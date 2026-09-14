import test from "node:test";
import assert from "node:assert/strict";
import {
  ANNOUNCE_PHRASES,
  announceDurationSeconds,
  announceFileName,
  announceTeamTiming,
  collectAnnouncePeople,
  fillAnnouncePhrase,
  fingerprintAnnounceRender,
  pickAnnouncePhrase,
  resolveAnnouncePhrase,
} from "../src/features/media/announce-core.js";
import { buildAnnounceTimeline } from "../src/features/media/announce-timeline.js";
import { announceFrameTime, describeAnnounceFrame, renderAnnounceFrame } from "../src/features/media/announce-frame.js";

const roster = [
  { id: "p1", display_name: "Oben", positions: ["MC"], avatar_path: "oben.png", is_active: true, member_type: "elenco" },
  { id: "p2", display_name: "Santozz", positions: ["ATA"], external_avatar_url: "https://img/santozz.png", is_active: true, member_type: "complete" },
  { id: "p3", display_name: "Cedraz", positions: ["ZAG"], is_active: true, member_type: "elenco" },
  { id: "p4", display_name: "Teste", positions: ["MC"], is_active: true, member_type: "teste" },
  { id: "p5", display_name: "Inativo", positions: ["GOL"], is_active: false, member_type: "elenco" },
  { id: "p6", display_name: "João Pedro da Silva Extra", positions: ["GOL"], is_active: true, member_type: "elenco" },
];

function workspace() {
  return {
    players: roster,
    aliases: [{ player_id: "p1", ea_name: "OBEEN" }],
    assetUrl: (path) => `/storage/${path}`,
  };
}

