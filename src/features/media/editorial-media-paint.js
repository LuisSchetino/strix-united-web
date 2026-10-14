// STRIX editorial painter: the one visual direction behind every generated piece
// (Agenda do dia, Relacionados, Resumos, Anúncios). It speaks the product's
// language: ink stage, off-white type at phone scale, hairlines, timetable and
// ledger compositions, and the "now line" — the same mark the app uses to show
// where the night stands — as the transition that reveals each scene. The stage
// is never still, and it moves like an institution, not like a party: under one
// fixed light, an outlined word crosses, hairlines travel at a constant pace and
// one soft band drifts through. Straight lines only: no circles, no rays, nothing
// that sways, flashes or pulses.
// Every value painted comes from the timeline; a missing value renders as "—".
import { boardKit } from "./board-kit.js";
import { logoDrawRect } from "./agenda-paint.js";
import { drawMark, drawMarkBuilding, markSize, sponsorMarksOf } from "./partner-marks.js";
import { sceneAt, remap, easeOutQuart, easeInOutCubic } from "./agenda-timeline.js";
import { relatedNightSceneAt } from "./related-night-timeline.js";
import { lineupBoardPositions } from "./related-night-layout.js";
import { summarySceneAt } from "./summary-timeline.js";
import { announceSceneAt } from "./announce-timeline.js";

const VOID = "#050607";
const STAGE_TOP = "#0e1114";
const STAGE_LOW = "#08090b";
const WHITE = "#fbfaf5";
const SOFT = "#c9cdd2";
const MUTED = "#8e969f";
const FAINT = "#767e88";
const HAIR = "rgba(245,245,245,0.14)";
const HAIR_STRONG = "rgba(245,245,245,0.34)";
const FONT = "Inter, Arial, sans-serif";
// The site's display face: used for the line that names a competition.
const DISPLAY = "Rajdhani, Inter, Arial, sans-serif";
const M = 64; // outer margin at 1080 wide

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const ease = (value) => easeOutQuart(clamp(value));
const pad2 = (value) => String(value).padStart(2, "0");
const dash = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));
const initialsOf = (name, fallback = "S") => String(name || fallback).split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 3).toUpperCase() || fallback;

function setFont(ctx, weight, size, family = FONT) {
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
}

/** Draws one line of text; shrinks to maxWidth instead of clipping it. Returns the size used. */
function drawText(ctx, value, x, y, size, { color = WHITE, weight = 800, align = "left", maxWidth = 0, tracking = 0, baseline = "middle", min = 14, family = FONT } = {}) {
  const text = String(value ?? "");
  if (!text) return size;
  let fitted = size;
  setFont(ctx, weight, fitted, family);
  if (maxWidth > 0) {
    // Tracking widens the line: it counts when the line is fitted to its column.
    const wide = () => ctx.measureText(text).width + tracking * fitted * text.length;
    while (wide() > maxWidth && fitted > min) {
      fitted -= Math.max(1, fitted * 0.04);
      setFont(ctx, weight, fitted, family);
    }
  }
  if ("letterSpacing" in ctx) ctx.letterSpacing = tracking ? `${(tracking * fitted).toFixed(2)}px` : "0px";
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  if (maxWidth > 0) ctx.fillText(text, x, y, maxWidth);
  else ctx.fillText(text, x, y);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  return fitted;
}

/** Fixed-size text: shortens with an ellipsis instead of shrinking. */
function drawClipped(ctx, value, x, y, size, maxWidth, options = {}) {
  let text = String(value ?? "");
  setFont(ctx, options.weight || 600, size);
  if (ctx.measureText(text).width > maxWidth) {
    while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
    text = `${text.trimEnd()}…`;
  }
  drawText(ctx, text, x, y, size, { ...options });
}

/**
 * Names stay whole and inside their column: one line, shrunk a little when needed; a name
 * that would get too small that way is split at a word, and the two lines are shrunk until
 * the widest one fits. Nothing is ever drawn past `maxWidth`.
 */
function fitName(ctx, text, size, weight, maxWidth) {
  const name = String(text || "").trim();
  setFont(ctx, weight, size);
  const width = ctx.measureText(name).width;
  if (width <= maxWidth) return { lines: [name], size };
  const single = size * (maxWidth / width);
  if (single >= size * 0.7) return { lines: [name], size: single };
  const base = size * 0.86;
  const lines = twoLines(ctx, name, base, weight, maxWidth);
  if (lines.length < 2) return { lines: [name], size: single };
  setFont(ctx, weight, base);
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const double = widest > maxWidth ? base * (maxWidth / widest) : base;
  return double > single * 1.12 ? { lines, size: double } : { lines: [name], size: single };
}

/** Splits a name into at most two balanced lines for display sizes. */
function twoLines(ctx, text, size, weight, maxWidth) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  setFont(ctx, weight, size);
  if (words.length < 2 || ctx.measureText(words.join(" ")).width <= maxWidth) return [words.join(" ")];
  let best = [words.join(" ")];
  let bestWidth = Infinity;
  for (let cut = 1; cut < words.length; cut += 1) {
    const lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (widest < bestWidth) { best = lines; bestWidth = widest; }
  }
  return best;
}

/** Masked rise: the line slides up into place from behind its own baseline. */
function drawRise(ctx, value, x, y, size, progress, options = {}) {
  const p = ease(progress);
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath();
  const width = (options.maxWidth || ctx.canvas?.width || 1080 * 2) + size;
  const left = options.align === "center" ? x - width / 2 : options.align === "right" ? x - width : x - size * 0.1;
  ctx.rect(left, y - size * 0.72, width, size * 1.36);
  ctx.clip();
  ctx.globalAlpha *= Math.min(1, p * 1.4);
  ctx.translate(0, (1 - p) * size * 0.95);
  const blur = (1 - p) * size * 0.06;
  if (blur > 0.4 && typeof ctx.filter === "string") ctx.filter = `blur(${blur.toFixed(1)}px)`;
  drawText(ctx, value, x, y, size, options);
  ctx.restore();
}

function drawRule(ctx, x1, y, x2, color = HAIR, width = 1) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function drawGrowRule(ctx, x1, y, x2, progress, color = HAIR_STRONG, width = 1) {
  const p = ease(progress);
  if (p <= 0) return;
  drawRule(ctx, x1, y, x1 + (x2 - x1) * p, color, width);
}

function circle(ctx, x, y, radius) {
  if (typeof ctx.arc === "function") { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); return true; }
  return false;
}

/* ------------------------------------------------------------------ stage */

function scaleOf(timeline) {
  return (timeline?.width || 1080) / 1080;
}

/** Deterministic 0..1 noise: the same frame always paints the same atmosphere. */
function seeded(index, salt = 1) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function measureTracked(ctx, text, weight, size, tracking = 0) {
  setFont(ctx, weight, size);
  if ("letterSpacing" in ctx) ctx.letterSpacing = tracking ? `${(tracking * size).toFixed(2)}px` : "0px";
  const width = ctx.measureText(String(text)).width + ("letterSpacing" in ctx ? 0 : String(text).length * tracking * size);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  return width;
}

/**
 * Outlined display text as a cached layer. Stroking glyphs directly shows every
 * overlap inside a letter (the font builds R, A, X from crossing contours), so
 * the layer strokes at twice the width and then cuts the letters' interior
 * out: only the outer edge remains. Null where there is no DOM canvas (tests).
 */
const outlineLayers = new Map();
function outlinedText(text, size, { color = WHITE, lineWidth = 2, weight = 800 } = {}) {
  if (typeof document === "undefined" || !text) return null;
  const px = Math.max(8, Math.round(size));
  const key = `${text}|${px}|${color}|${lineWidth.toFixed(1)}|${weight}`;
  const cached = outlineLayers.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  const layer = canvas.getContext?.("2d");
  if (!layer) return null;
  const font = `${weight} ${px}px ${FONT}`;
  layer.font = font;
  const advance = layer.measureText(text).width;
  const pad = Math.ceil(lineWidth * 2 + 2);
  canvas.width = Math.ceil(advance + pad * 2);
  canvas.height = Math.ceil(px * 1.3 + pad * 2);
  layer.font = font;
  layer.textAlign = "left";
  layer.textBaseline = "middle";
  layer.lineJoin = "round";
  layer.strokeStyle = color;
  layer.lineWidth = lineWidth * 2;
  layer.strokeText(text, pad, canvas.height / 2);
  layer.globalCompositeOperation = "destination-out";
  layer.fillStyle = "#000";
  layer.fillText(text, pad, canvas.height / 2);
  const entry = { canvas, advance, pad, height: canvas.height };
  // A layer drawn before the display face loaded is not kept.
  if (!document.fonts?.check || document.fonts.check(font)) {
    if (outlineLayers.size > 48) outlineLayers.clear();
    outlineLayers.set(key, entry);
  }
  return entry;
}

/** Draws an outlined word with its left edge (or centre) at x and its middle at y. False when unavailable. */
function drawOutlined(ctx, text, x, y, size, options = {}) {
  const layer = outlinedText(text, size, options);
  if (!layer) return false;
  const left = options.align === "center" ? x - layer.advance / 2 : x;
  ctx.drawImage(layer.canvas, left - layer.pad, y - layer.height / 2);
  return true;
}

/**
 * Passing lines: hairlines that cross the frame from left to right, each at its
 * own height and constant pace, fading in and out along their length. The motion
 * of a broadcast package: straight, level, unhurried. `top`/`bottom` bound the
 * band they travel in.
 */
function drawPassingLines(ctx, timeline, time, { color = "245,245,245", strength = 1, top = 0, bottom = null, count = 5 } = {}) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const low = bottom == null ? height : bottom;
  const span = low - top;
  if (span <= 0 || !ctx.createLinearGradient) return;
  ctx.save();
  for (let index = 0; index < count; index += 1) {
    const y = top + span * (0.08 + 0.84 * seeded(index, 11));
    const length = width * (0.34 + 0.3 * seeded(index, 12));
    const period = 7 + 6 * seeded(index, 13);
    const travel = width + length;
    const x = ((((time / period + seeded(index, 14)) % 1) + 1) % 1) * travel - length;
    const alpha = (0.1 + 0.16 * seeded(index, 15)) * strength;
    const line = ctx.createLinearGradient(x, 0, x + length, 0);
    line.addColorStop(0, `rgba(${color},0)`);
    line.addColorStop(0.5, `rgba(${color},${alpha.toFixed(3)})`);
    line.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = line;
    ctx.fillRect(x, y, length, Math.max(1, 1.5 * s));
  }
  ctx.restore();
}

/**
 * One soft band of light drifting across at a constant, slow pace: wide, faint
 * and level, like a reflection moving over glass. Never more than one.
 */
function drawSoftBand(ctx, timeline, time, { color = "245,245,245", strength = 1, top = 0, bottom = null, period = 15, fade = 0 } = {}) {
  const { width, height } = timeline;
  const low = bottom == null ? height : bottom;
  if (!ctx.createLinearGradient || low <= top) return;
  const reach = width * 0.7;
  const x = ((((time / period) % 1) + 1) % 1) * (width + reach) - reach;
  const band = ctx.createLinearGradient(x, 0, x + reach, 0);
  band.addColorStop(0, `rgba(${color},0)`);
  band.addColorStop(0.5, `rgba(${color},${(0.055 * strength).toFixed(3)})`);
  band.addColorStop(1, `rgba(${color},0)`);
  ctx.save();
  ctx.fillStyle = band;
  // `fade`: the band comes in gradually below `top`, so its upper edge is never a line.
  const steps = fade > 0 ? 12 : 0;
  const base = ctx.globalAlpha;
  for (let step = 0; step < steps; step += 1) {
    ctx.globalAlpha = base * ((step + 0.5) / steps);
    ctx.fillRect(x, top + (fade * step) / steps, reach, fade / steps + 1);
  }
  ctx.globalAlpha = base;
  ctx.fillRect(x, top + fade, reach, low - top - fade);
  ctx.restore();
}

