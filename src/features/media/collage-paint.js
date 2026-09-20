import { easeInOutCubic, easeOutExpo, reveal } from "./agenda-timeline.js";
import { campaignName } from "./announce-look.js";
import { opponentInitials } from "./agenda-media-core.js";
import { fieldQuad, projectFieldPoint, PITCH } from "./related-night-layout.js";
import { relatedNightSceneAt } from "./related-night-timeline.js";

const PAPER = "#11100d";
const SHEET = "#ece7dc";
const INK = "#f4f1ea";
const MUTED = "#9a958b";
const TAPE = "rgba(226,214,186,0.82)";
const VOID = "#070706";
const STAMP = "#cfc6b4";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function seeded(seed = 1) {
  let state = (Math.imul(Number(seed) || 11, 2654435761) >>> 0) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 13), 1274126177) >>> 0;
    return state / 4294967296;
  };
}

export function collageEnter(time, start, dur = 0.28) {
  return reveal(time, start, dur, easeOutExpo);
}

export function collageBeat(time, start, dur = 0.36) {
  const local = clamp((Number(time) - start) / Math.max(0.001, dur));
  return easeOutExpo(local);
}

let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(128, 128);
  let seed = 2166136261;
  for (let index = 0; index < image.data.length; index += 4) {
    seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0;
    const value = 64 + (seed & 110);
    image.data[index] = value;
    image.data[index + 1] = value - 6;
    image.data[index + 2] = value - 14;
    image.data[index + 3] = 34;
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return grainTile;
}

function paintPaper(ctx, width, height, time = 0) {
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = PAPER;
  ctx.fillRect(18, 22, width - 36, height - 44);
  const wash = ctx.createRadialGradient(width * 0.42, height * 0.22, 10, width * 0.5, height * 0.4, Math.max(width, height) * 0.78);
  wash.addColorStop(0, "rgba(244,241,234,0.07)");
  wash.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
  const tile = grain();
  if (tile) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(tile, -20, -20, width + 40, height + 40);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = INK;
  for (let y = 24; y < height; y += 6) ctx.fillRect(0, y, width, 1);
  ctx.restore();
  const flash = Math.sin(clamp(time / 0.14) * Math.PI) * (time < 0.16 ? 0.1 : 0);
  if (flash > 0) {
    ctx.fillStyle = `rgba(244,241,234,${flash})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function tornPath(ctx, x, y, w, h, seed) {
  const rand = seeded(seed);
  ctx.beginPath();
  const steps = 16;
  ctx.moveTo(x + rand() * 10, y + rand() * 8);
  for (let i = 1; i <= steps; i += 1) ctx.lineTo(x + (w * i) / steps + (rand() - 0.5) * 12, y + (rand() - 0.5) * 9);
  for (let i = 1; i <= steps; i += 1) ctx.lineTo(x + w + (rand() - 0.5) * 9, y + (h * i) / steps + (rand() - 0.5) * 11);
  for (let i = 1; i <= steps; i += 1) ctx.lineTo(x + w - (w * i) / steps + (rand() - 0.5) * 12, y + h + (rand() - 0.5) * 9);
  for (let i = 1; i <= steps; i += 1) ctx.lineTo(x + (rand() - 0.5) * 9, y + h - (h * i) / steps + (rand() - 0.5) * 11);
  ctx.closePath();
}

function paintTape(ctx, x, y, w = 86, rot = -0.18, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = TAPE;
  ctx.fillRect(-w / 2, -9, w, 18);
  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(-w / 2, -9, w, 5);
  ctx.restore();
}

function paintHalftone(ctx, x, y, w, h, seed, alpha = 0.16) {
  const rand = seeded(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  for (let py = y; py < y + h; py += 7) {
    for (let px = x; px < x + w; px += 7) {
      const r = 1.1 + rand() * 1.8;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function collageLetterPlan(text, seed = 7) {
  const chars = String(text || "").split("");
  const rand = seeded(seed + chars.length * 13);
  return chars.map((char, index) => ({
    char,
    space: char === " ",
    rot: (rand() - 0.5) * 0.22,
    lift: (rand() - 0.5) * 18,
    scale: 0.82 + rand() * 0.38,
    pad: 8 + rand() * 10,
    invert: rand() > 0.62,
    delay: index * 0.045,
  }));
}

export function paintCollageWord(ctx, text, x, y, {
  size = 92,
  seed = 9,
  time = 1,
  start = 0,
  maxWidth = 900,
  align = "left",
} = {}) {
  const plan = collageLetterPlan(text, seed);
  const boxes = plan.map((item) => ({
    ...item,
    w: item.space ? size * 0.28 : Math.max(28, size * item.scale * 0.72) + item.pad,
    h: size * item.scale * 0.92,
  }));
  const total = boxes.reduce((sum, item) => sum + item.w + 6, 0);
  const scale = total > maxWidth ? maxWidth / total : 1;
  let cursor = align === "center" ? x - (total * scale) / 2 : x;
  boxes.forEach((item) => {
    const enter = collageEnter(time, start + item.delay, 0.22);
    const bw = item.w * scale;
    const bh = item.h * scale;
    if (item.space || enter <= 0.01) {
      cursor += (item.w + 6) * scale;
      return;
    }
    ctx.save();
    ctx.translate(cursor + bw / 2, y + item.lift * enter);
    ctx.rotate(item.rot * enter);
    ctx.globalAlpha = enter;
    ctx.fillStyle = item.invert ? INK : SHEET;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = item.invert ? VOID : "#16140f";
    ctx.font = `800 ${Math.round(size * item.scale * scale * 0.72)}px Rajdhani, Impact, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.char, 0, 2);
    ctx.restore();
    cursor += (item.w + 6) * scale;
  });
  return { width: total * scale, count: plan.length };
}