function mockContext() {
  const calls = [];
  return {
    calls,
    font: "",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    clip() {},
    fill() {},
    stroke() {},
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    fillText(text) { calls.push(["fillText", text]); },
    moveTo() {},
    lineTo() {},
    arc() {},
    translate() {},
    scale() {},
    drawImage() {},
    measureText(text) { return { width: String(text).length * 12 }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
}

test("elenco ativo vira source of truth e ignora teste/inativo", () => {
  const people = collectAnnouncePeople(workspace(), { p1: "diretoria" });
  assert.equal(people.some((person) => person.name === "Teste"), false);
  assert.equal(people.some((person) => person.name === "Inativo"), false);
  const oben = people.find((person) => person.id === "p1");
  assert.equal(oben.nick, "OBEEN");
  assert.equal(oben.position, "MC");
  assert.equal(oben.photo, "/storage/oben.png");
  assert.equal(oben.extraRole, "diretoria");
  assert.equal(oben.extraBadge, "DIRETORIA");
  const santozz = people.find((person) => person.id === "p2");
  assert.equal(santozz.photo, "https://img/santozz.png");
  const cedraz = people.find((person) => person.id === "p3");
  assert.equal(cedraz.photo, "");
});

test("frases cobrem o tom da temporada e aceitam variáveis", () => {
  assert.ok(ANNOUNCE_PHRASES.length >= 15 && ANNOUNCE_PHRASES.length <= 20);
  const person = { id: "p1", name: "Oben", position: "MC", extraRole: "diretoria", extraBadge: "DIRETORIA" };
  const filled = fillAnnouncePhrase("{nome} · {posição} · {temporada} · {funçãoExtra}", person);
  assert.equal(filled, "Oben · MC · FC 27 · DIRETORIA");
  const auto = resolveAnnouncePhrase(person, { type: "diretoria" });
  assert.equal(auto.source, "auto");
  assert.ok(auto.text.length > 8);
  const chosen = resolveAnnouncePhrase(person, { type: "jogador", phraseId: "chapter" });
  assert.equal(chosen.id, "chapter");
  const custom = resolveAnnouncePhrase(person, { custom: "Pronto, {nome}." });
  assert.equal(custom.text, "Pronto, Oben.");
  const shuffled = pickAnnouncePhrase(person, { type: "jogador", currentId: "next-season" });
  assert.notEqual(shuffled.id, "next-season");
});

test("duração individual fica entre 7s e 12s e o time adapta entre 10s e 22s", () => {
  assert.equal(announceDurationSeconds({ kind: "individual", format: "story" }), 9);
  assert.equal(announceDurationSeconds({ kind: "individual", format: "feed" }), 0.04);
  const small = announceTeamTiming(3);
  const large = announceTeamTiming(18);
  assert.ok(small.duration >= 10 && small.duration <= 22);
  assert.ok(large.duration >= 10 && large.duration <= 22);
  assert.equal(announceFileName({ kind: "individual", format: "story", name: "Oben" }), "strix-anuncio-individual-oben-reels.mp4");
  assert.equal(announceFileName({ kind: "team", format: "feed", title: "ELENCO FC 27" }), "strix-anuncio-elenco-elenco-fc-27-post.png");
});

test("fingerprint muda com ordem, frase e função extra", async () => {
  const people = collectAnnouncePeople(workspace(), { p1: "diretoria" });
  const base = { kind: "team", format: "story", people: people.slice(0, 3), title: "ELENCO FC 27", phrase: "ok" };
  const original = await fingerprintAnnounceRender(base);
  const same = await fingerprintAnnounceRender({ ...base, people: people.slice(0, 3) });
  const reordered = await fingerprintAnnounceRender({ ...base, people: [people[2], people[0], people[1]] });
  const phrased = await fingerprintAnnounceRender({ ...base, phrase: "outra" });
  assert.equal(original, same);
  assert.notEqual(original, reordered);
  assert.notEqual(original, phrased);
});

test("os 4 modos montam timeline e o painter escreve o nome", () => {
  const people = collectAnnouncePeople(workspace(), { p1: "diretoria" });
  const individual = people[0];
  const modes = [
    { kind: "individual", format: "story", people: [individual], phrase: "Pronto para escrever a próxima temporada." },
    { kind: "individual", format: "feed", people: [individual], phrase: "Mais uma peça confirmada para o FC 27." },
    { kind: "team", format: "story", people, title: "ELENCO FC 27" },
    { kind: "team", format: "feed", people, title: "PLANTEL FC 27" },
  ];
  for (const mode of modes) {
    const timeline = buildAnnounceTimeline(mode);
    assert.ok(timeline.totalFrames >= 1);
    assert.equal(timeline.width, mode.format === "feed" ? 1080 : 1080);
    assert.equal(timeline.height, mode.format === "feed" ? 1350 : 1920);
    if (mode.format === "feed") {
      assert.equal(timeline.still, true);
      assert.equal(timeline.totalFrames, 1);
      assert.equal(describeAnnounceFrame(timeline, 0).sceneType === "still" || describeAnnounceFrame(timeline, 0).sceneType === "grid", true);
    } else if (mode.kind === "individual") {
      assert.equal(describeAnnounceFrame(timeline, 0.2).sceneType, "intro");
      assert.equal(describeAnnounceFrame(timeline, 4).sceneType, "hold");
      assert.equal(describeAnnounceFrame(timeline, timeline.duration - 0.2).sceneType, "close");
      assert.equal(timeline.duration, 9);
    } else {
      assert.equal(describeAnnounceFrame(timeline, 0.3).sceneType, "intro");
      assert.equal(describeAnnounceFrame(timeline, timeline.introEnd + 0.2).sceneType, "person");
      assert.equal(describeAnnounceFrame(timeline, timeline.duration - 0.1).sceneType, "finale");
    }
    const ctx = mockContext();
    renderAnnounceFrame(ctx, { timeline, timeSec: announceFrameTime(0, timeline), assets: { players: [], byId: {} } });
    const names = ctx.calls.filter((call) => call[0] === "fillText").map((call) => call[1]).join(" ");
    assert.ok(names.includes("STRIX") || names.includes("OBEEN") || names.includes("ELENCO") || names.includes("PLANTEL"));
  }
});