/**
 * What keeps the stage alive behind every scene: an outlined word crossing it
 * slowly, hairlines passing, one soft band, quiet dust, a ticker on the edge and
 * register ticks in the corners.
 */
function drawAtmosphere(ctx, timeline, time, ghost) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const { top, bottom } = region(timeline);
  ctx.save();
  if (ghost) {
    const size = Math.min(height * 0.19, 360 * s);
    const layer = outlinedText(`${String(ghost).toUpperCase()}   `, size, { color: "rgb(245,245,245)", lineWidth: Math.max(1, 1.4 * s) });
    if (layer) {
      const span = Math.max(size, layer.advance);
      const offset = (time * 30 * s) % span;
      ctx.save();
      ctx.globalAlpha = 0.05;
      for (let x = -offset; x < width; x += span) ctx.drawImage(layer.canvas, x - layer.pad, height * 0.845 - layer.height / 2);
      ctx.restore();
    }
  }
  drawSoftBand(ctx, timeline, time, { top, bottom });
  drawPassingLines(ctx, timeline, time, { top, bottom, strength: 0.8 });
  ctx.fillStyle = WHITE;
  for (let index = 0; index < 20; index += 1) {
    const speed = 0.008 + seeded(index, 2) * 0.016;
    const y = ((((seeded(index, 3) - time * speed) % 1) + 1) % 1) * height;
    const size = (1.4 + seeded(index, 5) * 1.8) * s;
    ctx.globalAlpha = 0.07 + 0.05 * seeded(index, 4);
    ctx.fillRect(seeded(index, 1) * width, y, size, size);
  }
  ctx.globalAlpha = 1;
  if (typeof ctx.rotate === "function") {
    const length = bottom - top;
    const text = "STRIX UNITED   ·   FC 27   ·   ";
    ctx.save();
    ctx.translate(width - 27 * s, top + length / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    ctx.rect(-length / 2, -16 * s, length, 32 * s);
    ctx.clip();
    setFont(ctx, 700, 15 * s);
    const span = Math.max(60 * s, ctx.measureText(text).width);
    const offset = (time * 20 * s) % span;
    for (let x = -length / 2 - offset; x < length / 2; x += span) drawText(ctx, text, x, 0, 15 * s, { color: "rgba(245,245,245,0.2)", weight: 700 });
    ctx.restore();
  }
  // Register ticks at the corners of the content area.
  const tick = 16 * s;
  ctx.fillStyle = HAIR_STRONG;
  for (const [x, y, dx, dy] of [[M * s, top + 14 * s, 1, 1], [width - M * s, top + 14 * s, -1, 1], [M * s, bottom - 14 * s, 1, -1], [width - M * s, bottom - 14 * s, -1, -1]]) {
    ctx.fillRect(dx > 0 ? x : x - tick, y, tick, Math.max(1, s));
    ctx.fillRect(x, dy > 0 ? y : y - tick, Math.max(1, s), tick);
  }
  ctx.restore();
}

/**
 * How far down a piece's own header starts. Posted as a story, the top of the frame is covered
 * by Instagram itself (the account's picture and name, and the music's title when there is
 * one): the crest and "STRIX UNITED" were being written under it. In the tall format the
 * header, its rule and everything below them start past that band; the feed format has no
 * such band and stays as it was.
 */
const STORY_TOP_BAND = 150;
function headShift(timeline) {
  const tall = (timeline?.height || 0) / (timeline?.width || 1) > 1.5;
  return tall ? STORY_TOP_BAND * scaleOf(timeline) : 0;
}

/* ---------------------------------------------------------------- partners */

/**
 * The partners' marks in a row centred on (cx, cy), every one `height` tall, a hairline between
 * neighbours. `build(index)` (0→1) lets each one build itself; omitted, they are simply there.
 * Returns the row's width.
 */
function drawSponsorRow(ctx, timeline, marks, { cx, cy, height, gap, maxWidth, build = null } = {}) {
  if (!marks.length) return 0;
  const s = scaleOf(timeline);
  const each = (maxWidth - gap * (marks.length - 1)) / marks.length;
  const sizes = marks.map((mark) => markSize(mark, height, each));
  const total = sizes.reduce((sum, size) => sum + size.w, 0) + gap * (marks.length - 1);
  let x = cx - total / 2;
  marks.forEach((mark, index) => {
    const p = build ? clamp(build(index)) : 1;
    if (p > 0) {
      if (build) drawMarkBuilding(ctx, mark, x, cy, sizes[index], p);
      else drawMark(ctx, mark, x, cy, sizes[index]);
      if (index > 0) {
        ctx.save();
        ctx.globalAlpha *= ease(p * 2);
        ctx.fillStyle = HAIR_STRONG;
        ctx.fillRect(x - gap / 2, cy - height * 0.42, Math.max(1, s), height * 0.84);
        ctx.restore();
      }
    }
    x += sizes[index].w + gap;
  });
  return total;
}

function drawBase(ctx, timeline, { section = "", date = "", counter = "", time = 0, assets = null, ghost = "" } = {}) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setTransform?.(1, 0, 0, 1, 0, 0);
  const stage = ctx.createLinearGradient?.(0, 0, 0, height);
  if (stage) {
    stage.addColorStop(0, STAGE_TOP);
    stage.addColorStop(0.42, VOID);
    stage.addColorStop(1, STAGE_LOW);
    ctx.fillStyle = stage;
  } else ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  // One fixed light from above: the stage is lit, the light does not perform.
  const glow = ctx.createRadialGradient?.(width / 2, height * 0.14, 0, width / 2, height * 0.14, width * 0.9);
  if (glow) {
    glow.addColorStop(0, "rgba(245,245,245,0.055)");
    glow.addColorStop(1, "rgba(245,245,245,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }
  // Vignette: the edges fall away so the centre reads first.
  const vignette = ctx.createRadialGradient?.(width / 2, height * 0.46, Math.min(width, height) * 0.32, width / 2, height * 0.46, Math.max(width, height) * 0.78);
  if (vignette) {
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }
  drawAtmosphere(ctx, timeline, time, ghost);

  // Header: crest, club, piece.
  const shift = headShift(timeline);
  const headY = 104 * s + shift;
  const crest = assets?.strix;
  let textX = M * s;
  if (crest?.bitmap) {
    const rect = logoDrawRect(crest, 58 * s);
    ctx.drawImage(crest.bitmap, rect.sx, rect.sy, rect.sw, rect.sh, M * s, headY - rect.dh / 2, rect.dw, rect.dh);
    textX = M * s + rect.dw + 18 * s;
  }
  drawText(ctx, "STRIX UNITED", textX, headY, 26 * s, { color: WHITE, weight: 800, tracking: 0.12 });
  if (section) drawText(ctx, section.toUpperCase(), width - M * s, headY, 22 * s, { color: MUTED, weight: 700, align: "right", tracking: 0.1, maxWidth: width * 0.42 });
  drawRule(ctx, M * s, 162 * s + shift, width - M * s, HAIR, Math.max(1, s));

  // Footer: date and count.
  const footY = height - 92 * s;
  drawRule(ctx, M * s, footY - 44 * s, width - M * s, HAIR, Math.max(1, s));
  // The partners, small and white, in the middle of the footer row of every frame of every
  // piece: the date on their left and the count on their right keep clear of them.
  const marks = sponsorMarksOf(assets);
  const strip = marks.length ? { height: 32 * s, gap: 44 * s, maxWidth: width * 0.26 } : null;
  const side = strip ? width / 2 - strip.maxWidth / 2 - M * s - 28 * s : width * 0.56;
  if (date) drawText(ctx, date.toUpperCase(), M * s, footY, 22 * s, { color: MUTED, weight: 700, tracking: 0.08, maxWidth: side });
  drawText(ctx, counter ? counter.toUpperCase() : "FC 27", width - M * s, footY, 22 * s, { color: SOFT, weight: 800, align: "right", tracking: 0.08, maxWidth: strip ? side : 0 });
  if (strip) {
    ctx.globalAlpha = 0.9;
    drawSponsorRow(ctx, timeline, marks, { cx: width / 2, cy: footY, ...strip });
  }
  ctx.restore();
}

/** Content region between header and footer rules. */
function region(timeline) {
  const s = scaleOf(timeline);
  return { top: 162 * s + headShift(timeline), bottom: timeline.height - 136 * s };
}

/**
 * The now line: a hairline with a dot sweeping down the stage. Content above it
 * is revealed; content below it is not yet there. Returns true while sweeping.
 */
function withNowLine(ctx, timeline, progress, paint, lineColor = WHITE) {
  const p = ease(progress);
  const { top, bottom } = region(timeline);
  if (p >= 0.999) { paint(); return false; }
  const y = top + (bottom - top) * p;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, timeline.width, y);
  ctx.clip();
  paint();
  ctx.restore();
  const s = scaleOf(timeline);
  const trail = ctx.createLinearGradient?.(0, y - 90 * s, 0, y);
  if (trail) {
    trail.addColorStop(0, "rgba(245,245,245,0)");
    trail.addColorStop(1, "rgba(245,245,245,0.09)");
    ctx.save();
    ctx.fillStyle = trail;
    ctx.fillRect(M * s, y - 90 * s, timeline.width - 2 * M * s, 90 * s);
    ctx.restore();
  }
  drawRule(ctx, M * s, y, timeline.width - M * s, lineColor, Math.max(1, 1.5 * s));
  ctx.save();
  // Micro-flash: the dot blooms for the first instant of the sweep, then settles.
  const flash = Math.max(0, 1 - progress / 0.12);
  if (flash > 0) {
    const bloom = ctx.createRadialGradient?.(M * s, y, 0, M * s, y, 46 * s);
    if (bloom) {
      bloom.addColorStop(0, `rgba(245,245,245,${(0.5 * flash).toFixed(3)})`);
      bloom.addColorStop(1, "rgba(245,245,245,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(M * s - 46 * s, y - 46 * s, 92 * s, 92 * s);
    }
  }
  ctx.fillStyle = lineColor;
  if (circle(ctx, M * s, y, 7 * s)) ctx.fill();
  else ctx.fillRect(M * s - 6 * s, y - 6 * s, 12 * s, 12 * s);
  ctx.restore();
  return true;
}

// A piece opens on its cover. The first frame of the file is what a gallery, a
// chat or a feed shows as the thumbnail, so the opening scene is already whole
// on frame zero: its entrances are run ahead by this much, and the motion of the
// first second is the composition growing into place (from a touch smaller, so
// the first frame sits inside the stage marks) instead of a reveal from nothing.
const COVER_LEAD = 2.4;
const COVER_SETTLE = 0.035;

/**
 * One scene, start to end: a short flash marks the cut, the now line reveals
 * the content, and before the next scene it lifts away. `length` 0 (stills, the
 * last scene) keeps the content in place. `cover` is the opening scene: no
 * reveal, the content is there from the first frame.
 */
function playScene(ctx, timeline, elapsed, length, paint, { sweep = 0.55, lineColor = WHITE, leave = 0.3, cover = false } = {}) {
  const s = scaleOf(timeline);
  const out = length > 0 && leave > 0 ? ease(clamp((length - elapsed) / leave)) : 1;
  ctx.save();
  if (out < 1) {
    ctx.globalAlpha *= out;
    ctx.translate(0, -(1 - out) * 52 * s);
  }
  if (cover) {
    const push = 1 - COVER_SETTLE * (1 - ease(clamp(elapsed / 1.4)));
    ctx.translate(timeline.width / 2, timeline.height / 2);
    ctx.scale(push, push);
    ctx.translate(-timeline.width / 2, -timeline.height / 2);
    paint();
  } else {
    withNowLine(ctx, timeline, remap(elapsed, 0, sweep), paint, lineColor);
  }
  ctx.restore();
  const flash = length > 0 && !cover ? 1 - clamp(elapsed / 0.16) : 0;
  if (flash > 0) {
    const { top, bottom } = region(timeline);
    ctx.save();
    ctx.globalAlpha = 0.07 * flash;
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, top, timeline.width, bottom - top);
    ctx.restore();
  }
}