function paintTornPhoto(ctx, bitmap, box, { seed = 3, rot = -0.04, alpha = 1, time = 1 } = {}) {
  if (alpha <= 0.01) return;
  const { x, y, w, h } = box;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot + Math.sin(time * 0.7) * 0.01);
  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = SHEET;
  tornPath(ctx, -8, -8, w + 16, h + 16, seed);
  ctx.fill();
  ctx.save();
  tornPath(ctx, 0, 0, w, h, seed + 4);
  ctx.clip();
  if (bitmap) {
    const scale = Math.max(w / bitmap.width, h / bitmap.height);
    ctx.filter = "grayscale(1) contrast(1.18) brightness(1.02)";
    ctx.drawImage(bitmap, (w - bitmap.width * scale) / 2, (h - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    ctx.filter = "none";
    paintHalftone(ctx, 0, 0, w, h, seed, 0.12);
  } else {
    ctx.fillStyle = "#1c1a16";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 2;
  tornPath(ctx, 0, 0, w, h, seed + 4);
  ctx.stroke();
  ctx.restore();
}

function paintSticker(ctx, label, x, y, { size = 22, rot = 0.08, fill = INK, time = 1, start = 0 } = {}) {
  const enter = collageEnter(time, start, 0.2);
  if (enter <= 0.01) return;
  const text = String(label || "").toUpperCase();
  ctx.save();
  ctx.font = `800 ${size}px Inter, sans-serif`;
  const w = ctx.measureText(text).width + 28;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(0.86 + enter * 0.14, 0.86 + enter * 0.14);
  ctx.globalAlpha = enter;
  ctx.fillStyle = fill;
  ctx.fillRect(-8, -size, w, size + 18);
  ctx.fillStyle = fill === INK ? VOID : INK;
  ctx.fillText(text, 6, 4);
  ctx.restore();
}

function paintMark(ctx, x1, y1, x2, y2, time, start) {
  const enter = collageEnter(time, start, 0.28);
  if (enter <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = "rgba(244,241,234,0.55)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + (x2 - x1) * enter, y1 + (y2 - y1) * enter);
  ctx.stroke();
  ctx.restore();
}

function fit(ctx, text, maxWidth, font) {
  ctx.font = font;
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1);
  return `${next}…`;
}

function shirtLabel(player) {
  const raw = player?.number ?? player?.shirt_number;
  if (raw === "" || raw == null) return "";
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? String(numeric).padStart(2, "0") : String(raw);
}

function poly(ctx, points, close = false) {
  if (!points?.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  if (close) ctx.closePath();
}

export function paintCollagePitch(ctx, timeline, time) {
  const t = Number(time) || 0;
  const cam = {
    x: Math.sin(t * 0.28) * 5,
    y: Math.cos(t * 0.22) * 3,
    zoom: 0.9 + Math.sin(t * 0.16) * 0.012,
    lookU: 0.5,
    lookV: 0.5,
    originN: 0.5,
  };
  const quad = fieldQuad(timeline, cam);
  const enter = collageEnter(time, 0.06, 0.4);
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate(Math.sin(time * 0.35) * 3, Math.cos(time * 0.28) * 2);
  ctx.rotate(-0.018);
  poly(ctx, quad, true);
  ctx.fillStyle = SHEET;
  ctx.fill();
  ctx.save();
  poly(ctx, quad, true);
  ctx.clip();
  paintHalftone(ctx, 0, 0, timeline.width, timeline.height, 44, 0.14);
  const ink = (uvs) => uvs.map(([u, v]) => projectFieldPoint(u, v, timeline, cam));
  ctx.strokeStyle = "#1a1814";
  ctx.lineWidth = 3.2;
  poly(ctx, ink([[0, 0], [1, 0], [1, 1], [0, 1]]), true);
  ctx.stroke();
  poly(ctx, ink([[0, 0.5], [1, 0.5]]));
  ctx.stroke();
  const box = (depth, half, near = false) => near
    ? [[0.5 - half, 1 - depth], [0.5 + half, 1 - depth], [0.5 + half, 1], [0.5 - half, 1]]
    : [[0.5 - half, depth], [0.5 + half, depth], [0.5 + half, 0], [0.5 - half, 0]];
  [box(PITCH.penaltyDepth, PITCH.penaltyHalfU), box(PITCH.penaltyDepth, PITCH.penaltyHalfU, true),
    box(PITCH.goalAreaDepth, PITCH.goalAreaHalfU), box(PITCH.goalAreaDepth, PITCH.goalAreaHalfU, true)].forEach((uvs) => {
    poly(ctx, ink(uvs), true);
    ctx.stroke();
  });
  const circle = Array.from({ length: 40 }, (_, index) => {
    const a = (index / 40) * Math.PI * 2;
    return [0.5 + Math.cos(a) * PITCH.circleRu, 0.5 + Math.sin(a) * PITCH.circleRv];
  });
  poly(ctx, ink(circle), true);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 4;
  poly(ctx, quad, true);
  ctx.stroke();
  paintTape(ctx, quad[0].x + 40, quad[0].y + 8, 92, -0.18, enter);
  paintTape(ctx, quad[1].x - 36, quad[1].y + 14, 80, 0.2, enter);
  ctx.restore();
}

export function paintCollageAnnounce(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  const { width, height, safe, still } = timeline;
  const t = still ? 2 : Number(time) || 0;
  paintPaper(ctx, width, height, still ? 1 : t);
  const person = timeline.person || timeline.people?.[0];
  const people = timeline.people || [];

  if (timeline.kind === "team" && (still || t >= (timeline.finaleStart || 0) * 0.85)) {
    paintCollageWord(ctx, "ELENCO", safe.side, safe.top + 70, { size: 84, seed: 3, time: t, maxWidth: width - safe.side * 2 });
    people.slice(0, 8).forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const bw = (width - safe.side * 2 - 36) / 2;
      const x = safe.side + col * (bw + 36);
      const y = safe.top + 140 + row * 210;
      paintTornPhoto(ctx, assets?.byId?.[item.id]?.bitmap, { x, y, w: bw, h: 148 }, {
        seed: 8 + index,
        rot: col ? 0.04 : -0.05,
        alpha: collageEnter(t, 0.2 + index * 0.05, 0.24),
        time: t,
      });
      paintCollageWord(ctx, campaignName(item).slice(0, 10), x, y + 176, {
        size: 28,
        seed: 20 + index,
        time: t,
        start: 0.28 + index * 0.04,
        maxWidth: bw,
      });
    });
    return;
  }

  const asset = assets?.byId?.[person?.id] || assets?.players?.[0];
  ctx.save();
  ctx.globalAlpha = collageEnter(t, 0, 0.24);
  ctx.fillStyle = MUTED;
  ctx.font = "800 16px Inter, sans-serif";
  ctx.fillText("FC 27", safe.side, safe.top - 8);
  ctx.restore();

  paintTornPhoto(ctx, asset?.bitmap, {
    x: width * 0.08,
    y: height * 0.16,
    w: width * 0.58,
    h: height * 0.52,
  }, {
    seed: 14,
    rot: -0.055,
    alpha: collageEnter(t, 0.08, 0.34),
    time: t,
  });
  paintTape(ctx, width * 0.22, height * 0.17, 120, -0.28, collageEnter(t, 0.22, 0.18));
  paintTape(ctx, width * 0.55, height * 0.64, 96, 0.2, collageEnter(t, 0.3, 0.18));

  if (asset?.bitmap) {
    paintTornPhoto(ctx, asset.bitmap, {
      x: width * 0.62,
      y: height * 0.12,
      w: width * 0.28,
      h: height * 0.22,
    }, {
      seed: 29,
      rot: 0.08,
      alpha: collageEnter(t, 0.18, 0.28) * 0.8,
      time: t,
    });
  }

  const name = campaignName(person || {});
  paintCollageWord(ctx, name, safe.side, height * 0.78, {
    size: 78,
    seed: 41,
    time: t,
    start: 0.26,
    maxWidth: width - safe.side * 2,
  });
  paintSticker(ctx, person?.position || "MC", safe.side + 8, height * 0.88, {
    size: 20,
    rot: -0.1,
    fill: INK,
    time: t,
    start: 0.42,
  });
  if (person?.extraBadge) {
    paintSticker(ctx, person.extraBadge, safe.side + 168, height * 0.9, {
      size: 16,
      rot: 0.08,
      fill: "#e4d6b6",
      time: t,
      start: 0.5,
    });
  }
  const number = shirtLabel(person);
  if (number) {
    ctx.save();
    ctx.globalAlpha = collageEnter(t, 0.36, 0.22);
    ctx.translate(width - safe.side - 20, height * 0.34);
    ctx.rotate(0.12);
    ctx.fillStyle = SHEET;
    ctx.fillRect(-70, -70, 140, 140);
    ctx.fillStyle = VOID;
    ctx.font = "800 72px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(number, 0, 28);
    ctx.restore();
  }
  if (timeline.phrase) {
    paintMark(ctx, safe.side, height - safe.bottom - 18, width - safe.side, height - safe.bottom - 8, t, 0.56);
    ctx.save();
    ctx.globalAlpha = collageEnter(t, 0.52, 0.24);
    ctx.fillStyle = MUTED;
    ctx.font = "700 24px Inter, sans-serif";
    ctx.fillText(fit(ctx, String(timeline.phrase).toUpperCase(), width - safe.side * 2, ctx.font), safe.side, height - safe.bottom + 18);
    ctx.restore();
  }
}

export function paintCollageAgenda(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!timeline?.width) return;
  const { width, height, safe, still } = timeline;
  const t = still ? 2 : Number(time) || 0;
  const matches = timeline.matches || [];
  paintPaper(ctx, width, height, still ? 1 : t);
  paintCollageWord(ctx, "AGENDA", safe.side - 8, safe.top + 58, {
    size: 96,
    seed: 2,
    time: t,
    maxWidth: width - safe.side * 2 + 20,
  });
  paintSticker(ctx, dayLabel || "HOJE", width - safe.side - 210, safe.top + 118, {
    size: 18,
    rot: 0.07,
    fill: STAMP,
    time: t,
    start: 0.16,
  });
  paintSticker(ctx, `${String(matches.length).padStart(2, "0")} JOGOS`, safe.side, safe.top + 128, {
    size: 16,
    rot: -0.08,
    fill: INK,
    time: t,
    start: 0.2,
  });

  matches.slice(0, 6).forEach((match, index) => {
    const y = safe.top + 168 + index * 126;
    const enter = collageEnter(t, 0.18 + index * 0.08, 0.28);
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.translate(safe.side + (index % 2 ? 10 : -6), y);
    ctx.rotate(index % 2 ? 0.018 : -0.02);
    ctx.fillStyle = index % 2 ? "rgba(244,241,234,0.08)" : "rgba(20,18,16,0.55)";
    ctx.fillRect(0, 0, width - safe.side * 2, 108);
    ctx.strokeStyle = "rgba(244,241,234,0.18)";
    ctx.strokeRect(0, 0, width - safe.side * 2, 108);
    ctx.fillStyle = INK;
    ctx.font = "800 34px Rajdhani, sans-serif";
    ctx.fillText(match.kickoff || "", 18, 42);
    ctx.font = "700 36px Rajdhani, sans-serif";
    ctx.fillText(fit(ctx, String(match.opponent || "").toUpperCase(), width - safe.side * 2 - 140, ctx.font), 18, 82);
    ctx.fillStyle = MUTED;
    ctx.font = "800 14px Inter, sans-serif";
    ctx.fillText(String(match.competition || "AMISTOSO").toUpperCase(), 18, 102);
    ctx.fillStyle = SHEET;
    ctx.font = "800 28px Rajdhani, sans-serif";
    ctx.fillText(String(index + 1).padStart(2, "0"), width - safe.side * 2 - 58, 40);
    const logo = assets?.opponents?.[index] || assets?.byId?.[match.id];
    if (logo?.bitmap) {
      ctx.save();
      ctx.translate(width - safe.side * 2 - 92, 58);
      ctx.rotate(-0.08);
      ctx.drawImage(logo.bitmap, 0, 0, 64, 64);
      ctx.restore();
    }
    ctx.restore();
    paintTape(ctx, safe.side + 70, y + 4, 78, -0.16, enter);
  });
}

