import { paintAgendaFrame, typeScale, finaleRowLayout } from "./agenda-paint.js";
import { paintRelatedNightFrame } from "./related-night-paint.js";
import { paintAnnounceFrame } from "./announce-paint.js";
import { campaignName } from "./announce-look.js";
import { paintSummaryFrame } from "./summary-paint.js";
import { pickCollageAsset } from "../../assets/collage/index.js";
import {
  CUTOUT_TEMPLATE_SEEDS,
  layoutCutoutText,
  paintCutoutText,
} from "./cutout-text.js";

const V2_PINK = "#e94b9b";
const V2_CYAN = "#3ec8f5";
const V2_YELLOW = "#f2c94c";
const MONTHS = "JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ";

function normalizeHeadline(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function fontPx(font, fallback = 96) {
  const match = String(font || "").match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : fallback;
}

function isTitleFace(font) {
  const face = String(font || "");
  if (!face) return true;
  return /rajdhani/i.test(face);
}

function hexToRgb(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length < 6) return { r: 233, g: 75, b: 155 };
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function classifyAccent(hex) {
  const { r, g, b } = hexToRgb(hex);
  if (r > 180 && g < 140 && b > 90) return V2_PINK;
  if (b > 160 && g > 140 && r < 140) return V2_CYAN;
  if (r > 180 && g > 150 && b < 120) return V2_YELLOW;
  return hex || V2_PINK;
}

function accentTrio(primary = "") {
  const lead = classifyAccent(primary);
  if (lead === V2_CYAN) return [V2_CYAN, V2_PINK, V2_YELLOW];
  if (lead === V2_YELLOW) return [V2_YELLOW, V2_CYAN, V2_PINK];
  return [V2_PINK, V2_CYAN, V2_YELLOW];
}

export function collageHeadlineMode(still, time = 0) {
  if (still) return "static";
  const t = Math.max(0, Number(time) || 0);
  if (t < 0.95) return "assemble";
  if (t < 1.52) return "chaos";
  if (t < 1.88) return "match_cut";
  if (t < 2.18) return "chaos";
  return "static";
}

export function collageLetterPlan(text, seed = 7) {
  const layout = layoutCutoutText(String(text || ""), { seed, size: 120, maxWidth: 4000 });
  return layout.rows.flatMap((row) => row.glyphs.map((glyph) => ({
    char: glyph.char,
    space: glyph.space,
    rot: glyph.rot,
    lift: glyph.y,
    scale: glyph.scale,
    pad: 8,
    invert: glyph.invert,
    delay: glyph.delay,
  })));
}

export function paintCollageWord(ctx, text, x, y, {
  size = 92,
  seed = 9,
  time = 1,
  start = 0,
  maxWidth = 900,
  align = "left",
  still = false,
  animation = "",
} = {}) {
  const local = Math.max(0, Number(time) - Number(start));
  const motion = animation || collageHeadlineMode(still, local);
  const layout = layoutCutoutText(text, { seed, size, maxWidth, align: "left" });
  const left = align === "center" ? x - layout.width / 2 : align === "right" ? x - layout.width : x;
  const prev = {
    font: ctx.font,
    fillStyle: ctx.fillStyle,
    strokeStyle: ctx.strokeStyle,
    textAlign: ctx.textAlign,
    textBaseline: ctx.textBaseline,
    globalAlpha: ctx.globalAlpha,
  };
  const painted = paintCutoutText(ctx, {
    text,
    x: left,
    y: y - size * 0.82,
    maxWidth,
    seed,
    size,
    align: "left",
    animation: motion,
    progress: still ? 1 : Math.max(0.001, local),
    rate: motion === "match_cut" ? 5 : 7,
  });
  ctx.font = prev.font;
  ctx.fillStyle = prev.fillStyle;
  ctx.strokeStyle = prev.strokeStyle;
  ctx.textAlign = prev.textAlign;
  ctx.textBaseline = prev.textBaseline;
  ctx.globalAlpha = prev.globalAlpha;
  return painted;
}

function isMetaCopy(text) {
  const value = normalizeHeadline(text);
  if (!value) return false;
  if (/^\d{2} JOGOS?$/.test(value)) return true;
  if (/^\d{1,2} RELACIONADOS$/.test(value)) return true;
  if (new RegExp(`\\d{1,2}\\s+(${MONTHS})`).test(value)) return true;
  if (/^\d{2}\/\d{2}/.test(value)) return true;
  if (/DE SET|DE AGO|DE OUT/.test(value)) return true;
  return false;
}

function paintBrushMark(ctx, bitmap, { x, y, w, h, rot = 0, alpha = 0.28, color = V2_PINK, composite = "screen" }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (bitmap && typeof ctx.drawImage === "function") {
    ctx.globalCompositeOperation = composite;
    ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(10, h * 0.18);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, h * 0.08);
    ctx.quadraticCurveTo(0, -h * 0.22, w * 0.4, h * 0.04);
    ctx.stroke();
  }
  ctx.restore();
}