/** Thin progress hairline: how far into this beat the piece is. */
function drawBeat(ctx, timeline, progress) {
  const s = scaleOf(timeline);
  const y = timeline.height - 136 * s;
  ctx.save();
  ctx.fillStyle = HAIR_STRONG;
  ctx.fillRect(M * s, y - Math.max(1, s), (timeline.width - 2 * M * s) * clamp(progress), Math.max(2, 2 * s));
  ctx.restore();
}

/* ----------------------------------------------------------- crests & faces */

function drawCrest(ctx, asset, x, y, size, fallbackName = "") {
  if (asset?.bitmap) {
    const rect = logoDrawRect(asset, size);
    ctx.drawImage(asset.bitmap, rect.sx, rect.sy, rect.sw, rect.sh, x - rect.dw / 2, y - rect.dh / 2, rect.dw, rect.dh);
    return;
  }
  drawText(ctx, asset?.initials || initialsOf(fallbackName), x, y, size * 0.4, { color: WHITE, weight: 800, align: "center", tracking: -0.02 });
}

// One reusable layer for portraits: the photo is drawn there and masked before it reaches the frame.
let portraitScratch = null;

/**
 * A portrait inside `box` that dissolves into the stage at its foot (the photo
 * itself fades, so no darker block is left under it); with no photo the number
 * or initials become the image, outlined. `border` frames the box.
 */
function drawPortraitBox(ctx, timeline, asset, box, { label = "", time = 0, zoom = 0, border = false } = {}) {
  const { x, y, w, h } = box;
  const s = scaleOf(timeline);
  const bitmap = asset?.bitmap;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (bitmap) {
    const scale = Math.max(w / bitmap.width, h / bitmap.height) * (1.07 - 0.07 * clamp(zoom));
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    const dx = (w - dw) / 2 + Math.sin(time * 0.3) * 6 * s;
    const dy = Math.min(0, (h - dh) * 0.12);
    const scratch = typeof document !== "undefined" ? (portraitScratch ||= document.createElement("canvas")) : null;
    const layer = scratch?.getContext?.("2d");
    if (layer) {
      const lw = Math.max(2, Math.ceil(w));
      const lh = Math.max(2, Math.ceil(h));
      if (scratch.width !== lw || scratch.height !== lh) { scratch.width = lw; scratch.height = lh; }
      else layer.clearRect(0, 0, lw, lh);
      layer.globalCompositeOperation = "source-over";
      layer.drawImage(bitmap, dx, dy, dw, dh);
      const mask = layer.createLinearGradient(0, 0, 0, lh);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(0.5, "rgba(0,0,0,1)");
      mask.addColorStop(0.95, "rgba(0,0,0,0)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      layer.globalCompositeOperation = "destination-in";
      layer.fillStyle = mask;
      layer.fillRect(0, 0, lw, lh);
      ctx.drawImage(scratch, x, y, lw, lh);
    } else {
      ctx.drawImage(bitmap, x + dx, y + dy, dw, dh);
      const fade = ctx.createLinearGradient?.(0, y + h * 0.45, 0, y + h);
      if (fade) {
        fade.addColorStop(0, "rgba(5,6,7,0)");
        fade.addColorStop(1, "rgba(5,6,7,1)");
        ctx.fillStyle = fade;
        ctx.fillRect(x, y, w, h);
      }
    }
  } else {
    const size = Math.min(h * 0.62, w * 0.6, 560 * s);
    if (!drawOutlined(ctx, label, x + w / 2, y + h * 0.48, size, { color: "rgba(245,245,245,0.34)", lineWidth: Math.max(1.5, 2.4 * s), align: "center" })) {
      drawText(ctx, label, x + w / 2, y + h * 0.48, size, { color: FAINT, weight: 800, align: "center" });
    }
  }
  ctx.restore();
  if (border) {
    ctx.save();
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = Math.max(1, s);
    ctx.strokeRect?.(x, y, w, h);
    ctx.restore();
  }
}

/** Full-bleed portrait between `top` and `bottom`. */
function drawPortrait(ctx, timeline, asset, { top, bottom, label = "", time = 0, zoom = 0 } = {}) {
  drawPortraitBox(ctx, timeline, asset, { x: 0, y: top, w: timeline.width, h: bottom - top }, { label, time, zoom });
}

/* ------------------------------------------------------------------ agenda */

/** A match that counts for a competition (anything that is not a friendly). */
const isChampionship = (match) => {
  const name = String(match?.competition || "").trim();
  return Boolean(name) && !/amistos/i.test(name);
};

function paintAgendaCover(ctx, timeline, elapsed, { dayLabel, assets }) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const max = width - 2 * M * s;
  const feed = timeline.format === "feed";
  const cx = width / 2;
  // The cover is one centred column that fills the stage: the crest, the title as wide as the
  // stage lets it (both lines in the same size), a hairline, and the date, small, under it.
  const land = ease(remap(elapsed, 0, 0.7));
  const crest = (feed ? 240 : 350) * s;
  const crestY = height * (feed ? 0.27 : 0.335);
  ctx.save();
  ctx.globalAlpha *= land;
  drawCrest(ctx, assets?.strix, cx, crestY, crest * (0.92 + 0.08 * land), "Strix United");
  ctx.restore();
  const size = Math.min(320 * s, 100 * max / Math.max(1, measureTracked(ctx, "AGENDA", 800, 100, -0.04)));
  const titleY = height * (feed ? 0.475 : 0.5);
  drawRise(ctx, "AGENDA", cx, titleY, size, remap(elapsed, 0.12, 0.85), { color: WHITE, weight: 800, tracking: -0.04, align: "center", maxWidth: max });
  drawRise(ctx, "DO DIA", cx, titleY + size * 0.86, size, remap(elapsed, 0.22, 0.95), { color: MUTED, weight: 800, tracking: -0.04, align: "center", maxWidth: max });
  const ruleY = titleY + size * 1.5;
  const half = (max / 2) * ease(remap(elapsed, 0.3, 1.1));
  if (half > 0) drawRule(ctx, cx - half, ruleY, cx + half, HAIR_STRONG, Math.max(1, 1.5 * s));
  if (dayLabel) drawRise(ctx, dayLabel.toUpperCase(), cx, ruleY + 66 * s, 30 * s, remap(elapsed, 0.4, 1.1), { color: SOFT, weight: 700, tracking: 0.22, align: "center", maxWidth: max });
}

function paintTimetableRow(ctx, timeline, match, { rowTop, rowH, progress, asset, time }) {
  const { width } = timeline;
  const s = scaleOf(timeline);
  const p = ease(progress);
  if (p <= 0) return;
  const x = M * s;
  const right = width - M * s;
  const crestSize = Math.min(148 * s, rowH * 0.38);
  const timeSize = Math.min(124 * s, rowH * 0.32);
  // The competition has its own line at the top of the row, as wide as the row lets it; the
  // hour, the opponent and the crest share the middle of what is left under it.
  const mid = rowTop + rowH * 0.59;
  const titled = isChampionship(match);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 1.3);
  ctx.translate(0, (1 - p) * 36 * s);
  // Every game is a game: all rows sit on the same faint band and read the same way (hour,
  // competition over the opponent, crest). A competition game is told apart by its name in
  // white and by a pass of light as it lands, not by owning the row.
  const band = ctx.createLinearGradient?.(x, 0, right, 0);
  if (band) {
    band.addColorStop(0, "rgba(245,245,245,0.06)");
    band.addColorStop(1, "rgba(245,245,245,0.012)");
    ctx.fillStyle = band;
    ctx.fillRect(x - 24 * s, rowTop + 8 * s, right - x + 48 * s, rowH - 16 * s);
  }
  if (titled && progress > 0 && progress < 1 && ctx.createLinearGradient) {
    const reach = (right - x) * 0.42;
    const at = x - 24 * s - reach + (right - x + 48 * s + reach) * progress;
    const shine = ctx.createLinearGradient(at, 0, at + reach, 0);
    shine.addColorStop(0, "rgba(245,245,245,0)");
    shine.addColorStop(0.5, `rgba(245,245,245,${(0.16 * (1 - progress)).toFixed(3)})`);
    shine.addColorStop(1, "rgba(245,245,245,0)");
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 24 * s, rowTop + 8 * s, right - x + 48 * s, rowH - 16 * s);
    ctx.clip();
    ctx.fillStyle = shine;
    ctx.fillRect(at, rowTop + 8 * s, reach, rowH - 16 * s);
    ctx.restore();
  }
  drawRule(ctx, x, rowTop, right, HAIR, Math.max(1, s));
  setFont(ctx, 800, timeSize);
  const timeText = match.kickoff || "—";
  drawText(ctx, timeText, x - 4 * s, mid, timeSize, { color: WHITE, weight: 800, tracking: -0.04 });
  const timeW = Math.max(ctx.measureText("00:00").width, ctx.measureText(timeText).width);
  const nameX = x + timeW + 32 * s;
  const nameMax = right - crestSize - 32 * s - nameX;
  const nameSize = Math.min(76 * s, rowH * 0.2);
  const fitted = fitName(ctx, match.opponent || "Adversário", nameSize, 800, nameMax);
  const lines = fitted.lines;
  const lineGap = fitted.size * 1.04;
  const metaSize = Math.min(32 * s, rowH * 0.09);
  const round = String(match.round || "").trim();
  // What the game is for comes first, over the opponent: one line, in the display face.
  const leagueSize = Math.min(44 * s, rowH * 0.115);
  drawText(ctx, String(match.competition || "Amistoso").toUpperCase(), nameX, rowTop + rowH * 0.215, leagueSize, { color: titled ? WHITE : MUTED, weight: 700, tracking: 0.08, maxWidth: right - nameX, min: leagueSize * 0.7, family: DISPLAY });
  const blockH = lines.length * lineGap - (lineGap - fitted.size) + (round ? metaSize * 1.25 : 0);
  let y = mid - blockH / 2 + fitted.size * 0.5;
  lines.forEach((line) => { drawText(ctx, line, nameX, y, fitted.size, { color: WHITE, weight: 800, tracking: -0.02 }); y += lineGap; });
  if (round) drawText(ctx, round, nameX, y - lineGap + fitted.size * 0.5 + metaSize * 0.85, metaSize * 0.8, { color: MUTED, weight: 600, maxWidth: nameMax, min: metaSize * 0.5 });
  drawCrest(ctx, asset, right - crestSize / 2, mid, crestSize, match.opponent);
  void time;
  ctx.restore();
}

function paintAgendaPage(ctx, timeline, scene, elapsed, assets, time) {
  const { width } = timeline;
  const s = scaleOf(timeline);
  const { top, bottom } = region(timeline);
  const matches = scene.matches || [];
  const headY = top + 78 * s;
  drawRise(ctx, "HOJE", M * s, headY, 44 * s, remap(elapsed, 0.04, 0.5), { color: WHITE, weight: 800, tracking: 0.04 });
  if (scene.pageCount > 1) drawText(ctx, `${pad2(scene.pageIndex + 1)} / ${pad2(scene.pageCount)}`, width - M * s, headY, 24 * s, { color: MUTED, weight: 700, align: "right" });
  const areaTop = headY + 70 * s;
  const areaBottom = bottom - 40 * s;
  const rows = Math.max(1, matches.length);
  const rowH = Math.min(timeline.format === "feed" ? 270 * s : 400 * s, (areaBottom - areaTop) / Math.max(rows, 3));
  const used = rowH * rows;
  const startY = areaTop + Math.max(0, (areaBottom - areaTop - used) * 0.45);
  // A page cut on a song (film-sound.js) says when each game comes in: `scene.cues`, seconds
  // into the page. Without it, the games follow each other a tenth of a second apart.
  const cueOf = (index) => (Number.isFinite(scene.cues?.[index]) ? scene.cues[index] : 0.06 + index * 0.1);
  matches.forEach((match, index) => paintTimetableRow(ctx, timeline, match, {
    rowTop: startY + index * rowH,
    rowH,
    progress: remap(elapsed, cueOf(index), cueOf(index) + 0.56),
    asset: assets?.opponents?.[scene.firstMatchIndex + index],
    time,
  }));
  const lastY = startY + used;
  drawGrowRule(ctx, M * s, lastY, width - M * s, remap(elapsed, 0.2 + rows * 0.11, 0.8 + rows * 0.11), HAIR);
}

