import test from "node:test";
import assert from "node:assert/strict";
import {
  RELATED_NIGHT_TEMPLATE_VERSION,
  collectTonightRelated,
  describeTonightRelated,
  fingerprintRelatedNightRender,
  positionGroup,
  relatedNightDurationSeconds,
  relatedNightFileName,
  suggestRelatedFromLineups,
} from "../src/features/media/related-night-core.js";

const day = "2026-09-02T18:00:00-03:00";

const roster = [
  { id: "p1", display_name: "João", positions: ["GOL"], avatar_path: "joao.png", is_active: true, shirt_number: 1 },
  { id: "p2", display_name: "Arruda", positions: ["GOL"], avatar_path: "arruda.png", is_active: true },
  { id: "p3", display_name: "Ygo", positions: ["ZAG"], avatar_path: "ygo.png", is_active: true },
  { id: "p4", display_name: "Sampaio", positions: ["ZAG"], avatar_path: "sampaio.png", is_active: true },
  { id: "p5", display_name: "Cedraz", positions: ["ZAG"], avatar_path: "cedraz.png", is_active: true },
  { id: "p6", display_name: "Léo", positions: ["ZAG"], avatar_path: "leo.png", is_active: true },
  { id: "p7", display_name: "Oben", positions: ["VOL"], avatar_path: "oben.png", is_active: true },
  { id: "p8", display_name: "Nunes", positions: ["MC"], avatar_path: "nunes.png", is_active: true },
  { id: "p9", display_name: "Kestol", positions: ["MC"], avatar_path: "kestol.png", is_active: true },
  { id: "p10", display_name: "Dudu", positions: ["MEI"], avatar_path: "dudu.png", is_active: true },
  { id: "p11", display_name: "Biel", positions: ["ALA"], avatar_path: "biel.png", is_active: true },
  { id: "p12", display_name: "Santozz", positions: ["ATA"], avatar_path: "santozz.png", is_active: true },
  { id: "p13", display_name: "Vini", positions: ["ATA"], avatar_path: "vini.png", is_active: true },
];

function workspaceWith({ agenda = [], players = roster, nightRelated = [] } = {}) {
  return {
    agenda,
    players,
    nightRelated,
    assetUrl: (path) => `/storage/${path}`,
  };
}

function todayLineups(namesByMatch) {
  return namesByMatch.map((names, index) => ({
    id: `m${index}`,
    opponent_name: `Adversário ${index + 1}`,
    scheduled_at: `2026-09-02T2${index + 1}:10:00-03:00`,
    status: "scheduled",
    lineup: names,
  }));
}

const thirteenIds = roster.map((player) => player.id);
const twelveLineupNames = roster.slice(0, 12).map((player) => player.display_name);

test("sem lista salva as escalações não viram source of truth do vídeo", () => {
  const workspace = workspaceWith({
    agenda: todayLineups([twelveLineupNames, ["João", "Nunes"]]),
  });
  const state = describeTonightRelated(workspace, new Date(day));
  assert.equal(state.saved, false);
  assert.equal(state.day, "2026-09-02");
  assert.equal(collectTonightRelated(workspace, new Date(day)).length, 0);
  assert.equal(state.suggestion.length, 12);
  assert.ok(state.suggestion.some((player) => player.name === "João"));
  assert.equal(state.suggestion.find((player) => player.name === "João").photo, "/storage/joao.png");
});

test("PREENCHER PELAS ESCALAÇÕES une lineups de hoje e ignora amanhã", () => {
  const suggested = suggestRelatedFromLineups(workspaceWith({
    agenda: [
      ...todayLineups([["João", "Ygo", "Oben"], ["João", "Nunes"]]),
      {
        id: "tomorrow",
        opponent_name: "Amanhã FC",
        scheduled_at: "2026-09-03T22:10:00-03:00",
        status: "scheduled",
        lineup: ["Fantasma"],
      },
    ],
  }), new Date(day));
  assert.equal(suggested.find((row) => row.name === "Fantasma"), undefined);
  assert.equal(suggested.filter((row) => row.name === "João").length, 1);
  assert.ok(suggested.some((row) => row.name === "Nunes"));
  assert.equal(suggested.find((row) => row.name === "João").group, "GOL");
  assert.equal(suggested.find((row) => row.name === "João").number, 1);
});

test("13 relacionados salvos prevalecem mesmo com só 12 nas escalações", () => {
  const workspace = workspaceWith({
    agenda: todayLineups([twelveLineupNames]),
    nightRelated: [{ night_date: "2026-09-02", player_ids: thirteenIds }],
  });
  const state = describeTonightRelated(workspace, new Date(day));
  const video = collectTonightRelated(workspace, new Date(day));
  assert.equal(state.saved, true);
  assert.equal(state.suggestion.length, 12);
  assert.equal(video.length, 13);
  assert.ok(video.some((player) => player.id === "p13" && player.name === "Vini"));
  assert.equal(state.suggestion.find((player) => player.id === "p13"), undefined);
  assert.equal(video.filter((player) => player.group === "GOL").length, 2);
  assert.equal(video.filter((player) => player.group === "DEF").length, 4);
  assert.equal(video.filter((player) => player.group === "MEI").length, 5);
  assert.equal(video.filter((player) => player.group === "ATA").length, 2);
});

test("lista salva editada substitui a sugestão das escalações", () => {
  const workspace = workspaceWith({
    agenda: todayLineups([twelveLineupNames]),
    nightRelated: [{ night_date: "2026-09-02", player_ids: ["p1", "p13"] }],
  });
  const video = collectTonightRelated(workspace, new Date(day));
  assert.deepEqual(video.map((player) => player.id).sort(), ["p1", "p13"]);
  assert.equal(suggestRelatedFromLineups(workspace, new Date(day)).length, 12);
});

test("agrupa posições sem linguagem de reserva", () => {
  assert.equal(positionGroup("GOL"), "GOL");
  assert.equal(positionGroup("ZAG"), "DEF");
  assert.equal(positionGroup("VOL"), "MEI");
  assert.equal(positionGroup("ALA"), "MEI");
  assert.equal(positionGroup("ATA"), "ATA");
});

test("fingerprint considera a lista salva e muda quando ela muda", async () => {
  const base = {
    day: "2026-09-02",
    format: "story",
    saved: true,
    templateVersion: RELATED_NIGHT_TEMPLATE_VERSION,
    players: [{ id: "p1", name: "João", photo: "a.png", position: "GOL", group: "GOL" }],
  };
  const original = await fingerprintRelatedNightRender(base);
  const same = await fingerprintRelatedNightRender({
    ...base,
    players: [{ ...base.players[0] }],
  });
  const moved = await fingerprintRelatedNightRender({
    ...base,
    players: [{ ...base.players[0], photo: "b.png" }],
  });
  const extra = await fingerprintRelatedNightRender({
    ...base,
    players: [...base.players, { id: "p13", name: "Vini", photo: "c.png", position: "ATA", group: "ATA" }],
  });
  assert.equal(original, same);
  assert.notEqual(original, moved);
  assert.notEqual(original, extra);
});

test("duração cabe no formato social para 11, 13 e 15", () => {
  assert.equal(relatedNightDurationSeconds(0), 0);
  for (const count of [11, 13, 15]) {
    const duration = relatedNightDurationSeconds(count);
    assert.ok(duration >= 18 && duration <= 24, `${count} -> ${duration}`);
  }
  assert.equal(relatedNightFileName({ day: "2026-09-02", format: "story" }), "strix-relacionados-2026-09-02-story.mp4");
});
