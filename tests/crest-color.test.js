import test from "node:test";
import assert from "node:assert/strict";
import { crestColorPixels } from "../src/ui/crest-color.js";
import { goalBetween } from "../src/features/home/live-goal.js";

const pixels = (...parts) => {
  const data = [];
  for (const [rgba, count] of parts) for (let i = 0; i < count; i += 1) data.push(...rgba);
  return Uint8ClampedArray.from(data);
};

test("cor do escudo: a cor viva que mais cobre o escudo, clara o bastante para o fundo escuro", () => {
  const gold = crestColorPixels(pixels([[200, 160, 40, 255], 300], [[10, 10, 10, 255], 600], [[0, 0, 0, 0], 400]));
  assert.match(gold, /^#[0-9a-f]{6}$/);
  const [r, g, b] = gold.slice(1).match(/../g).map((x) => parseInt(x, 16));
  assert.ok(r > g && g > b && r >= 200);
  const red = crestColorPixels(pixels([[120, 10, 20, 255], 200], [[250, 250, 250, 255], 300]));
  assert.ok(parseInt(red.slice(1, 3), 16) >= 200);
});

test("escudo preto e branco ou transparente não tem cor", () => {
  assert.equal(crestColorPixels(pixels([[255, 255, 255, 255], 300], [[0, 0, 0, 255], 300])), null);
  assert.equal(crestColorPixels(pixels([[0, 0, 0, 0], 10])), null);
  assert.equal(crestColorPixels(pixels([[30, 90, 220, 255], 2], [[0, 0, 0, 255], 900])), null);
});

test("gol só quando o placar do mesmo jogo sobe", () => {
  assert.equal(goalBetween({ id: "a", strix: 1, opponent: 0 }, { id: "a", strix: 2, opponent: 0 }), "strix");
  assert.equal(goalBetween({ id: "a", strix: 1, opponent: 0 }, { id: "a", strix: 1, opponent: 1 }), "opponent");
  assert.equal(goalBetween({ id: "a", strix: 1, opponent: 0 }, { id: "a", strix: 1, opponent: 0 }), "");
  assert.equal(goalBetween({ id: "a", strix: 1, opponent: 0 }, { id: "b", strix: 3, opponent: 0 }), "");
  assert.equal(goalBetween(null, { id: "a", strix: 1, opponent: 0 }), "");
});
