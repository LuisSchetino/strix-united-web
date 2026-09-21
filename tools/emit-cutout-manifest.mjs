import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(await readFile(join(root, "public/collage/letters/manifest.json"), "utf8"));
const chars = raw.chars || {};
const DIR_MAP = { "!": "excl", ".": "dot", ",": "comma" };

const library = {};
for (const [key, entry] of Object.entries(chars)) {
  const variants = (entry.variants || []).map((item) => ({
    w: item.width,
    h: item.height,
    aspect: item.aspectRatio,
    cx: item.visualCenter?.[0] ?? 0.5,
    cy: item.visualCenter?.[1] ?? 0.5,
    baseline: item.visualBaseline,
    scale: item.recommendedScale,
  }));
  const widths = variants.map((item) => item.w).sort((a, b) => a - b);
  const heights = variants.map((item) => item.h).sort((a, b) => a - b);
  const baselines = variants.map((item) => item.baseline).sort((a, b) => a - b);
  const mid = (list) => list[Math.floor((list.length - 1) / 2)] || 1;
  library[key] = {
    dir: DIR_MAP[key] || entry.dir || key,
    count: variants.length,
    medianW: mid(widths),
    medianH: mid(heights),
    medianBaseline: mid(baselines),
    variants,
  };
}

const body = `export const CUTOUT_MANIFEST_VERSION = ${JSON.stringify(raw.version || "letters-real-v1")};
export const CUTOUT_LIBRARY_SOURCE = ${JSON.stringify(raw.source || "fernandochueire/letras_recortadas")};
export const CUTOUT_CHAR_DIRS = Object.freeze(${JSON.stringify(DIR_MAP)});
export const CUTOUT_LIBRARY = Object.freeze(${JSON.stringify(library)});
export const CUTOUT_VARIANT_COUNTS = Object.freeze(Object.fromEntries(
  Object.entries(CUTOUT_LIBRARY).map(([char, entry]) => [char, entry.count]),
));
`;

await writeFile(join(root, "src/features/media/cutout-manifest.js"), body);
console.log(`chars=${Object.keys(library).length} variants=${Object.values(library).reduce((sum, item) => sum + item.count, 0)}`);
