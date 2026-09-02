import test from "node:test";
import assert from "node:assert/strict";
import { agendaDurationSeconds } from "../src/features/media/agenda-media-core.js";
import { buildAgendaTimeline } from "../src/features/media/agenda-timeline.js";
import { agendaFrameTime, describeAgendaFrame, renderAgendaFrame, signatureDistance } from "../src/features/media/agenda-frame.js";

function matches(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    opponent: index === 0 ? "Winner Elevens" : index === 1 ? "Genius Esports" : `Time ${index + 1}`,
    kickoff: `${21 + index}:10`,
    competition: index === 0 ? "Amistoso" : "Superliga Yeshua",
  }));
}

function mockContext() {
  const calls = [];
  return {
    calls,
    font: "",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    textAlign: "left",
    textBaseline: "alphabetic",
    save() {},
    restore() {},
    beginPath() {},
    clip() {},
    fill() {},
    stroke() {},
    fillRect(...args) { calls.push(["fillRect", ...args]); },
    fillText(text) { calls.push(["fillText", text]); },
    moveTo() {},
    lineTo() {},
    rect() {},
    translate() {},
    scale() {},
    drawImage() {},
    measureText(text) { return { width: String(text).length * 12 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
}

function assetsFor(count) {
  return {
    strix: { bitmap: null, initials: "SU", name: "Strix United" },
    opponents: matches(count).map((match) => ({ bitmap: null, initials: "WE", name: match.opponent })),
  };
}

test("preview e encode compartilham o mesmo relógio de frame", () => {
  const timeline = buildAgendaTimeline(matches(3), { format: "story" });
  assert.equal(agendaFrameTime(0, timeline), 0);
  assert.equal(agendaFrameTime(75, timeline), 2.5);
  assert.ok(agendaFrameTime(timeline.totalFrames - 1, timeline) < timeline.duration + 0.001);
  const times = [];
  for (let index = 0; index < timeline.totalFrames; index += 1) times.push(agendaFrameTime(index, timeline));
  for (let index = 1; index < times.length; index += 1) {
    assert.ok(times[index] >= times[index - 1]);
  }
});

test("1, 3 e 6 jogos cobrem opening, confrontos, agenda e MATCHDAY", () => {
  for (const count of [1, 3, 6]) {
    const timeline = buildAgendaTimeline(matches(count), { format: "story" });
    assert.equal(describeAgendaFrame(timeline, 0.5).sceneType, "intro");
    assert.equal(describeAgendaFrame(timeline, timeline.introEnd + 0.4).sceneType, "match");
    assert.equal(describeAgendaFrame(timeline, timeline.introEnd + 0.4).matchIndex, 0);
    assert.equal(describeAgendaFrame(timeline, timeline.finaleStart + 0.3).sceneType, "finale");
    assert.equal(describeAgendaFrame(timeline, timeline.lockupStart + 0.2).sceneType, "lockup");
    if (count >= 3) {
      assert.equal(describeAgendaFrame(timeline, timeline.introEnd + 3.4).matchIndex, 1);
      assert.equal(describeAgendaFrame(timeline, timeline.introEnd + 6.4).matchIndex, 2);
    }
    assert.ok(agendaDurationSeconds(count) === timeline.duration);
  }
});

test("motion de ambiente muda entre holds do mesmo jogo", () => {
  const timeline = buildAgendaTimeline(matches(3), { format: "story" });
  const assets = assetsFor(3);
  const early = mockContext();
  const late = mockContext();
  renderAgendaFrame(early, { timeline, timeSec: 3.2, assets, dayLabel: "02 SET 2026" });
  renderAgendaFrame(late, { timeline, timeSec: 3.8, assets, dayLabel: "02 SET 2026" });
  assert.notDeepEqual(early.calls, late.calls);
  assert.equal(describeAgendaFrame(timeline, 3.2).sceneType, "match");
  assert.equal(describeAgendaFrame(timeline, 3.8).sceneType, "match");
});

test("assinaturas diferentes não colapsam para zero", () => {
  assert.ok(signatureDistance([10, 20, 30], [12, 18, 40]) > 0);
  assert.equal(signatureDistance([8, 8], [8, 8]), 0);
});
