import test from "node:test";
import assert from "node:assert/strict";
import { BANNER_HEIGHT, BANNER_SAFE_LEFT, BANNER_SAFE_RIGHT, BANNER_WIDTH, bannerPicture, bannerPictures, fitTitle, wrapTitle } from "../src/features/library/library-share-banner.js";

// Ten units per character: widths are easy to reason about.
const measure = (value) => value.length * 10;

test("everything readable sits inside what a 3:2 centre crop keeps", () => {
  // WhatsApp's compact card shows the middle of the banner at about 3:2.
  const visible = BANNER_HEIGHT * 1.5;
  const cropLeft = (BANNER_WIDTH - visible) / 2;
  assert.ok(BANNER_SAFE_LEFT >= cropLeft + 40, "left edge of the text has room inside the crop");
  assert.ok(BANNER_SAFE_RIGHT <= BANNER_WIDTH - cropLeft - 40, "right edge of the text has room inside the crop");
  assert.equal(BANNER_SAFE_LEFT + BANNER_SAFE_RIGHT, BANNER_WIDTH, "the band is centred");
});

test("a title wraps on words and never cuts one", () => {
  assert.deepEqual(wrapTitle(measure, "Saida de bola pelo lado", 120, 3), ["Saida de", "bola pelo", "lado"]);
  assert.deepEqual(wrapTitle(measure, "Curto", 120, 3), ["Curto"]);
  assert.deepEqual(wrapTitle(measure, "Superlongapalavraunica aqui", 120, 3), ["Superlongapalavraunica", "aqui"]);
  assert.deepEqual(wrapTitle(measure, "", 120, 3), []);
});

test("a title longer than the block ends in an ellipsis inside the line", () => {
  const lines = wrapTitle(measure, "um dois tres quatro cinco seis sete oito nove dez", 100, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith("…"));
  assert.ok(measure(lines[1]) <= 100);
});

test("the type shrinks until the whole title fits; the smallest size clips", () => {
  const measureAt = (value, size) => value.length * size * 0.5;
  // At 60 a line holds 13 characters and the title needs four lines; at 40 it holds 20 and needs two.
  const fit = fitTitle(measureAt, "Escanteio curto na primeira trave", 400, 3, [92, 60, 40]);
  assert.equal(fit.size, 40);
  assert.deepEqual(fit.lines, ["Escanteio curto na", "primeira trave"]);
  assert.ok(!fit.lines.at(-1).endsWith("…"));
  const clipped = fitTitle(measureAt, "palavra ".repeat(60).trim(), 400, 3, [92, 60, 40]);
  assert.equal(clipped.size, 40);
  assert.ok(clipped.lines.at(-1).endsWith("…"));
});

test("the banner picture is the material's thumbnail, else the YouTube frame, else none", () => {
  assert.equal(bannerPicture({ thumbnail_url: "https://cdn.example/capa.jpg", source_url: "https://youtu.be/dQw4w9WgXcQ" }), "https://cdn.example/capa.jpg");
  assert.equal(bannerPicture({ thumbnail_url: "", source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }), "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(bannerPicture({ source_url: "https://drive.google.com/file/d/abc/view" }), "");
  assert.equal(bannerPicture({ thumbnail_url: "/assets/capa.jpg", source_url: "" }), "");
  // The drawing tries the wide YouTube frame first and falls back to the middle band of the standard one.
  assert.deepEqual(bannerPictures({ source_url: "https://youtu.be/dQw4w9WgXcQ" }).map((picture) => [picture.url.split("/").pop(), picture.band]), [["maxresdefault.jpg", false], ["hqdefault.jpg", true]]);
  assert.deepEqual(bannerPictures({ thumbnail_url: "https://cdn.example/capa.jpg", source_url: "https://youtu.be/dQw4w9WgXcQ" }), [{ url: "https://cdn.example/capa.jpg", band: false }]);
  assert.deepEqual(bannerPictures({ source_url: "https://drive.google.com/file/d/abc/view" }), []);
});
