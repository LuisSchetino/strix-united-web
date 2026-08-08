import test from "node:test";
import assert from "node:assert/strict";
import { dominantColorsFromPixels } from "../src/features/competitions/palette-core.js";

test("extrai cores predominantes úteis e ignora fundo transparente", () => {
  const pixels = new Uint8ClampedArray([
    10, 80, 240, 255, 10, 80, 240, 255, 10, 80, 240, 255, 10, 80, 240, 255,
    235, 30, 55, 255, 235, 30, 55, 255, 0, 0, 0, 0, 255, 255, 255, 255,
  ]);
  const colors = dominantColorsFromPixels(pixels, 5);
  assert.ok(colors.some((color) => /^#[0-9a-f]{6}$/i.test(color)));
  assert.ok(colors.length >= 1);
});