/**
 * The close: as soon as the games have been read, the Strix crest lands in the middle of
 * the stage and keeps growing until the end, when it covers the whole frame. The crest is
 * round, so "the whole frame" means wider than the frame's diagonal: no corner is left.
 */
function paintAgendaClose(ctx, timeline, elapsed, { assets }) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const arrive = ease(remap(elapsed, 0, 0.32));
  const grow = easeInOutCubic(remap(elapsed, 0.12, 2.1));
  const cy = height * 0.47;
  // Light opening behind the crest as it lands.
  const burst = ctx.createRadialGradient?.(width / 2, cy, 0, width / 2, cy, width * (0.35 + 0.6 * grow));
  if (burst) {
    burst.addColorStop(0, `rgba(245,245,245,${(0.16 * arrive * (1 - 0.6 * grow)).toFixed(3)})`);
    burst.addColorStop(1, "rgba(245,245,245,0)");
    ctx.save();
    ctx.fillStyle = burst;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  // The growth is a steady push-in (each instant multiplies the size by the same factor),
  // from a crest that sits in the stage to one whose disc is wider than the diagonal.
  const from = 230 * s;
  const cover = Math.hypot(width, height) * 1.1;
  // Once it covers the frame the crest does not stop: it keeps drifting in, slowly, under what follows.
  const drift = 1 + 0.07 * remap(elapsed, 2.1, 5);
  const size = from * (cover / from) ** grow * (0.86 + 0.14 * arrive) * drift;
  ctx.save();
  ctx.globalAlpha *= arrive;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  drawCrest(ctx, assets?.strix, width / 2, cy + grow * (height / 2 - cy), size, "Strix United");
  ctx.restore();

  // The closing card: the frame darkens over the crest (deeper at the edges, so the owl stays
  // as a shadow in the middle) and the partners' marks build themselves in white, piece by
  // piece, over a hairline that grows from the centre; then one band of light crosses them.
  const marks = sponsorMarksOf(assets);
  const dark = ease(remap(elapsed, 2.0, 2.75));
  if (!marks.length || dark <= 0) return;
  ctx.save();
  ctx.globalAlpha = 1;
  const veil = ctx.createRadialGradient?.(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.62);
  if (veil) {
    veil.addColorStop(0, `rgba(5,6,7,${(0.84 * dark).toFixed(3)})`);
    veil.addColorStop(1, `rgba(5,6,7,${(0.97 * dark).toFixed(3)})`);
    ctx.fillStyle = veil;
  } else ctx.fillStyle = `rgba(5,6,7,${(0.9 * dark).toFixed(3)})`;
  ctx.fillRect(0, 0, width, height);
  const middle = height * 0.5;
  // Whose marks these are, said before they build.
  drawRise(ctx, marks.length === 1 ? "PARCEIRO OFICIAL" : "PARCEIROS OFICIAIS", width / 2, middle - 176 * s, 30 * s, remap(elapsed, 2.3, 2.95), { color: SOFT, weight: 700, align: "center", tracking: 0.26, maxWidth: width - 2 * M * s });
  drawSponsorRow(ctx, timeline, marks, {
    cx: width / 2, cy: middle - 26 * s, height: 132 * s, gap: 110 * s, maxWidth: width - 2 * M * s - 40 * s,
    build: (index) => remap(elapsed, 2.5 + index * 0.3, 3.55 + index * 0.3),
  });
  const line = ease(remap(elapsed, 2.9, 3.9));
  if (line > 0) {
    const half = (width / 2 - M * s) * line;
    drawRule(ctx, width / 2 - half, middle + 96 * s, width / 2 + half, HAIR_STRONG, Math.max(1, 1.5 * s));
  }
  const pass = remap(elapsed, 3.75, 4.9);
  if (pass > 0 && pass < 1 && ctx.createLinearGradient) {
    const reach = width * 0.5;
    const x = -reach + (width + reach) * pass;
    const band = ctx.createLinearGradient(x, 0, x + reach, 0);
    band.addColorStop(0, "rgba(245,245,245,0)");
    band.addColorStop(0.5, "rgba(245,245,245,0.09)");
    band.addColorStop(1, "rgba(245,245,245,0)");
    ctx.fillStyle = band;
    ctx.fillRect(x, middle - 150 * s, reach, 300 * s);
  }
  ctx.restore();
}

export function paintEditorialAgenda(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.width) return;
  const scene = sceneAt(timeline, time);
  const count = timeline.matches?.length || 0;
  drawBase(ctx, timeline, { section: "Agenda do dia", date: dayLabel, counter: count ? `${pad2(count)} ${count === 1 ? "jogo" : "jogos"}` : "", time, assets, ghost: "AGENDA" });
  if (!scene) return;
  const elapsed = time - scene.start;
  const length = scene.end - scene.start;
  if (scene.type === "intro") {
    playScene(ctx, timeline, elapsed, length, () => paintAgendaCover(ctx, timeline, elapsed + COVER_LEAD, { dayLabel, assets }), { cover: true });
    return;
  }
  if (scene.type === "page") {
    playScene(ctx, timeline, elapsed, length, () => paintAgendaPage(ctx, timeline, scene, elapsed, assets, time), { sweep: 0.6 });
    drawBeat(ctx, timeline, remap(elapsed, 0, length));
    return;
  }
  if (scene.type === "finale") {
    playScene(ctx, timeline, elapsed, 0, () => paintAgendaClose(ctx, timeline, elapsed, { assets }));
  }
}

/* ----------------------------------------------------------------- summary */

const RESULT_WORD = { V: "VITÓRIA", E: "EMPATE", D: "DERROTA" };
const resultOf = (match) => {
  const ours = Number(match?.strix_score);
  const theirs = Number(match?.opponent_score);
  if (match?.strix_score == null || match?.opponent_score == null || !Number.isFinite(ours) || !Number.isFinite(theirs)) return "";
  return ours > theirs ? "V" : ours < theirs ? "D" : "E";
};

function paintSummaryCover(ctx, timeline, elapsed) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const x = M * s;
  const max = width - 2 * M * s;
  const period = timeline.period || {};
  const stats = period.stats || {};
  const week = period.mode === "week";
  drawRise(ctx, "RESUMO", x - 6 * s, height * 0.385, 236 * s, remap(elapsed, 0.12, 0.85), { color: WHITE, weight: 800, tracking: -0.04, maxWidth: max });
  drawRise(ctx, week ? "DA SEMANA" : "DO DIA", x - 2 * s, height * 0.49, 140 * s, remap(elapsed, 0.22, 0.95), { color: MUTED, weight: 800, tracking: -0.03, maxWidth: max });
  drawGrowRule(ctx, x, height * 0.56, width - x, remap(elapsed, 0.3, 1.1));
  const record = `${dash(stats.wins)}V  ${dash(stats.draws)}E  ${dash(stats.losses)}D`;
  drawRise(ctx, record, x - 4 * s, height * 0.635, 120 * s, remap(elapsed, 0.4, 1.1), { color: WHITE, weight: 800, tracking: -0.03, maxWidth: max });
}

function paintSummaryStats(ctx, timeline, elapsed) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const x = M * s;
  const stats = timeline.period?.stats || {};
  const headY = height * 0.25;
  drawRise(ctx, "A NOITE.", x - 4 * s, headY + 60 * s, 110 * s, remap(elapsed, 0.06, 0.66), { color: WHITE, weight: 800, tracking: -0.04 });
  const cells = [
    ["JOGOS", dash(stats.games)],
    ["CAMPANHA", `${dash(stats.wins)}V ${dash(stats.draws)}E ${dash(stats.losses)}D`],
    ["GOLS", `${dash(stats.goalsFor)}–${dash(stats.goalsAgainst)}`],
    ["APROVEITAMENTO", stats.efficiency == null ? "—" : `${stats.efficiency}%`],
  ];
  const gridTop = headY + 230 * s;
  const cellW = (width - 2 * M * s) / 2;
  const cellH = Math.min(300 * s, (height * 0.82 - gridTop) / 2);
  cells.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cx = x + col * cellW + (col ? 36 * s : 0);
    const cy = gridTop + row * cellH;
    const p = remap(elapsed, 0.25 + index * 0.09, 0.85 + index * 0.09);
    ctx.save();
    ctx.globalAlpha *= ease(p);
    drawRule(ctx, x + col * cellW, cy, x + (col + 1) * cellW - (col ? 0 : 36 * s), HAIR, Math.max(1, s));
    ctx.restore();
    drawRise(ctx, label, cx, cy + 50 * s, 24 * s, p, { color: MUTED, weight: 700, tracking: 0.1, maxWidth: cellW - 40 * s });
    drawRise(ctx, value, cx - 3 * s, cy + 150 * s, 104 * s, p, { color: WHITE, weight: 800, tracking: -0.04, maxWidth: cellW - 44 * s });
  });
}

function paintScoreline(ctx, timeline, match, assets, elapsed, index, count, dayLabel) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const feed = timeline.format === "feed";
  const p = remap(elapsed, 0.08, 0.7);
  drawRise(ctx, (match.competition || "Amistoso").toUpperCase(), width / 2, height * (feed ? 0.22 : 0.25), 30 * s, p, { color: SOFT, weight: 700, align: "center", tracking: 0.1, maxWidth: width - 2 * M * s });
  if (count > 1) drawText(ctx, `${pad2(index + 1)} / ${pad2(count)}`, width / 2, height * (feed ? 0.27 : 0.285), 22 * s, { color: MUTED, weight: 700, align: "center" });
  const rowY = height * (feed ? 0.45 : 0.43);
  const crestSize = (feed ? 170 : 200) * s;
  const crestP = ease(remap(elapsed, 0.15, 0.8));
  ctx.save();
  ctx.globalAlpha *= crestP;
  drawCrest(ctx, assets?.strix, M * s + crestSize / 2, rowY, crestSize, "Strix United");
  drawCrest(ctx, assets?.opponent, width - M * s - crestSize / 2, rowY, crestSize, match.opponent);
  ctx.restore();
  const scoreSize = (feed ? 210 : 250) * s;
  const scoreP = remap(elapsed, 0.22, 0.95);
  drawRise(ctx, dash(match.strix_score), width / 2 - 70 * s, rowY, scoreSize, scoreP, { color: WHITE, weight: 800, align: "right", tracking: -0.04 });
  drawRise(ctx, "–", width / 2, rowY, scoreSize * 0.42, scoreP, { color: FAINT, weight: 400, align: "center" });
  drawRise(ctx, dash(match.opponent_score), width / 2 + 70 * s, rowY, scoreSize, scoreP, { color: WHITE, weight: 800, align: "left", tracking: -0.04 });
  const nameY = rowY + crestSize * 0.5 + 70 * s;
  const nameMax = width * 0.4;
  drawRise(ctx, "STRIX UNITED", M * s, nameY, 40 * s, remap(elapsed, 0.3, 1), { color: WHITE, weight: 800, maxWidth: nameMax });
  drawRise(ctx, match.opponent || "Adversário", width - M * s, nameY, 40 * s, remap(elapsed, 0.3, 1), { color: WHITE, weight: 800, align: "right", maxWidth: nameMax });
  const result = resultOf(match);
  const word = RESULT_WORD[result];
  const pillY = nameY + 110 * s;
  if (word) {
    const pill = ease(remap(elapsed, 0.45, 1.05));
    ctx.save();
    ctx.globalAlpha *= pill;
    setFont(ctx, 800, 28 * s);
    const w = ctx.measureText(word).width + 56 * s;
    const h = 60 * s;
    if (result === "V") { ctx.fillStyle = WHITE; ctx.fillRect(width / 2 - w / 2, pillY - h / 2, w, h); }
    else if (result === "D") { ctx.fillStyle = "#1c2026"; ctx.fillRect(width / 2 - w / 2, pillY - h / 2, w, h); }
    else { ctx.strokeStyle = HAIR_STRONG; ctx.lineWidth = Math.max(1, 1.5 * s); ctx.strokeRect?.(width / 2 - w / 2, pillY - h / 2, w, h); }
    drawText(ctx, word, width / 2, pillY, 28 * s, { color: result === "V" ? VOID : WHITE, weight: 800, align: "center", tracking: 0.12 });
    ctx.restore();
  }
  const when = [match.dateLabel || dayLabel, match.kickoff].filter(Boolean).join("  ·  ");
  if (when) drawRise(ctx, when.toUpperCase(), width / 2, pillY + 100 * s, 24 * s, remap(elapsed, 0.5, 1.1), { color: MUTED, weight: 700, align: "center", tracking: 0.08, maxWidth: width - 2 * M * s });
}

