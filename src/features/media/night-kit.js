// What every piece of the "night vision" model is drawn with: the type, a face burnt out by its
// own glow, the glass in front of everything (its grey, the dark edge, the lines, the noise),
// the band of readouts, the white blink on the hits and the way a piece ends (the light going
// out). The pieces themselves are night-paint.js, night-summary-paint.js and
// night-announce-paint.js; when things happen comes from night-plan.js.
import { RASTRO_BLUE } from "./night-look.js";

export { RASTRO_BLUE };
export const PALE = "#f4f4f1", GLOW = "rgba(47,128,255,0.75)";
// The picture stays black and white; the club's blue is the light on it: the glow around the
// face and the lettering, the flashes on the hits, the rings and the band.
export const GOTHIC = '"UnifrakturCook", "Old English Text MT", serif', WIDE = '"Archivo", "Inter", Arial, sans-serif';
export const F = 1 / 30;
export const clamp = (value) => Math.max(0, Math.min(1, value));
export const outExpo = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * clamp(p)));
export const inCubic = (p) => clamp(p) ** 3;
export const linear = (p) => clamp(p);
export const ramp = (t, from, length, ease = outExpo) => ease((t - from) / Math.max(1e-6, length));
export const lerp = (a, b, p) => a + (b - a) * p;
export const pad2 = (value) => String(value).padStart(2, "0");

// ---------------------------------------------------------------- type
function setType(ctx, family, weight, size, stretch = "normal") {
  ctx.font = `${weight} ${Math.max(1, size).toFixed(1)}px ${family}`;
  if ("fontStretch" in ctx) ctx.fontStretch = stretch;
}
export function widthOf(ctx, value, family, weight, size, stretch, tracking = 0) {
  setType(ctx, family, weight, size, stretch);
  return ctx.measureText(value).width + tracking * size * String(value).length;
}
/** The largest size, up to `max`, at which `value` fits in `width`. */
export const fit = (ctx, value, family, weight, stretch, width, max, tracking = 0) => Math.min(max, 100 * width / Math.max(1, widthOf(ctx, value, family, weight, 100, stretch, tracking)));

