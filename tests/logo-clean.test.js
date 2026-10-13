import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanLogoPixels } from "../src/ui/logo-clean.js";

/** A square picture painted by `paint(x, y)` → [r, g, b, a]. */
function picture(size, paint) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) data.set(paint(x, y), (y * size + x) * 4);
  return data;
}
const alphaAt = (data, size, x, y) => data[(y * size + x) * 4 + 3];
const WHITE = [255, 255, 255, 255], BLACK = [0, 0, 0, 255], NONE = [0, 0, 0, 0], RED = [200, 20, 30, 255], INK = [20, 20, 60, 255];

test("fundo branco em volta sai; o branco de dentro do contorno fica", () => {
  const size = 100, centre = 50;
  // A ring (the outline) with white inside, on a white card.
  const data = picture(size, (x, y) => { const d = Math.hypot(x - centre, y - centre); return d <= 26 ? WHITE : d <= 32 ? INK : WHITE; });
  const verdict = cleanLogoPixels(data, size, size);
  assert.equal(verdict.removed, true);
  assert.equal(alphaAt(data, size, 2, 2), 0);
  assert.equal(alphaAt(data, size, centre, centre), 255);
  assert.equal(alphaAt(data, size, centre + 29, centre), 255);
  // And the small crest is trimmed to its own square.
  assert.ok(verdict.box.size >= 64 && verdict.box.size <= 72, `size ${verdict.box.size}`);
  assert.ok(Math.abs(verdict.box.x + verdict.box.size / 2 - centre) <= 2);
});

test("escudo branco sobre branco não é tocado", () => {
  const size = 80;
  const data = picture(size, (x, y) => (x > 30 && x < 50 && y > 30 && y < 50 ? RED : WHITE));
  // The red mark is tiny: removing the white would take nearly everything.
  const before = Array.from(data);
  assert.equal(cleanLogoPixels(data, size, size), null);
  assert.deepEqual(Array.from(data), before);
});

test("fundo preto em volta sai, e o escudo pequeno é aproximado", () => {
  const size = 100;
  const data = picture(size, (x, y) => (Math.hypot(x - 50, y - 50) <= 20 ? RED : BLACK));
  const verdict = cleanLogoPixels(data, size, size);
  assert.equal(verdict.removed, true);
  assert.equal(alphaAt(data, size, 2, 2), 0);
  assert.equal(alphaAt(data, size, 50, 50), 255);
  assert.ok(verdict.box.size >= 41 && verdict.box.size <= 46, `size ${verdict.box.size}`);
});

test("o preto de dentro de um contorno claro fica", () => {
  const size = 100;
  // A light ring with black inside, on a black card.
  const data = picture(size, (x, y) => { const d = Math.hypot(x - 50, y - 50); return d <= 30 ? BLACK : d <= 36 ? WHITE : BLACK; });
  const verdict = cleanLogoPixels(data, size, size);
  assert.equal(verdict.removed, true);
  assert.equal(alphaAt(data, size, 3, 3), 0);
  assert.equal(alphaAt(data, size, 50, 50), 255);
  assert.equal(alphaAt(data, size, 50 + 33, 50), 255);
});

test("escudo pequeno em PNG transparente é aproximado", () => {
  const size = 120;
  const data = picture(size, (x, y) => (x >= 45 && x < 75 && y >= 50 && y < 70 ? RED : NONE));
  const verdict = cleanLogoPixels(data, size, size);
  assert.equal(verdict.removed, false);
  assert.ok(verdict.box.size >= 30 && verdict.box.size <= 34);
});

test("escudo que já ocupa a imagem, ou com fundo colorido, fica como veio", () => {
  const size = 60;
  assert.equal(cleanLogoPixels(picture(size, (x, y) => (Math.hypot(x - 30, y - 30) <= 29 ? RED : NONE)), size, size), null);
  assert.equal(cleanLogoPixels(picture(size, () => [30, 90, 200, 255]), size, size), null);
  assert.equal(cleanLogoPixels(picture(size, (x) => (x < 30 ? WHITE : BLACK)), size, size), null);
});

test("fundo branco de um escudo que já ocupa a imagem sai sem cortar nada", () => {
  const size = 100;
  const data = picture(size, (x, y) => (Math.hypot(x - 50, y - 50) <= 47 ? INK : WHITE));
  const verdict = cleanLogoPixels(data, size, size);
  assert.equal(verdict.removed, true);
  assert.equal(verdict.box, null);
  assert.equal(alphaAt(data, size, 1, 1), 0);
  assert.equal(alphaAt(data, size, 50, 50), 255);
});

test("escudo em imagem larga conta como pequeno: o token é quadrado", () => {
  const width = 160, height = 90;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 10; y < 80; y += 1) for (let x = 45; x < 115; x += 1) data.set([200, 20, 30, 255], (y * width + x) * 4);
  const verdict = cleanLogoPixels(data, width, height);
  assert.equal(verdict.removed, false);
  assert.ok(verdict.box.size >= 70 && verdict.box.size <= 76, `size ${verdict.box.size}`);
  assert.ok(Math.abs(verdict.box.x + verdict.box.size / 2 - 80) <= 2);
});