export function paintEditorialSummary(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.width) return;
  const scene = summarySceneAt(timeline, time);
  const matches = timeline.matches || [];
  const week = timeline.period?.mode === "week";
  drawBase(ctx, timeline, { section: week ? "Resumo da semana" : "Resumo do dia", date: timeline.period?.rangeLabel || dayLabel, counter: `${pad2(matches.length)} ${matches.length === 1 ? "jogo" : "jogos"}`, time, assets, ghost: "RESUMO" });
  // The ending every video shares: the crest covers the frame, then the partners.
  if (timeline.outroStart != null && time >= timeline.outroStart) {
    paintAgendaClose(ctx, timeline, time - timeline.outroStart, { assets });
    return;
  }
  const elapsed = time - (scene?.start || 0);
  const sceneLength = scene && scene.type !== "finale" ? scene.end - scene.start : 0;
  if (scene?.type === "intro") {
    playScene(ctx, timeline, elapsed, sceneLength, () => paintSummaryCover(ctx, timeline, elapsed + COVER_LEAD), { cover: true });
    return;
  }
  if (scene?.type === "stats") {
    playScene(ctx, timeline, elapsed, sceneLength, () => paintSummaryStats(ctx, timeline, elapsed));
    return;
  }
  if (scene?.type === "finale") {
    const stats = timeline.period?.stats || {};
    const { width, height } = timeline;
    const s = scaleOf(timeline);
    playScene(ctx, timeline, elapsed, sceneLength, () => {
      drawRise(ctx, "A HISTÓRIA", width / 2, height * 0.42, 150 * s, remap(elapsed, 0.08, 0.8), { color: WHITE, weight: 800, align: "center", tracking: -0.04, maxWidth: width - 2 * M * s });
      drawRise(ctx, "CONTINUA.", width / 2, height * 0.51, 150 * s, remap(elapsed, 0.18, 0.9), { color: MUTED, weight: 800, align: "center", tracking: -0.04, maxWidth: width - 2 * M * s });
      drawGrowRule(ctx, width * 0.3, height * 0.575, width * 0.7, remap(elapsed, 0.3, 1));
      drawRise(ctx, `${dash(stats.wins)}V ${dash(stats.draws)}E ${dash(stats.losses)}D  ·  ${(timeline.period?.rangeLabel || dayLabel).toUpperCase()}`, width / 2, height * 0.625, 28 * s, remap(elapsed, 0.4, 1.1), { color: SOFT, weight: 700, align: "center", tracking: 0.08, maxWidth: width - 2 * M * s });
    });
    return;
  }
  const result = scene?.type === "result" ? scene : null;
  const index = result?.index ?? matches.length - 1;
  const match = result?.match || matches.at(-1);
  if (!match) return;
  playScene(ctx, timeline, result ? elapsed : 2, sceneLength, () => paintScoreline(ctx, timeline, match, { ...assets, opponent: assets?.opponents?.[index] }, result ? elapsed : 2, index, matches.length, dayLabel));
}

/* ---------------------------------------------------------- people pieces */

function personLabel(person) {
  if (person?.number !== undefined && person?.number !== null && person?.number !== "") return pad2(person.number);
  return initialsOf(person?.name);
}

// Structure roles carry their own light and a solid plate: gold for the board,
// platinum for the council, the club's white for staff. (Rastro Blue stays data.)
const ROLE_ACCENT = Object.freeze({
  diretoria: { line: "#d9b45a", glow: "217,180,90", ink: "#17120a" },
  conselho: { line: "#c4d6f5", glow: "170,196,240", ink: "#0b1220" },
  staff: { line: WHITE, glow: "245,245,245", ink: VOID },
  manager: { line: WHITE, glow: "245,245,245", ink: VOID },
});
const roleAccent = (person) => ROLE_ACCENT[String(person?.extraRole || "").toLowerCase()] || null;

/**
 * The role's ground: a still wash of its colour rising from `y`, a fine pinstripe
 * over it, hairlines passing in that colour and one soft band drifting through.
 * Under a portrait all of it stays in the name block, so nothing crosses a face.
 * Institutional on purpose: straight lines, constant pace, no circles, no rays.
 */
function drawRoleLight(ctx, timeline, accent, y, elapsed, time, { below = true } = {}) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const { top: stageTop } = region(timeline);
  const rise = Math.min(1, elapsed * 1.5);
  const top = below ? y : stageTop;
  const washTop = y - height * 0.16;
  const wash = ctx.createLinearGradient?.(0, washTop, 0, height);
  if (wash) {
    wash.addColorStop(0, `rgba(${accent.glow},0)`);
    wash.addColorStop(0.55, `rgba(${accent.glow},${(0.14 * rise).toFixed(3)})`);
    wash.addColorStop(1, `rgba(${accent.glow},${(0.2 * rise).toFixed(3)})`);
    ctx.save();
    ctx.fillStyle = wash;
    ctx.fillRect(0, washTop, width, height - washTop);
    ctx.restore();
  }
  // Pinstripe: fine vertical lines, still, fading in from the top of the block.
  const step = 28 * s;
  const fade = 220 * s;
  const stripe = ctx.createLinearGradient?.(0, top, 0, top + fade);
  ctx.save();
  if (stripe) {
    stripe.addColorStop(0, `rgba(${accent.glow},0)`);
    stripe.addColorStop(1, `rgba(${accent.glow},${(0.07 * rise).toFixed(3)})`);
    ctx.fillStyle = stripe;
  } else ctx.fillStyle = `rgba(${accent.glow},${(0.05 * rise).toFixed(3)})`;
  for (let x = (width % step) / 2; x < width; x += step) ctx.fillRect(x, top, Math.max(1, s), height - top);
  ctx.restore();
  drawSoftBand(ctx, timeline, time, { color: accent.glow, strength: 1.7 * rise, top, bottom: height, period: 12, fade });
  drawPassingLines(ctx, timeline, time, { color: accent.glow, strength: 1.6 * rise, top: top + fade * 0.5, bottom: height - 150 * s, count: 4 });
}

/** The role as a solid plate that wipes in: the strongest label on the frame. */
function drawRolePlate(ctx, timeline, accent, word, x, y, progress) {
  const s = scaleOf(timeline);
  const p = ease(progress);
  if (p <= 0 || !word) return 0;
  const size = 30 * s;
  const textW = measureTracked(ctx, word, 800, size, 0.16);
  const w = textW + 44 * s;
  const h = 58 * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - h / 2, w * p, h);
  ctx.clip();
  ctx.fillStyle = accent.line;
  ctx.fillRect(x, y - h / 2, w, h);
  drawText(ctx, word, x + 22 * s, y + 1 * s, size, { color: accent.ink, weight: 800, tracking: 0.16 });
  ctx.restore();
  return w;
}

function paintPersonScene(ctx, timeline, person, asset, elapsed, { kicker = "", sceneLength = 3, time = 0, upper = false, phrase = "", phraseFrom = 0.6 } = {}) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const { top } = region(timeline);
  const feed = timeline.format === "feed";
  const photoBottom = height * (feed ? 0.62 : 0.66);
  const accent = roleAccent(person);
  drawPortrait(ctx, timeline, asset, { top, bottom: photoBottom, label: personLabel(person), time, zoom: remap(elapsed, 0, sceneLength) });
  const x = M * s;
  const max = width - 2 * M * s;
  const badge = person.extraBadge || "";
  const name = upper ? String(person.name || "").toUpperCase() : person.name;
  const nameSize = (feed ? 126 : 156) * s;
  const fitted = fitName(ctx, name, nameSize, 800, max);
  const position = person.position || "";

  // The block is laid out first, top to bottom, so the label sits just above the
  // name and the edge bar wraps exactly what it marks.
  const blockTop = photoBottom + (feed ? 30 : 60) * s;
  const labelH = accent ? 58 * s : kicker ? 28 * s : 0;
  const cap = fitted.size * 0.37; // half the cap height: text is drawn on its middle
  // The name sits midway: the same air above it (to the label) as below it (to the line).
  const air = (accent ? 36 : 26) * s;
  const firstLine = blockTop + labelH + (labelH ? air : 0) + cap;
  const lastLine = firstLine + (fitted.lines.length - 1) * fitted.size * 0.98;
  const lineY = lastLine + cap + air;
  const detailY = lineY + 50 * s;
  const blockBottom = detailY + 24 * s;

  if (accent) {
    drawRoleLight(ctx, timeline, accent, photoBottom, elapsed, time);
    // The role, outlined and huge, crosses behind the name.
    if (badge) {
      const layer = outlinedText(`${badge}  `, 250 * s, { color: accent.line, lineWidth: Math.max(1, 1.6 * s) });
      if (layer) {
        const span = Math.max(250 * s, layer.advance);
        const offset = (time * 46 * s) % span;
        ctx.save();
        ctx.globalAlpha *= 0.2 * ease(remap(elapsed, 0.2, 1));
        for (let gx = -offset; gx < width; gx += span) ctx.drawImage(layer.canvas, gx - layer.pad, photoBottom - 84 * s - layer.height / 2);
        ctx.restore();
      }
    }
    // The edge bar, the height of the block.
    const barTop = blockTop - 18 * s;
    ctx.save();
    ctx.fillStyle = accent.line;
    ctx.fillRect(0, barTop, Math.max(4, 10 * s), (blockBottom + 18 * s - barTop) * ease(remap(elapsed, 0.2, 0.9)));
    ctx.restore();
    drawRolePlate(ctx, timeline, accent, badge, x, blockTop + labelH / 2, remap(elapsed, 0.1, 0.7));
  } else if (kicker) {
    drawRise(ctx, kicker, x, blockTop + labelH / 2, 26 * s, remap(elapsed, 0.1, 0.6), { color: MUTED, weight: 700, tracking: 0.14 });
  }

  fitted.lines.forEach((line, lineIndex) => {
    drawRise(ctx, line, x - 4 * s, firstLine + lineIndex * fitted.size * 0.98, fitted.size, remap(elapsed, 0.16 + lineIndex * 0.08, 0.8 + lineIndex * 0.08), { color: WHITE, weight: 800, tracking: -0.035 });
  });

  // The line under the name: the role's colour (white for players), with a shine travelling along it.
  const grow = ease(remap(elapsed, 0.5, 1.2));
  const length = Math.min(max, (accent ? 560 : 300) * s) * grow;
  const thickness = Math.max(2, (accent ? 6 : 3) * s);
  ctx.save();
  ctx.fillStyle = accent ? accent.line : HAIR_STRONG;
  ctx.fillRect(x, lineY, length, thickness);
  const shine = ((time * 0.6) % 1) * length;
  const sheen = grow >= 1 ? ctx.createLinearGradient?.(x + shine - 60 * s, 0, x + shine + 60 * s, 0) : null;
  if (sheen) {
    sheen.addColorStop(0, "rgba(255,255,255,0)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.85)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(x, lineY, length, thickness);
  }
  ctx.restore();

  const positionW = position ? measureTracked(ctx, position, 700, 34 * s, 0.08) + 28 * s : 0;
  if (position) drawRise(ctx, position, x, detailY, 34 * s, remap(elapsed, 0.3, 0.95), { color: SOFT, weight: 700, tracking: 0.08 });
  if (badge && !accent) drawRise(ctx, badge, x + positionW, detailY, 34 * s, remap(elapsed, 0.34, 1), { color: MUTED, weight: 800, tracking: 0.08 });
  if (phrase) drawRise(ctx, phrase, x, detailY + 80 * s, 36 * s, remap(elapsed, phraseFrom, phraseFrom + 0.7), { color: SOFT, weight: 600, maxWidth: max });
}

