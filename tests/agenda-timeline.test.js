import test from "node:test";
import assert from "node:assert/strict";
import { buildAgendaTimeline, easeOutExpo, sceneAt } from "../src/features/media/agenda-timeline.js";
import { logoDrawRect, measureSafeZones, paintAgendaFrame, typeScale } from "../src/features/media/agenda-paint.js";

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
  assert.equal(one.scenes.filter((scene) => scene.type === "match").length, 1);
  assert.equal(five.scenes.filter((scene) => scene.type === "match").length, 5);
  const seven = buildAgendaTimeline(matches(7), { format: "story" });
  assert.ok(one.scenes.find((scene) => scene.type === "match").end - one.scenes.find((scene) => scene.type === "match").start > 4);
  const fiveBeat = five.scenes.find((scene) => scene.type === "match").end - five.scenes.find((scene) => scene.type === "match").start;
  const sevenBeat = seven.scenes.find((scene) => scene.type === "match").end - seven.scenes.find((scene) => scene.type === "match").start;
  assert.ok(fiveBeat >= 2.4 && fiveBeat < 2.7);
  assert.ok(sevenBeat >= 2.1 && sevenBeat <= 2.3);
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
  assert.ok(one.duration - one.finaleStart >= 3.2);
  assert.ok(typeScale("story").title >= 110);
  assert.ok(typeScale("story").kickoff >= 110);
  const box = typeScale("story").logoMatch;
  const left = logoDrawRect({ bitmap: { width: 512, height: 400 } }, box);
  const right = logoDrawRect({ bitmap: { width: 200, height: 200 } }, box);
  assert.ok(Math.max(left.dw, left.dh) <= box + 0.01);
  assert.ok(Math.max(right.dw, right.dh) <= box + 0.01);
  assert.equal(Math.max(left.dw, left.dh).toFixed(1), Math.max(right.dw, right.dh).toFixed(1));
});

test("easing premium não é linear e o painter cobre intro, jogo e finale", () => {
  assert.ok(easeOutExpo(0.2) > 0.2);
  assert.ok(easeOutExpo(0.2) > easeOutExpo(0.1));
  const timeline = buildAgendaTimeline(matches(3), { format: "story" });
  const ctx = mockContext();
  const assets = {
    strix: { bitmap: null, initials: "SU", name: "Strix United" },
    opponents: matches(3).map((match) => ({ bitmap: null, initials: "WE", name: match.opponent })),
  };
  paintAgendaFrame(ctx, { timeline, time: 0.8, assets, dayLabel: "02 SET 2026" });
  paintAgendaFrame(ctx, { timeline, time: timeline.introEnd + 0.6, assets, dayLabel: "02 SET 2026" });
  paintAgendaFrame(ctx, { timeline, time: timeline.finaleStart + 0.8, assets, dayLabel: "02 SET 2026" });
  paintAgendaFrame(ctx, { timeline, time: Math.max(0, timeline.duration - 0.2), assets, dayLabel: "02 SET 2026" });
  const texts = ctx.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
  assert.ok(texts.includes("AGENDA"));
  assert.ok(texts.includes("DO DIA"));
  assert.ok(texts.includes("AGENDA COMPLETA"));
  assert.ok(texts.includes("STRIX UNITED"));
  assert.ok(!texts.includes("MATCHDAY"));
  assert.ok(texts.some((text) => String(text).includes("WINNER")));
  const lateMatch = mockContext();
  const lastMatch = timeline.scenes.filter((scene) => scene.type === "match").at(-1);
  paintAgendaFrame(lateMatch, { timeline, time: lastMatch.end - 0.04, assets, dayLabel: "02 SET 2026" });
  const lateTexts = lateMatch.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
  assert.ok(!lateTexts.includes("AGENDA COMPLETA"));
  assert.ok(!lateTexts.includes("MATCHDAY"));
  const lateIntro = mockContext();
  paintAgendaFrame(lateIntro, { timeline, time: timeline.introEnd - 0.04, assets, dayLabel: "02 SET 2026" });
  const introTexts = lateIntro.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
  assert.ok(!introTexts.some((text) => String(text).startsWith("JOGO")));
  assert.ok(!introTexts.includes("AGENDA COMPLETA"));
  assert.equal(timeline.scenes.at(-1).type, "finale");
});

test("zero jogos não produz composição renderizável", () => {
  const empty = buildAgendaTimeline([], { format: "story" });
  assert.equal(empty.totalFrames, 0);
  assert.equal(empty.duration, 0);
  assert.equal(empty.scenes.length, 0);
});
