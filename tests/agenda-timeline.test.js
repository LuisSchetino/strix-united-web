import test from "node:test";
import assert from "node:assert/strict";
import { buildAgendaTimeline, easeOutExpo, sceneAt } from "../src/features/media/agenda-timeline.js";
import {
  finaleDensity,
  finaleRowLayout,
  finaleRowZones,
  logoDrawRect,
  matchStagePresence,
  measureSafeZones,
  paintAgendaFrame,
  typeScale,
} from "../src/features/media/agenda-paint.js";
import { renderAgendaFrame } from "../src/features/media/agenda-frame.js";
import { AGENDA_TEMPLATE_VERSION } from "../src/features/media/agenda-media-core.js";
import { readFile } from "node:fs/promises";

function matches(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    opponent: index === 0 ? "Winner Elevens" : `Time ${index + 1}`,
    kickoff: `${22 + index}:10`,
    competition: "Superliga Yeshua",
    round: "Rodada 9",
  }));
}

function mockContext() {
  const calls = [];
  const ctx = {
    calls,
    font: "",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    letterSpacing: "0",
    save() { calls.push("save"); },
    restore() { calls.push("restore"); },
    beginPath() { calls.push("beginPath"); },
    closePath() { calls.push("closePath"); },
    clip() { calls.push("clip"); },
    fill() { calls.push("fill"); },
    stroke() { calls.push("stroke"); },
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    strokeRect(...args) { calls.push(["strokeRect", ...args]); },
    fillText(text, x, y) { calls.push(["fillText", text, x, y]); },
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    rect(...args) { calls.push(["rect", ...args]); },
    translate() {},
    scale() {},
    drawImage() { calls.push("drawImage"); },
    measureText(text) { return { width: String(text).length * 12 }; },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
  };
  return ctx;
}

test("timeline adapta beats e nunca sai da safe area do Instagram", () => {
  const one = buildAgendaTimeline(matches(1), { format: "story" });
  const five = buildAgendaTimeline(matches(5), { format: "story" });
  const feed = buildAgendaTimeline(matches(3), { format: "feed" });
  assert.equal(one.scenes.filter((scene) => scene.type === "page").length, 1);
  assert.equal(five.scenes.filter((scene) => scene.type === "page").length, 2);
  const seven = buildAgendaTimeline(matches(7), { format: "story" });
  assert.equal(seven.scenes.filter((scene) => scene.type === "page").length, 2);
  const pageBeat = five.scenes.find((scene) => scene.type === "page").end - five.scenes.find((scene) => scene.type === "page").start;
  assert.equal(pageBeat, 4.35);
  assert.equal(five.scenes.filter((scene) => scene.type === "page").flatMap((page) => page.matches).length, 5);
  assert.equal(one.scenes.filter((scene) => scene.type === "lockup").length, 0);
  assert.deepEqual(measureSafeZones(one), {
    format: "story",
    width: 1080,
    height: 1920,
    top: 210,
    bottom: 320,
    side: 72,
    contentHeight: 1390,
  });
  assert.equal(feed.width, 1080);
  assert.equal(feed.height, 1350);
  assert.equal(feed.safe.top, 110);
  assert.equal(one.totalFrames, Math.round(one.duration * one.fps));
  assert.equal(sceneAt(one, 0.2).type, "intro");
  assert.equal(sceneAt(one, one.finaleStart + 0.1).type, "finale");
  assert.equal(sceneAt(one, Math.max(0, one.duration - 0.05)).type, "finale");
  assert.ok(one.introEnd >= 2);
  assert.ok(Math.abs(one.duration - one.finaleStart - 2.5) < 0.001);
  assert.ok(typeScale("story").title >= 110);
  assert.ok(typeScale("story").kickoff >= 110);
  const box = typeScale("story").logoMatch;
  const left = logoDrawRect({ bitmap: { width: 512, height: 400 } }, box);
  const right = logoDrawRect({ bitmap: { width: 200, height: 200 } }, box);
  assert.ok(Math.max(left.dw, left.dh) <= box + 0.01);
  assert.ok(Math.max(right.dw, right.dh) <= box + 0.01);
  assert.equal(Math.max(left.dw, left.dh).toFixed(1), Math.max(right.dw, right.dh).toFixed(1));
});

