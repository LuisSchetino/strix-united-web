import { paintAgendaFrame, typeScale, finaleRowLayout } from "./agenda-paint.js";
import { paintRelatedNightFrame } from "./related-night-paint.js";
import { paintAnnounceFrame } from "./announce-paint.js";
import { campaignName } from "./announce-look.js";
import { paintSummaryFrame } from "./summary-paint.js";
import {
  CUTOUT_TEMPLATE_SEEDS,
  layoutCutoutText,
  paintCutoutText,
} from "./cutout-text.js";

const SECONDARY_HEADLINES = new Set(["DO DIA", "DA NOITE", "DA SEMANA"]);

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

export function collageHeadlineMode(still, time = 0) {
  if (still) return "static";
  const t = Math.max(0, Number(time) || 0);
  if (t < 0.82) return "assemble";
  if (t < 1.58) return "chaos";
  if (t < 1.98) return "match_cut";
  if (t < 2.38) return "chaos";
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

function paintAccentMark(ctx, hit, accent) {
  if (!accent || !hit) return;
  ctx.save();
  if (hit.transform && typeof ctx.setTransform === "function") {
    const matrix = hit.transform;
    ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  }
  ctx.globalAlpha *= 0.62;
  ctx.fillStyle = accent;
  const width = SECONDARY_HEADLINES.has(hit.text) ? 44 : 58;
  const x = hit.align === "center" ? hit.x - width / 2 : hit.align === "right" ? hit.x - width : hit.x;
  ctx.fillRect(x, hit.y + 10, width, 2);
  ctx.restore();
}

function replaceHeadlines(ctx, skipped, paint, overlay) {
  const original = ctx?.fillText;
  if (typeof original !== "function") {
    paint();
    return { accent: "" };
  }
  const deny = new Set((skipped || []).map(normalizeHeadline).filter(Boolean));
  let accent = "";
  let lastHit = null;
  ctx.fillText = function patchedFillText(text, x = 0, y = 0, ...rest) {
    const key = normalizeHeadline(text);
    if (deny.has(key) && isTitleFace(ctx.font)) {
      const align = ctx.textAlign === "center" || ctx.textAlign === "right" ? ctx.textAlign : "left";
      const secondary = SECONDARY_HEADLINES.has(key);
      const painted = paintCollageWord(ctx, key, Number(x) || 0, Number(y) || 0, {
        size: Math.max(32, Math.round(fontPx(ctx.font, 96) * (secondary ? 0.62 : 0.88))),
        seed: overlay.seed,
        time: overlay.time,
        start: overlay.start,
        still: overlay.still,
        maxWidth: overlay.maxWidth,
        align,
      });
      if (painted?.dominantAccent) accent = painted.dominantAccent;
      lastHit = {
        text: key,
        x: Number(x) || 0,
        y: Number(y) || 0,
        align,
        transform: typeof ctx.getTransform === "function" ? ctx.getTransform() : null,
      };
      return undefined;
    }
    return original.call(this, text, x, y, ...rest);
  };
  try {
    paint();
  } finally {
    ctx.fillText = original;
  }
  if (accent) paintAccentMark(ctx, lastHit, accent);
  return { accent };
}

export function isCollageLook(timeline) {
  return String(timeline?.mediaLook || "").toLowerCase() === "collage";
}

function motionStart(timeline, time, { name = false } = {}) {
  if (timeline.still) return 0;
  if (name) return Number(timeline.introEnd) || 0;
  return 0;
}

export function paintCollageAgenda(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!ctx || !timeline?.width) return;
  const t = Number(time) || 0;
  const still = Boolean(timeline.still);
  const finaleStart = Number(timeline.finaleStart);
  if (!still && Number.isFinite(finaleStart) && t >= finaleStart) {
    paintAgendaFrame(ctx, { timeline, time: t, assets, dayLabel });
    return;
  }
  replaceHeadlines(ctx, ["AGENDA", "DO DIA"], () => {
    paintAgendaFrame(ctx, { timeline, time: t, assets, dayLabel });
  }, {
    seed: CUTOUT_TEMPLATE_SEEDS.agenda,
    still,
    time: t,
    start: motionStart(timeline, t),
    maxWidth: timeline.width - 96,
  });
}

export function paintCollageRelated(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!ctx || !timeline?.width) return;
  const t = Number(time) || 0;
  const still = Boolean(timeline.still);
  const finaleStart = Number(timeline.finaleStart);
  if (!still && Number.isFinite(finaleStart) && t >= finaleStart) {
    paintRelatedNightFrame(ctx, { timeline, time: t, assets, dayLabel });
    return;
  }
  replaceHeadlines(ctx, ["RELACIONADOS", "DA NOITE", "RELACIONADOS DA NOITE"], () => {
    paintRelatedNightFrame(ctx, { timeline, time: t, assets, dayLabel });
  }, {
    seed: CUTOUT_TEMPLATE_SEEDS.related,
    still,
    time: t,
    start: motionStart(timeline, t),
    maxWidth: timeline.width - 80,
  });
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
  replaceHeadlines(ctx, skip, () => {
    paintAnnounceFrame(ctx, { timeline, time: t, assets });
  }, {
    seed: CUTOUT_TEMPLATE_SEEDS.announce,
    still,
    time: t,
    start: motionStart(timeline, t, { name: true }),
    maxWidth: timeline.width - (timeline.safe?.side || 64) - 48,
  });
}

export function paintCollageSummary(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!ctx || !timeline?.width) return;
  const t = Number(time) || 0;
  const still = Boolean(timeline.still);
  const finaleStart = Number(timeline.finaleStart);
  if (!still && Number.isFinite(finaleStart) && t >= finaleStart) {
    paintSummaryFrame(ctx, { timeline, time: t, assets, dayLabel });
    return;
  }
  replaceHeadlines(ctx, ["RESUMO", "DO DIA", "DA SEMANA"], () => {
    paintSummaryFrame(ctx, { timeline, time: t, assets, dayLabel });
  }, {
    seed: CUTOUT_TEMPLATE_SEEDS.summary,
    still,
    time: t,
    start: motionStart(timeline, t),
    maxWidth: timeline.width - 96,
  });
}

export function collageEnter() {
  return 1;
}

export function collageBeat() {
  return 1;
}

export { CUTOUT_TEMPLATE_SEEDS, typeScale, finaleRowLayout };