function paintEnergyField(ctx, timeline, { accent = "", time = 0, seed = 2, kind = "intro" } = {}) {
  if (!ctx || !timeline?.width) return;
  const { width, height } = timeline;
  const [pink, cyan, yellow] = accentTrio(accent);
  const pulse = 0.5 + Math.sin(time * 1.6 + seed) * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const wash = ctx.createRadialGradient(width * 0.5, height * (kind === "hero" ? 0.42 : kind === "match" ? 0.22 : 0.36), 20, width * 0.5, height * (kind === "match" ? 0.22 : 0.4), width * (kind === "match" ? 0.42 : 0.62));
  wash.addColorStop(0, rgba(pink, kind === "match" ? 0.05 : 0.1 + pulse * 0.04));
  wash.addColorStop(0.45, rgba(cyan, kind === "match" ? 0.03 : 0.05));
  wash.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height * (kind === "match" ? 0.38 : 0.72));
  ctx.restore();

  const brushA = pickCollageAsset("brushes", seed);
  const brushB = pickCollageAsset("brushes", seed + 1);
  paintBrushMark(ctx, brushA, {
    x: width * 0.5,
    y: height * (kind === "announce" ? 0.58 : 0.34),
    w: width * 0.92,
    h: height * 0.16,
    rot: -0.08,
    alpha: 0.22,
    color: pink,
  });
  paintBrushMark(ctx, brushB, {
    x: width * 0.58,
    y: height * (kind === "announce" ? 0.64 : 0.4),
    w: width * 0.7,
    h: height * 0.1,
    rot: 0.12,
    alpha: 0.16,
    color: cyan,
  });

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.18 + pulse * 0.08;
  const flare = ctx.createRadialGradient(width * 0.72, height * 0.3, 4, width * 0.72, height * 0.3, 120);
  flare.addColorStop(0, rgba(yellow, 0.55));
  flare.addColorStop(1, "rgba(242,201,76,0)");
  ctx.fillStyle = flare;
  ctx.beginPath();
  ctx.arc(width * 0.72, height * 0.3, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = rgba(cyan, 0.55);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(width * 0.18, height * 0.22);
  ctx.lineTo(width * 0.34, height * 0.22);
  ctx.stroke();
  ctx.strokeStyle = rgba(pink, 0.7);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width * 0.5 - 36, height * (kind === "announce" ? 0.7 : 0.48));
  ctx.lineTo(width * 0.5 + 36, height * (kind === "announce" ? 0.7 : 0.48));
  ctx.stroke();
  ctx.restore();
}

function paintHeroStack(ctx, timeline, {
  lines = [],
  seed = 2,
  time = 0,
  still = false,
  start = 0,
  y = 0,
  primary = 236,
} = {}) {
  const width = timeline.width;
  const secondary = Math.round(primary * 0.5);
  let cursor = y;
  let accent = "";
  const paintedLines = [];
  lines.forEach((text, index) => {
    const size = index === 0 ? primary : secondary;
    const painted = paintCollageWord(ctx, text, width / 2, cursor, {
      size,
      seed: seed + index * 17,
      time,
      start,
      still,
      maxWidth: width - 64,
      align: "center",
    });
    if (painted?.dominantAccent) accent = painted.dominantAccent;
    paintedLines.push({ text, y: cursor, size });
    cursor += size * (index === 0 ? 0.86 : 0.78);
  });
  if (accent) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = classifyAccent(accent);
    ctx.fillRect(width / 2 - 34, paintedLines[0].y + 14, 68, 3);
    ctx.restore();
  }
  return { accent, bottom: cursor, lines: paintedLines };
}

