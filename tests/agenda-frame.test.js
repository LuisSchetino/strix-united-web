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
    strokeRect(...args) { calls.push(["strokeRect", ...args]); },
    fillText(text) { calls.push(["fillText", text]); },
    moveTo() {},
    lineTo() {},
    rect() {},
    translate(...args) { calls.push(["translate", ...args]); },
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

test("1, 3 e 6 jogos cobrem abertura, páginas de confrontos e encerramento", () => {
  for (const count of [1, 3, 6]) {
    const timeline = buildAgendaTimeline(matches(count), { format: "story" });
    assert.equal(describeAgendaFrame(timeline, 0.5).sceneType, "intro");
    assert.equal(describeAgendaFrame(timeline, timeline.introEnd + 0.4).sceneType, "page");
    assert.equal(describeAgendaFrame(timeline, timeline.introEnd + 0.4).matchIndex, 0);
    assert.equal(describeAgendaFrame(timeline, timeline.introEnd + 0.4).matchCount, Math.min(4, count));
    assert.equal(describeAgendaFrame(timeline, timeline.finaleStart + 0.3).sceneType, "finale");
    assert.equal(describeAgendaFrame(timeline, Math.max(0, timeline.duration - 0.05)).sceneType, "finale");
    assert.ok(agendaDurationSeconds(count) === timeline.duration);
    const pages = timeline.scenes.filter((scene) => scene.type === "page");
    assert.equal(pages.length, Math.ceil(count / 4));
    assert.deepEqual(pages.flatMap((page) => page.matches.map((match) => match.id)), matches(count).map((match) => match.id));
    assert.equal(describeAgendaFrame(timeline, pages.at(-1).end - 0.01).sceneType, "page");
    assert.equal(describeAgendaFrame(timeline, pages.at(-1).end).sceneType, "finale");
  }
});

test("listas longas são paginadas sem truncar jogos", () => {
  for (const count of [15, 300]) {
    const source = matches(count);
    const timeline = buildAgendaTimeline(source, { format: "story" });
    const pages = timeline.scenes.filter((scene) => scene.type === "page");
    assert.equal(pages.length, Math.ceil(count / timeline.pageSize));
    assert.deepEqual(pages.flatMap((page) => page.matches.map((match) => match.id)), source.map((match) => match.id));
    assert.equal(pages.at(-1).matches.length, count % timeline.pageSize || timeline.pageSize);
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
  assert.equal(describeAgendaFrame(timeline, 3.2).sceneType, "page");
  assert.equal(describeAgendaFrame(timeline, 3.8).sceneType, "page");
});

test("assinaturas diferentes não colapsam para zero", () => {
  assert.ok(signatureDistance([10, 20, 30], [12, 18, 40]) > 0);
  assert.equal(signatureDistance([8, 8], [8, 8]), 0);
});