export function paintCollageRelated(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!timeline?.width) return;
  const { width, height, safe, still } = timeline;
  const t = still ? 2 : Number(time) || 0;
  paintPaper(ctx, width, height, still ? 1 : t);
  paintCollageWord(ctx, "RELACIONADOS", safe.side - 10, safe.top + 36, {
    size: 52,
    seed: 5,
    time: t,
    maxWidth: width - safe.side * 2 + 24,
  });
  ctx.save();
  ctx.globalAlpha = collageEnter(t, 0.12, 0.2);
  ctx.fillStyle = MUTED;
  ctx.font = "800 16px Inter, sans-serif";
  ctx.fillText(dayLabel || "", safe.side, safe.top + 78);
  ctx.restore();

  paintCollagePitch(ctx, timeline, t);

  const scene = relatedNightSceneAt(timeline, t);
  const featured = scene?.type === "player" ? scene.player : (timeline.players || [])[0];
  const asset = assets?.byId?.[featured?.id];
  if (!featured) return;

  paintTornPhoto(ctx, asset?.bitmap, {
    x: width * 0.58,
    y: height * 0.22,
    w: width * 0.34,
    h: height * 0.42,
  }, {
    seed: 33,
    rot: 0.05,
    alpha: collageEnter(t, scene?.start || 0.2, 0.28),
    time: t,
  });
  paintTape(ctx, width * 0.7, height * 0.23, 100, -0.2, collageEnter(t, 0.34, 0.16));

  const number = shirtLabel(featured);
  if (number) {
    paintSticker(ctx, number, width * 0.6, height * 0.68, {
      size: 28,
      rot: -0.12,
      fill: SHEET,
      time: t,
      start: 0.36,
    });
  }
  paintCollageWord(ctx, String(featured.name || "").toUpperCase(), safe.side, height * 0.84, {
    size: 54,
    seed: 17,
    time: t,
    start: 0.32,
    maxWidth: width * 0.7,
  });
  paintSticker(ctx, featured.position || "MC", safe.side + 12, height * 0.92, {
    size: 18,
    rot: 0.06,
    fill: INK,
    time: t,
    start: 0.44,
  });
}