function withCollagePass(ctx, { skip = [], shiftMeta = 0, collectNames = [] }, paint) {
  const original = ctx?.fillText;
  if (typeof original !== "function") {
    paint();
    return { hits: [] };
  }
  const deny = new Set(skip.map(normalizeHeadline).filter(Boolean));
  const names = new Set(collectNames.map(normalizeHeadline).filter(Boolean));
  const hits = [];
  ctx.fillText = function patchedFillText(text, x = 0, y = 0, ...rest) {
    const key = normalizeHeadline(text);
    if (deny.has(key) && isTitleFace(ctx.font)) {
      hits.push({
        text: key,
        x: Number(x) || 0,
        y: Number(y) || 0,
        align: ctx.textAlign === "center" || ctx.textAlign === "right" ? ctx.textAlign : "left",
        size: fontPx(ctx.font, 96),
        transform: typeof ctx.getTransform === "function" ? ctx.getTransform() : null,
      });
      return undefined;
    }
    if (names.has(key) && isTitleFace(ctx.font)) {
      hits.push({
        text: key,
        x: Number(x) || 0,
        y: Number(y) || 0,
        align: ctx.textAlign === "left" ? "left" : ctx.textAlign,
        size: fontPx(ctx.font, 96),
        transform: typeof ctx.getTransform === "function" ? ctx.getTransform() : null,
      });
      return undefined;
    }
    const nextY = shiftMeta && isMetaCopy(text) ? Number(y) + shiftMeta : y;
    return original.call(this, text, x, nextY, ...rest);
  };
  try {
    paint();
  } finally {
    ctx.fillText = original;
  }
  return { hits };
}

function motionStart(timeline, { name = false } = {}) {
  if (timeline.still) return 0;
  if (name) return Number(timeline.introEnd) || 0;
  return 0;
}

export function isCollageLook(timeline) {
  return String(timeline?.mediaLook || "").toLowerCase() === "collage";
}

export function paintCollageAgenda(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!ctx || !timeline?.width) return;
  const t = Number(time) || 0;
  const still = Boolean(timeline.still);
  const finaleStart = Number(timeline.finaleStart);
  const intro = still || t < Number(timeline.introEnd);
  if (!still && Number.isFinite(finaleStart) && t >= finaleStart) {
    paintAgendaFrame(ctx, { timeline, time: t, assets, dayLabel });
    return;
  }
  const shiftMeta = intro ? 286 : 0;
  withCollagePass(ctx, { skip: ["AGENDA", "DO DIA"], shiftMeta }, () => {
    paintAgendaFrame(ctx, { timeline, time: t, assets, dayLabel });
  });
  if (intro) {
    paintEnergyField(ctx, timeline, { time: t, seed: CUTOUT_TEMPLATE_SEEDS.agenda, kind: "intro" });
    paintHeroStack(ctx, timeline, {
      lines: ["AGENDA", "DO", "DIA"],
      seed: CUTOUT_TEMPLATE_SEEDS.agenda,
      time: t,
      still,
      start: motionStart(timeline),
      y: timeline.safe.top + 252,
      primary: Math.round(Math.min(timeline.width * 0.248, 268)),
    });
    return;
  }
  paintEnergyField(ctx, timeline, { time: t, seed: CUTOUT_TEMPLATE_SEEDS.agenda, kind: "match", accent: V2_YELLOW });
}

export function paintCollageRelated(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!ctx || !timeline?.width) return;
  const t = Number(time) || 0;
  const still = Boolean(timeline.still);
  const finaleStart = Number(timeline.finaleStart);
  const intro = still || t < Number(timeline.introEnd);
  if (!still && Number.isFinite(finaleStart) && t >= finaleStart) {
    paintRelatedNightFrame(ctx, { timeline, time: t, assets, dayLabel });
    return;
  }
  withCollagePass(ctx, { skip: ["RELACIONADOS", "DA NOITE", "RELACIONADOS DA NOITE"], shiftMeta: intro ? 168 : 0 }, () => {
    paintRelatedNightFrame(ctx, { timeline, time: t, assets, dayLabel });
  });
  if (intro) {
    paintEnergyField(ctx, timeline, { time: t, seed: CUTOUT_TEMPLATE_SEEDS.related, kind: "intro" });
    paintHeroStack(ctx, timeline, {
      lines: ["RELACIONADOS", "DA", "NOITE"],
      seed: CUTOUT_TEMPLATE_SEEDS.related,
      time: t,
      still,
      start: motionStart(timeline),
      y: timeline.safe.top + 168,
      primary: Math.round(Math.min(timeline.width * 0.176, 198)),
    });
  }
}

