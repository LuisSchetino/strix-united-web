import test from "node:test";
import assert from "node:assert/strict";
import { buildRelatedNightTimeline } from "../src/features/media/related-night-timeline.js";
import { relatedNightCamera } from "../src/features/media/related-night-layout.js";
import {
  cameraHeroAmount,
  classifyHeroPixels,
  heroPresence,
  heroStageBox,
  lowerThirdPresence,
} from "../src/features/media/related-night-hero.js";
import { paintRelatedNightFrame } from "../src/features/media/related-night-paint.js";

function players() {
  return [
    { id: "g1", name: "Ceni", photo: "", position: "GOL", group: "GOL", number: 1 },
    { id: "d1", name: "Cedraz", photo: "", position: "ZAG", group: "DEF", number: 4 },
    { id: "m1", name: "Nunes", photo: "", position: "MC", group: "MEI", number: 8 },
    { id: "a1", name: "Santozz", photo: "", position: "ATA", group: "ATA", number: 9 },
  ];
}

function opaque(width, height, rgb = [240, 180, 40]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = rgb[0];
    data[index * 4 + 1] = rgb[1];
    data[index * 4 + 2] = rgb[2];
    data[index * 4 + 3] = 255;
  }
  return data;
}

function cutout(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const inside = x > 12 && x < 36 && y > 8 && y < 60;
      data[index] = 80;
      data[index + 1] = 80;
      data[index + 2] = 80;
      data[index + 3] = inside ? 255 : 0;
    }
  }
  return data;
}

test("hero stage fica na direita sem esmagar o campo", () => {
  const timeline = buildRelatedNightTimeline(players(), { format: "story" });
  const stage = heroStageBox(timeline);
  const ratio = stage.width / timeline.width;
  assert.ok(ratio >= 0.26 && ratio <= 0.34);
  assert.ok(stage.left > timeline.width * 0.5);
  assert.ok(stage.right > timeline.width * 0.9);
  assert.ok(stage.plateY > stage.portraitTop);
});

test("classifica recorte transparente e foto com fundo forte", () => {
  const punched = classifyHeroPixels(cutout(48, 72), 48, 72);
  const crest = classifyHeroPixels(opaque(48, 72), 48, 72);
  assert.equal(punched.kind, "cutout");
  assert.ok(punched.alphaRatio > 0.12);
  assert.ok(punched.contentTop > 0.05 && punched.contentTop < 0.2);
  assert.ok(punched.contentBottom > 0.75);
  assert.equal(crest.kind, "photo");
  assert.equal(crest.strongBg, true);
  assert.equal(crest.contentTop, 0);
  assert.equal(crest.contentBottom, 1);
});

test("câmera mantém o campo centralizado com o hero na direita", () => {
  const timeline = buildRelatedNightTimeline(players(), { format: "story" });
  const scene = timeline.scenes.find((item) => item.type === "player");
  const rest = relatedNightCamera(timeline, scene.start + 0.4, { hero: 0 });
  const hero = relatedNightCamera(timeline, scene.start + 0.4, { hero: 1 });
  const finale = relatedNightCamera(timeline, timeline.duration - 0.15, { hero: 0 });
  assert.equal(hero.originN, rest.originN);
  assert.ok(Math.abs(hero.originN - 0.5) < 0.04);
  assert.equal(hero.x, rest.x);
  assert.ok(finale.zoom < rest.zoom);
  assert.ok(finale.originN >= hero.originN - 0.02);
});

test("lower third entra depois do hero e os dois saem juntos", () => {
  const timeline = buildRelatedNightTimeline(players(), { format: "story" });
  const scene = timeline.scenes.find((item) => item.type === "player");
  assert.ok(heroPresence(scene, scene.start + 0.06) > lowerThirdPresence(scene, scene.start + 0.06));
  assert.ok(heroPresence(scene, scene.start + 0.5) > 0.95);
  assert.ok(lowerThirdPresence(scene, scene.start + 0.5) > 0.95);
  const late = scene.end - 0.08;
  assert.ok(Math.abs(heroPresence(scene, late) - lowerThirdPresence(scene, late)) < 0.05);
  assert.equal(cameraHeroAmount({ type: "finale" }, timeline.finaleStart + 0.2, timeline), 0);
});

test("painter ancora nome e posição no hero sem card de reserva", () => {
  const timeline = buildRelatedNightTimeline(players(), { format: "story" });
  const scene = timeline.scenes.find((item) => item.type === "player" && item.player.name === "Cedraz");
  const calls = [];
  const ctx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    textAlign: "left",
    filter: "",
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
    shadowColor: "",
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    clip() {},
    fill() {},
    stroke() {},
    fillRect() {},
    clearRect() {},
    fillText(text) { calls.push(String(text)); },
    moveTo() {},
    lineTo() {},
    rect() {},
    arc() {},
    ellipse() {},
    translate() {},
    scale() {},
    quadraticCurveTo() {},
    setTransform() {},
    measureText(text) { return { width: String(text).length * 12 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
  paintRelatedNightFrame(ctx, { timeline, time: scene.start + 0.45, assets: { players: [], byId: {} }, dayLabel: "03 SET 2026" });
  assert.ok(calls.includes("CEDRAZ"));
  assert.ok(calls.some((text) => /04\s+·\s+ZAG/.test(text)));
  assert.ok(!calls.some((text) => text === "STRIX UNITED" && calls[calls.indexOf("CEDRAZ") + 1] === "STRIX UNITED"));
  assert.ok(!calls.some((text) => /RESERVA|BANCO|SUPLENTE|TITULAR/i.test(text)));
});
