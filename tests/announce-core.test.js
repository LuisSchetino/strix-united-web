import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
import { personVariant, campaignName, fitNameLayout, announceGridSpec, fitAnnounceSubject, headVisibleInDest, announceRoleInk, announceRoleLook } from "../src/features/media/announce-look.js";
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
    strokeRect() {},
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
      assert.equal(describeAnnounceFrame(timeline, 1.8).sceneType, "reveal");
      assert.equal(describeAnnounceFrame(timeline, 3.2).sceneType, "hero");
      assert.equal(describeAnnounceFrame(timeline, 5.2).sceneType, "reframe");
      assert.equal(describeAnnounceFrame(timeline, 7.2).sceneType, "detail");
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
    assert.ok(names.includes("STRIX") || names.includes("OBEN") || names.includes("ELENCO") || names.includes("PLANTEL"));
  }
});

test("v3.1 names wrap, team post uses 2x4, and missing FX do not paint", () => {
  assert.equal(campaignName({ nick: "OBEEN", name: "Oben" }), "OBEN");
  assert.equal(campaignName({ name: "Santozz" }), "SANTOZZ");
  assert.equal(campaignName({ nick: "39ygo", name: "YGO" }), "YGO");
  assert.equal(campaignName({ name: "Júlio" }), "JÚLIO");
  const ctx = mockContext();
  const long = fitNameLayout(ctx, "João Pedro da Silva Extra", 240, 72, 40);
  assert.equal(long.lines.length, 2);
  assert.ok(long.size <= 72);
  assert.equal(announceGridSpec(8, "feed").cols, 2);
  assert.equal(announceGridSpec(15, "feed").cols, 3);
  assert.equal(announceGridSpec(4, "story").cols, 2);
  assert.equal(announceGridSpec(1, "story").cols, 1);
  assert.equal(announceGridSpec(2, "story").cols, 2);
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

test("announce name follows Elencos display_name and ignores alias", () => {
  const people = collectAnnouncePeople(workspace());
  assert.equal(people[0].name, "Oben");
  assert.equal(people[0].nick, "OBEEN");
  assert.equal(campaignName(people[0]), "OBEN");
  const ctx = mockContext();
  const timeline = buildAnnounceTimeline({
    kind: "individual",
    format: "feed",
    people: [people[0]],
    phrase: "Mais uma peça confirmada para o FC 27.",
  });
  renderAnnounceFrame(ctx, { timeline, timeSec: 0, assets: { players: [], byId: {} } });
  const names = ctx.calls.filter((call) => call[0] === "fillText").map((call) => call[1]).join(" ");
  assert.ok(names.includes("OBEN"));
  assert.equal(names.includes("OBEEN"), false);
});

test("subject fit never crops the head out of the photo box", () => {
  const destW = 800;
  const destH = 850;
  const cutout = fitAnnounceSubject(
    { width: 800, height: 1600 },
    destW,
    destH,
    { crop: "cutout", alphaRatio: 0.4, contentTop: 0.02, contentBottom: 0.98, contentLeft: 0.18, contentRight: 0.82 },
    { scale: 1.34, focusY: 0.3 },
  );
  assert.equal(headVisibleInDest(cutout, destH), true);
  assert.ok(cutout.dy > -destH * 0.08);

  const misclassified = fitAnnounceSubject(
    { width: 700, height: 1800 },
    destW,
    destH,
    { crop: "portrait", alphaRatio: 0.22, contentTop: 0.04, contentBottom: 0.96, contentLeft: 0.2, contentRight: 0.8 },
    { scale: 1.4, focusY: 0.4 },
  );
  assert.equal(headVisibleInDest(misclassified, destH), true);

  const portrait = fitAnnounceSubject(
    { width: 900, height: 1200 },
    destW,
    destH,
    { crop: "portrait", alphaRatio: 0 },
    { scale: 1.34, focusY: 0.07 },
  );
  assert.equal(headVisibleInDest(portrait, destH), true);
  const eyeY = portrait.dy + portrait.dh * 0.22;
  assert.ok(eyeY > destH * 0.12 && eyeY < destH * 0.48);
});

test("role looks change the piece language, not only the badge ink", async () => {
  assert.equal(announceRoleInk("diretoria"), "#d4c4a0");
  assert.equal(announceRoleLook("diretoria").grade, "warm");
  assert.equal(announceRoleLook("diretoria").mark, "gold");
  assert.equal(announceRoleLook("conselho").grade, "stone");
  assert.equal(announceRoleLook("conselho").mark, "stone");
  assert.equal(announceRoleLook("staff").grade, "steel");
  assert.equal(announceRoleLook("manager").mark, "steel");
  assert.equal(announceRoleLook("jogador").grade, "mono");
  assert.equal(announceRoleInk("jogador"), "#9aa0a6");
  const paint = await readFile(new URL("../src/features/media/announce-paint.js", import.meta.url), "utf8");
  assert.doesNotMatch(paint, /Math\.sin\([^)]*\) \* 20/);
  assert.doesNotMatch(paint, /drift: Math\.sin/);
  assert.match(paint, /announceRoleLook/);
  assert.match(paint, /paintRoleAtmosphere/);
  assert.match(paint, /paintRoleMarks/);
  assert.match(paint, /paintRoleSweep/);
  assert.match(paint, /paintPhotoFlash/);
  assert.match(paint, /cinematicCamera\(timeline, time, local, stage\)/);
});

test("diretoria still preview paints cargo without collapsing it into position", () => {
  const ctx = mockContext();
  const person = {
    id: "p1",
    name: "Oben",
    nick: "OBEEN",
    position: "MC",
    extraRole: "diretoria",
    extraBadge: "DIRETORIA",
  };
  const timeline = buildAnnounceTimeline({
    kind: "individual",
    format: "feed",
    people: [person],
    phrase: "Direção alinhada.",
  });
  renderAnnounceFrame(ctx, { timeline, timeSec: 0, assets: { players: [], byId: {} } });
  const names = ctx.calls.filter((call) => call[0] === "fillText").map((call) => call[1]);
  assert.ok(names.includes("OBEN"));
  assert.ok(names.includes("MC"));
  assert.ok(names.includes("DIRETORIA"));
  assert.equal(names.some((text) => String(text).includes("MC") && String(text).includes("DIRETORIA")), false);
});