/** A face in a circle (or the shirt number when there is no photo). */
function drawFace(ctx, asset, person, x, y, size, color = MUTED) {
  const bitmap = asset?.bitmap;
  if (bitmap && circle(ctx, x, y, size / 2)) {
    ctx.save();
    ctx.clip();
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    ctx.drawImage(bitmap, x - (bitmap.width * scale) / 2, y - size / 2, bitmap.width * scale, bitmap.height * scale);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = HAIR_STRONG;
    ctx.lineWidth = 1;
    if (circle(ctx, x, y, size / 2)) ctx.stroke();
    ctx.restore();
    return;
  }
  drawText(ctx, personLabel(person), x, y, size * 0.46, { color, weight: 700, align: "center" });
}

/** Everyone on one screen: faces, names and roles in a ledger of one or two columns. */
function paintLedger(ctx, timeline, title, people, elapsed, { upper = false, assets = null } = {}) {
  const { width } = timeline;
  const s = scaleOf(timeline);
  const { top, bottom } = region(timeline);
  const x = M * s;
  drawRise(ctx, title, x - 4 * s, top + 120 * s, 110 * s, remap(elapsed, 0.05, 0.6), { color: WHITE, weight: 800, tracking: -0.04, maxWidth: width - 2 * M * s });
  const cols = people.length > 8 ? 2 : 1;
  const perCol = Math.ceil(people.length / cols);
  const listTop = top + 220 * s;
  // Short lists breathe: rows grow (up to a point) to fill the screen instead of huddling at the top.
  const rowH = Math.min(230 * s, (bottom - 40 * s - listTop) / Math.max(perCol, 1));
  const gap = 44 * s;
  const colW = (width - 2 * M * s - (cols - 1) * gap) / cols;
  const stagger = Math.min(0.05, 1.2 / Math.max(1, people.length));
  people.forEach((person, index) => {
    const col = Math.floor(index / perCol);
    const row = index % perCol;
    const cx = x + col * (colW + gap);
    const cy = listTop + row * rowH;
    const p = remap(elapsed, 0.2 + index * stagger, 0.75 + index * stagger);
    const accent = roleAccent(person);
    const face = Math.min(150 * s, rowH * 0.62);
    // Every row leaves the same gutter on the left: the role's bar lives there, clear of the face.
    const gutter = 22 * s;
    ctx.save();
    ctx.globalAlpha *= ease(p);
    drawRule(ctx, cx, cy, cx + colW, HAIR, Math.max(1, s));
    drawFace(ctx, assets?.byId?.[person.id], person, cx + gutter + face / 2, cy + rowH / 2, face);
    if (accent) { ctx.fillStyle = accent.line; ctx.fillRect(cx, cy + rowH * 0.2, Math.max(2, 4 * s), rowH * 0.6 * ease(p)); }
    ctx.restore();
    const nameX = cx + gutter + face + 22 * s;
    const metaW = cols > 1 ? 150 * s : 260 * s;
    const nameSize = Math.min(cols > 1 ? 40 * s : 84 * s, rowH * 0.4);
    const name = upper ? String(person.name || "").toUpperCase() : person.name;
    drawRise(ctx, name, nameX, cy + rowH / 2, nameSize, p, { color: WHITE, weight: 800, tracking: -0.02, maxWidth: colW - gutter - face - 22 * s - metaW - 12 * s });
    const meta = accent ? person.extraBadge : [person.position, person.extraBadge].filter(Boolean).join(" · ") || "ELENCO";
    drawRise(ctx, meta, cx + colW, cy + rowH / 2, Math.min(cols > 1 ? 20 * s : 32 * s, rowH * 0.2), p, { color: accent ? accent.line : MUTED, weight: accent ? 800 : 700, align: "right", tracking: 0.06, maxWidth: metaW });
  });
  if (people.length) {
    const end = listTop + perCol * rowH;
    drawGrowRule(ctx, x, end, x + (cols > 1 ? width - 2 * M * s : colW), remap(elapsed, 0.3 + people.length * stagger, 0.9 + people.length * stagger), HAIR);
  }
}

/** The closing mark: the crest lands out of a burst of light, the club's name under it. */
function paintCrestClose(ctx, timeline, elapsed, assets, line = "") {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const cy = height * 0.43;
  const land = ease(remap(elapsed, 0.1, 0.9));
  const burst = ctx.createRadialGradient?.(width / 2, cy, 0, width / 2, cy, width * (0.3 + 0.5 * land));
  if (burst) {
    burst.addColorStop(0, `rgba(245,245,245,${(0.2 * (1 - 0.55 * land)).toFixed(3)})`);
    burst.addColorStop(1, "rgba(245,245,245,0)");
    ctx.save();
    ctx.fillStyle = burst;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha *= land;
  const blur = (1 - land) * 14 * s;
  if (blur > 0.5 && typeof ctx.filter === "string") ctx.filter = `blur(${blur.toFixed(1)}px)`;
  drawCrest(ctx, assets?.strix, width / 2, cy, (340 + 220 * (1 - land)) * s, "Strix United");
  ctx.restore();
  drawRise(ctx, "STRIX UNITED", width / 2, height * 0.615, 96 * s, remap(elapsed, 0.5, 1.2), { color: WHITE, weight: 800, align: "center", tracking: 0.04, maxWidth: width - 2 * M * s });
  drawGrowRule(ctx, width * 0.36, height * 0.66, width * 0.64, remap(elapsed, 0.65, 1.4));
  if (line) drawRise(ctx, line, width / 2, height * 0.695, 30 * s, remap(elapsed, 0.75, 1.4), { color: MUTED, weight: 700, align: "center", tracking: 0.18, maxWidth: width - 2 * M * s });
}

/* -------------------------------------------------------------- relacionados
   The night's list on a pitch board seen from behind our goal: each player's shirt
   and name land on his position (the holding midfielder behind the midfield line,
   wing-backs wide) and stay there, while the player of the moment is presented
   large below it. It is the list of who is called for the night, with more names
   than a team fields, so the piece always names itself "Relacionados da noite" and
   never "Escalação": the board shows where each one plays, not who starts. */

const SECTORS = Object.freeze({
  GOL: { word: "GOLEIRO", plural: "GOLEIROS", v0: 0.86, v1: 1 },
  DEF: { word: "DEFESA", plural: "DEFESA", v0: 0.69, v1: 0.86 },
  MEI: { word: "MEIO-CAMPO", plural: "MEIO-CAMPO", v0: 0.4, v1: 0.69 },
  ATA: { word: "ATAQUE", plural: "ATAQUE", v0: 0.1, v1: 0.4 },
});
const SECTOR_ORDER = Object.freeze(["GOL", "DEF", "MEI", "ATA"]);
const sectorOf = (player) => (SECTORS[player?.group] ? player.group : "MEI");
const sectorWord = (id, count) => (count > 1 ? SECTORS[id].plural : SECTORS[id].word);

/** A point of the pitch (u across, v from the far goal 0 to ours 1) on the tilted board. */
function boardPoint(board, u, v) {
  const depth = v * (0.7 + 0.3 * v); // far rows are foreshortened
  const span = board.topW + (board.w - board.topW) * depth;
  return { x: board.x + board.w / 2 + (u - 0.5) * span, y: board.y + depth * board.h, scale: 0.7 + 0.3 * depth };
}

function boardPath(ctx, board, points, close = true) {
  ctx.beginPath();
  points.forEach(([u, v], index) => {
    const point = boardPoint(board, u, v);
    if (index) ctx.lineTo(point.x, point.y);
    else ctx.moveTo(point.x, point.y);
  });
  if (close) ctx.closePath();
}

/** The board: a slab with mown stripes and every marking of a pitch, in perspective. */
function drawBoard(ctx, board, s) {
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  ctx.save();
  // Thickness: the same outline, dropped.
  ctx.translate(0, 16 * s);
  boardPath(ctx, board, corners);
  ctx.fillStyle = "#07090b";
  ctx.fill();
  ctx.translate(0, -16 * s);
  boardPath(ctx, board, corners);
  const turf = ctx.createLinearGradient?.(0, board.y, 0, board.y + board.h);
  if (turf) {
    turf.addColorStop(0, "#12161b");
    turf.addColorStop(1, "#1a1f26");
    ctx.fillStyle = turf;
  } else ctx.fillStyle = "#161a20";
  ctx.fill();
  for (let band = 0; band < 10; band += 2) {
    boardPath(ctx, board, [[0, band / 10], [1, band / 10], [1, (band + 1) / 10], [0, (band + 1) / 10]]);
    ctx.fillStyle = "rgba(245,245,245,0.03)";
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(245,245,245,0.42)";
  ctx.lineWidth = Math.max(1, 1.6 * s);
  boardPath(ctx, board, corners);
  ctx.stroke();
  boardPath(ctx, board, [[0, 0.5], [1, 0.5]], false);
  ctx.stroke();
  const ring = Array.from({ length: 41 }, (_, index) => {
    const angle = (index / 40) * Math.PI * 2;
    return [0.5 + Math.cos(angle) * 0.15, 0.5 + Math.sin(angle) * 0.085];
  });
  boardPath(ctx, board, ring);
  ctx.stroke();
  for (const [near, far] of [[0, 0.16], [1, 0.84]]) {
    boardPath(ctx, board, [[0.22, near], [0.22, far], [0.78, far], [0.78, near]], false);
    ctx.stroke();
  }
  for (const [near, far] of [[0, 0.055], [1, 0.945]]) {
    boardPath(ctx, board, [[0.37, near], [0.37, far], [0.63, far], [0.63, near]], false);
    ctx.stroke();
  }
  ctx.restore();
}

/** The club's own shirt, with a faint light on its edge so the black reads on the dark pitch. */
function drawKit(ctx, x, y, size, { active = false } = {}) {
  const kit = boardKit.bitmap;
  const h = size * 1.56, w = h * (kit.width / kit.height);
  const top = y - h / 2 - size * 0.28;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  // Two passes of light behind it: a black shirt needs its outline lit to stand on a dark pitch.
  ctx.shadowColor = active ? "rgba(255,255,255,0.95)" : "rgba(245,245,245,0.8)";
  ctx.shadowBlur = size * (active ? 0.24 : 0.17);
  ctx.drawImage(kit, x - w / 2, top, w, h);
  ctx.drawImage(kit, x - w / 2, top, w, h);
  ctx.restore();
  ctx.drawImage(kit, x - w / 2, top, w, h);
}

/** A shirt with the number (or initials) on it. */
function drawShirt(ctx, x, y, size, label, { fill = WHITE, ink = VOID } = {}) {
  const u = size;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x - 0.2 * u, y - 0.5 * u);
  ctx.lineTo(x - 0.52 * u, y - 0.34 * u);
  ctx.lineTo(x - 0.4 * u, y - 0.1 * u);
  ctx.lineTo(x - 0.27 * u, y - 0.17 * u);
  ctx.lineTo(x - 0.27 * u, y + 0.5 * u);
  ctx.lineTo(x + 0.27 * u, y + 0.5 * u);
  ctx.lineTo(x + 0.27 * u, y - 0.17 * u);
  ctx.lineTo(x + 0.4 * u, y - 0.1 * u);
  ctx.lineTo(x + 0.52 * u, y - 0.34 * u);
  ctx.lineTo(x + 0.2 * u, y - 0.5 * u);
  ctx.quadraticCurveTo(x, y - 0.34 * u, x - 0.2 * u, y - 0.5 * u);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawText(ctx, label, x, y + 0.08 * u, u * (String(label).length > 2 ? 0.3 : 0.4), { color: ink, weight: 800, align: "center", tracking: -0.02 });
}

/** Where each name sits on the board, and how wide its tag may be before it meets a neighbour. */
/** How many rows the strip under the pitch takes (0 when everyone is on the pitch). */
function benchRows(timeline) {
  const players = timeline.players || [];
  if (!players.some((player) => player?.slot != null)) return 0;
  const bench = players.filter((player) => player?.bench).length;
  return bench ? (bench > 6 ? 2 : 1) : 0;
}
/** The height the strip needs under the board. */
const benchBand = (timeline) => { const rows = benchRows(timeline); return rows ? (112 + rows * 128) * scaleOf(timeline) : 0; };

/** The strip's own name, on a hairline, under the pitch. */
function drawBenchLabel(ctx, timeline, board, alpha = 1) {
  if (!benchRows(timeline) || alpha <= 0) return;
  const s = scaleOf(timeline);
  const y = board.y + board.h + 40 * s;
  ctx.save();
  ctx.globalAlpha *= alpha;
  drawText(ctx, "RELACIONADOS", board.x, y, 20 * s, { color: MUTED, weight: 800, tracking: 0.16 });
  const from = board.x + measureTracked(ctx, "RELACIONADOS", 800, 20 * s, 0.16) + 18 * s;
  ctx.fillStyle = HAIR;
  ctx.fillRect(from, y - 1, Math.max(0, board.x + board.w - from), Math.max(1, 2 * s));
  ctx.restore();
}

function boardLayout(timeline, board) {
  const players = timeline.players || [];
  const unit = scaleOf(timeline);
  const rows = benchRows(timeline);
  const benchOrder = rows ? players.map((player, index) => (player.bench ? index : -1)).filter((index) => index >= 0) : [];
  const perRow = rows > 1 ? Math.ceil(benchOrder.length / 2) : benchOrder.length;
  const spots = lineupBoardPositions(players).map((spot, index) => {
    const order = benchOrder.indexOf(index);
    if (order < 0) return boardPoint(board, spot.u, spot.v);
    // The strip: one or two rows of the same shirts, a little smaller, under the pitch.
    const row = Math.floor(order / perRow), inRow = Math.min(perRow, benchOrder.length - row * perRow);
    return { x: board.x + board.w * ((order % perRow) + 0.5) / inRow, y: board.y + board.h + (158 + row * 128) * unit, scale: 0.84 };
  });
  return players.map((player, index) => {
    let room = board.w * 0.42;
    spots.forEach((other, otherIndex) => {
      if (otherIndex === index || Math.abs(other.y - spots[index].y) > 40 * scaleOf(timeline)) return;
      room = Math.min(room, Math.abs(other.x - spots[index].x) * 0.94);
    });
    return { player, ...spots[index], room };
  });
}

/** One name on the board: shirt, then the tag under it. `pop` 0→1 is the landing. */
function drawBoardPlayer(ctx, timeline, entry, { pop = 1, active = false, time = 0, sizeBoost = 1 } = {}) {
  if (pop <= 0) return;
  const s = scaleOf(timeline);
  const landing = pop < 1 ? 1 + 0.28 * Math.sin(Math.min(1, pop) * Math.PI) : 1;
  const size = 74 * s * entry.scale * sizeBoost * landing * (active ? 1.12 : 1);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, pop * 1.6);
  if (active) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.globalAlpha *= 0.3 + 0.5 * pulse;
    if (circle(ctx, entry.x, entry.y, size * (0.78 + 0.1 * pulse))) ctx.stroke();
    ctx.restore();
  }
  const shirtY = entry.y - (1 - Math.min(1, pop)) * 46 * s;
  if (boardKit.bitmap) drawKit(ctx, entry.x, shirtY, size, { active });
  else drawShirt(ctx, entry.x, shirtY, size, personLabel(entry.player), { fill: active ? WHITE : "#d9dde2" });
  const fullTag = Math.max(15 * s, 24 * s * entry.scale * sizeBoost);
  const name = String(entry.player.name || "").toUpperCase();
  const natural = measureTracked(ctx, name, 800, fullTag, 0.02) + 18 * s;
  const tagSize = natural > entry.room ? Math.max(fullTag * 0.6, fullTag * (entry.room / natural)) : fullTag;
  const width = Math.min(entry.room, measureTracked(ctx, name, 800, tagSize, 0.02) + 18 * s);
  const tagY = entry.y + size * 0.5 + tagSize * 0.95;
  ctx.fillStyle = "rgba(5,6,7,0.82)";
  ctx.fillRect(entry.x - width / 2, tagY - tagSize * 0.72, width, tagSize * 1.44);
  drawClipped(ctx, name, entry.x, tagY, tagSize, width - 10 * s, { color: WHITE, weight: 800, align: "center", tracking: 0.02 });
  ctx.restore();
}

