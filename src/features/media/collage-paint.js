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
  if (lead === V2_CYAN) return [V2_CYAN, V2_YELLOW];
  if (lead === V2_YELLOW) return [V2_YELLOW, V2_CYAN];
  return [V2_PINK, V2_CYAN];
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
  const rawLeft = align === "center" ? x - layout.width / 2 : align === "right" ? x - layout.width : x;
  const left = align === "left" ? Math.max(24, rawLeft) : rawLeft;
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

function tintedBrush(bitmap, color, dw, dh) {
  const scratch = typeof OffscreenCanvas === "function"
    ? new OffscreenCanvas(Math.ceil(dw), Math.ceil(dh))
    : (typeof document !== "undefined" ? document.createElement("canvas") : null);
  if (!scratch?.getContext) return null;
  scratch.width = Math.max(1, Math.ceil(dw));
  scratch.height = Math.max(1, Math.ceil(dh));
  const sctx = scratch.getContext("2d");
  if (!sctx) return null;
  sctx.drawImage(bitmap, 0, 0, dw, dh);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, dw, dh);
  return scratch;
}

function paintBrushMark(ctx, bitmap, { x, y, maxW = 220, maxH = 56, rot = 0, alpha = 0.22, color = V2_PINK } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "screen";
  if (bitmap && typeof ctx.drawImage === "function") {
    const iw = Math.max(1, bitmap.width || maxW);
    const ih = Math.max(1, bitmap.height || maxH);
    const aspect = iw / ih;
    let dw = maxW;
    let dh = dw / aspect;
    if (dh > maxH) {
      dh = maxH;
      dw = dh * aspect;
    }
    const tinted = tintedBrush(bitmap, color, dw, dh);
    if (tinted) ctx.drawImage(tinted, -dw / 2, -dh / 2);
    else ctx.drawImage(bitmap, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-42, 6);
    ctx.quadraticCurveTo(8, -14, 48, 4);
    ctx.stroke();
  }
  ctx.restore();
}

function paintHeadlineAccents(ctx, timeline, {
  accent = "",
  time = 0,
  seed = 2,
  x = 0,
  y = 0,
} = {}) {
  if (!ctx || !timeline?.width) return;
  const [lead, second] = accentTrio(accent);
  const pulse = 0.5 + Math.sin(time * 1.2 + seed) * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const glow = ctx.createRadialGradient(x, y, 8, x, y, 140);
  glow.addColorStop(0, rgba(lead, 0.16 + pulse * 0.05));
  glow.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 140, 0, Math.PI * 2);
  ctx.fill();
  const flare = ctx.createRadialGradient(x + 86, y - 48, 2, x + 86, y - 48, 36);
  flare.addColorStop(0, rgba(second, 0.42));
  flare.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = flare;
  ctx.beginPath();
  ctx.arc(x + 86, y - 48, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = rgba(second, 0.7);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 90, y - 70);
  ctx.lineTo(x - 28, y - 70);
  ctx.stroke();
  ctx.restore();

  const brush = pickCollageAsset("brushes", seed);
  paintBrushMark(ctx, brush, {
    x: x + 70,
    y: y + 18,
    maxW: 168,
    maxH: 44,
    rot: -0.16,
    alpha: 0.2,
    color: lead,
  });
}

function paintHeroStack(ctx, timeline, {
  lines = [],
  seed = 2,
  time = 0,
  still = false,
  start = 0,
  y = 0,
  primary = 236,
  stackLead = 1.08,
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
    cursor += index === 0 ? size * 0.88 : size * stackLead;
  });
  if (accent || paintedLines[0]) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = classifyAccent(accent || V2_CYAN);
    ctx.fillRect(width / 2 - 28, paintedLines[0].y + 10, 56, 2);
    ctx.restore();
  }
  return { accent, bottom: cursor, lines: paintedLines };
}

function paintMetaBlock(ctx, timeline, { date = "", count = "", y = 0 } = {}) {
  if (!ctx) return;
  const x = timeline.width / 2;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#efece6";
  if (date) {
    ctx.font = `700 ${timeline.format === "feed" ? 32 : 44}px Inter, sans-serif`;
    ctx.fillText(date, x, y);
  }
  if (count) {
    ctx.font = `800 ${timeline.format === "feed" ? 48 : 72}px Inter, sans-serif`;
    ctx.fillText(count, x, y + (timeline.format === "feed" ? 56 : 72));
  }
  ctx.restore();
}

