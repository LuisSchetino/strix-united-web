import {
  CUTOUT_CHAR_DIRS,
  CUTOUT_LIBRARY,
  CUTOUT_MANIFEST_VERSION,
  CUTOUT_VARIANT_COUNTS,
} from "./cutout-manifest.js";

export const CUTOUT_ENGINE_VERSION = "cutout-v2";
export { CUTOUT_MANIFEST_VERSION, CUTOUT_LIBRARY, CUTOUT_VARIANT_COUNTS, CUTOUT_CHAR_DIRS };
export const CUTOUT_PUBLIC_ROOT = "/collage/letters";

export const CUTOUT_TEMPLATE_SEEDS = Object.freeze({
  agenda: 2,
  related: 5,
  relatedPlayer: 17,
  summary: 11,
  announce: 41,
  elenco: 3,
});

export const CUTOUT_MODES = Object.freeze({
  static: "static",
  assemble: "assemble",
  chaos: "chaos",
  match_cut: "match_cut",
  jitter: "jitter",
});

const FALLBACK_FONTS = Object.freeze([
  "Impact",
  "Georgia",
  "Times New Roman",
  "Segoe UI Black",
]);

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function seeded(seed = 1) {
  let state = (Math.imul(Number(seed) || 11, 2654435761) >>> 0) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 13), 1274126177) >>> 0;
    return state / 4294967296;
  };
}

