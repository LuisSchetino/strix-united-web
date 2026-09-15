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
import { personVariant, campaignName, fitNameLayout, announceGridSpec } from "../src/features/media/announce-look.js";
import { composeAnnounceFx, listAnnounceFxSlots, missingAnnounceFx, ANNOUNCE_FX_SLOTS, ANNOUNCE_FX_SKIPPED } from "../src/features/media/announce-fx.js";
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
    globalCompositeOperation: "source-over",
    textAlign: "left",
    textBaseline: "alphabetic",
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    clip() {},
    rect() {},
    fill() {},
    stroke() {},
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    fillText(text) { calls.push(["fillText", text]); },
    moveTo() {},
    lineTo() {},
    arc() {},
    quadraticCurveTo() {},
    setLineDash() {},
    ellipse() {},
    translate() {},
    scale() {},
    rotate() {},
    drawImage() {},
    measureText(text) { return { width: String(text).length * 12 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
}

test("elenco ativo usa structure_role oficial e ignora teste/inativo", () => {
  const people = collectAnnouncePeople({
    ...workspace(),
    players: workspace().players.map((player) => player.id === "p1" ? { ...player, structure_role: "diretoria" } : player),
  });
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

test("duração individual fica entre 8s e 12s e o time não é comprimido", () => {
  assert.equal(announceDurationSeconds({ kind: "individual", format: "story" }), 10.6);
  assert.equal(announceDurationSeconds({ kind: "individual", format: "feed" }), 0.04);
  const four = announceTeamTiming(4);
  const eight = announceTeamTiming(8);
  const large = announceTeamTiming(18);
  assert.ok(four.beat >= 3 && four.beat <= 4);
  assert.ok(four.readable >= 2.5);
  assert.ok(eight.duration > 22);
  assert.equal(eight.pages, 2);
  assert.ok(large.duration > eight.duration);
  const eightPeople = Array.from({ length: 8 }, (_, index) => ({ id: `p${index + 1}`, name: `Jogador ${index + 1}` }));
  const eightTimeline = buildAnnounceTimeline({ kind: "team", format: "story", people: eightPeople, title: "ELENCO FC 27" });
  const eightPages = eightTimeline.scenes.filter((scene) => scene.type === "finale");
  assert.equal(eightPages.length, 2);
  assert.equal(eightPages[0].people.length, 4);
  assert.equal(eightPages[1].people.length, 4);
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
      assert.equal(describeAnnounceFrame(timeline, 3.2).sceneType, "hero");
      assert.equal(describeAnnounceFrame(timeline, 5).sceneType, "reframe");
      assert.equal(describeAnnounceFrame(timeline, 7).sceneType, "detail");
      assert.equal(describeAnnounceFrame(timeline, timeline.duration - 0.2).sceneType, "close");
      assert.equal(timeline.duration, 10.6);
    } else {
      assert.equal(describeAnnounceFrame(timeline, 0.3).sceneType, "intro");
      assert.equal(describeAnnounceFrame(timeline, timeline.introEnd + 0.2).sceneType, "person");
      assert.equal(describeAnnounceFrame(timeline, timeline.duration - 0.1).sceneType, "finale");
      const hero = timeline.scenes.find((scene) => scene.type === "person");
      assert.ok(hero.end - hero.start >= 3 && hero.end - hero.start <= 4);
      assert.equal(timeline.look.variants[0], "left");
      assert.equal(personVariant(1), "center");
      assert.equal(personVariant(2), "tight");
      assert.equal(personVariant(3), "left");
    }
    const ctx = mockContext();
    renderAnnounceFrame(ctx, { timeline, timeSec: announceFrameTime(0, timeline), assets: { players: [], byId: {} } });
    const names = ctx.calls.filter((call) => call[0] === "fillText").map((call) => call[1]).join(" ");
    assert.ok(names.includes("STRIX") || names.includes("OBEEN") || names.includes("ELENCO") || names.includes("PLANTEL"));
  }
});

test("v3.1 names wrap, team post uses 2x4, and missing FX do not paint", () => {
  assert.equal(campaignName({ nick: "OBEEN", name: "Oben" }), "OBEEN");
  assert.equal(campaignName({ name: "Santozz" }), "SANTOZZ");
  const ctx = mockContext();
  const long = fitNameLayout(ctx, "João Pedro da Silva Extra", 240, 72, 40);
  assert.equal(long.lines.length, 2);
  assert.ok(long.size <= 72);
  assert.equal(announceGridSpec(8, "feed").cols, 2);
  assert.equal(announceGridSpec(15, "feed").cols, 3);
  assert.equal(announceGridSpec(4, "story").cols, 2);
  assert.equal(listAnnounceFxSlots().length, 4);
  assert.ok(ANNOUNCE_FX_SLOTS.lightSweep01.path.includes("light-rays-sweep-01.mp4"));
  assert.ok(ANNOUNCE_FX_SLOTS.flare01.path.includes("light-leak-warm-01.mp4"));
  assert.equal(ANNOUNCE_FX_SLOTS.brush01, undefined);
  assert.ok(ANNOUNCE_FX_SLOTS.inkReveal01.path.includes("ink-alpha-matte-01.mp4"));
  assert.ok(ANNOUNCE_FX_SLOTS.smoke01.path.includes("smoke-wisps-01.mp4"));
  assert.equal(ANNOUNCE_FX_SLOTS.inkReveal01.blendMode, "destination-in");
  assert.ok(ANNOUNCE_FX_SKIPPED.some((item) => item.path.includes("brush-transition-01.mp4")));
  assert.ok(ANNOUNCE_FX_SKIPPED.some((item) => item.path.includes("water-caustics-01.mp4")));
  assert.ok(ANNOUNCE_FX_SKIPPED.some((item) => item.path.includes("smoke-black-mixkit-01.mp4")));
  const missing = missingAnnounceFx({});
  assert.equal(missing.length, listAnnounceFxSlots().length);
  assert.equal(composeAnnounceFx(ctx, { bitmap: null }, { x: 0, y: 0, w: 100, h: 100, alpha: 1 }), false);
});
