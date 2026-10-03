// STRIX editorial painter: the one visual direction behind every generated piece
// (Agenda do dia, Relacionados, Resumos, Anúncios). It speaks the product's
// language: ink stage, off-white type at phone scale, hairlines, timetable and
// ledger compositions, and the "now line" — the same mark the app uses to show
// where the night stands — as the transition that reveals each scene.
// Every value painted comes from the timeline; a missing value renders as "—".
import { logoDrawRect } from "./agenda-paint.js";
import { sceneAt, remap, easeOutQuart } from "./agenda-timeline.js";
import { relatedNightSceneAt } from "./related-night-timeline.js";
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
const M = 64; // outer margin at 1080 wide

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const ease = (value) => easeOutQuart(clamp(value));
const pad2 = (value) => String(value).padStart(2, "0");
const dash = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));
const initialsOf = (name, fallback = "S") => String(name || fallback).split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 3).toUpperCase() || fallback;

function setFont(ctx, weight, size) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`;
}

/** Draws one line of text; shrinks to maxWidth instead of clipping it. Returns the size used. */
function drawText(ctx, value, x, y, size, { color = WHITE, weight = 800, align = "left", maxWidth = 0, tracking = 0, baseline = "middle", min = 14 } = {}) {
  const text = String(value ?? "");
  if (!text) return size;
  let fitted = size;
  setFont(ctx, weight, fitted);
  if (maxWidth > 0) {
    while (ctx.measureText(text).width > maxWidth && fitted > min) {
      fitted -= Math.max(1, fitted * 0.04);
      setFont(ctx, weight, fitted);
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

/** Names stay whole: shrink to fit one line (down to 50%) before splitting at a word. */
function fitName(ctx, text, size, weight, maxWidth) {
  const name = String(text || "").trim();
  setFont(ctx, weight, size);
  const width = ctx.measureText(name).width;
  if (width <= maxWidth) return { lines: [name], size };
  const scaled = size * (maxWidth / width);
  if (scaled >= size * 0.5) return { lines: [name], size: scaled };
  return { lines: twoLines(ctx, name, size * 0.86, weight, maxWidth), size: size * 0.86 };
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

function drawBase(ctx, timeline, { section = "", date = "", counter = "", time = 0, assets = null } = {}) {
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

  // One slow light crossing the stage keeps the frame alive without texture.
  const drift = (Math.sin(time * 0.21) * 0.5 + 0.5) * width;
  const glow = ctx.createRadialGradient?.(drift, height * 0.18, 0, drift, height * 0.18, width * 0.8);
  if (glow) {
    glow.addColorStop(0, "rgba(245,245,245,0.045)");
    glow.addColorStop(1, "rgba(245,245,245,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  // A single beam of light, very slow, at a fixed angle: depth without texture.
  const beamX = ((time * 0.045) % 1.6 - 0.3) * width;
  const beam = ctx.createLinearGradient?.(beamX - width * 0.35, 0, beamX + width * 0.35, height * 0.6);
  if (beam) {
    beam.addColorStop(0, "rgba(245,245,245,0)");
    beam.addColorStop(0.5, "rgba(245,245,245,0.028)");
    beam.addColorStop(1, "rgba(245,245,245,0)");
    ctx.fillStyle = beam;
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

  // Header: crest, club, piece.
  const headY = 104 * s;
  const crest = assets?.strix;
  let textX = M * s;
  if (crest?.bitmap) {
    const rect = logoDrawRect(crest, 58 * s);
    ctx.drawImage(crest.bitmap, rect.sx, rect.sy, rect.sw, rect.sh, M * s, headY - rect.dh / 2, rect.dw, rect.dh);
    textX = M * s + rect.dw + 18 * s;
  }
  drawText(ctx, "STRIX UNITED", textX, headY, 26 * s, { color: WHITE, weight: 800, tracking: 0.12 });
  if (section) drawText(ctx, section.toUpperCase(), width - M * s, headY, 22 * s, { color: MUTED, weight: 700, align: "right", tracking: 0.1, maxWidth: width * 0.42 });
  drawRule(ctx, M * s, 162 * s, width - M * s, HAIR, Math.max(1, s));

  // Footer: date and count.
  const footY = height - 92 * s;
  drawRule(ctx, M * s, footY - 44 * s, width - M * s, HAIR, Math.max(1, s));
  if (date) drawText(ctx, date.toUpperCase(), M * s, footY, 22 * s, { color: MUTED, weight: 700, tracking: 0.08, maxWidth: width * 0.56 });
  drawText(ctx, counter ? counter.toUpperCase() : "FC 27", width - M * s, footY, 22 * s, { color: SOFT, weight: 800, align: "right", tracking: 0.08 });
  ctx.restore();
}

/** Content region between header and footer rules. */
function region(timeline) {
  const s = scaleOf(timeline);
  return { top: 162 * s, bottom: timeline.height - 136 * s };
}

/**
 * The now line: a hairline with a dot sweeping down the stage. Content above it
 * is revealed; content below it is not yet there. Returns true while sweeping.
 */
function withNowLine(ctx, timeline, progress, paint) {
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
  const trail = ctx.createLinearGradient?.(0, y - 64 * s, 0, y);
  if (trail) {
    trail.addColorStop(0, "rgba(245,245,245,0)");
    trail.addColorStop(1, "rgba(245,245,245,0.07)");
    ctx.save();
    ctx.fillStyle = trail;
    ctx.fillRect(M * s, y - 64 * s, timeline.width - 2 * M * s, 64 * s);
    ctx.restore();
  }
  drawRule(ctx, M * s, y, timeline.width - M * s, WHITE, Math.max(1, 1.5 * s));
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
  ctx.fillStyle = WHITE;
  if (circle(ctx, M * s, y, 7 * s)) ctx.fill();
  else ctx.fillRect(M * s - 6 * s, y - 6 * s, 12 * s, 12 * s);
  ctx.restore();
  return true;
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
  const radius = size * 0.42;
  ctx.save();
  ctx.strokeStyle = HAIR_STRONG;
  ctx.lineWidth = Math.max(1, size * 0.012);
  if (circle(ctx, x, y, radius)) ctx.stroke();
  ctx.restore();
  drawText(ctx, asset?.initials || initialsOf(fallbackName), x, y, size * 0.26, { color: WHITE, weight: 800, align: "center" });
}

/** Full-bleed portrait that fades into the stage; typographic fallback when there is no photo. */
function drawPortrait(ctx, timeline, asset, { top, bottom, label = "", time = 0, zoom = 0 } = {}) {
  const { width } = timeline;
  const h = bottom - top;
  const bitmap = asset?.bitmap;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, width, h);
  ctx.clip();
  if (bitmap) {
    const scale = Math.max(width / bitmap.width, h / bitmap.height) * (1.04 - 0.04 * clamp(zoom));
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    const dx = (width - dw) / 2 + Math.sin(time * 0.3) * 6 * scaleOf(timeline);
    const dy = top + Math.min(0, (h - dh) * 0.12);
    ctx.drawImage(bitmap, dx, dy, dw, dh);
  } else {
    // No photo: the number or initials become the image, outlined on the stage.
    const s = scaleOf(timeline);
    const size = Math.min(h * 0.62, 560 * s);
    if (typeof ctx.strokeText === "function") {
      setFont(ctx, 800, size);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = HAIR_STRONG;
      ctx.lineWidth = Math.max(1.5, 2.4 * s);
      ctx.strokeText(label, width / 2, top + h * 0.52);
    } else drawText(ctx, label, width / 2, top + h * 0.52, size, { color: FAINT, weight: 800, align: "center" });
  }
  const fade = ctx.createLinearGradient?.(0, top + h * 0.45, 0, bottom);
  if (fade) {
    fade.addColorStop(0, "rgba(5,6,7,0)");
    fade.addColorStop(1, "rgba(5,6,7,1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, top, width, h);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ agenda */

function paintAgendaCover(ctx, timeline, elapsed, { count, dayLabel }) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const x = M * s;
  const max = width - 2 * M * s;
  const feed = timeline.format === "feed";
  drawRise(ctx, "AGENDA", x - 6 * s, height * (feed ? 0.40 : 0.385), (feed ? 200 : 236) * s, remap(elapsed, 0.12, 0.85), { color: WHITE, weight: 800, tracking: -0.04, maxWidth: max });
  drawRise(ctx, "DO DIA", x - 2 * s, height * (feed ? 0.535 : 0.49), (feed ? 120 : 140) * s, remap(elapsed, 0.22, 0.95), { color: MUTED, weight: 800, tracking: -0.03, maxWidth: max });
  drawGrowRule(ctx, x, height * (feed ? 0.62 : 0.56), width - x, remap(elapsed, 0.3, 1.1));
  drawRise(ctx, pad2(count), x - 4 * s, height * (feed ? 0.71 : 0.635), (feed ? 130 : 160) * s, remap(elapsed, 0.4, 1.1), { color: WHITE, weight: 800, tracking: -0.04 });
  setFont(ctx, 800, (feed ? 130 : 160) * s);
  const numberW = ctx.measureText(pad2(count)).width;
  drawRise(ctx, count === 1 ? "JOGO MARCADO" : "JOGOS MARCADOS", x + numberW + 28 * s, height * (feed ? 0.715 : 0.64), 34 * s, remap(elapsed, 0.5, 1.2), { color: SOFT, weight: 700, tracking: 0.08, maxWidth: max - numberW - 28 * s });
}

function paintTimetableRow(ctx, timeline, match, { rowTop, rowH, progress, asset }) {
  const { width } = timeline;
  const s = scaleOf(timeline);
  const p = ease(progress);
  if (p <= 0) return;
  const x = M * s;
  const right = width - M * s;
  const crestSize = Math.min(124 * s, rowH * 0.36);
  const timeSize = Math.min(148 * s, rowH * 0.36);
  const mid = rowTop + rowH / 2;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 1.3);
  ctx.translate(0, (1 - p) * 36 * s);
  drawRule(ctx, x, rowTop, right, HAIR, Math.max(1, s));
  setFont(ctx, 800, timeSize);
  const timeText = match.kickoff || "—";
  drawText(ctx, timeText, x - 4 * s, mid, timeSize, { color: WHITE, weight: 800, tracking: -0.04 });
  const timeW = Math.max(ctx.measureText("00:00").width, ctx.measureText(timeText).width);
  const nameX = x + timeW + 32 * s;
  const nameMax = right - crestSize - 24 * s - nameX;
  const nameSize = Math.min(76 * s, rowH * 0.2);
  const fitted = fitName(ctx, match.opponent || "Adversário", nameSize, 800, nameMax);
  const lines = fitted.lines;
  const lineGap = fitted.size * 1.04;
  const metaSize = Math.min(32 * s, rowH * 0.09);
  const blockH = lines.length * lineGap + metaSize * 1.5;
  let y = mid - blockH / 2 + fitted.size * 0.5;
  lines.forEach((line) => { drawText(ctx, line, nameX, y, fitted.size, { color: WHITE, weight: 800, tracking: -0.02 }); y += lineGap; });
  const meta = [match.competition || "Amistoso", match.round].filter(Boolean).join("  ·  ");
  drawClipped(ctx, meta, nameX, y + metaSize * 0.2, metaSize, nameMax, { color: MUTED, weight: 600 });
  drawCrest(ctx, asset, right - crestSize / 2, mid, crestSize, match.opponent);
  ctx.restore();
}

function paintAgendaPage(ctx, timeline, scene, elapsed, assets) {
  const { width, height } = timeline;
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
  matches.forEach((match, index) => paintTimetableRow(ctx, timeline, match, {
    rowTop: startY + index * rowH,
    rowH,
    progress: remap(elapsed, 0.06 + index * 0.1, 0.62 + index * 0.1),
    asset: assets?.opponents?.[scene.firstMatchIndex + index],
  }));
  const lastY = startY + used;
  drawGrowRule(ctx, M * s, lastY, width - M * s, remap(elapsed, 0.2 + rows * 0.11, 0.8 + rows * 0.11), HAIR);
  void height;
}

function paintAgendaClose(ctx, timeline, elapsed, { first, count, dayLabel, assets }) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const feed = timeline.format === "feed";
  drawRise(ctx, "A NOITE COMEÇA ÀS", width / 2, height * (feed ? 0.3 : 0.34), 36 * s, remap(elapsed, 0.05, 0.6), { color: SOFT, weight: 700, align: "center", tracking: 0.1 });
  drawRise(ctx, first || "—", width / 2, height * (feed ? 0.45 : 0.45), (feed ? 230 : 280) * s, remap(elapsed, 0.12, 0.9), { color: WHITE, weight: 800, align: "center", tracking: -0.05 });
  drawGrowRule(ctx, width * 0.3, height * (feed ? 0.57 : 0.545), width * 0.7, remap(elapsed, 0.3, 1));
  const crestP = ease(remap(elapsed, 0.35, 1));
  ctx.save();
  ctx.globalAlpha *= crestP;
  drawCrest(ctx, assets?.strix, width / 2, height * (feed ? 0.67 : 0.62), 128 * s, "Strix United");
  ctx.restore();
  drawRise(ctx, `${pad2(count)} ${count === 1 ? "JOGO" : "JOGOS"}  ·  ${dayLabel.toUpperCase()}`, width / 2, height * (feed ? 0.77 : 0.7), 26 * s, remap(elapsed, 0.45, 1.1), { color: MUTED, weight: 700, align: "center", tracking: 0.08, maxWidth: width - 2 * M * s });
}

export function paintEditorialAgenda(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.width) return;
  const scene = sceneAt(timeline, time);
  const count = timeline.matches?.length || 0;
  drawBase(ctx, timeline, { section: "Agenda do dia", date: dayLabel, counter: count ? `${pad2(count)} ${count === 1 ? "jogo" : "jogos"}` : "", time, assets });
  if (!scene) return;
  const elapsed = time - scene.start;
  if (scene.type === "intro") {
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.55), () => paintAgendaCover(ctx, timeline, elapsed, { count, dayLabel }));
    return;
  }
  if (scene.type === "page") {
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.6), () => paintAgendaPage(ctx, timeline, scene, elapsed, assets));
    drawBeat(ctx, timeline, remap(elapsed, 0, scene.end - scene.start));
    return;
  }
  if (scene.type === "finale") {
    const first = timeline.matches?.[0]?.kickoff || "";
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.55), () => paintAgendaClose(ctx, timeline, elapsed, { first, count, dayLabel, assets }));
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
  drawBase(ctx, timeline, { section: week ? "Resumo da semana" : "Resumo do dia", date: timeline.period?.rangeLabel || dayLabel, counter: `${pad2(matches.length)} ${matches.length === 1 ? "jogo" : "jogos"}`, time, assets });
  const elapsed = time - (scene?.start || 0);
  if (scene?.type === "intro") {
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.55), () => paintSummaryCover(ctx, timeline, elapsed));
    return;
  }
  if (scene?.type === "stats") {
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.55), () => paintSummaryStats(ctx, timeline, elapsed));
    return;
  }
  if (scene?.type === "finale") {
    const stats = timeline.period?.stats || {};
    const { width, height } = timeline;
    const s = scaleOf(timeline);
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.55), () => {
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
  withNowLine(ctx, timeline, remap(elapsed, 0, 0.5), () => paintScoreline(ctx, timeline, match, { ...assets, opponent: assets?.opponents?.[index] }, result ? elapsed : 2, index, matches.length, dayLabel));
}

/* ---------------------------------------------------------- people pieces */

function personLabel(person) {
  if (person?.number !== undefined && person?.number !== null && person?.number !== "") return pad2(person.number);
  return initialsOf(person?.name);
}

// Structure roles get their own light: gold for the board, blue for the council.
const ROLE_ACCENT = Object.freeze({
  diretoria: { line: "#d9b45a", glow: "217,180,90" },
  conselho: { line: "#2F80FF", glow: "47,128,255" },
});

function paintPersonScene(ctx, timeline, person, asset, elapsed, { counter = "", sceneLength = 3, time = 0, upper = false, phrase = "", phraseFrom = 0.6 } = {}) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const { top } = region(timeline);
  const feed = timeline.format === "feed";
  const photoBottom = height * (feed ? 0.62 : 0.66);
  drawPortrait(ctx, timeline, asset, { top, bottom: photoBottom, label: personLabel(person), time, zoom: remap(elapsed, 0, sceneLength) });
  const x = M * s;
  const max = width - 2 * M * s;
  const accent = ROLE_ACCENT[String(person.extraRole || "").toLowerCase()] || null;
  if (accent) {
    // A coloured light rises from under the portrait and breathes slowly.
    const breathe = 0.75 + Math.sin(time * 1.6) * 0.25;
    const glow = ctx.createRadialGradient?.(width / 2, photoBottom, 0, width / 2, photoBottom, width * 0.75);
    if (glow) {
      glow.addColorStop(0, `rgba(${accent.glow},${(0.26 * breathe * Math.min(1, elapsed * 1.5)).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${accent.glow},0)`);
      ctx.save();
      ctx.fillStyle = glow;
      ctx.fillRect(0, top, width, height - top);
      ctx.restore();
    }
  }
  const baseY = photoBottom + 18 * s;
  if (counter) drawRise(ctx, counter, x, baseY, 24 * s, remap(elapsed, 0.1, 0.6), { color: MUTED, weight: 700, tracking: 0.1 });
  const name = upper ? String(person.name || "").toUpperCase() : person.name;
  const nameSize = (feed ? 126 : 156) * s;
  const fitted = fitName(ctx, name, nameSize, 800, max);
  let y = baseY + 44 * s + fitted.size * 0.62;
  fitted.lines.forEach((line, lineIndex) => {
    drawRise(ctx, line, x - 4 * s, y, fitted.size, remap(elapsed, 0.16 + lineIndex * 0.08, 0.8 + lineIndex * 0.08), { color: WHITE, weight: 800, tracking: -0.035 });
    y += fitted.size * 0.98;
  });
  if (accent) {
    // The role's line grows under the name, with a short shine travelling along it.
    const lineY = y - fitted.size * 0.34;
    const grow = ease(remap(elapsed, 0.5, 1.2));
    const length = Math.min(max, 420 * s) * grow;
    ctx.save();
    ctx.fillStyle = accent.line;
    ctx.fillRect(x, lineY, length, Math.max(2, 4 * s));
    const shine = ((time * 0.6) % 1) * length;
    const sheen = ctx.createLinearGradient?.(x + shine - 60 * s, 0, x + shine + 60 * s, 0);
    if (sheen && grow >= 1) {
      sheen.addColorStop(0, "rgba(255,255,255,0)");
      sheen.addColorStop(0.5, "rgba(255,255,255,0.85)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(x, lineY, length, Math.max(2, 4 * s));
    }
    ctx.restore();
    y += 18 * s;
  }
  const detailY = y + 4 * s;
  const position = person.position || "";
  const badge = person.extraBadge || "";
  setFont(ctx, 700, 34 * s);
  if (position) drawRise(ctx, position, x, detailY, 34 * s, remap(elapsed, 0.3, 0.95), { color: SOFT, weight: 700, tracking: 0.08 });
  const positionW = position ? ctx.measureText(position).width + 28 * s : 0;
  if (badge) drawRise(ctx, badge, x + positionW, detailY, 34 * s, remap(elapsed, 0.34, 1), { color: accent ? accent.line : MUTED, weight: 800, tracking: 0.08 });
  if (phrase) drawRise(ctx, phrase, x, detailY + 80 * s, 36 * s, remap(elapsed, phraseFrom, phraseFrom + 0.7), { color: SOFT, weight: 600, maxWidth: max });
}

function paintLedger(ctx, timeline, title, people, elapsed, { page = 0, pages = 1, upper = false } = {}) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const { top, bottom } = region(timeline);
  const x = M * s;
  drawRise(ctx, title, x - 4 * s, top + 120 * s, 110 * s, remap(elapsed, 0.05, 0.6), { color: WHITE, weight: 800, tracking: -0.04, maxWidth: width - 2 * M * s });
  if (pages > 1) drawText(ctx, `${pad2(page + 1)} / ${pad2(pages)}`, width - M * s, top + 120 * s, 24 * s, { color: MUTED, weight: 700, align: "right" });
  const cols = people.length > 9 ? 2 : 1;
  const perCol = Math.ceil(people.length / cols);
  const listTop = top + 230 * s;
  const rowH = Math.min(118 * s, (bottom - 40 * s - listTop) / Math.max(perCol, 1));
  const colW = (width - 2 * M * s - (cols - 1) * 40 * s) / cols;
  people.forEach((person, index) => {
    const col = Math.floor(index / perCol);
    const row = index % perCol;
    const cx = x + col * (colW + 40 * s);
    const cy = listTop + row * rowH;
    const p = remap(elapsed, 0.2 + index * 0.05, 0.75 + index * 0.05);
    ctx.save();
    ctx.globalAlpha *= ease(p);
    drawRule(ctx, cx, cy, cx + colW, HAIR, Math.max(1, s));
    ctx.restore();
    const numberSize = Math.min(34 * s, rowH * 0.32);
    const nameSize = Math.min(52 * s, rowH * 0.42);
    drawRise(ctx, personLabel(person), cx, cy + rowH / 2, numberSize, p, { color: MUTED, weight: 700 });
    const name = upper ? String(person.name || "").toUpperCase() : person.name;
    drawRise(ctx, name, cx + 90 * s, cy + rowH / 2, nameSize, p, { color: WHITE, weight: 800, tracking: -0.02, maxWidth: colW - 90 * s - 170 * s });
    drawRise(ctx, [person.position, person.extraBadge].filter(Boolean).join(" · ") || "ELENCO", cx + colW, cy + rowH / 2, Math.min(26 * s, rowH * 0.24), p, { color: MUTED, weight: 700, align: "right", maxWidth: 170 * s });
  });
  if (people.length) {
    const end = listTop + perCol * rowH;
    drawGrowRule(ctx, x, end, x + (cols > 1 ? width - 2 * M * s : colW), remap(elapsed, 0.3 + people.length * 0.05, 0.9 + people.length * 0.05), HAIR);
  }
  void height;
}

export function paintEditorialRelated(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.width) return;
  const scene = relatedNightSceneAt(timeline, time);
  const players = timeline.players || [];
  const count = players.length;
  drawBase(ctx, timeline, { section: "Relacionados", date: dayLabel, counter: `${pad2(count)} ${count === 1 ? "nome" : "nomes"}`, time, assets });
  const elapsed = time - (scene?.start || 0);
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  if (scene?.type === "intro") {
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.55), () => {
      const x = M * s;
      const max = width - 2 * M * s;
      drawRise(ctx, "RELACIONADOS", x - 4 * s, height * 0.385, 150 * s, remap(elapsed, 0.12, 0.85), { color: WHITE, weight: 800, tracking: -0.04, maxWidth: max });
      drawRise(ctx, "DA NOITE", x - 2 * s, height * 0.47, 150 * s, remap(elapsed, 0.22, 0.95), { color: MUTED, weight: 800, tracking: -0.04, maxWidth: max });
      drawGrowRule(ctx, x, height * 0.54, width - x, remap(elapsed, 0.3, 1.1));
      drawRise(ctx, pad2(count), x - 4 * s, height * 0.615, 160 * s, remap(elapsed, 0.4, 1.1), { color: WHITE, weight: 800, tracking: -0.04 });
      setFont(ctx, 800, 160 * s);
      const numberW = ctx.measureText(pad2(count)).width;
      drawRise(ctx, count === 1 ? "NOME NA LISTA" : "NOMES NA LISTA", x + numberW + 28 * s, height * 0.62, 34 * s, remap(elapsed, 0.5, 1.2), { color: SOFT, weight: 700, tracking: 0.08 });
    });
    return;
  }
  if (scene?.type === "finale") {
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.55), () => paintLedger(ctx, timeline, "A LISTA.", players, elapsed));
    return;
  }
  const player = scene?.player || players[0];
  if (!player) return;
  const index = scene?.index || 0;
  const asset = assets?.byId?.[player.id] || assets?.players?.[index];
  withNowLine(ctx, timeline, remap(elapsed, 0, 0.5), () => paintPersonScene(ctx, timeline, player, asset, elapsed, {
    counter: `${pad2(index + 1)} / ${pad2(count)}`,
    sceneLength: scene ? scene.end - scene.start : 3,
    time,
  }));
}

/* ---------------------------------------------------------------- announce */

function paintAnnounceIntro(ctx, timeline, elapsed, lines) {
  const { width, height } = timeline;
  const s = scaleOf(timeline);
  const max = width - 2 * M * s;
  drawRise(ctx, lines[1], width / 2, height * 0.46, 170 * s, remap(elapsed, 0.12, 0.85), { color: WHITE, weight: 800, align: "center", tracking: -0.04, maxWidth: max });
  drawRise(ctx, lines[2], width / 2, height * 0.55, 170 * s, remap(elapsed, 0.22, 0.95), { color: MUTED, weight: 800, align: "center", tracking: -0.04, maxWidth: max });
}

function paintSingleAnnouncement(ctx, timeline, time, assets) {
  const scene = announceSceneAt(timeline, time);
  const person = scene?.person || timeline.person || timeline.people?.[0];
  if (!person) return;
  const elapsed = time - (scene?.start || 0);
  if (scene?.type === "intro") {
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.5), () => paintAnnounceIntro(ctx, timeline, elapsed, ["ANÚNCIO OFICIAL", "UM NOVO", "CAPÍTULO."]));
    return;
  }
  const asset = assets?.byId?.[person.id] || assets?.players?.[0];
  const heroStart = timeline.scenes?.find((item) => item.type === "reveal")?.start ?? 0;
  const sinceHero = timeline.still ? 3 : time - heroStart;
  const phraseFrom = timeline.still ? 0 : Math.max(0, (timeline.scenes?.find((item) => item.type === "detail")?.start ?? 7) - heroStart);
  const draw = () => paintPersonScene(ctx, timeline, person, asset, sinceHero, {
    counter: timeline.announceType === "jogador" ? "NOVO CAPÍTULO" : "NOVO NOME",
    sceneLength: timeline.duration || 10,
    time,
    upper: true,
    phrase: timeline.phrase,
    phraseFrom,
  });
  if (scene?.type === "reveal") withNowLine(ctx, timeline, remap(elapsed, 0, 0.6), draw);
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
  drawBase(ctx, timeline, { section: timeline.kind === "team" ? "Elenco FC 27" : "Anúncio oficial", counter: `${pad2(count)} ${count === 1 ? "nome" : "nomes"}`, time, assets });
  if (timeline.kind !== "team") { paintSingleAnnouncement(ctx, timeline, time, assets); return; }
  const scene = announceSceneAt(timeline, time);
  const elapsed = time - (scene?.start || 0);
  if (scene?.type === "intro") {
    withNowLine(ctx, timeline, remap(elapsed, 0, 0.5), () => paintAnnounceIntro(ctx, timeline, elapsed, [`${count} NOMES · UM ESCUDO`, "UM CLUBE.", "UMA TEMPORADA."]));
    return;
  }
  if (scene?.type === "finale" || scene?.type === "grid") {
    const page = scene.pageIndex || 0;
    const listed = scene.people || (scene.pages ? scene.pages[0] : people);
    const still = scene.type === "grid";
    const draw = () => paintLedger(ctx, timeline, timeline.title || "ELENCO FC 27", Array.isArray(listed) ? listed : people, still ? 3 : elapsed, { page, pages: scene.pageCount || 1, upper: true });
    if (still) draw();
    else withNowLine(ctx, timeline, remap(elapsed, 0, 0.55), draw);
    return;
  }
  const person = scene?.person || people[0];
  if (!person) return;
  const index = scene?.index || 0;
  const asset = assets?.byId?.[person.id] || assets?.players?.[index];
  withNowLine(ctx, timeline, remap(elapsed, 0, 0.5), () => paintPersonScene(ctx, timeline, person, asset, elapsed, {
    counter: `${pad2(index + 1)} / ${pad2(count)}`,
    sceneLength: scene ? scene.end - scene.start : 3,
    time,
    upper: true,
  }));
}