export function paintCollageSummary(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!timeline?.width) return;
  const { width, height, safe, still } = timeline;
  const t = still ? 2 : Number(time) || 0;
  const matches = timeline.matches || [];
  const stats = timeline.stats || timeline.period?.stats || {};
  paintPaper(ctx, width, height, still ? 1 : t);
  paintCollageWord(ctx, "RESUMO", safe.side, safe.top + 54, {
    size: 88,
    seed: 11,
    time: t,
    maxWidth: width - safe.side * 2,
  });
  ctx.save();
  ctx.globalAlpha = collageEnter(t, 0.1, 0.2);
  ctx.fillStyle = MUTED;
  ctx.font = "800 16px Inter, sans-serif";
  ctx.fillText(dayLabel || timeline.title || "", safe.side, safe.top + 104);
  ctx.restore();

  [["J", stats.games], ["V", stats.wins], ["GOLS", stats.goalsFor ?? stats.gf]].forEach((item, index) => {
    const x = safe.side + index * 210 + (index === 1 ? 12 : 0);
    const y = safe.top + 150 + (index === 2 ? 10 : 0);
    const enter = collageEnter(t, 0.16 + index * 0.07, 0.24);
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.translate(x, y);
    ctx.rotate(-0.06 + index * 0.05);
    ctx.fillStyle = SHEET;
    ctx.fillRect(0, 0, 176, 118);
    ctx.fillStyle = "#16140f";
    ctx.font = "800 16px Inter, sans-serif";
    ctx.fillText(String(item[0]), 16, 36);
    ctx.font = "800 58px Rajdhani, sans-serif";
    ctx.fillText(String(item[1] ?? "—"), 16, 96);
    ctx.restore();
    paintTape(ctx, x + 40, y + 4, 64, -0.2, enter);
  });

  matches.slice(0, 5).forEach((match, index) => {
    const y = safe.top + 310 + index * 98;
    const enter = collageEnter(t, 0.28 + index * 0.06, 0.22);
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.translate(safe.side + (index % 2 ? 8 : -8), y);
    ctx.rotate(index % 2 ? 0.012 : -0.014);
    ctx.fillStyle = "rgba(244,241,234,0.07)";
    ctx.fillRect(0, 0, width - safe.side * 2, 84);
    ctx.fillStyle = INK;
    ctx.font = "700 32px Rajdhani, sans-serif";
    ctx.fillText(fit(ctx, String(match.opponent || "").toUpperCase(), width * 0.5, ctx.font), 18, 52);
    ctx.textAlign = "right";
    ctx.font = "800 40px Rajdhani, sans-serif";
    ctx.fillText(`${match.strix_score ?? match.scoreFor ?? ""}–${match.opponent_score ?? match.scoreAgainst ?? ""}`, width - safe.side * 2 - 18, 56);
    const logo = assets?.opponents?.[index] || assets?.byId?.[match.id];
    if (logo?.bitmap) ctx.drawImage(logo.bitmap, width * 0.52, 12, 52, 52);
    ctx.restore();
  });
}

export function isCollageLook(timeline) {
  return String(timeline?.mediaLook || "").toLowerCase() === "collage";
}

export { opponentInitials, easeInOutCubic };