export function paintCollageAnnounce(ctx, { timeline, time = 0, assets } = {}) {
  if (!ctx || !timeline?.width) return;
  const t = Number(time) || 0;
  const person = timeline.person || timeline.people?.[0];
  const name = campaignName(person || {});
  if (timeline.kind === "team" || !name) {
    paintAnnounceFrame(ctx, { timeline, time: t, assets });
    return;
  }
  const skip = [name, ...String(name).split(/\s+/)].filter((item) => String(item).length > 1);
  const still = Boolean(timeline.still);
  const { hits } = withCollagePass(ctx, { skip, collectNames: skip }, () => {
    paintAnnounceFrame(ctx, { timeline, time: t, assets });
  });
  const paper = pickCollageAsset("tornPaper", CUTOUT_TEMPLATE_SEEDS.announce);
  const tape = pickCollageAsset("brushes", CUTOUT_TEMPLATE_SEEDS.announce + 4);
  if (hits.length) {
    const lead = hits[0];
    paintEnergyField(ctx, timeline, {
      time: t,
      seed: CUTOUT_TEMPLATE_SEEDS.announce,
      kind: "announce",
      accent: V2_PINK,
    });
    if (paper) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.translate(lead.x + 24, lead.y - lead.size * 0.7);
      ctx.rotate(-0.06);
      ctx.drawImage(paper, 0, 0, Math.max(220, lead.size * 2.6), Math.max(90, lead.size * 1.05));
      ctx.restore();
    }
    paintBrushMark(ctx, tape, {
      x: lead.x + 80,
      y: lead.y - lead.size * 0.55,
      w: 220,
      h: 28,
      rot: -0.18,
      alpha: 0.34,
      color: V2_YELLOW,
    });
    hits.forEach((hit, index) => {
      const size = Math.round(Math.max(hit.size * 1.28, timeline.format === "feed" ? 96 : 198));
      paintCollageWord(ctx, hit.text, hit.x, hit.y + (index ? size * 0.08 : 0), {
        size,
        seed: CUTOUT_TEMPLATE_SEEDS.announce + index,
        time: t,
        start: motionStart(timeline, { name: true }),
        still,
        maxWidth: timeline.width - (timeline.safe?.side || 64) - 24,
        align: hit.align,
      });
    });
    return;
  }
  paintEnergyField(ctx, timeline, { time: t, seed: CUTOUT_TEMPLATE_SEEDS.announce, kind: "announce", accent: V2_PINK });
}

export function paintCollageSummary(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!ctx || !timeline?.width) return;
  const t = Number(time) || 0;
  const still = Boolean(timeline.still);
  const finaleStart = Number(timeline.finaleStart);
  const intro = still || t < Number(timeline.introEnd);
  if (!still && Number.isFinite(finaleStart) && t >= finaleStart) {
    paintSummaryFrame(ctx, { timeline, time: t, assets, dayLabel });
    return;
  }
  const week = /SEMANA/i.test(timeline.period?.title || "");
  withCollagePass(ctx, { skip: ["RESUMO", "DO DIA", "DA SEMANA"], shiftMeta: intro ? 148 : 0 }, () => {
    paintSummaryFrame(ctx, { timeline, time: t, assets, dayLabel });
  });
  if (intro) {
    paintEnergyField(ctx, timeline, { time: t, seed: CUTOUT_TEMPLATE_SEEDS.summary, kind: "intro" });
    paintHeroStack(ctx, timeline, {
      lines: week ? ["RESUMO", "DA", "SEMANA"] : ["RESUMO", "DO", "DIA"],
      seed: CUTOUT_TEMPLATE_SEEDS.summary,
      time: t,
      still,
      start: motionStart(timeline),
      y: timeline.safe.top + 176,
      primary: Math.round(Math.min(timeline.width * 0.214, 228)),
    });
  }
}

export function collageEnter() {
  return 1;
}

export function collageBeat() {
  return 1;
}

export { CUTOUT_TEMPLATE_SEEDS, typeScale, finaleRowLayout };