test("easing premium não é linear e o render cobre abertura, páginas completas e encerramento", () => {
  assert.ok(easeOutExpo(0.2) > 0.2);
  assert.ok(easeOutExpo(0.2) > easeOutExpo(0.1));
  const timeline = buildAgendaTimeline(matches(3), { format: "story" });
  const ctx = mockContext();
  const assets = {
    strix: { bitmap: null, initials: "SU", name: "Strix United" },
    opponents: matches(3).map((match) => ({ bitmap: null, initials: "WE", name: match.opponent })),
  };
  renderAgendaFrame(ctx, { timeline, time: 0.8, assets, dayLabel: "02 SET 2026" });
  renderAgendaFrame(ctx, { timeline, time: timeline.introEnd + 0.6, assets, dayLabel: "02 SET 2026" });
  renderAgendaFrame(ctx, { timeline, time: timeline.finaleStart + 0.8, assets, dayLabel: "02 SET 2026" });
  renderAgendaFrame(ctx, { timeline, time: Math.max(0, timeline.duration - 0.2), assets, dayLabel: "02 SET 2026" });
  const texts = ctx.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
  assert.ok(texts.includes("AGENDA"));
  assert.ok(texts.includes("DO DIA"));
  assert.ok(texts.includes("HOJE"), "a página é a grade de horários de hoje");
  assert.ok(texts.includes("STRIX UNITED"));
  assert.ok(texts.includes("A NOITE COMEÇA ÀS"), "o encerramento usa o primeiro horário real da noite");
  assert.ok(texts.some((text) => String(text).toUpperCase().includes("WINNER")));
  const lateMatch = mockContext();
  const lastPage = timeline.scenes.filter((scene) => scene.type === "page").at(-1);
  renderAgendaFrame(lateMatch, { timeline, time: lastPage.end - 0.04, assets, dayLabel: "02 SET 2026" });
  const lateTexts = lateMatch.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
  assert.ok(!lateTexts.includes("A NOITE COMEÇA ÀS"));
  const lateIntro = mockContext();
  renderAgendaFrame(lateIntro, { timeline, time: timeline.introEnd - 0.04, assets, dayLabel: "02 SET 2026" });
  const introTexts = lateIntro.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
  assert.ok(!introTexts.includes("HOJE"));
  assert.equal(timeline.scenes.at(-1).type, "finale");
});

test("nova identidade invalida o render anterior e mantém Strix em todas as páginas", () => {
  assert.equal(AGENDA_TEMPLATE_VERSION, "agenda-nightshift-v3");
  const timeline = buildAgendaTimeline(matches(5), { format: "story" });
  const assets = {
    strix: { bitmap: null, initials: "SU", name: "Strix United" },
    opponents: matches(5).map((match) => ({ bitmap: null, initials: "WE", name: match.opponent })),
  };
  const beat = timeline.scenes.find((scene) => scene.type === "page").end
    - timeline.scenes.find((scene) => scene.type === "page").start;
  const times = [
    timeline.introEnd + 0.2,
    timeline.introEnd + 1.1,
    timeline.introEnd + beat - 0.1,
    timeline.introEnd + beat + 0.12,
    timeline.introEnd + beat * 2 - 0.1,
  ];
  for (const time of times) {
    const ctx = mockContext();
    renderAgendaFrame(ctx, { timeline, time, assets, dayLabel: "02 SET 2026" });
    const texts = ctx.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
    assert.ok(texts.some((text) => String(text).includes("STRIX UNITED")), `STRIX UNITED em ${time}`);
    assert.ok(texts.some((text) => /^\d{2}:\d{2}$/.test(String(text))), `horário do jogo em ${time}`);
  }
  const finale = mockContext();
  renderAgendaFrame(finale, { timeline, time: timeline.finaleStart + 0.14, assets, dayLabel: "02 SET 2026" });
  const finaleTexts = finale.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
  assert.ok(finaleTexts.includes("A NOITE COMEÇA ÀS"));
  assert.ok(finaleTexts.includes(timeline.matches[0].kickoff), "o horário do encerramento é o do primeiro jogo");
});