function paintLineupIntro(ctx, timeline, elapsed, count) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const x = M * s;
  const max = width - 2 * M * s;
  drawRise(ctx, "RELACIONADOS", x - 4 * s, height * 0.335, 150 * s, remap(elapsed, 0.12, 0.85), { color: WHITE, weight: 800, tracking: -0.04, maxWidth: max });
  drawRise(ctx, "DA NOITE", x - 2 * s, height * 0.42, 150 * s, remap(elapsed, 0.22, 0.95), { color: MUTED, weight: 800, tracking: -0.04, maxWidth: max });
  drawGrowRule(ctx, x, height * 0.49, width - x, remap(elapsed, 0.3, 1.1));
  drawRise(ctx, pad2(count), x - 4 * s, height * 0.565, 160 * s, remap(elapsed, 0.4, 1.1), { color: WHITE, weight: 800, tracking: -0.04 });
  setFont(ctx, 800, 160 * s);
  const numberW = ctx.measureText(pad2(count)).width;
  drawRise(ctx, count === 1 ? "NOME NA LISTA" : "NOMES NA LISTA", x + numberW + 28 * s, height * 0.57, 34 * s, remap(elapsed, 0.5, 1.2), { color: SOFT, weight: 700, tracking: 0.08 });
  // The list by sector, from the goal out.
  const sizes = timeline.groupSizes || {};
  const present = SECTOR_ORDER.filter((id) => sizes[id]);
  if (!present.length) return;
  const cellTop = height * 0.68;
  const cellW = max / present.length;
  present.forEach((id, index) => {
    const p = remap(elapsed, 0.6 + index * 0.1, 1.15 + index * 0.1);
    const cx = x + index * cellW;
    ctx.save();
    ctx.globalAlpha *= ease(p);
    drawRule(ctx, cx, cellTop, cx + cellW - 20 * s, HAIR_STRONG, Math.max(1, s));
    ctx.restore();
    drawRise(ctx, sectorWord(id, sizes[id]), cx, cellTop + 44 * s, 22 * s, p, { color: MUTED, weight: 800, tracking: 0.12, maxWidth: cellW - 24 * s });
    drawRise(ctx, pad2(sizes[id]), cx - 2 * s, cellTop + 130 * s, 96 * s, p, { color: WHITE, weight: 800, tracking: -0.04 });
  });
}

function paintLineupPlayer(ctx, timeline, scene, elapsed, time, assets) {
  const { width } = timeline;
  const s = scaleOf(timeline);
  const { top, bottom } = region(timeline);
  const players = timeline.players || [];
  const player = scene.player;
  const index = Math.max(0, players.findIndex((item) => item.id === player.id));
  const id = sectorOf(player);
  const group = players.filter((item) => sectorOf(item) === id);
  const inGroup = Math.max(0, group.findIndex((item) => item.id === player.id));
  const lead = scene.groupLead !== false && inGroup === 0;
  const x = M * s;
  const max = width - 2 * M * s;
  const feed = timeline.format === "feed";

  // The board, with the sector on stage lit and every name called so far in place. It opens the
  // scene (the piece's name is in the header), and it gives room: what is under it, the strip
  // and the player of the moment, always ends above the footer.
  const boardTop = top + 44 * s;
  const playerRoom = (feed ? 330 : 440) * s;
  const boardH = Math.max(300 * s, Math.min(640 * s, (bottom - top) * 0.42, bottom - 22 * s - boardTop - 56 * s - benchBand(timeline) - playerRoom));
  // With a strip under the pitch, the row below starts lower: the pitch keeps its size.
  const board = { x, y: boardTop, w: max, h: boardH, topW: max * 0.58 };
  drawBoard(ctx, board, s);
  drawBenchLabel(ctx, timeline, board);
  const sector = SECTORS[id];
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.save();
  ctx.globalAlpha *= lead ? ease(remap(elapsed, 0, 0.5)) : 1;
  boardPath(ctx, board, [[0, sector.v0], [1, sector.v0], [1, sector.v1], [0, sector.v1]]);
  ctx.fillStyle = `rgba(245,245,245,${(0.07 + 0.04 * pulse).toFixed(3)})`;
  if (!player.bench) ctx.fill();
  ctx.restore();
  const layout = boardLayout(timeline, board);
  layout.forEach((entry, order) => {
    if (order > index) return;
    const current = order === index;
    drawBoardPlayer(ctx, timeline, entry, { pop: current ? remap(elapsed, 0.08, 0.6) : 1, active: current, time });
  });

  // Below the board: the player of the moment.
  const rowTop = boardTop + boardH + 56 * s + benchBand(timeline);
  const rowH = bottom - 22 * s - rowTop;
  const photoW = max * 0.44;
  const photo = { x: width - M * s - photoW, y: rowTop, w: photoW, h: rowH };
  const asset = assets?.byId?.[player.id] || assets?.players?.[scene.index || 0];
  const enter = ease(remap(elapsed, 0.05, 0.55));
  ctx.save();
  ctx.globalAlpha *= enter;
  ctx.translate((1 - enter) * 70 * s, 0);
  drawPortraitBox(ctx, timeline, asset, photo, { label: personLabel(player), time, zoom: remap(elapsed, 0, scene.end - scene.start), border: true });
  ctx.restore();

  const colW = max - photoW - 36 * s;
  const number = player.number !== undefined && player.number !== null && player.number !== "" ? pad2(player.number) : "";
  const fitted = fitName(ctx, player.name, (feed ? 92 : 116) * s, 800, colW);
  const cap = fitted.size * 0.37;
  // The number gives way first when the row is short: the name and the position always fit.
  const rest = fitted.lines.length * fitted.size * 0.98 + 34 * s + 52 * s;
  const wanted = number ? (feed ? 110 : 170) * s : 0;
  const numberH = wanted && rowH - rest - 26 * s >= 80 * s ? Math.min(wanted, rowH - rest - 26 * s) : 0;
  const blockH = numberH + (numberH ? 26 * s : 0) + rest;
  let y = rowTop + Math.max(0, (rowH - blockH) / 2);
  if (numberH) {
    const p = ease(remap(elapsed, 0.1, 0.7));
    ctx.save();
    ctx.globalAlpha *= p;
    if (!drawOutlined(ctx, number, x - 4 * s, y + numberH / 2, numberH, { color: "rgba(245,245,245,0.6)", lineWidth: Math.max(1.5, 2.6 * s) })) {
      drawText(ctx, `Nº ${number}`, x, y + numberH / 2, 34 * s, { color: MUTED, weight: 700, tracking: 0.08 });
    }
    ctx.restore();
    y += numberH + 26 * s;
  }
  fitted.lines.forEach((line, lineIndex) => {
    drawRise(ctx, line, x - 4 * s, y + cap + lineIndex * fitted.size * 0.98, fitted.size, remap(elapsed, 0.14 + lineIndex * 0.08, 0.7 + lineIndex * 0.08), { color: WHITE, weight: 800, tracking: -0.035, maxWidth: colW });
  });
  y += fitted.lines.length * fitted.size * 0.98 + 14 * s;
  drawGrowRule(ctx, x, y, x + Math.min(colW, 260 * s), remap(elapsed, 0.4, 1), WHITE, Math.max(2, 3 * s));
  const detailY = y + 44 * s;
  const position = player.position || "";
  if (position) drawRise(ctx, position, x, detailY, 34 * s, remap(elapsed, 0.28, 0.85), { color: SOFT, weight: 700, tracking: 0.08 });
  const positionW = position ? measureTracked(ctx, position, 700, 34 * s, 0.08) + 28 * s : 0;
  if (player.extraBadge) drawRise(ctx, player.extraBadge, x + positionW, detailY, 30 * s, remap(elapsed, 0.34, 0.9), { color: MUTED, weight: 800, tracking: 0.08, maxWidth: colW - positionW });
}

