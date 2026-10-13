import test from "node:test";
import assert from "node:assert/strict";
import { relatedNightDurationSeconds } from "../src/features/media/related-night-core.js";
import { buildRelatedNightTimeline } from "../src/features/media/related-night-timeline.js";
import { describeRelatedNightFrame, relatedNightFrameTime, renderRelatedNightFrame } from "../src/features/media/related-night-frame.js";

function players(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `Jogador ${index + 1}`,
    photo: "",
    position: index < 2 ? "GOL" : index < 6 ? "ZAG" : index < 11 ? "MC" : "ATA",
    group: index < 2 ? "GOL" : index < 6 ? "DEF" : index < 11 ? "MEI" : "ATA",
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
    rect() {},
    arc() {},
    ellipse() {},
    translate(...args) { calls.push(["translate", ...args]); },
    scale() {},
    rotate() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    setLineDash() {},
    drawImage() {},
    measureText(text) { return { width: String(text).length * 12 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    filter: "",
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
    shadowColor: "",
    setTransform() {},
    clearRect() {},
  };
}

test("preview e encode compartilham o relógio dos relacionados", () => {
  const timeline = buildRelatedNightTimeline(players(13), { format: "story" });
  assert.equal(relatedNightFrameTime(0, timeline), 0);
  const times = [];
  for (let index = 0; index < timeline.totalFrames; index += 1) times.push(relatedNightFrameTime(index, timeline));
  for (let index = 1; index < times.length; index += 1) {
    assert.ok(times[index] >= times[index - 1]);
  }
});

test("11, 13 e 15 cobrem opening, jogadores e campo completo", () => {
  for (const count of [11, 13, 15]) {
    const timeline = buildRelatedNightTimeline(players(count), { format: "story" });
    assert.equal(describeRelatedNightFrame(timeline, 0.4).sceneType, "intro");
    assert.equal(describeRelatedNightFrame(timeline, timeline.introEnd + 0.3).sceneType, "player");
    assert.equal(describeRelatedNightFrame(timeline, timeline.duration - 0.05).sceneType, "finale");
    const lastPlayer = timeline.scenes.filter((scene) => scene.type === "player").at(-1);
    const late = describeRelatedNightFrame(timeline, lastPlayer.end - 0.05);
    assert.ok(late.onField.length >= count - 1);
    assert.equal(relatedNightDurationSeconds(count), timeline.outroStart);
    assert.equal(timeline.duration, timeline.outroStart + 5);
  }
});

test("o campo continua vivo no hold do mesmo jogador", () => {
  const timeline = buildRelatedNightTimeline(players(13), { format: "story" });
  const assets = {
    strix: { bitmap: null, initials: "SU", name: "Strix" },
    players: players(13).map((player) => ({ bitmap: null, initials: "JX", name: player.name })),
    byId: {},
  };
  const first = timeline.scenes.find((scene) => scene.type === "player");
  const early = mockContext();
  const late = mockContext();
  renderRelatedNightFrame(early, { timeline, timeSec: first.start + 0.3, assets, dayLabel: "02 SET 2026" });
  renderRelatedNightFrame(late, { timeline, timeSec: first.start + 0.8, assets, dayLabel: "02 SET 2026" });
  assert.notDeepEqual(early.calls, late.calls);
});