/** One line; `y` is the top of its capitals. `soft` 0..1 is how far out of focus it still is. */
export function write(ctx, value, x, y, { family = WIDE, weight = 700, size, stretch = "normal", color = PALE, align = "left", tracking = 0, alpha = 1, glow = 0, soft = 0, cap = 0.72 } = {}) {
  if (!value || alpha <= 0) return;
  ctx.save();
  setType(ctx, family, weight, size, stretch);
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(tracking * size).toFixed(2)}px`;
  ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillStyle = color; ctx.globalAlpha *= alpha;
  if (soft > 0.03 && typeof ctx.filter === "string") ctx.filter = `blur(${(20 * soft).toFixed(1)}px)`;
  if (glow > 0) { ctx.shadowColor = GLOW; ctx.shadowBlur = glow; }
  ctx.fillText(value, x, y + size * cap);
  ctx.restore();
}
export const gothic = (ctx, value, x, y, size, options = {}) => write(ctx, value, x, y, { family: GOTHIC, weight: 700, size, glow: 16, cap: 0.74, ...options });
/** Small wide capitals, set like a device's readouts; `lines` may hold line breaks. */
export const readout = (ctx, lines, x, y, size, options = {}) => String(lines).split("\n").forEach((line, i) => write(ctx, line, x, y + i * size * 1.3, { weight: 700, size, stretch: "expanded", tracking: 0.12, ...options }));

/** `text` broken into lines no wider than `width`. */
export function wrapLines(ctx, text, { family = WIDE, weight = 700, size, stretch = "normal", tracking = 0, width }) {
  const lines = [];
  let line = "";
  for (const word of String(text || "").split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && widthOf(ctx, next, family, weight, size, stretch, tracking) > width) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// A name is set in the blackletter only when it is letters: its numerals are not used.
export const lettersOnly = (name) => /^[\p{L} .'-]+$/u.test(name);
export const asWritten = (name) => String(name || "").toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (all, lead, letter) => lead + letter.toUpperCase());

// ---------------------------------------------------------------- the face
const layers = new WeakMap();
function cover(layer, source, width, height, focusY) {
  const scale = Math.max(width / source.width, height / source.height), w = source.width * scale, h = source.height * scale;
  layer.drawImage(source, (width - w) / 2, (height - h) * focusY, w, h);
}
function contain(layer, source, width, height) {
  const scale = Math.min(width / source.width, height / source.height) * 0.62, w = source.width * scale, h = source.height * scale;
  layer.drawImage(source, (width - w) / 2, (height - h) * 0.4, w, h);
}
/** Soft-edged ellipse: what is outside it is not there. */
function ellipseMask(layer, width, height, inner) {
  layer.save();
  layer.globalCompositeOperation = "destination-in";
  layer.translate(width * 0.5, height * 0.42); layer.scale(width * 0.54, height * 0.52);
  const fade = layer.createRadialGradient(0, 0, 0, 0, 0, 1);
  fade.addColorStop(inner, "rgba(0,0,0,1)"); fade.addColorStop(1, "rgba(0,0,0,0)");
  layer.fillStyle = fade; layer.fillRect(-2, -2, 4, 4);
  layer.restore();
}
// How much of the club's blue the black-and-white face takes: enough to read as blue in the
// shadows and mid-tones, while the highlights stay white and the picture stays a photo.
export const FACE_TINT = 0.45;

/** Tones a grey picture partly in the club's blue (`amount` 0..1). */
function tint(layer, width, height, amount = FACE_TINT) {
  layer.save();
  layer.globalCompositeOperation = "color"; layer.globalAlpha = amount;
  layer.fillStyle = RASTRO_BLUE; layer.fillRect(0, 0, width, height);
  layer.restore();
}

/**
 * A picture as this model shows it: the face in hard black and white, and two copies of its
 * bright parts bleeding past their edges. Made once per picture and shape; `whole` is for a
 * crest (shown entire, not cropped).
 */
function faceLayers(source, ratio, whole = false) {
  if (!source?.width || typeof document === "undefined") return null;
  let byRatio = layers.get(source);
  if (!byRatio) { byRatio = new Map(); layers.set(source, byRatio); }
  const key = `${ratio.toFixed(2)}:${whole}`;
  if (byRatio.has(key)) return byRatio.get(key);
  const make = (width, filter, inner, glow = 0, toned = false) => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = Math.round(width * ratio);
    const layer = canvas.getContext("2d");
    if (typeof layer.filter === "string") layer.filter = filter;
    if (whole) contain(layer, source, canvas.width, canvas.height); else cover(layer, source, canvas.width, canvas.height, 0.2);
    layer.filter = "none";
    if (toned) tint(layer, canvas.width, canvas.height);
    if (glow > 0) { layer.save(); layer.globalCompositeOperation = "multiply"; layer.globalAlpha = glow; layer.fillStyle = RASTRO_BLUE; layer.fillRect(0, 0, canvas.width, canvas.height); layer.restore(); }
    ellipseMask(layer, canvas.width, canvas.height, inner);
    return canvas;
  };
  const made = {
    base: make(720, "grayscale(1) contrast(1.5) brightness(1.5)", 0.5, 0, true),
    far: make(180, "grayscale(1) contrast(2.4) brightness(1.9) blur(8px)", 0.62, 1),
    near: make(240, "grayscale(1) contrast(3) brightness(2.2) blur(3px)", 0.56),
  };
  byRatio.set(key, made);
  return made;
}

export function drawFace(ctx, source, box, { alpha = 1, zoom = 1, punch = 0, flare = 0, whole = false } = {}) {
  const made = faceLayers(source, box.h / box.w, whole);
  if (!made || alpha <= 0) return;
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h * 0.42); ctx.scale(zoom, zoom); ctx.translate(-box.w / 2, -box.h * 0.42);
  ctx.globalAlpha = alpha; ctx.drawImage(made.base, 0, 0, box.w, box.h);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = alpha * 0.95; ctx.drawImage(made.far, 0, 0, box.w, box.h);
  ctx.globalAlpha = alpha * clamp(0.5 * punch + 0.75 * flare); ctx.drawImage(made.far, 0, 0, box.w, box.h);
  ctx.globalAlpha = alpha * clamp(0.55 + 0.25 * punch); ctx.drawImage(made.near, 0, 0, box.w, box.h);
  ctx.restore();
}

const medals = new WeakMap();
/** A face as a round medal, in the same hard black and white (the players on the pitch). Made once per picture. */
function medalOf(source) {
  if (!source?.width || typeof document === "undefined") return null;
  if (medals.has(source)) return medals.get(source);
  const size = 220, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const layer = canvas.getContext("2d");
  layer.fillStyle = "#0b0b0b"; layer.fillRect(0, 0, size, size);
  // The head sits near the top of a portrait: the square is cut from there, a little closer.
  const scale = Math.max(size / source.width, size / source.height) * 1.12, w = source.width * scale, h = source.height * scale;
  const place = (filter, alpha, mode) => {
    if (typeof layer.filter === "string") layer.filter = filter;
    layer.globalAlpha = alpha; layer.globalCompositeOperation = mode;
    layer.drawImage(source, (size - w) / 2, (size - h) * 0.1, w, h);
  };
  place("grayscale(1) contrast(1.5) brightness(1.4)", 1, "source-over");
  place("grayscale(1) contrast(2.6) brightness(2) blur(5px)", 0.6, "screen");
  layer.filter = "none"; layer.globalAlpha = 1;
  tint(layer, size, size);
  layer.globalAlpha = 1; layer.globalCompositeOperation = "destination-in";
  layer.beginPath(); layer.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); layer.fill();
  medals.set(source, canvas);
  return canvas;
}

/** One player's medal at (`x`, `y`), radius `r`. Without a photo, `fallback` (his number or initials) is written in the ring. */
export function drawMedal(ctx, source, x, y, r, { alpha = 1, flare = 0, fallback = "" } = {}) {
  if (alpha <= 0) return;
  const medal = medalOf(source);
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (medal) ctx.drawImage(medal, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = "#0b0b0b"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    write(ctx, String(fallback), x, y - r * 0.36, { weight: 900, size: r * 0.72, stretch: "semi-expanded", align: "center" });
  }
  ctx.strokeStyle = RASTRO_BLUE; ctx.lineWidth = Math.max(2.5, r * 0.05); ctx.shadowColor = GLOW; ctx.shadowBlur = 10 + 26 * flare;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  if (flare > 0.02) { ctx.globalCompositeOperation = "screen"; ctx.globalAlpha *= clamp(0.7 * flare); ctx.fillStyle = RASTRO_BLUE; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- the glass
let noise = null, lines = null;
function glassParts() {
  if (noise || typeof document === "undefined") return;
  noise = [0, 1, 2].map((seed) => {
    const canvas = document.createElement("canvas");
    canvas.width = 270; canvas.height = 480;
    const layer = canvas.getContext("2d"), image = layer.createImageData(270, 480);
    let state = 7919 + seed * 104729;
    for (let i = 0; i < image.data.length; i += 4) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255; image.data[i + 3] = (state >> 8) % 46;
    }
    layer.putImageData(image, 0, 0);
    return canvas;
  });
  lines = document.createElement("canvas");
  lines.width = 4; lines.height = 5;
  const layer = lines.getContext("2d");
  layer.fillStyle = "rgba(0,0,0,0.22)"; layer.fillRect(0, 0, 4, 2);
}

/** What the glass does to everything behind it: its grey, the dark edge, the lines, the noise. */
function drawGlass(ctx, width, height, frame, flare) {
  glassParts();
  const cx = width / 2, cy = height * 0.42, reach = Math.hypot(width / 2, height * 0.58);
  ctx.save();
  if (flare > 0.01) { ctx.globalCompositeOperation = "screen"; ctx.fillStyle = `rgba(47,128,255,${(0.3 * flare).toFixed(3)})`; ctx.fillRect(0, 0, width, height); }
  ctx.globalCompositeOperation = "multiply";
  const grey = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  grey.addColorStop(0, "#ffffff"); grey.addColorStop(0.46, "#d2d6dd"); grey.addColorStop(1, "#50545d");
  ctx.fillStyle = grey; ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  const edge = ctx.createRadialGradient(cx, cy, reach * 0.38, cx, cy, reach);
  edge.addColorStop(0, "rgba(2,3,5,0)"); edge.addColorStop(1, "rgba(2,3,5,0.84)");
  ctx.fillStyle = edge; ctx.fillRect(0, 0, width, height);
  if (lines && ctx.createPattern) {
    ctx.save(); ctx.translate(0, frame % 5);
    ctx.fillStyle = ctx.createPattern(lines, "repeat"); ctx.fillRect(0, -5, width, height + 10);
    ctx.restore();
  }
  if (noise) { ctx.globalAlpha = 0.34; ctx.drawImage(noise[frame % 3], 0, 0, width, height); }
  ctx.restore();
}

// ---------------------------------------------------------------- what the pieces share
export function geometry(timeline) {
  const { width, height } = timeline, k = height / 1920;
  return { width, height, k, s: Math.max(k, 0.8), box: { x: 40, y: 150 * k, w: width - 80, h: 1500 * k }, band: 1528 * k };
}
export const flareAt = (plan, t) => Math.max(0, ...plan.blinks.map(([at, power]) => (t >= at ? power * Math.exp(-(t - at) / 0.08) : 0)));

/** How far the light has gone out: 0 until `plan.off`, 1 at `plan.end`. */
export const goneAt = (plan, t) => clamp((t - plan.off) / Math.max(F, plan.end - plan.off));

/**
 * Starts a frame: black, then everything drawn after it sits inside the last shot's slow
 * pull-out (from `pullFrom` to the end, starting `from` that much closer). `close` must be
 * called to finish the frame.
 */
export function open(ctx, timeline, t, pullFrom, from = 1.13) {
  const { width, height, night: plan } = timeline;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  if (typeof ctx.filter === "string") ctx.filter = "none";
  ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, width, height);
  const pull = t >= pullFrom ? lerp(from, 1, clamp((t - pullFrom) / Math.max(F, plan.end - pullFrom)) ** 0.6) : 1;
  ctx.save();
  ctx.translate(width / 2, height * 0.46); ctx.scale(pull, pull); ctx.translate(-width / 2, -height * 0.46);
}

/**
 * Ends a frame: the glass over everything and, from `plan.off`, the light going out. The last
 * hit burns the picture white for an instant; then it drifts out of focus behind the glass
 * while the dark edge closes in on the face, until nothing is left.
 */
export function close(ctx, timeline, t, flare) {
  const { width, height, night: plan } = timeline, gone = goneAt(plan, t);
  ctx.restore();
  if (gone > 0.01 && ctx.canvas && typeof ctx.filter === "string") {
    ctx.save();
    ctx.filter = `blur(${(30 * gone ** 1.4).toFixed(1)}px)`;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  }
  drawGlass(ctx, width, height, Math.round(t / F), flare);
  if (t < plan.off) return;
  ctx.save();
  const burn = 0.55 * Math.exp(-(t - plan.off) / 0.13);
  if (burn > 0.01) { ctx.globalCompositeOperation = "screen"; ctx.fillStyle = `rgba(47,128,255,${burn.toFixed(3)})`; ctx.fillRect(0, 0, width, height); ctx.globalCompositeOperation = "source-over"; }
  const eased = gone * gone * (3 - 2 * gone), reach = Math.hypot(width / 2, height * 0.58), outer = reach * (1.06 - 0.98 * eased);
  const dark = ctx.createRadialGradient(width / 2, height * 0.42, outer * 0.3, width / 2, height * 0.42, outer);
  dark.addColorStop(0, `rgba(0,0,0,${(eased ** 2.2).toFixed(3)})`); dark.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = dark; ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * A shade from `top` down to the band, over the face: for words that have to be read (a name,
 * a record), which the glow of a white shirt would otherwise eat.
 */
export function shade(ctx, g, top, alpha = 1) {
  if (alpha <= 0) return;
  const from = top - 150 * g.k, dark = ctx.createLinearGradient(0, from, 0, top + 40 * g.k);
  dark.addColorStop(0, "rgba(4,4,5,0)"); dark.addColorStop(1, `rgba(4,4,5,${(0.66 * alpha).toFixed(3)})`);
  ctx.save();
  ctx.fillStyle = dark; ctx.fillRect(0, from, g.width, g.band + 130 * g.k - from);
  ctx.restore();
}

export function dashes(ctx, g) {
  ctx.save();
  ctx.fillStyle = RASTRO_BLUE; ctx.globalAlpha *= 0.9;
  for (const [x, y] of [[70, 150], [g.width - 100, 150], [70, 760], [g.width - 100, 1500]]) ctx.fillRect(x, y * g.k, 22, 5);
  ctx.restore();
}

/** The band of readouts under the lettering: the club's tag, the day (`first`), a count (`middle`), the league (`last`). */
export function drawBand(ctx, g, alpha, { first = "", middle = "", last = "PRO CLUBS\nFC 27" } = {}) {
  if (alpha <= 0) return;
  const y = g.band, head = String(first).split("\n")[0];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = RASTRO_BLUE; ctx.globalAlpha *= 0.85; ctx.fillRect(70, y, g.width - 140, 2); ctx.globalAlpha /= 0.85;
  ctx.strokeStyle = RASTRO_BLUE; ctx.lineWidth = 2;
  ctx.strokeRect(71, y + 25, 248, 82);
  ctx.beginPath(); ctx.moveTo(71, y + 65); ctx.lineTo(319, y + 65); ctx.moveTo(121, y + 25); ctx.lineTo(121, y + 65); ctx.stroke();
  gothic(ctx, "S", 96, y + 30, 34, { align: "center", glow: 0 });
  write(ctx, "GO STRIX", 134, y + 38, { weight: 700, size: 15, stretch: "expanded", tracking: 0.1 });
  write(ctx, "SÓ PARA QUEM JOGA À NOITE", 195, y + 80, { weight: 700, size: 10.5, stretch: "expanded", tracking: 0.1, align: "center", color: RASTRO_BLUE });
  readout(ctx, first, 372, y + 34, Math.min(19, fit(ctx, head, WIDE, 700, "expanded", 200, 19, 0.12)), { color: RASTRO_BLUE });
  readout(ctx, middle, 600, y + 34, Math.min(19, fit(ctx, String(middle).split("\n")[0], WIDE, 700, "expanded", 240, 19, 0.12)));
  readout(ctx, last, g.width - 70, y + 34, 19, { align: "right" });
  ctx.restore();
}

// The day as a readout: "08 DE OUT DE 2026" → "08 OUT 2026" (it has one narrow column).
export const dayStamp = (dayLabel) => String(dayLabel || "").toUpperCase().replace(/\s+DE\s+/g, " ");

/** A crest in the model's black and white, fitted in a square of side `size` whose top-left is (`x`, `y`). */
export function drawCrest(ctx, bitmap, x, y, size, alpha = 1) {
  if (!bitmap || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (typeof ctx.filter === "string") ctx.filter = "grayscale(1) contrast(1.3) brightness(1.3)";
  const scale = size / Math.max(bitmap.width, bitmap.height), w = bitmap.width * scale, h = bitmap.height * scale;
  ctx.drawImage(bitmap, x + (size - w) / 2, y + (size - h) / 2, w, h);
  ctx.restore();
}
