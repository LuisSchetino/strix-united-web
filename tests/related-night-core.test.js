import test from "node:test";
import assert from "node:assert/strict";
import {
  RELATED_NIGHT_TEMPLATE_VERSION,
  collectTonightRelated,
  describeTonightRelated,
  fingerprintRelatedNightRender,
  hydrateRelatedPlayers,
  positionGroup,
  relatedNightDurationSeconds,
  relatedNightFileName,
  squadFaces,
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

test("com escalação, o vídeo mostra quem joga: um nome salvo que não está em nenhuma escalação fica de fora", () => {
  const workspace = workspaceWith({
    agenda: todayLineups([twelveLineupNames]),
    nightRelated: [{ night_date: "2026-09-02", player_ids: thirteenIds }],
  });
  const state = describeTonightRelated(workspace, new Date(day));
  const video = collectTonightRelated(workspace, new Date(day));
  assert.equal(state.saved, true);
  assert.equal(state.suggestion.length, 12);
  // The saved list is what the editor shows; the video is who is in tonight's line-ups.
  assert.equal(state.players.length, 13);
  assert.equal(video.length, 12);
  assert.equal(video.find((player) => player.id === "p13"), undefined);
  // The pitch is the first game's eleven; whoever is listed beyond it goes to the strip.
  assert.equal(video.filter((player) => player.slot != null).length, 11);
  assert.equal(new Set(video.filter((player) => player.slot != null).map((player) => player.slot)).size, 11);
  assert.equal(video.filter((player) => player.bench).length, 1);
});

test("a faixa de relacionados é quem joga os outros jogos da noite", () => {
  const first = twelveLineupNames.slice(0, 11), second = [twelveLineupNames[0], twelveLineupNames[11]];
  const workspace = workspaceWith({
    agenda: todayLineups([first, second]),
    nightRelated: [{ night_date: "2026-09-02", player_ids: ["p1"] }],
  });
  const video = collectTonightRelated(workspace, new Date(day));
  assert.equal(video.length, 12);
  assert.equal(video.filter((player) => player.slot != null).length, 11);
  const strip = video.filter((player) => player.bench);
  assert.equal(strip.length, 1);
  assert.equal(strip[0].name, twelveLineupNames[11]);
});

test("sem escalação no primeiro jogo, a lista fica como era: por setor, sem banco", () => {
  const workspace = workspaceWith({ agenda: [], nightRelated: [{ night_date: "2026-09-02", player_ids: thirteenIds }] });
  const video = collectTonightRelated(workspace, new Date(day));
  assert.equal(video.length, 13);
  assert.equal(video.some((player) => player.bench || player.slot != null), false);
});

test("sem lista salva não há vídeo, mesmo com escalações", () => {
  const workspace = workspaceWith({ agenda: todayLineups([twelveLineupNames]) });
  assert.equal(collectTonightRelated(workspace, new Date(day)).length, 0);
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

test("número da camisa vem do Elenco e não é inventado", () => {
  const workspace = workspaceWith();
  const joao = hydrateRelatedPlayers(["p1"], workspace)[0];
  const arruda = hydrateRelatedPlayers(["p2"], workspace)[0];
  assert.equal(joao.name, "João");
  assert.equal(joao.number, 1);
  assert.equal(joao.position, "GOL");
  assert.equal(arruda.name, "Arruda");
  assert.equal(arruda.number, "");
});

test("o rosto da peça só pode ser de quem está no elenco atual e tem foto", () => {
  const workspace = {
    assetUrl: (path) => `/media/${path}`,
    players: [
      { id: "a", display_name: "Zeca", avatar_path: "zeca.png", is_active: true, member_type: "elenco" },
      { id: "b", display_name: "Ana", avatar_path: "ana.png", is_active: true, member_type: "complete" },
      { id: "c", display_name: "Saiu", avatar_path: "saiu.png", is_active: false, member_type: "elenco" },
      { id: "d", display_name: "Teste", avatar_path: "teste.png", is_active: true, member_type: "teste" },
      { id: "e", display_name: "Sem Foto", is_active: true, member_type: "elenco" },
    ],
  };
  assert.deepEqual(squadFaces(workspace).map((player) => player.name), ["Ana", "Zeca"]);
  assert.deepEqual(squadFaces({}), []);
});