export function hashSeed(...parts) {
  let hash = 2166136261;
  const text = parts.map((part) => String(part ?? "")).join(":");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizeCutoutChar(char) {
  const raw = String(char || "");
  if (!raw || raw === " " || raw === "\n" || raw === "\t") return raw;
  if (CUTOUT_LIBRARY[raw]) return raw;
  const mapped = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return CUTOUT_LIBRARY[mapped] ? mapped : "?";
}

export function cutoutCharsNeeded(text = "") {
  return [...new Set(String(text || "").split("").map(normalizeCutoutChar).filter((char) => CUTOUT_LIBRARY[char]))];
}

export function variantCount(char) {
  return CUTOUT_LIBRARY[normalizeCutoutChar(char)]?.count || 1;
}

export function cutoutDirName(char) {
  const key = normalizeCutoutChar(char);
  return CUTOUT_LIBRARY[key]?.dir || CUTOUT_CHAR_DIRS[key] || key;
}

export function cutoutVariantMeta(char, variant) {
  const lib = CUTOUT_LIBRARY[normalizeCutoutChar(char)];
  if (!lib?.variants?.length) return null;
  const index = ((Number(variant) || 1) - 1 + lib.count) % lib.count;
  return lib.variants[index] || null;
}

export function cutoutAssetPath(char, variant) {
  const key = normalizeCutoutChar(char);
  const lib = CUTOUT_LIBRARY[key];
  const count = lib?.count || 1;
  const index = ((Number(variant) || 1) - 1 + count) % count;
  const dir = lib?.dir || key || "?";
  return `${CUTOUT_PUBLIC_ROOT}/${dir}/${String(index + 1).padStart(2, "0")}.png`;
}

export function cutoutFingerprintToken() {
  const counts = Object.entries(CUTOUT_VARIANT_COUNTS).map(([char, count]) => `${char}${count}`).join("");
  return `${CUTOUT_ENGINE_VERSION}:${CUTOUT_MANIFEST_VERSION}:${counts}`;
}

function modeOf(value) {
  const key = String(value || "static").toLowerCase().replace("-", "_");
  return CUTOUT_MODES[key] || CUTOUT_MODES.static;
}

function chaosBeat(progress, seed, slot, key, rate) {
  const charRate = Math.max(4, Number(rate) || 8) * (0.88 + seeded(hashSeed(seed, key, "rate"))() * 0.24);
  const tick = Math.max(0, Math.floor(Number(progress) * charRate));
  const hold = seeded(hashSeed(seed, slot, tick, "hold"))();
  return hold < 0.36 && tick > 0 ? tick - 1 : tick;
}

export function pickCutoutVariant(char, { seed = 1, slot = 0, mode = "static", progress = 0, rate = 8 } = {}) {
  const key = normalizeCutoutChar(char);
  const count = variantCount(key);
  const resolved = modeOf(mode);
  if (resolved === "static" || resolved === "assemble" || resolved === "jitter") {
    return 1 + Math.floor(seeded(hashSeed(seed, key, slot, "base"))() * count);
  }
  const beat = chaosBeat(progress, seed, slot, key, rate);
  return 1 + Math.floor(seeded(hashSeed(seed, key, slot, beat, resolved))() * count);
}

export function cutoutGlyphPlan(char, seed, slot) {
  const rand = seeded(hashSeed(seed, normalizeCutoutChar(char), slot, "glyph"));
  return {
    char: normalizeCutoutChar(char),
    space: char === " ",
    break: char === "\n",
    rot: (rand() - 0.5) * 0.12,
    lift: (rand() - 0.5) * 10,
    scale: 0.9 + rand() * 0.18,
    overlap: 0.03 + rand() * 0.07,
    invert: rand() > 0.55,
    delay: slot * 0.12,
  };
}

function slotMetrics(char, size, plan) {
  const lib = CUTOUT_LIBRARY[char];
  const height = size * plan.scale;
  const aspect = lib ? lib.medianW / Math.max(1, lib.medianH) : 0.72;
  const width = height * aspect;
  return {
    w: width,
    h: height,
    baseline: height * (lib?.medianBaseline || 0.86),
    aspect,
  };
}

export function layoutCutoutText(text, {
  seed = 7,
  size = 120,
  maxWidth = 980,
  letterSpacing = 0.02,
  lineGap = 0.18,
  align = "left",
} = {}) {
  const lines = String(text || "").split("\n");
  const rows = [];
  lines.forEach((line, lineIndex) => {
    const glyphs = [];
    let cursor = 0;
    String(line).split("").forEach((char, index) => {
      const slot = lineIndex * 64 + index;
      const plan = cutoutGlyphPlan(char, seed, slot);
      if (plan.space) {
        cursor += size * 0.22;
        return;
      }
      if (plan.break || !CUTOUT_LIBRARY[plan.char]) return;
      const metrics = slotMetrics(plan.char, size, plan);
      const width = metrics.w * (1 + letterSpacing);
      glyphs.push({
        ...plan,
        slot,
        x: cursor,
        y: plan.lift,
        w: width,
        h: metrics.h,
        baseline: metrics.baseline,
        aspect: metrics.aspect,
      });
      cursor += width * (1 - plan.overlap);
    });
    const width = glyphs.reduce((max, glyph) => Math.max(max, glyph.x + glyph.w), 0);
    const scale = width > maxWidth && width > 0 ? maxWidth / width : 1;
    rows.push({
      glyphs: glyphs.map((glyph) => ({
        ...glyph,
        x: glyph.x * scale,
        y: glyph.y * scale,
        w: glyph.w * scale,
        h: glyph.h * scale,
        baseline: glyph.baseline * scale,
      })),
      width: width * scale,
      height: size * scale,
    });
  });
  const height = rows.reduce((sum, row, index) => sum + row.height + (index ? size * lineGap : 0), 0);
  const width = Math.max(0, ...rows.map((row) => row.width));
  rows.forEach((row) => {
    const shift = align === "center" ? (width - row.width) / 2 : align === "right" ? width - row.width : 0;
    row.glyphs.forEach((glyph) => { glyph.x += shift; });
  });
  return { rows, width, height, seed, size };
}

export function cutoutEnterAmount(mode, progress, delay) {
  const resolved = modeOf(mode);
  if (resolved === "assemble") return clamp((Number(progress) - delay) / 0.1);
  return 1;
}

function jitterOf(mode, progress, seed, slot) {
  const resolved = modeOf(mode);
  if (resolved !== "jitter" && resolved !== "chaos") return { x: 0, y: 0, rot: 0 };
  const rand = seeded(hashSeed(seed, slot, "jitter"));
  const slow = Number(progress) * (0.7 + rand() * 0.5);
  const wave = Math.sin(slow + slot * 0.37);
  const amp = 1 + rand() * 2;
  return {
    x: wave * amp,
    y: Math.cos(slow * 0.82 + slot) * amp * 0.65,
    rot: wave * 0.007,
  };
}

const letterCache = new Map();

export function getCutoutBitmap(char, variant) {
  return letterCache.get(cutoutAssetPath(char, variant)) || null;
}

export function cutoutPreloadPlan(text = "", { seed = 1, mode = "static" } = {}) {
  const resolved = modeOf(mode);
  const chars = cutoutCharsNeeded(text);
  if (resolved === "chaos" || resolved === "match_cut") {
    return chars.flatMap((char) => Array.from({ length: variantCount(char) }, (_, index) => cutoutAssetPath(char, index + 1)));
  }
  const paths = [];
  layoutCutoutText(text, { seed, size: 120, maxWidth: 4000 }).rows.forEach((row) => {
    row.glyphs.forEach((glyph) => {
      paths.push(cutoutAssetPath(glyph.char, pickCutoutVariant(glyph.char, {
        seed,
        slot: glyph.slot,
        mode: resolved,
        progress: 1,
      })));
    });
  });
  return [...new Set(paths)];
}

function loadCutoutPath(path) {
  if (letterCache.has(path)) return Promise.resolve(letterCache.get(path));
  if (typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { letterCache.set(path, image); resolve(image); };
    image.onerror = () => resolve(null);
    image.src = path;
  });
}

