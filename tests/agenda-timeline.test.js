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
  assert.ok(one.scenes.find((scene) => scene.type === "match").end - one.scenes.find((scene) => scene.type === "match").start > 4);
  assert.ok(five.scenes.find((scene) => scene.type === "match").end - five.scenes.find((scene) => scene.type === "match").start < 2);
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
  assert.ok(one.introEnd >= 2);
  assert.ok(one.duration - one.finaleStart >= 3.2);
  assert.ok(typeScale("story").title >= 110);
  assert.ok(typeScale("story").kickoff >= 110);
  const left = logoDrawRect({ bitmap: { width: 512, height: 400 } }, 276);
  const right = logoDrawRect({ bitmap: { width: 200, height: 200 } }, 276);
  assert.ok(Math.max(left.dw, left.dh) <= 276.01);
  assert.ok(Math.max(right.dw, right.dh) <= 276.01);
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
  const texts = ctx.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => call[1]);
  assert.ok(texts.includes("AGENDA DO DIA"));
  assert.ok(texts.includes("STRIX UNITED"));
  assert.ok(texts.includes("MATCHDAY"));
  assert.ok(texts.some((text) => String(text).includes("WINNER")));
});

test("zero jogos não produz composição renderizável", () => {
  const empty = buildAgendaTimeline([], { format: "story" });
  assert.equal(empty.totalFrames, 0);
  assert.equal(empty.duration, 0);
  assert.equal(empty.scenes.length, 0);
});
