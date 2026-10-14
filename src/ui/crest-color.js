// The colour a crest is known by, for effects drawn in the opponent's colours (the goal
// celebration of the live game). `crestColorPixels` is the rule (pure, tested); `crestColor`
// reads a picture and applies it. Whenever the picture cannot be read, or has no colour of its
// own (a black and white crest), the answer is null and the caller keeps its neutral colour.

const CLEAR = 120;        // pixels more transparent than this are not the crest
const MIN_SATURATION = 0.32;
const MIN_LIGHT = 0.18;
const MAX_LIGHT = 0.9;
const MIN_SHARE = 0.04;   // the colour must cover at least this much of the crest
const BINS = 24;          // hue buckets of 15°

const hex = (value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");

function hsl(r, g, b) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const light = (max + min) / 2;
  const chroma = max - min;
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * light - 1));
  let hue = 0;
  if (chroma) {
    const [rr, gg, bb] = [r / 255, g / 255, b / 255];
    if (max === rr) hue = ((gg - bb) / chroma) % 6;
    else if (max === gg) hue = (bb - rr) / chroma + 2;
    else hue = (rr - gg) / chroma + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { hue, saturation, light };
}

/**
 * The crest's strongest colour as "#rrggbb", or null when it has none. RGBA pixels in `data`.
 * Colours are grouped by hue; the group covering most of the crest wins, weighted by how vivid
 * it is, and its average is brightened enough to read as light on the site's near-black.
 */
export function crestColorPixels(data) {
  const bins = Array.from({ length: BINS }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
  let solid = 0;
  for (let p = 0; p + 3 < data.length; p += 4) {
    if (data[p + 3] < CLEAR) continue;
    solid += 1;
    const { hue, saturation, light } = hsl(data[p], data[p + 1], data[p + 2]);
    if (saturation < MIN_SATURATION || light < MIN_LIGHT || light > MAX_LIGHT) continue;
    const bin = bins[Math.floor(hue / (360 / BINS)) % BINS];
    const weight = 0.5 + saturation;
    bin.weight += weight;
    bin.r += data[p] * weight; bin.g += data[p + 1] * weight; bin.b += data[p + 2] * weight;
  }
  if (!solid) return null;
  // neighbouring buckets count together, so a colour on a bucket edge is not split in two
  let best = -1, bestWeight = 0;
  bins.forEach((bin, i) => {
    const total = bin.weight + 0.5 * (bins[(i + 1) % BINS].weight + bins[(i + BINS - 1) % BINS].weight);
    if (bin.weight && total > bestWeight) { best = i; bestWeight = total; }
  });
  if (best < 0 || bins[best].weight / solid < MIN_SHARE) return null;
  const bin = bins[best];
  let [r, g, b] = [bin.r / bin.weight, bin.g / bin.weight, bin.b / bin.weight];
  // too dark to glow on black: lift it towards its own brightest version
  const max = Math.max(r, g, b);
  if (max < 200) { const k = 200 / Math.max(1, max); r *= k; g *= k; b *= k; }
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const done = new Map();

/** The crest colour for `url` (see `crestColorPixels`), worked once per visit. */
export function crestColor(url) {
  if (!url || typeof document === "undefined") return Promise.resolve(null);
  if (done.has(url)) return done.get(url);
  const work = (async () => {
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!response.ok) return null;
      const bitmap = await createImageBitmap(await response.blob());
      const size = 96;
      const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0, size, size);
      bitmap.close?.();
      return crestColorPixels(ctx.getImageData(0, 0, size, size).data);
    } catch {
      return null;
    }
  })();
  done.set(url, work);
  return work;
}
