import { easeInOutCubic, easeOutExpo, reveal } from "./agenda-timeline.js";
import { campaignName, fitNameLayout } from "./announce-look.js";
import { opponentInitials } from "./agenda-media-core.js";
import { typeScale } from "./agenda-paint.js";

const PAPER = "#12110f";
const INK = "#f4f1ea";
const MUTED = "#9b968c";
const TAPE = "rgba(232,224,208,0.72)";
const VOID = "#080807";

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function seeded(seed = 1) {
  let state = (Math.imul(Number(seed) || 1, 2654435761) >>> 0) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 13), 1274126177) >>> 0;
    return state / 4294967296;
  };
}

let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(96, 96);
  let seed = 2166136261;
  for (let index = 0; index < image.data.length; index += 4) {
    seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0;
    const value = 70 + (seed & 90);
    image.data[index] = value;
    image.data[index + 1] = value - 4;
    image.data[index + 2] = value - 10;
    image.data[index + 3] = 28;
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return grainTile;
}

function paintPaper(ctx, width, height, time = 0) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  const wash = ctx.createRadialGradient(width * 0.5, height * 0.28, 20, width * 0.5, height * 0.4, Math.max(width, height) * 0.72);
  wash.addColorStop(0, "rgba(244,241,234,0.06)");
  wash.addColorStop(1, "rgba(8,8,7,0.42)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
  const tile = grain();
  if (tile) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.drawImage(tile, 0, 0, width + 40, height + 40);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = INK;
  for (let y = 18; y < height; y += 7) ctx.fillRect(0, y, width, 1);
  ctx.restore();
  const flash = Math.sin(clamp(time / 0.16) * Math.PI) * (time < 0.18 ? 0.08 : 0);
  if (flash > 0) {
    ctx.fillStyle = `rgba(244,241,234,${flash})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function tornPath(ctx, x, y, w, h, seed) {
  const rand = seeded(seed);
  ctx.beginPath();
  const steps = 14;
  ctx.moveTo(x + rand() * 8, y + rand() * 6);
  for (let i = 1; i <= steps; i += 1) {
    ctx.lineTo(x + (w * i) / steps + (rand() - 0.5) * 10, y + (rand() - 0.5) * 8);
  }
  for (let i = 1; i <= steps; i += 1) {
    ctx.lineTo(x + w + (rand() - 0.5) * 8, y + (h * i) / steps + (rand() - 0.5) * 8);
  }
  for (let i = 1; i <= steps; i += 1) {
    ctx.lineTo(x + w - (w * i) / steps + (rand() - 0.5) * 10, y + h + (rand() - 0.5) * 8);
  }
  for (let i = 1; i <= steps; i += 1) {
    ctx.lineTo(x + (rand() - 0.5) * 8, y + h - (h * i) / steps + (rand() - 0.5) * 8);
  }
  ctx.closePath();
}

function paintTape(ctx, x, y, w, rot = -0.18) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = TAPE;
  ctx.fillRect(-w / 2, -7, w, 14);
  ctx.restore();
}

function paintSticker(ctx, text, x, y, { size = 28, rot = 0, fill = INK, alpha = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(8,8,7,0.88)";
  ctx.fillRect(-8, -size * 0.78, ctx.measureText ? 0 : 120, size * 1.15);
  ctx.font = `800 ${size}px Inter, sans-serif`;
  const width = ctx.measureText(String(text)).width;
  ctx.fillRect(-12, -size * 0.82, width + 24, size * 1.2);
  ctx.fillStyle = fill;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(text), 0, 0);
  ctx.restore();
}

function cover(ctx, bitmap, x, y, w, h, focusY = 0.2) {
  if (!bitmap) return;
  const scale = Math.max(w / bitmap.width, h / bitmap.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (bitmap.width - sw) / 2;
  const sy = Math.max(0, Math.min(bitmap.height - sh, bitmap.height * focusY - sh * 0.28));
  ctx.drawImage(bitmap, sx, sy, sw, sh, x, y, w, h);
}

function paintTornPhoto(ctx, bitmap, box, { seed = 1, rot = -0.04, alpha = 1, time = 0 } = {}) {
  const { x, y, w, h } = box;
  const lift = (1 - alpha) * 28;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2, y + h / 2 + lift);
  ctx.rotate(rot);
  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = INK;
  tornPath(ctx, -10, -10, w + 20, h + 20, seed);
  ctx.fill();
  ctx.save();
  tornPath(ctx, 0, 0, w, h, seed + 7);
  ctx.clip();
  if (bitmap) cover(ctx, bitmap, 0, 0, w, h, 0.18);
  else {
    ctx.fillStyle = "#1b1a17";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  paintTape(ctx, w * 0.18, 4, 86, -0.22);
  paintTape(ctx, w * 0.82, h - 2, 74, 0.16);
  ctx.restore();
}

function enter(time, start, dur = 0.32) {
  return reveal(time, start, dur, easeOutExpo);
}

function fit(ctx, text, maxWidth, font) {
  ctx.font = font;
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1);
  return `${next}…`;
}

export function paintCollageAnnounce(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  const { width, height, safe, still } = timeline;
  const t = still ? 1.4 : Number(time) || 0;
  paintPaper(ctx, width, height, still ? 1 : t);
  const person = timeline.person || timeline.people?.[0];
  const people = timeline.people || [];
  ctx.save();
  ctx.globalAlpha = enter(t, 0.02, 0.28);
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", safe.side, safe.top - 4);
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.fillText(timeline.season || "FC 27", width - safe.side, safe.top - 4);
  ctx.restore();

  if (timeline.kind === "team" && (still || t >= (timeline.finaleStart || 0))) {
    people.slice(0, 8).forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const bw = (width - safe.side * 2 - 28) / 2;
      const bh = 220;
      const x = safe.side + col * (bw + 28);
      const y = safe.top + 48 + row * (bh + 36);
      const asset = assets?.byId?.[item.id];
      paintTornPhoto(ctx, asset?.bitmap, { x, y, w: bw, h: bh - 48 }, {
        seed: index + 3,
        rot: (index % 2 ? 0.03 : -0.04),
        alpha: enter(t, 0.08 + index * 0.04, 0.24),
        time: t,
      });
      ctx.save();
      ctx.globalAlpha = enter(t, 0.16 + index * 0.04, 0.2);
      ctx.fillStyle = INK;
      ctx.font = "700 28px Rajdhani, sans-serif";
      ctx.fillText(fit(ctx, campaignName(item), bw, ctx.font), x, y + bh - 8);
      ctx.restore();
    });
    return;
  }

  const asset = assets?.byId?.[person?.id] || assets?.players?.[0];
  const photoW = width * 0.78;
  const photoH = height * 0.52;
  paintTornPhoto(ctx, asset?.bitmap, {
    x: (width - photoW) / 2,
    y: safe.top + 36,
    w: photoW,
    h: photoH,
  }, {
    seed: 11,
    rot: -0.035 + Math.sin(t * 0.2) * 0.008,
    alpha: enter(t, 0.08, 0.36),
    time: t,
  });

  const name = fitNameLayout(ctx, campaignName(person || {}), width - safe.side * 2, 120, 56);
  ctx.save();
  ctx.globalAlpha = enter(t, 0.22, 0.3);
  ctx.fillStyle = INK;
  ctx.font = `800 ${name.size}px Rajdhani, sans-serif`;
  name.lines.forEach((line, index) => {
    ctx.save();
    ctx.translate(safe.side + 8, height - safe.bottom - 210 + index * name.size * 0.9);
    ctx.rotate(-0.03);
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = enter(t, 0.34, 0.24);
  paintSticker(ctx, (person?.position || "MC").toUpperCase(), safe.side + 18, height - safe.bottom - 96, {
    size: 22,
    rot: -0.08,
    fill: INK,
  });
  if (person?.extraBadge) {
    paintSticker(ctx, person.extraBadge, safe.side + 168, height - safe.bottom - 78, {
      size: 18,
      rot: 0.06,
      fill: "#e4d5b4",
    });
  }
  ctx.restore();

  if (timeline.phrase) {
    ctx.save();
    ctx.globalAlpha = enter(t, 0.48, 0.28);
    ctx.fillStyle = MUTED;
    ctx.font = "600 28px Inter, sans-serif";
    ctx.fillText(fit(ctx, String(timeline.phrase).toUpperCase(), width - safe.side * 2, ctx.font), safe.side, height - safe.bottom - 28);
    ctx.restore();
  }
}

export function paintCollageAgenda(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!timeline?.width) return;
  const { width, height, safe, still } = timeline;
  const t = still ? 1.2 : Number(time) || 0;
  const matches = timeline.matches || [];
  paintPaper(ctx, width, height, still ? 1 : t);
  ctx.save();
  ctx.globalAlpha = enter(t, 0, 0.24);
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText("AGENDA DO DIA", safe.side, safe.top);
  ctx.fillStyle = INK;
  ctx.font = "700 64px Rajdhani, sans-serif";
  ctx.fillText("STRIX UNITED", safe.side, safe.top + 72);
  ctx.fillStyle = MUTED;
  ctx.font = "800 22px Inter, sans-serif";
  ctx.fillText(dayLabel || "", safe.side, safe.top + 108);
  ctx.restore();

  matches.slice(0, 6).forEach((match, index) => {
    const y = safe.top + 148 + index * 118;
    ctx.save();
    ctx.globalAlpha = enter(t, 0.12 + index * 0.08, 0.28);
    ctx.translate(safe.side, y);
    ctx.rotate(index % 2 ? 0.012 : -0.012);
    ctx.fillStyle = "rgba(244,241,234,0.06)";
    ctx.fillRect(0, 0, width - safe.side * 2, 102);
    ctx.fillStyle = INK;
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillText(match.kickoff || "", 18, 36);
    ctx.font = "700 36px Rajdhani, sans-serif";
    ctx.fillText(fit(ctx, String(match.opponent || "").toUpperCase(), width - safe.side * 2 - 40, ctx.font), 18, 74);
    const logo = assets?.opponents?.[index] || assets?.byId?.[match.id];
    if (logo?.bitmap) {
      ctx.drawImage(logo.bitmap, width - safe.side * 2 - 88, 14, 72, 72);
    }
    ctx.restore();
  });
}

export function paintCollageRelated(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!timeline?.width) return;
  const { width, height, safe, still } = timeline;
  const t = still ? 1.2 : Number(time) || 0;
  const players = timeline.players || [];
  paintPaper(ctx, width, height, still ? 1 : t);
  ctx.save();
  ctx.globalAlpha = enter(t, 0, 0.22);
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText("RELACIONADOS", safe.side, safe.top);
  ctx.fillStyle = INK;
  ctx.font = "700 58px Rajdhani, sans-serif";
  ctx.fillText("NOITE STRIX", safe.side, safe.top + 68);
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText(dayLabel || "", safe.side, safe.top + 100);
  ctx.restore();

  const scene = (timeline.scenes || []).find((item) => item.type === "player" && t >= item.start && t < item.end);
  const featured = scene?.player || players[0];
  const asset = assets?.byId?.[featured?.id];
  if (featured) {
    paintTornPhoto(ctx, asset?.bitmap, {
      x: width * 0.18,
      y: safe.top + 128,
      w: width * 0.64,
      h: height * 0.42,
    }, {
      seed: 21,
      rot: -0.04,
      alpha: enter(t, 0.1, 0.3),
    });
    const number = featured.number || featured.shirt_number;
    ctx.save();
    ctx.globalAlpha = enter(t, 0.28, 0.24);
    ctx.fillStyle = INK;
    ctx.font = "800 120px Rajdhani, sans-serif";
    ctx.fillText(number != null && number !== "" ? String(number).padStart(2, "0") : "", safe.side, height - safe.bottom - 120);
    ctx.font = "700 72px Rajdhani, sans-serif";
    ctx.fillText(fit(ctx, String(featured.name || "").toUpperCase(), width - safe.side * 2, ctx.font), safe.side, height - safe.bottom - 48);
    ctx.fillStyle = MUTED;
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillText(String(featured.position || "").toUpperCase(), safe.side, height - safe.bottom - 12);
    ctx.restore();
  }
}

export function paintCollageSummary(ctx, { timeline, time = 0, assets, dayLabel } = {}) {
  if (!timeline?.width) return;
  const { width, height, safe, still } = timeline;
  const t = still ? 1.2 : Number(time) || 0;
  const matches = timeline.matches || [];
  const stats = timeline.stats || {};
  paintPaper(ctx, width, height, still ? 1 : t);
  ctx.save();
  ctx.globalAlpha = enter(t, 0, 0.24);
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText(timeline.title || "RESUMO", safe.side, safe.top);
  ctx.fillStyle = INK;
  ctx.font = "700 62px Rajdhani, sans-serif";
  ctx.fillText("STRIX UNITED", safe.side, safe.top + 72);
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText(dayLabel || "", safe.side, safe.top + 104);
  ctx.restore();

  [["J", stats.games], ["V", stats.wins], ["GOLS", stats.goalsFor]].forEach((item, index) => {
    const x = safe.side + index * 210;
    ctx.save();
    ctx.globalAlpha = enter(t, 0.16 + index * 0.06, 0.22);
    ctx.translate(x, safe.top + 150);
    ctx.rotate(-0.04 + index * 0.03);
    ctx.fillStyle = "rgba(244,241,234,0.08)";
    ctx.fillRect(0, 0, 188, 110);
    ctx.fillStyle = MUTED;
    ctx.font = "800 16px Inter, sans-serif";
    ctx.fillText(String(item[0]), 16, 32);
    ctx.fillStyle = INK;
    ctx.font = "800 52px Rajdhani, sans-serif";
    ctx.fillText(String(item[1] ?? "—"), 16, 86);
    ctx.restore();
  });

  matches.slice(0, 5).forEach((match, index) => {
    const y = safe.top + 300 + index * 92;
    ctx.save();
    ctx.globalAlpha = enter(t, 0.28 + index * 0.06, 0.22);
    ctx.fillStyle = INK;
    ctx.font = "700 32px Rajdhani, sans-serif";
    ctx.fillText(fit(ctx, String(match.opponent || "").toUpperCase(), width * 0.58, ctx.font), safe.side, y);
    ctx.textAlign = "right";
    ctx.fillText(`${match.strix_score ?? match.scoreFor ?? ""}–${match.opponent_score ?? match.scoreAgainst ?? ""}`, width - safe.side, y);
    ctx.restore();
  });
}

export function isCollageLook(timeline) {
  return String(timeline?.mediaLook || "").toLowerCase() === "collage";
}

export { typeScale, opponentInitials, easeInOutCubic };