export function preloadCutoutText(text = "", options = {}) {
  if (typeof Image === "undefined") return Promise.resolve(letterCache);
  return Promise.all(cutoutPreloadPlan(text, options).map(loadCutoutPath)).then(() => letterCache);
}

export function preloadCutoutChars(text = "", options = {}) {
  return preloadCutoutText(text, { mode: "chaos", ...options });
}

function paintFallbackGlyph(ctx, glyph, x, y) {
  ctx.save();
  ctx.translate(x + glyph.w / 2, y + glyph.h / 2);
  ctx.rotate(glyph.rot);
  ctx.fillStyle = glyph.invert ? "#f4f1ea" : "#ece7dc";
  ctx.fillRect(-glyph.w / 2, -glyph.h / 2, glyph.w, glyph.h);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.strokeRect(-glyph.w / 2, -glyph.h / 2, glyph.w, glyph.h);
  ctx.fillStyle = glyph.invert ? "#11100d" : "#16140f";
  ctx.font = `800 ${Math.round(glyph.h * 0.72)}px ${FALLBACK_FONTS[glyph.slot % FALLBACK_FONTS.length]}, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph.char, 0, 2);
  ctx.restore();
}

function drawCutoutBitmap(ctx, bitmap, glyph, meta, jitter, enter) {
  const slotW = glyph.w;
  const slotH = glyph.h;
  const iw = Math.max(1, bitmap.width || meta?.w || slotW);
  const ih = Math.max(1, bitmap.height || meta?.h || slotH);
  const fit = Math.min(slotW / iw, slotH / ih);
  const dw = iw * fit;
  const dh = ih * fit;
  const cx = dw * (meta?.cx ?? 0.5);
  const base = dh * (meta?.baseline ?? 0.86);
  ctx.translate(glyph.w / 2 + jitter.x, glyph.baseline + jitter.y);
  ctx.rotate(glyph.rot * enter + jitter.rot);
  ctx.drawImage(bitmap, -cx, -base, dw, dh);
}

export function paintCutoutText(ctx, {
  text = "",
  x = 0,
  y = 0,
  maxWidth = 980,
  seed = 7,
  size = 120,
  style = "static",
  animation = "",
  progress = 1,
  rate = 8,
  align = "left",
  letterSpacing = 0.02,
  lineGap = 0.18,
} = {}) {
  if (!ctx) return null;
  const mode = modeOf(animation || style);
  const layout = layoutCutoutText(text, { seed, size, maxWidth, letterSpacing, lineGap, align });
  layout.rows.forEach((row, rowIndex) => {
    row.glyphs.forEach((glyph) => {
      const enter = cutoutEnterAmount(mode, progress, glyph.delay + rowIndex * 0.08);
      if (enter <= 0.02) return;
      const variant = pickCutoutVariant(glyph.char, { seed, slot: glyph.slot, mode, progress, rate });
      const jitter = jitterOf(mode, progress, seed, glyph.slot);
      const dx = x + glyph.x;
      const dy = y + rowIndex * (layout.size * (1 + lineGap)) + glyph.y;
      ctx.save();
      ctx.globalAlpha *= enter;
      const bitmap = getCutoutBitmap(glyph.char, variant);
      if (bitmap) {
        ctx.translate(dx, dy);
        drawCutoutBitmap(ctx, bitmap, glyph, cutoutVariantMeta(glyph.char, variant), jitter, enter);
      } else {
        paintFallbackGlyph(ctx, glyph, dx + jitter.x, dy + jitter.y);
      }
      ctx.restore();
    });
  });
  return layout;
}

export const FONTS = FALLBACK_FONTS;