function withCollagePass(ctx, { skip = [], skipMeta = false, collectNames = [] }, paint) {
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
    if (skipMeta && isMetaCopy(text)) return undefined;
    if (deny.has(key) || names.has(key)) {
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
    return original.call(this, text, x, y, ...rest);
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
  withCollagePass(ctx, { skip: ["AGENDA", "DO DIA"], skipMeta: intro }, () => {
    paintAgendaFrame(ctx, { timeline, time: t, assets, dayLabel });
  });
  if (intro) {
    const y = Math.round(timeline.height * 0.4);
    paintHeadlineAccents(ctx, timeline, {
      accent: V2_PINK,
      time: t,
      seed: CUTOUT_TEMPLATE_SEEDS.agenda,
      x: timeline.width / 2,
      y,
    });
    paintHeroStack(ctx, timeline, {
      lines: ["AGENDA", "DO", "DIA"],
      seed: CUTOUT_TEMPLATE_SEEDS.agenda,
      time: t,
      still,
      start: motionStart(timeline),
      y,
      primary: Math.round(Math.min(timeline.width * 0.248, 268)),
    });
    const countLabel = String(timeline.matches?.length || 0).padStart(2, "0");
    const games = `${countLabel} ${(timeline.matches?.length || 0) === 1 ? "JOGO" : "JOGOS"}`;
    paintMetaBlock(ctx, timeline, {
      date: dayLabel,
      count: games,
      y: timeline.height - timeline.safe.bottom - 108,
    });
  }
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
  withCollagePass(ctx, { skip: ["RELACIONADOS", "DA NOITE", "RELACIONADOS DA NOITE"], skipMeta: intro }, () => {
    paintRelatedNightFrame(ctx, { timeline, time: t, assets, dayLabel });
  });
  if (intro) {
    const y = Math.round(timeline.safe.top + timeline.height * 0.16);
    paintHeadlineAccents(ctx, timeline, {
      accent: V2_CYAN,
      time: t,
      seed: CUTOUT_TEMPLATE_SEEDS.related,
      x: timeline.width / 2,
      y,
    });
    const stack = paintHeroStack(ctx, timeline, {
      lines: ["RELACIONADOS", "DA", "NOITE"],
      seed: CUTOUT_TEMPLATE_SEEDS.related,
      time: t,
      still,
      start: motionStart(timeline),
      y,
      primary: Math.round(Math.min(timeline.width * 0.168, 186)),
      stackLead: 1.62,
    });
    paintMetaBlock(ctx, timeline, {
      date: dayLabel,
      count: `${timeline.players?.length || 0} RELACIONADOS`,
      y: Math.max(Math.round(timeline.height * 0.54), Math.round(stack.bottom + 36)),
    });
  }
}

export function paintCollageAnnounce(ctx, { timeline, time = 0, assets } = {}) {
  if (!ctx || !timeline?.width) return;
  const t = Number(time) || 0;
  const scene = (timeline.scenes || []).find((item) => t >= item.start && t < item.end);
  const person = scene?.person || timeline.person || timeline.people?.[0];
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
  if (!hits.length && !still && t < Number(timeline.introEnd || 0)) return;
  const lead = hits[0] || {
    text: normalizeHeadline(name),
    x: timeline.safe?.side || 64,
    y: timeline.height * 0.72,
    align: "left",
    size: timeline.format === "feed" ? 132 : 176,
    transform: null,
  };
  const brush = pickCollageAsset("brushes", CUTOUT_TEMPLATE_SEEDS.announce);
  paintBrushMark(ctx, brush, {
    x: lead.x + 90,
    y: lead.y - lead.size * 0.35,
    maxW: 150,
    maxH: 38,
    rot: -0.2,
    alpha: 0.22,
    color: V2_PINK,
  });
  paintHeadlineAccents(ctx, timeline, {
    accent: V2_PINK,
    time: t,
    seed: CUTOUT_TEMPLATE_SEEDS.announce,
    x: lead.x + 120,
    y: lead.y - 20,
  });
  const targets = hits.length ? hits : [lead];
  targets.forEach((hit, index) => {
    const size = Math.round(Math.min(hit.size || 176, timeline.format === "feed" ? 84 : 152));
    const x = Math.max(Number(hit.x) || 0, timeline.safe?.side || 72) + 40;
    paintCollageWord(ctx, hit.text, x, hit.y + (index ? size * 0.06 : 0), {
      size,
      seed: CUTOUT_TEMPLATE_SEEDS.announce + index,
      time: t,
      start: motionStart(timeline, { name: true }),
      still,
      maxWidth: Math.max(220, timeline.width - x - (timeline.safe?.side || 64) - 12),
      align: "left",
    });
  });
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
  withCollagePass(ctx, { skip: ["RESUMO", "DO DIA", "DA SEMANA"], skipMeta: intro }, () => {
    paintSummaryFrame(ctx, { timeline, time: t, assets, dayLabel });
  });
  if (intro) {
    const y = Math.round(timeline.safe.top + 220);
    paintHeadlineAccents(ctx, timeline, {
      accent: V2_YELLOW,
      time: t,
      seed: CUTOUT_TEMPLATE_SEEDS.summary,
      x: timeline.width / 2,
      y,
    });
    paintHeroStack(ctx, timeline, {
      lines: week ? ["RESUMO", "DA", "SEMANA"] : ["RESUMO", "DO", "DIA"],
      seed: CUTOUT_TEMPLATE_SEEDS.summary,
      time: t,
      still,
      start: motionStart(timeline),
      y,
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