test("agenda completa adapta 3/5/6 jogos e separa competição do matchup", () => {
  const long = (count) => Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    opponent: index % 2 ? "Sinceridade" : "POA City FC",
    kickoff: `${21 + index}:10`,
    competition: index % 2 ? "MASTER LEAGUE" : "SUPERLIGA YESHUA",
    round: "",
  }));
  assert.equal(finaleDensity(3), "spacious");
  assert.equal(finaleDensity(5), "medium");
  assert.equal(finaleDensity(6), "compact");
  for (const count of [3, 5, 6]) {
    const timeline = buildAgendaTimeline(long(count), { format: "story" });
    const layout = finaleRowLayout(timeline);
    assert.equal(layout.density, finaleDensity(count));
    assert.ok(layout.minCompGap >= 18);
    if (count === 5) {
      const safeW = timeline.width - timeline.safe.side * 2;
      assert.ok(layout.span >= safeW * 0.78);
      assert.ok(layout.logoBox >= 70);
    }
    for (let index = 0; index < count; index += 1) {
      const zones = finaleRowZones(layout, index);
      assert.ok(zones.compY - zones.matchupBottom >= layout.minCompGap - 0.01);
      assert.ok(zones.timeY < zones.matchupMid);
      assert.ok(zones.matchupMid - zones.timeY >= layout.timeGap);
      assert.ok(layout.timeGap >= 18);
      assert.ok(zones.compY < layout.endY + 0.01);
    }
    const ctx = mockContext();
    paintAgendaFrame(ctx, { timeline, time: timeline.finaleStart + 0.8, assets: {
      strix: { bitmap: null, initials: "SU", name: "Strix United" },
      opponents: long(count).map((match) => ({ bitmap: null, initials: "WE", name: match.opponent })),
    }, dayLabel: "02 SET 2026" });
    const texts = ctx.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
    assert.ok(texts.includes("AGENDA COMPLETA"));
    assert.ok(texts.some((text) => String(text).includes("SUPERLIGA YESHUA")));
    assert.ok(texts.some((text) => String(text).includes("MASTER LEAGUE")));
  }
});

test("opening v7 é tipográfico e o painter separa palco de conteúdo variável", async () => {
  const paint = await readFile(new URL("../src/features/media/agenda-paint.js", import.meta.url), "utf8");
  assert.match(paint, /paintMatchStagePersistent/);
  assert.match(paint, /paintMatchVariableContent/);
  assert.doesNotMatch(paint, /logoIntro/);
  assert.doesNotMatch(paint, /MASTER LEAGUE/);
  assert.doesNotMatch(paint, /SUPERLIGA YESHUA/);
  const timeline = buildAgendaTimeline(matches(3), { format: "story" });
  const ctx = mockContext();
  paintAgendaFrame(ctx, {
    timeline,
    time: 1.4,
    assets: { strix: { bitmap: null, initials: "SU", name: "Strix United" }, opponents: [] },
    dayLabel: "02 SET 2026",
  });
  const texts = ctx.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
  assert.ok(texts.includes("AGENDA"));
  assert.ok(texts.includes("DO DIA"));
  assert.ok(texts.includes("03 JOGOS"));
  assert.ok(typeScale("story").title >= 170);
});

test("zero jogos não produz composição renderizável", () => {
  const empty = buildAgendaTimeline([], { format: "story" });
  assert.equal(empty.totalFrames, 0);
  assert.equal(empty.duration, 0);
  assert.equal(empty.scenes.length, 0);
});
