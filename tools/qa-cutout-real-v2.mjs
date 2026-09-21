import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cutoutAssetPath,
  cutoutEnterAmount,
  cutoutVariantMeta,
  layoutCutoutText,
  pickCutoutVariant,
} from "../src/features/media/cutout-text.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "qa", "cutout-real-v2");

function glyphsOf(text, {
  seed,
  size,
  maxWidth = 1000,
  mode,
  progress,
  rate = 8,
  x = 40,
  y = 700,
} = {}) {
  const layout = layoutCutoutText(text, { seed, size, maxWidth });
  const glyphs = [];
  layout.rows.forEach((row, rowIndex) => {
    row.glyphs.forEach((glyph) => {
      const enter = cutoutEnterAmount(mode, progress, glyph.delay + rowIndex * 0.08);
      if (enter <= 0.02) return;
      const variant = pickCutoutVariant(glyph.char, { seed, slot: glyph.slot, mode, progress, rate });
      const meta = cutoutVariantMeta(glyph.char, variant);
      glyphs.push({
        char: glyph.char,
        variant,
        path: cutoutAssetPath(glyph.char, variant),
        x: x + glyph.x,
        y: y + rowIndex * (layout.size * 1.18) + glyph.y,
        w: glyph.w,
        h: glyph.h,
        rot: glyph.rot,
        baseline: glyph.baseline,
        enter,
        cx: meta?.cx ?? 0.5,
        cy: meta?.cy ?? 0.5,
        vb: meta?.baseline ?? 0.86,
      });
    });
  });
  return { width: layout.width, height: layout.height, glyphs };
}

function forcedWord(pairs, { seed = 2, size = 220, x = 40, y = 700, maxWidth = 1000 } = {}) {
  const text = pairs.map((item) => item[0]).join("");
  const layout = layoutCutoutText(text, { seed, size, maxWidth });
  const glyphs = layout.rows[0].glyphs.map((glyph, index) => {
    const variant = pairs[index][1];
    const meta = cutoutVariantMeta(glyph.char, variant);
    return {
      char: glyph.char,
      variant,
      path: cutoutAssetPath(glyph.char, variant),
      x: x + glyph.x,
      y: y + glyph.y,
      w: glyph.w,
      h: glyph.h,
      rot: glyph.rot,
      baseline: glyph.baseline,
      enter: 1,
      cx: meta?.cx ?? 0.5,
      cy: meta?.cy ?? 0.5,
      vb: meta?.baseline ?? 0.86,
    };
  });
  return { width: layout.width, height: layout.height, glyphs };
}

await mkdir(outDir, { recursive: true });

const frames = {
  "agenda-static.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "static", progress: 1, x: 36, y: 780 }),
  "agenda-assemble/frame-01.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "assemble", progress: 0.08, x: 36, y: 780 }),
  "agenda-assemble/frame-02.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "assemble", progress: 0.2, x: 36, y: 780 }),
  "agenda-assemble/frame-03.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "assemble", progress: 0.32, x: 36, y: 780 }),
  "agenda-assemble/frame-04.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "assemble", progress: 0.44, x: 36, y: 780 }),
  "agenda-assemble/frame-05.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "assemble", progress: 0.56, x: 36, y: 780 }),
  "agenda-assemble/frame-06.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "assemble", progress: 0.68, x: 36, y: 780 }),
  "agenda-assemble/final.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "assemble", progress: 1, x: 36, y: 780 }),
  "agenda-chaos/frame-000.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "chaos", progress: 0.001, rate: 8, x: 36, y: 780 }),
  "agenda-chaos/frame-100.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "chaos", progress: 0.1, rate: 8, x: 36, y: 780 }),
  "agenda-chaos/frame-200.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "chaos", progress: 0.2, rate: 8, x: 36, y: 780 }),
  "agenda-chaos/frame-300.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "chaos", progress: 0.3, rate: 8, x: 36, y: 780 }),
  "agenda-chaos/frame-500.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "chaos", progress: 0.5, rate: 8, x: 36, y: 780 }),
  "agenda-chaos/frame-800.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "chaos", progress: 0.8, rate: 8, x: 36, y: 780 }),
  "agenda-matchcut/composicao-01.png": forcedWord([["A", 3], ["G", 7], ["E", 2], ["N", 18], ["D", 4], ["A", 9]], { seed: 2, size: 228, x: 36, y: 780 }),
  "agenda-matchcut/composicao-02.png": forcedWord([["A", 16], ["G", 2], ["E", 19], ["N", 4], ["D", 1], ["A", 3]], { seed: 2, size: 228, x: 36, y: 780 }),
  "agenda-matchcut/composicao-03.png": glyphsOf("AGENDA", { seed: 2, size: 228, mode: "match_cut", progress: 1.15, rate: 6, x: 36, y: 780 }),
  "v2-agenda-headline.png": glyphsOf("AGENDA", { seed: 2, size: 248, mode: "static", progress: 1, x: -28, y: 28 - 248 * 0.55, maxWidth: 1120 }),
  "v2-related-headline.png": glyphsOf("RELACIONADOS", { seed: 5, size: 96, mode: "static", progress: 1, x: -16, y: 36 - 96 * 0.55, maxWidth: 1104 }),
  "v2-announce-name.png": glyphsOf("NUNES", { seed: 41, size: 176, mode: "static", progress: 1, x: 4, y: 1920 * 0.52 - 176 * 0.55, maxWidth: 1068 }),
  "v2-summary-headline.png": glyphsOf("RESUMO", { seed: 11, size: 204, mode: "static", progress: 1, x: -12, y: 24 - 204 * 0.55, maxWidth: 1100 }),
};

const list = Object.entries(frames).map(([file, spec]) => ({ file, ...spec }));
await writeFile(join(outDir, "frames.json"), JSON.stringify(list));
console.log(`frames=${list.length}`);
