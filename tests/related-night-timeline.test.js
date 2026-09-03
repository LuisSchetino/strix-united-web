import test from "node:test";
import assert from "node:assert/strict";
import { relatedNightDurationSeconds } from "../src/features/media/related-night-core.js";
import { buildRelatedNightTimeline, relatedNightSceneAt } from "../src/features/media/related-night-timeline.js";
import { paintRelatedNightFrame } from "../src/features/media/related-night-paint.js";

function players(count) {
  const positions = ["GOL", "GOL", "ZAG", "ZAG", "ZAG", "ZAG", "VOL", "MC", "MC", "MEI", "ALA", "ATA", "ATA", "ALA", "MC"];
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `Jogador ${index + 1}`,
    photo: "",
    position: positions[index] || "MC",
    group: ["GOL", "GOL"].includes(positions[index]) ? "GOL" : positions[index] === "ZAG" ? "DEF" : positions[index] === "ATA" ? "ATA" : "MEI",
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
    save() { calls.push("save"); },
    restore() { calls.push("restore"); },
    beginPath() {},
    closePath() {},
    clip() {},
    fill() {},
    stroke() {},
    fillRect() {},
    fillText(text) { calls.push(["fillText", text]); },
    moveTo() {},
    lineTo() {},
    rect() {},
    arc() {},
    ellipse() {},
    translate() {},
    scale() {},
    drawImage() {},
    measureText(text) { return { width: String(text).length * 12 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
}

test("timeline constrói o campo sem cena de lista", () => {
  const timeline = buildRelatedNightTimeline(players(13), { format: "story" });
  assert.equal(timeline.scenes.filter((scene) => scene.type === "player").length, 13);
  assert.equal(timeline.scenes.filter((scene) => scene.type === "list").length, 0);
  assert.equal(relatedNightSceneAt(timeline, 0.4).type, "intro");
  assert.equal(relatedNightSceneAt(timeline, timeline.introEnd + 0.2).type, "player");
  assert.equal(relatedNightSceneAt(timeline, timeline.duration - 0.05).type, "finale");
  assert.equal(timeline.duration, relatedNightDurationSeconds(13));
  assert.ok(timeline.introEnd >= 1.5 && timeline.introEnd <= 2);
  assert.ok(timeline.duration - timeline.finaleStart >= 2 && timeline.duration - timeline.finaleStart <= 3.1);
});

test("apresentados permanecem e o painter não usa linguagem de reserva", () => {
  const timeline = buildRelatedNightTimeline(players(13), { format: "story" });
  const assets = {
    strix: { bitmap: null, initials: "SU", name: "Strix United" },
    players: players(13).map((player) => ({ bitmap: null, initials: "JX", name: player.name })),
    byId: {},
  };
  const first = timeline.scenes.find((scene) => scene.type === "player");
  const third = timeline.scenes.filter((scene) => scene.type === "player")[2];
  const ctx = mockContext();
  paintRelatedNightFrame(ctx, { timeline, time: 0.7, assets, dayLabel: "02 SET 2026" });
  paintRelatedNightFrame(ctx, { timeline, time: third.end - 0.1, assets, dayLabel: "02 SET 2026" });
  paintRelatedNightFrame(ctx, { timeline, time: timeline.duration - 0.2, assets, dayLabel: "02 SET 2026" });
  const texts = ctx.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => String(call[1]));
  assert.ok(texts.includes("RELACIONADOS"));
  assert.ok(texts.includes("DA NOITE"));
  assert.ok(texts.includes("13 RELACIONADOS"));
  assert.ok(!texts.some((text) => /RESERVA|BANCO|SUPLENTE|TITULAR|MATCHDAY/i.test(text)));
  const mid = mockContext();
  paintRelatedNightFrame(mid, { timeline, time: third.start + 0.4, assets, dayLabel: "02 SET 2026" });
  const midTexts = mid.calls.filter((call) => Array.isArray(call) && call[0] === "fillText").map((call) => String(call[1]));
  assert.ok(midTexts.includes(first.player.name.toUpperCase()));
  assert.ok(midTexts.includes(third.player.name.toUpperCase()));
});
