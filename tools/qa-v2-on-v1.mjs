import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cutoutAssetPath,
  cutoutVariantMeta,
  layoutCutoutText,
  pickCutoutVariant,
} from "../src/features/media/cutout-text.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "qa", "cutout-real-v2");

function word(text, { seed, size, x, y, maxWidth, align = "left" }) {
  const layout = layoutCutoutText(text, { seed, size, maxWidth, align: "left" });
  const left = align === "center" ? x - layout.width / 2 : x;
  const glyphs = layout.rows[0].glyphs.map((glyph) => {
    const variant = pickCutoutVariant(glyph.char, { seed, slot: glyph.slot, mode: "static", progress: 1 });
    const meta = cutoutVariantMeta(glyph.char, variant);
    return {
      char: glyph.char,
      path: cutoutAssetPath(glyph.char, variant),
      x: left + glyph.x,
      y: y - size * 0.82 + glyph.y,
      w: glyph.w,
      h: glyph.h,
      rot: glyph.rot,
      baseline: glyph.baseline,
      cx: meta?.cx ?? 0.5,
      vb: meta?.baseline ?? 0.86,
    };
  });
  return { glyphs, width: layout.width, height: layout.height };
}

await mkdir(outDir, { recursive: true });
const frames = {
  agenda: word("AGENDA", { seed: 2, size: 110, x: 540, y: 430, maxWidth: 980, align: "center" }),
  related: word("RELACIONADOS", { seed: 5, size: 72, x: 540, y: 430, maxWidth: 1000, align: "center" }),
  announce: word("NUNES", { seed: 41, size: 88, x: 72, y: 1380, maxWidth: 920, align: "left" }),
  summary: word("RESUMO", { seed: 11, size: 78, x: 540, y: 420, maxWidth: 980, align: "center" }),
};
await writeFile(join(outDir, "v1v2-headlines.json"), JSON.stringify(frames));
console.log("headlines-ready");