/** The whole list on the board, every shirt and name in place, under the piece's own name. */
function paintLineupFinale(ctx, timeline, elapsed, time) {
  const { width } = timeline;
  const s = scaleOf(timeline);
  const { top, bottom } = region(timeline);
  const x = M * s;
  const max = width - 2 * M * s;
  // With a line-up, the pitch is the first game's eleven and the strip under it is who plays
  // the other games; the title names the pitch. Without one, it is the whole list.
  const onPitch = (timeline.players || []).filter((player) => player?.slot != null).length;
  drawRise(ctx, onPitch === 11 ? "11 INICIAIS" : onPitch ? "TITULARES" : "RELACIONADOS DA NOITE", x - 4 * s, top + 116 * s, 104 * s, remap(elapsed, 0.05, 0.6), { color: WHITE, weight: 800, tracking: -0.04, maxWidth: max });
  const boardTop = top + 232 * s;
  const board = { x, y: boardTop, w: max, h: bottom - 150 * s - boardTop - benchBand(timeline), topW: max * 0.62 };
  ctx.save();
  ctx.globalAlpha *= ease(remap(elapsed, 0.1, 0.7));
  drawBoard(ctx, board, s);
  ctx.restore();
  drawBenchLabel(ctx, timeline, board, ease(remap(elapsed, 0.3, 0.9)));
  const players = timeline.players || [];
  const boost = players.length > 11 ? 1.05 : 1.25;
  boardLayout(timeline, board).forEach((entry, order) => {
    drawBoardPlayer(ctx, timeline, entry, { pop: remap(elapsed, 0.3 + order * 0.07, 0.8 + order * 0.07), time, sizeBoost: boost });
  });
  const sizes = timeline.groupSizes || {};
  const summary = SECTOR_ORDER.filter((id) => sizes[id]).map((id) => `${pad2(sizes[id])} ${sectorWord(id, sizes[id])}`).join("   ·   ");
  drawRise(ctx, summary, width / 2, bottom - 62 * s, 24 * s, remap(elapsed, 0.6, 1.3), { color: MUTED, weight: 700, align: "center", tracking: 0.12, maxWidth: max });
}

export function paintEditorialRelated(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.width) return;
  const scene = relatedNightSceneAt(timeline, time);
  const players = timeline.players || [];
  const count = players.length;
  drawBase(ctx, timeline, { section: "Relacionados", date: dayLabel, counter: `${pad2(count)} ${count === 1 ? "relacionado" : "relacionados"}`, time, assets, ghost: "RELACIONADOS" });
  // The ending every video shares: the crest covers the frame, then the partners.
  if (timeline.outroStart != null && time >= timeline.outroStart) {
    paintAgendaClose(ctx, timeline, time - timeline.outroStart, { assets });
    return;
  }
  const elapsed = time - (scene?.start || 0);
  if (scene?.type === "intro") {
    playScene(ctx, timeline, elapsed, scene.end - scene.start, () => paintLineupIntro(ctx, timeline, elapsed + COVER_LEAD, count), { cover: true });
    return;
  }
  if (scene?.type === "finale") {
    playScene(ctx, timeline, elapsed, 0, () => paintLineupFinale(ctx, timeline, elapsed, time));
    return;
  }
  const player = scene?.player || players[0];
  if (!player) return;
  const current = scene?.player ? scene : { player, index: 0, start: 0, end: 3, groupLead: true };
  // Within a sector the frame holds and only the player changes; a new sector is swept in by the now line.
  const fresh = current.groupLead !== false;
  playScene(ctx, timeline, fresh ? elapsed : 3, 0, () => paintLineupPlayer(ctx, timeline, current, elapsed, time, assets), { sweep: 0.5 });
}

/* ---------------------------------------------------------------- announce */

function paintAnnounceIntro(ctx, timeline, elapsed, lines, assets = null) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const max = width - 2 * M * s;
  if (assets?.strix) {
    // The crest sits behind the title, large and faint, settling as the lines rise.
    const settle = ease(remap(elapsed, 0, 1.2));
    ctx.save();
    ctx.globalAlpha *= 0.14 * settle;
    drawCrest(ctx, assets.strix, width / 2, height * 0.46, (760 + 120 * (1 - settle)) * s, "Strix United");
    ctx.restore();
  }
  if (lines[0]) drawRise(ctx, lines[0], width / 2, height * 0.365, 30 * s, remap(elapsed, 0.05, 0.6), { color: SOFT, weight: 700, align: "center", tracking: 0.2, maxWidth: max });
  drawRise(ctx, lines[1], width / 2, height * 0.46, 170 * s, remap(elapsed, 0.12, 0.85), { color: WHITE, weight: 800, align: "center", tracking: -0.04, maxWidth: max });
  drawRise(ctx, lines[2], width / 2, height * 0.55, 170 * s, remap(elapsed, 0.22, 0.95), { color: MUTED, weight: 800, align: "center", tracking: -0.04, maxWidth: max });
  drawGrowRule(ctx, width * 0.34, height * 0.615, width * 0.66, remap(elapsed, 0.4, 1.2));
}

/** Chapter card: the board, the council, the staff or the squad, announced before its people. */
function paintSectionCard(ctx, timeline, section, elapsed, time) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const max = width - 2 * M * s;
  const accent = ROLE_ACCENT[section.id] || null;
  const count = section.people.length;
  if (accent) drawRoleLight(ctx, timeline, accent, height * 0.62, elapsed, time, { below: false });
  drawRise(ctx, section.kicker || "", width / 2, height * 0.365, 28 * s, remap(elapsed, 0.04, 0.5), { color: accent ? accent.line : SOFT, weight: 800, align: "center", tracking: 0.22, maxWidth: max });
  drawRise(ctx, section.title[0], width / 2, height * 0.455, 168 * s, remap(elapsed, 0.1, 0.75), { color: WHITE, weight: 800, align: "center", tracking: -0.04, maxWidth: max });
  drawRise(ctx, section.title[1], width / 2, height * 0.545, 168 * s, remap(elapsed, 0.18, 0.85), { color: accent ? accent.line : MUTED, weight: 800, align: "center", tracking: -0.04, maxWidth: max });
  const grow = ease(remap(elapsed, 0.35, 1));
  ctx.save();
  ctx.fillStyle = accent ? accent.line : HAIR_STRONG;
  ctx.fillRect(width / 2 - 230 * s * grow, height * 0.612, 460 * s * grow, Math.max(2, (accent ? 6 : 3) * s));
  ctx.restore();
  drawRise(ctx, `${pad2(count)} ${count === 1 ? "NOME" : "NOMES"}`, width / 2, height * 0.66, 30 * s, remap(elapsed, 0.4, 1), { color: SOFT, weight: 700, align: "center", tracking: 0.16 });
  const names = section.people.map((person) => String(person.name || "").toUpperCase()).join("   ·   ");
  if (count <= 6) drawRise(ctx, names, width / 2, height * 0.705, 30 * s, remap(elapsed, 0.5, 1.1), { color: WHITE, weight: 800, align: "center", tracking: 0.06, maxWidth: max, min: 18 * s });
}

const GROUP_WORD = Object.freeze({ GOL: "GOLEIRO", DEF: "DEFESA", MEI: "MEIO-CAMPO", ATA: "ATAQUE" });

function paintSingleAnnouncement(ctx, timeline, time, assets) {
  const scene = announceSceneAt(timeline, time);
  const person = scene?.person || timeline.person || timeline.people?.[0];
  if (!person) return;
  const elapsed = time - (scene?.start || 0);
  if (scene?.type === "intro") {
    playScene(ctx, timeline, elapsed, scene.end - scene.start, () => paintAnnounceIntro(ctx, timeline, elapsed + COVER_LEAD, ["ANÚNCIO OFICIAL", "UM NOVO", "CAPÍTULO."], assets), { cover: true });
    return;
  }
  const asset = assets?.byId?.[person.id] || assets?.players?.[0];
  const heroStart = timeline.scenes?.find((item) => item.type === "reveal")?.start ?? 0;
  const sinceHero = timeline.still ? 3 : time - heroStart;
  const phraseFrom = timeline.still ? 0 : Math.max(0, (timeline.scenes?.find((item) => item.type === "detail")?.start ?? 7) - heroStart);
  const draw = () => paintPersonScene(ctx, timeline, person, asset, sinceHero, {
    kicker: timeline.announceType === "jogador" ? "NOVO CAPÍTULO" : "NOVO NOME",
    sceneLength: timeline.duration || 10,
    time,
    upper: true,
    phrase: timeline.phrase,
    phraseFrom,
  });
  if (scene?.type === "reveal") withNowLine(ctx, timeline, remap(elapsed, 0, 0.6), draw, roleAccent(person)?.line || WHITE);
  else draw();
  if (scene?.type === "close" || timeline.still) {
    const { width, height } = timeline;
    const s = scaleOf(timeline);
    const closeP = timeline.still ? 1 : ease(remap(elapsed, 0.1, 0.8));
    ctx.save();
    ctx.globalAlpha *= closeP;
    drawCrest(ctx, assets?.strix, width - M * s - 48 * s, height - 220 * s, 96 * s, "Strix United");
    ctx.restore();
  }
}

export function paintEditorialAnnounce(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  const people = timeline.people || [];
  const count = people.length;
  drawBase(ctx, timeline, { section: timeline.kind === "team" ? "Elenco FC 27" : "Anúncio oficial", counter: `${pad2(count)} ${count === 1 ? "nome" : "nomes"}`, time, assets, ghost: timeline.kind === "team" ? "STRIX UNITED" : "FC 27" });
  // The ending every video shares: the crest covers the frame, then the partners.
  if (timeline.outroStart != null && time >= timeline.outroStart) {
    paintAgendaClose(ctx, timeline, time - timeline.outroStart, { assets });
    return;
  }
  if (timeline.kind !== "team") { paintSingleAnnouncement(ctx, timeline, time, assets); return; }
  const scene = announceSceneAt(timeline, time);
  const elapsed = time - (scene?.start || 0);
  const length = scene ? scene.end - scene.start : 0;
  if (scene?.type === "intro") {
    playScene(ctx, timeline, elapsed, length, () => paintAnnounceIntro(ctx, timeline, elapsed + COVER_LEAD, [`${pad2(count)} NOMES  ·  UM ESCUDO`, "UM CLUBE.", "UMA TEMPORADA."], assets), { cover: true });
    return;
  }
  if (scene?.type === "section") {
    playScene(ctx, timeline, elapsed, length, () => paintSectionCard(ctx, timeline, scene.section, elapsed, time), { sweep: 0.45, lineColor: ROLE_ACCENT[scene.section.id]?.line || WHITE });
    return;
  }
  if (scene?.type === "crest") {
    paintCrestClose(ctx, timeline, elapsed, assets, `TEMPORADA ${String(timeline.season || "FC 27").toUpperCase()}`);
    return;
  }
  if (scene?.type === "finale" || scene?.type === "grid") {
    const listed = Array.isArray(scene.people) ? scene.people : people;
    const still = scene.type === "grid";
    const draw = () => paintLedger(ctx, timeline, timeline.title || "ELENCO FC 27", listed, still ? 3 : elapsed, { upper: true, assets });
    if (still) draw();
    else playScene(ctx, timeline, elapsed, length, draw);
    return;
  }
  const person = scene?.person || people[0];
  if (!person) return;
  // his own picture only: the pictures are not in the film's order (see night-announce-paint.js)
  const asset = assets?.byId?.[person.id] || null;
  const accent = roleAccent(person);
  playScene(ctx, timeline, elapsed, length, () => paintPersonScene(ctx, timeline, person, asset, elapsed, {
    kicker: accent ? "" : GROUP_WORD[person.group] || "",
    sceneLength: length || 3,
    time,
    upper: true,
  }), { sweep: 0.5, lineColor: accent?.line || WHITE });
}
