import { opponentInitials } from "./agenda-media-core.js";
import { logoDrawRect, paintAmbient, paintSceneSweep, typeScale } from "./agenda-paint.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";
import { composeAnnounceFx, fxEnvelope } from "./announce-fx.js";
import {
  announceGridSpec,
  announceRoleLook,
  campaignName,
  classifyAnnouncePhoto,
  fitAnnounceSubject,
  fitNameLayout,
  photoBoxForVariant,
  photoFocusY,
  typeBoxForVariant,
} from "./announce-look.js";
import { announceSceneAt } from "./announce-timeline.js";

const INK = "#efece6";
const MUTED = "#9aa0a6";
const VOID = "#050607";
const RULE = "rgba(239,236,230,0.34)";

const softPlanes = new WeakMap();
let grainTile = null;
let fxScratch = null;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function fadeRgba(color, amount) {
  const match = String(color || "").match(/rgba?\(([^)]+)\)/i);
  if (!match) return color;
  const parts = match[1].split(",").map((part) => part.trim());
  const alpha = Number(parts[3] ?? 1) * clamp(amount);
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
}

function fitText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1);
  return `${next}…`;
}

function wrapPhrase(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const next = `${current} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines.slice(0, 2);
}

function getGrainTile() {
  if (grainTile) return grainTile;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(96, 96);
  let seed = 2166136261;
  for (let index = 0; index < image.data.length; index += 4) {
    seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0;
    const value = seed & 255;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 26;
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return grainTile;
}

function getSoftPlane(bitmap) {
  if (!bitmap) return null;
  const cached = softPlanes.get(bitmap);
  if (cached) return cached;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, 180, 320);
  ctx.fillStyle = "rgba(5,6,7,0.48)";
  ctx.fillRect(0, 0, 180, 320);
  softPlanes.set(bitmap, canvas);
  return canvas;
}

function coverPhoto(ctx, bitmap, dx, dy, dw, dh, focusY = 0.22) {
  const scale = Math.max(dw / bitmap.width, dh / bitmap.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (bitmap.width - sw) / 2;
  const sy = Math.max(0, Math.min(bitmap.height - sh, bitmap.height * focusY - sh * 0.28));
  ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawMark(ctx, asset, x, y, box, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  if (asset?.bitmap) {
    const rect = logoDrawRect(asset, box);
    ctx.drawImage(asset.bitmap, rect.sx, rect.sy, rect.sw, rect.sh, -rect.dw / 2, -rect.dh / 2, rect.dw, rect.dh);
  } else {
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(box * 0.38)}px Rajdhani, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(asset?.initials || "SU", 0, 2);
  }
  ctx.restore();
}

function paintGrain(ctx, timeline, time, assets) {
  const grain = assets?.fx?.grain01;
  if (composeAnnounceFx(ctx, grain, { x: 0, y: 0, w: timeline.width, h: timeline.height, alpha: 1, time })) return;
  const tile = getGrainTile();
  if (!tile) return;
  const shift = Math.round((time * 8) % 96);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.drawImage(tile, -shift, -shift, timeline.width + 96, timeline.height + 96);
  ctx.restore();
}

function paintGrade(ctx, x, y, w, h, look) {
  const punch = ctx.createRadialGradient(x + w * 0.48, y + h * 0.32, Math.min(w, h) * 0.1, x + w * 0.5, y + h * 0.42, Math.max(w, h) * 0.82);
  punch.addColorStop(0, "rgba(255,255,255,0.1)");
  punch.addColorStop(0.38, "rgba(255,255,255,0)");
  punch.addColorStop(1, "rgba(5,6,7,0.5)");
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = punch;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  const blacks = ctx.createLinearGradient(x, y + h * 0.52, x, y + h);
  blacks.addColorStop(0, "rgba(5,6,7,0)");
  blacks.addColorStop(0.55, "rgba(5,6,7,0.16)");
  blacks.addColorStop(1, "rgba(5,6,7,0.38)");
  ctx.fillStyle = blacks;
  ctx.fillRect(x, y, w, h);
  const vignette = ctx.createRadialGradient(x + w * 0.5, y + h * 0.38, Math.min(w, h) * 0.22, x + w * 0.5, y + h * 0.42, Math.max(w, h) * 0.72);
  vignette.addColorStop(0, "rgba(5,6,7,0)");
  vignette.addColorStop(1, "rgba(5,6,7,0.14)");
  ctx.fillStyle = vignette;
  ctx.fillRect(x, y, w, h);
  const rim = ctx.createLinearGradient(x + w * 0.04, y + h * 0.08, x + w * 0.55, y + h * 0.58);
  const rimInk = look?.grade === "warm"
    ? ["rgba(232,214,170,0.2)", "rgba(212,196,160,0.05)", "rgba(212,196,160,0)"]
    : look?.grade === "stone"
      ? ["rgba(196,206,210,0.16)", "rgba(168,180,186,0.05)", "rgba(168,180,186,0)"]
      : look?.grade === "steel"
        ? ["rgba(220,224,228,0.16)", "rgba(201,206,212,0.05)", "rgba(201,206,212,0)"]
        : ["rgba(239,236,230,0.22)", "rgba(239,236,230,0.06)", "rgba(239,236,230,0)"];
  rim.addColorStop(0, rimInk[0]);
  rim.addColorStop(0.34, rimInk[1]);
  rim.addColorStop(1, rimInk[2]);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = rim;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  if (look?.wash) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const wash = ctx.createRadialGradient(x + w * 0.5, y + h * 0.28, 12, x + w * 0.5, y + h * 0.42, Math.max(w, h) * 0.72);
    wash.addColorStop(0, look.wash);
    wash.addColorStop(1, "rgba(5,6,7,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
}

function paintBackground(ctx, timeline, bitmap, time, camera = 1) {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);
  const plane = getSoftPlane(bitmap);
  if (plane) {
    const drift = Math.sin(time * 0.11) * 8;
    const scale = 1.16 * camera;
    const w = width * scale;
    const h = height * scale;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.drawImage(plane, (width - w) / 2 + drift, (height - h) / 2 + drift * 0.22, w, h);
    ctx.restore();
  }
  const veil = ctx.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, "rgba(5,6,7,0.28)");
  veil.addColorStop(0.45, "rgba(5,6,7,0.06)");
  veil.addColorStop(1, "rgba(5,6,7,0.7)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);
}

function paintTypePlate(ctx, timeline, variant, lift = 0) {
  const { width, height } = timeline;
  if (variant === "left") {
    ctx.fillStyle = VOID;
    ctx.fillRect(Math.round(width * 0.60), 0, width, height);
    return;
  }
  if (variant === "tight") {
    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, Math.round(width * 0.36), height);
    return;
  }
  const start = height * (0.5 - lift * 0.06);
  const fade = ctx.createLinearGradient(0, start, 0, height);
  fade.addColorStop(0, "rgba(5,6,7,0)");
  fade.addColorStop(0.18, "rgba(5,6,7,0.5)");
  fade.addColorStop(0.42, "rgba(5,6,7,0.92)");
  fade.addColorStop(1, "rgba(5,6,7,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, start, width, height - start);
}

function paintTopVeil(ctx, timeline) {
  const fade = ctx.createLinearGradient(0, 0, 0, 170);
  fade.addColorStop(0, "rgba(5,6,7,0.58)");
  fade.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, timeline.width, 170);
}

function paintChrome(ctx, timeline, { alpha = 1, season = "FC 27", variant = "center" } = {}) {
  const { width, safe } = timeline;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "800 16px Inter, sans-serif";
  if (variant === "left") {
    const x = Math.round(width * 0.66);
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.fillText("STRIX UNITED", x, safe.top - 8);
    ctx.fillStyle = INK;
    ctx.textAlign = "right";
    ctx.fillText(season, width - safe.side, safe.top - 8);
    ctx.fillStyle = RULE;
    ctx.fillRect(x, safe.top + 6, width - safe.side - x, 1);
  } else if (variant === "tight") {
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.fillText("STRIX UNITED", safe.side, safe.top - 8);
    ctx.fillStyle = INK;
    ctx.fillText(season, Math.round(width * 0.32) - 12, safe.top - 8);
    ctx.fillStyle = RULE;
    ctx.fillRect(safe.side, safe.top + 6, Math.round(width * 0.32) - 20, 1);
  } else {
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.fillText("STRIX UNITED", safe.side, safe.top - 8);
    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    ctx.fillText(season, width - safe.side, safe.top - 8);
    ctx.fillStyle = RULE;
    ctx.fillRect(safe.side, safe.top + 6, width - safe.side * 2, 1);
  }
  ctx.restore();
}

function paintShutter(ctx, timeline, amount) {
  const closed = clamp(amount);
  if (closed <= 0.001) return;
  const { width, height } = timeline;
  const h = height * 0.5 * closed;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, h);
  ctx.fillRect(0, height - h, width, h);
}

function hasFx(fx) {
  return Boolean(fx && !fx.missing && (fx.frames?.length || fx.bitmap));
}

function getFxScratch(width, height) {
  if (typeof document === "undefined") return null;
  if (!fxScratch || fxScratch.width !== width || fxScratch.height !== height) {
    fxScratch = document.createElement("canvas");
    fxScratch.width = width;
    fxScratch.height = height;
  }
  return fxScratch;
}

function paintInkReveal(ctx, timeline, amount, assets, paintIncoming) {
  const fx = assets?.fx?.inkReveal01;
  if (!hasFx(fx) || amount <= 0.001) return false;
  const scratch = getFxScratch(timeline.width, timeline.height);
  if (!scratch) return false;
  const sctx = scratch.getContext("2d");
  if (!sctx) return false;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = "source-over";
  sctx.globalAlpha = 1;
  sctx.clearRect(0, 0, timeline.width, timeline.height);
  paintIncoming(sctx);
  composeAnnounceFx(sctx, fx, {
    x: 0,
    y: 0,
    w: timeline.width,
    h: timeline.height,
    alpha: 1,
    time: (1 - clamp(amount)) * (fx.duration || 1),
  });
  ctx.drawImage(scratch, 0, 0);
  return true;
}

function paintBrushCut(ctx, timeline, amount, assets) {
  const fx = assets?.fx?.brush01;
  if (!hasFx(fx) || amount <= 0.001) return false;
  return composeAnnounceFx(ctx, fx, {
    x: 0,
    y: 0,
    w: timeline.width,
    h: timeline.height,
    alpha: clamp(amount),
    time: (1 - clamp(amount)) * (fx.duration || 1),
  });
}

function paintCutCover(ctx, timeline, amount, assets, even, inked) {
  if (amount <= 0.001) return;
  const brushed = paintBrushCut(ctx, timeline, amount, assets);
  if (inked || brushed) return;
  if (even) paintShutter(ctx, timeline, amount);
  else paintPhotoFlash(ctx, timeline, amount, assets);
}

function paintPhotoFlash(ctx, timeline, amount, assets, look) {
  const closed = clamp(amount);
  if (closed <= 0.001) return;
  if (composeAnnounceFx(ctx, assets?.fx?.flash01, {
    x: 0,
    y: 0,
    w: timeline.width,
    h: timeline.height,
    alpha: closed,
  })) {
    if (look?.flash && look.id !== "jogador") {
      ctx.fillStyle = fadeRgba(look.flash, closed * 0.55);
      ctx.fillRect(0, 0, timeline.width, timeline.height);
    }
    return;
  }
  ctx.fillStyle = fadeRgba(look?.flash || "rgba(239,236,230,0.78)", closed);
  ctx.fillRect(0, 0, timeline.width, timeline.height);
}

function paintNameAccent(ctx, box, progress, y, look) {
  const amount = clamp(progress);
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.55 * amount;
  ctx.fillStyle = look?.ink && look.id !== "jogador" ? look.ink : INK;
  ctx.fillRect(box.x, y, Math.min(box.w * 0.42, 220) * (0.35 + amount * 0.65), 3);
  ctx.restore();
}

function paintRoleAtmosphere(ctx, timeline, look, alpha = 1) {
  if (!look || look.id === "jogador" || alpha <= 0) return;
  const { width, height } = timeline;
  ctx.save();
  ctx.globalAlpha = alpha;
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.34, 18, width * 0.52, height * 0.4, Math.max(width, height) * 0.7);
  glow.addColorStop(0, look.ambient);
  glow.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function paintRoleMarks(ctx, timeline, look, alpha = 1) {
  if (!look?.mark || alpha <= 0) return;
  const { width, height, safe } = timeline;
  const x = safe.side;
  const y = safe.top + 28;
  const w = width - safe.side * 2;
  const h = height - safe.top - safe.bottom - 36;
  ctx.save();
  ctx.strokeStyle = look.border || look.rule;
  ctx.lineWidth = 1.25;
  ctx.lineCap = "square";
  if (look.mark === "gold" || look.mark === "steel") {
    ctx.globalAlpha = alpha * 0.82;
    const arm = look.mark === "gold" ? 26 : 18;
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * arm);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * arm, cy);
      ctx.stroke();
    });
  }
  if (look.mark === "stone") {
    ctx.globalAlpha = alpha * 0.42;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
  }
  if (look.mark === "steel") {
    ctx.globalAlpha = alpha * 0.38;
    ctx.beginPath();
    ctx.moveTo(x, y + 11);
    ctx.lineTo(x + 52, y + 11);
    ctx.moveTo(x + w - 52, y + 11);
    ctx.lineTo(x + w, y + 11);
    ctx.stroke();
  }
  if (look.mark === "gold") {
    ctx.globalAlpha = alpha * 0.28;
    ctx.beginPath();
    ctx.moveTo(x + 18, y);
    ctx.lineTo(x + w - 18, y);
    ctx.stroke();
  }
  ctx.restore();
}

function paintRoleSweep(ctx, timeline, look, local = 0, still = false) {
  if (!look?.sweep || look.id === "jogador") return;
  const { width, height } = timeline;
  const t = still ? 0.42 : clamp(local / 1.15);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  if (look.mark === "stone") {
    const y = height * (0.08 + t * 0.46);
    const sweep = ctx.createLinearGradient(0, y - 70, 0, y + 90);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.5, look.sweep);
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, width, height * 0.7);
  } else if (look.mark === "steel") {
    const y = height * (0.16 + t * 0.28);
    ctx.fillStyle = fadeRgba(look.sweep, still ? 0.55 : Math.sin(t * Math.PI) * 0.85);
    ctx.fillRect(0, y, width, 2);
  } else {
    const x = -width * 0.25 + t * width * 1.28;
    const sweep = ctx.createLinearGradient(x, 0, x + width * 0.32, height * 0.18);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.5, look.sweep);
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, width, height * 0.62);
  }
  ctx.restore();
}

function paintCampaignFallback(ctx, person, box, assets) {
  const { x, y, w, h } = box;
  ctx.fillStyle = "#101318";
  ctx.fillRect(x, y, w, h);
  const glow = ctx.createRadialGradient(x + w / 2, y + h * 0.42, 16, x + w / 2, y + h * 0.42, Math.max(w, h) * 0.52);
  glow.addColorStop(0, "rgba(239,236,230,0.08)");
  glow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  drawMark(ctx, assets?.strix, x + w / 2, y + h * 0.46, Math.min(w, h) * 0.62, 0.2);
  ctx.fillStyle = MUTED;
  ctx.font = "800 14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("FC 27", x + w / 2, y + h * 0.16);
  ctx.fillStyle = "rgba(239,236,230,0.16)";
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.22)}px Rajdhani, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(person?.initials || opponentInitials(person?.name), x + w / 2, y + h * 0.78);
}

function paintSubject(ctx, bitmap, person, box, classified, { scale = 1, alpha = 1, drift = 0, assets, look } = {}) {
  const { x, y, w, h, focusY = 0.22 } = box;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2 + drift, y + h / 2);
  ctx.translate(-w / 2, -h / 2);
  if (!bitmap) {
    paintCampaignFallback(ctx, person, { x: 0, y: 0, w, h }, assets);
    ctx.restore();
    return;
  }
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.4, 18, w * 0.5, h * 0.46, Math.max(w, h) * 0.62);
  glow.addColorStop(0, look?.ambient || "rgba(239,236,230,0.16)");
  glow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  const fit = fitAnnounceSubject(bitmap, w, h, classified, {
    scale,
    focusY: focusY || photoFocusY(classified),
  });
  ctx.drawImage(bitmap, fit.sx, fit.sy, fit.sw, fit.sh, fit.dx, fit.dy, fit.dw, fit.dh);
  paintGrade(ctx, 0, 0, w, h, look);
  ctx.restore();
}

function paintTypeStack(ctx, person, timeline, box, {
  alpha = 1,
  nameSize,
  brushProgress = 1,
  phrase = "",
  phraseAlpha = 0,
  stage = "hero",
} = {}) {
  if (alpha <= 0) return;
  const story = timeline.format !== "feed";
  const prefer = nameSize || (story ? 88 : 72);
  const layout = fitNameLayout(ctx, campaignName(person), box.w, prefer, story ? 44 : 40);
  const look = announceRoleLook(person.extraRole);
  const metaSize = stage === "detail" || stage === "close" || !story ? 15 : 13;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  const nameY = box.y + (layout.size * 0.86);
  layout.lines.forEach((line, index) => {
    ctx.font = `700 ${layout.size}px Rajdhani, sans-serif`;
    ctx.fillText(line, box.x, nameY + index * (layout.size * 0.9));
  });
  const nameBottom = nameY + (layout.lines.length - 1) * (layout.size * 0.9);
  const positionY = nameBottom + layout.size * 0.5;
  ctx.fillStyle = MUTED;
  ctx.font = `800 ${metaSize}px Inter, sans-serif`;
  ctx.fillText((person.position || "MC").toUpperCase(), box.x, positionY);
  let accentY = positionY + 18;
  if (person.extraBadge) {
    ctx.fillStyle = look.ink;
    ctx.font = `800 ${metaSize - 1}px Inter, sans-serif`;
    ctx.fillText(person.extraBadge, box.x, positionY + metaSize + 12);
    accentY = positionY + metaSize + 26;
  }
  paintNameAccent(ctx, box, brushProgress, accentY, look);
  if (stage === "detail" || stage === "close" || timeline.format === "feed") {
    ctx.fillStyle = MUTED;
    ctx.font = "800 13px Inter, sans-serif";
    ctx.fillText(timeline.season || "FC 27", box.x, accentY + 26);
  }
  if (phrase && phraseAlpha > 0) {
    ctx.globalAlpha = alpha * phraseAlpha;
    ctx.fillStyle = look.rule || RULE;
    ctx.fillRect(box.x, accentY + 44, 36, 2);
    ctx.fillStyle = INK;
    ctx.font = story ? "600 24px Inter, sans-serif" : "600 23px Inter, sans-serif";
    wrapPhrase(ctx, phrase, box.w, ctx.font).forEach((line, index) => {
      ctx.fillText(line, box.x, accentY + 86 + index * 32);
    });
  }
  ctx.restore();
}

function paintOpening(ctx, timeline, time, assets) {
  const { width, height, season } = timeline;
  const flash = timeline.still ? 0 : Math.sin(Math.min(1, time / 0.18) * Math.PI) * (time < 0.24 ? 0.72 : 0);
  const markIn = timeline.still ? 1 : reveal(time, 0.04, 0.42, easeOutExpo);
  const typeIn = timeline.still ? 1 : reveal(time, 0.28, 0.32, easeOutExpo);
  const seasonIn = timeline.still ? 1 : reveal(time, 0.48, 0.28, easeOutExpo);
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width / 2, height * 0.4, 12, width / 2, height * 0.4, 420);
  glow.addColorStop(0, "rgba(239,236,230,0.12)");
  glow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.translate(width / 2, height * 0.4);
  const pop = 2.28 - markIn * 1.18;
  ctx.scale(pop, pop);
  ctx.globalAlpha = Math.min(1, 0.35 + markIn);
  drawMark(ctx, assets?.strix, 0, 0, 320, 1);
  ctx.restore();
  if (flash > 0) {
    if (!composeAnnounceFx(ctx, assets?.fx?.flash01, { x: 0, y: 0, w: width, h: height, alpha: flash })) {
      ctx.fillStyle = `rgba(239,236,230,${flash})`;
      ctx.fillRect(0, 0, width, height);
    }
  }
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.globalAlpha = typeIn;
  ctx.font = "800 28px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", width / 2, height * 0.4 + 178);
  ctx.fillStyle = RULE;
  ctx.fillRect(width / 2 - 40, height * 0.4 + 196, 80, 2);
  ctx.globalAlpha = seasonIn;
  ctx.fillStyle = INK;
  ctx.font = "700 108px Rajdhani, sans-serif";
  ctx.fillText(season || "FC 27", width / 2, height * 0.4 + 292);
  ctx.restore();
  composeAnnounceFx(ctx, assets?.fx?.flare01, {
    x: 0,
    y: 0,
    w: width,
    h: height,
    alpha: Math.max(flash, fxEnvelope(time, 0.02, 1.15)),
    time,
  });
  composeAnnounceFx(ctx, assets?.fx?.lightSweep01, {
    x: 0,
    y: height * 0.12,
    w: width,
    h: height * 0.7,
    alpha: fxEnvelope(time, 0.1, 0.9),
    time,
  });
  paintGrain(ctx, timeline, time, assets);
}

function heroCamera(time, still, stage = "hero") {
  if (still) return { scale: 1.06, drift: 0, bg: 1.03, focusShift: 0, plateLift: 0.35 };
  const breath = Math.sin(time * 0.18) * 0.012;
  if (stage === "reveal") return { scale: 1.04 + breath, drift: 0, bg: 1.05, focusShift: 0.02, plateLift: 0 };
  if (stage === "hero") return { scale: 1.08 + breath, drift: 0, bg: 1.03, focusShift: 0, plateLift: 0 };
  if (stage === "reframe") return { scale: 1.14 + breath, drift: 0, bg: 1.07, focusShift: -0.04, plateLift: 0.2 };
  if (stage === "detail") return { scale: 1.18 + breath, drift: 0, bg: 1.05, focusShift: -0.055, plateLift: 0.35 };
  return { scale: 1.1 + breath, drift: 0, bg: 1.03, focusShift: -0.02, plateLift: 0.45 };
}

function paintHeroComposition(ctx, timeline, time, person, assets, {
  variant = "center",
  photoIn = 1,
  nameIn = 1,
  brushIn = 1,
  phraseIn = 0,
  phrase = "",
  indexLabel = "",
  recede = 1,
  stage = "hero",
} = {}) {
  const asset = assets?.byId?.[person?.id] || assets?.players?.[0];
  const classified = classifyAnnouncePhoto(asset?.bitmap);
  const box = photoBoxForVariant(variant, timeline, classified);
  box.focusY = clamp((box.focusY || photoFocusY(classified)) + heroCamera(time, timeline.still, stage).focusShift, 0.08, 0.34);
  const type = typeBoxForVariant(variant, timeline, box);
  const camera = heroCamera(time, timeline.still, stage);
  const arrive = 1.12 - photoIn * 0.12;
  paintBackground(ctx, timeline, asset?.bitmap, time, camera.bg);
  paintSubject(ctx, asset?.bitmap, person, box, classified, {
    scale: arrive * camera.scale * recede,
    alpha: photoIn,
    drift: camera.drift * 0.28,
    assets,
  });
  paintTypePlate(ctx, timeline, variant === "center" && timeline.format === "feed" ? "center" : variant, camera.plateLift);
  if (variant === "center" || timeline.format === "feed") paintTopVeil(ctx, timeline);
  paintChrome(ctx, timeline, { alpha: Math.max(nameIn, 0.55), season: timeline.season, variant });
  if (indexLabel) {
    ctx.save();
    ctx.globalAlpha = nameIn;
    ctx.fillStyle = MUTED;
    ctx.font = "800 15px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(indexLabel, type.x, timeline.safe.top + 44);
    ctx.restore();
  }
  paintTypeStack(ctx, person, timeline, type, {
    alpha: nameIn,
    brushProgress: brushIn,
    phrase,
    phraseAlpha: phraseIn,
    nameSize: variant === "tight" ? 68 : (timeline.format === "feed" ? 70 : 90),
    stage,
  });
  composeAnnounceFx(ctx, assets?.fx?.lightSweep01, {
    x: 0,
    y: 0,
    w: timeline.width,
    h: timeline.height * 0.45,
    alpha: photoIn * recede,
    time,
  });
  composeAnnounceFx(ctx, assets?.fx?.flare01, {
    x: timeline.width * 0.1,
    y: timeline.height * 0.12,
    w: timeline.width * 0.8,
    h: 160,
    alpha: fxEnvelope(time, 6.2, 1.1) * recede,
    time,
  });
  paintGrain(ctx, timeline, time, assets);
}

function lerpNum(a, b, t) {
  return a + (b - a) * t;
}

function mixCam(a, b, t) {
  const e = easeInOutCubic(clamp(t));
  return {
    scale: lerpNum(a.scale, b.scale, e),
    focus: lerpNum(a.focus, b.focus, e),
    lift: lerpNum(a.lift, b.lift, e),
    inset: lerpNum(a.inset, b.inset, e),
  };
}

function alongKeys(keys, t) {
  const u = clamp(t);
  if (u <= keys[0].t) return keys[0];
  for (let index = 1; index < keys.length; index += 1) {
    if (u <= keys[index].t) {
      const span = Math.max(0.0001, keys[index].t - keys[index - 1].t);
      return mixCam(keys[index - 1], keys[index], (u - keys[index - 1].t) / span);
    }
  }
  return keys[keys.length - 1];
}

function cinematicCamera(timeline, time = 0, local = 0, stage = "hero") {
  if (timeline?.still) return { scale: 1.12, focus: 0.16, lift: 0, inset: 4, drift: 0 };
  const live = Number(time) || 0;
  const breath = Math.sin(live * 0.15) * 0.007;
  const punch = local < 0.2 ? Math.sin((local / 0.2) * Math.PI) * 0.03 : 0;
  const table = {
    reveal: { scale: 1.045, focus: 0.195, lift: 4, inset: 10 },
    hero: { scale: 1.1, focus: 0.165, lift: 0, inset: 6 },
    reframe: { scale: 1.17, focus: 0.138, lift: -3, inset: 3 },
    detail: { scale: 1.23, focus: 0.118, lift: -5, inset: 2 },
    close: { scale: 1.12, focus: 0.155, lift: 0, inset: 5 },
  };
  const cam = table[stage] || table.hero;
  return { ...cam, scale: cam.scale + breath + punch, drift: 0 };
}

function playerStageGeometry(timeline, camera) {
  const { width, height, safe, format } = timeline;
  const story = format !== "feed";
  const type = typeScale(format);
  const typeReserve = story ? 572 : 410;
  const gap = story ? 90 : 82;
  const typeBox = {
    x: safe.side,
    y: height - safe.bottom - typeReserve + (story ? 22 : 14),
    w: width - safe.side * 2,
  };
  const inset = story ? camera.inset : Math.max(4, camera.inset - 2);
  const frameTop = safe.top + (story ? 52 : 34) + camera.lift * 0.28;
  const frame = {
    x: safe.side + inset,
    y: frameTop,
    w: width - (safe.side + inset) * 2,
    h: Math.max(400, typeBox.y - gap - frameTop),
  };
  return { type, headerY: safe.top + (story ? 32 : 18), frame, typeBox, gap };
}

function paintAnnounceStageFx(ctx, timeline, time, assets, { leak = 0, rays = 0 } = {}) {
  const { width, height } = timeline;
  if (rays > 0.02) {
    composeAnnounceFx(ctx, assets?.fx?.lightSweep01, {
      x: -width * 0.04,
      y: -height * 0.06,
      w: width * 1.08,
      h: height * 0.62,
      alpha: rays,
      scale: 1.06,
      time: time * 0.65,
    });
  }
  if (leak > 0.02) {
    composeAnnounceFx(ctx, assets?.fx?.flare01, {
      x: 0,
      y: 0,
      w: width,
      h: height * 0.55,
      alpha: leak,
      time,
    });
  }
}

function paintCampaignOpening(ctx, timeline, time, assets, {
  title1 = "ANÚNCIO",
  title2 = "OFICIAL",
  footer = timeline.season || "FC 27",
  countLabel = "",
} = {}) {
  const { width, height, safe } = timeline;
  const introEnd = timeline.introEnd || 1.08;
  const fadeOut = time >= introEnd ? 1 - reveal(time, introEnd, 0.28, easeInOutCubic) : 1;
  const logoIn = (timeline.still ? 1 : reveal(time, 0, 0.24, easeOutExpo)) * fadeOut;
  const brand = (timeline.still ? 1 : reveal(time, 0.02, 0.22, easeOutExpo)) * fadeOut;
  const kicker = (timeline.still ? 1 : reveal(time, 0.06, 0.22, easeOutExpo)) * fadeOut;
  const title = (timeline.still ? 1 : reveal(time, 0.08, 0.3, easeOutQuart)) * fadeOut;
  const date = (timeline.still ? 1 : reveal(time, 0.28, 0.24, easeOutQuart)) * fadeOut;
  const bar = (timeline.still ? 1 : reveal(time, 0, 0.22, easeOutExpo)) * fadeOut;
  const x = width / 2;
  const feed = timeline.format === "feed";
  const mark = feed ? 188 : 300;
  const titleSize = feed ? 148 : 228;
  const lockY = height * (feed ? 0.32 : 0.34);
  const brandY = lockY - mark * 0.52 - (feed ? 52 : 68);
  const titleY = lockY + mark * 0.52 + titleSize * 0.72 + (feed ? 20 : 28);
  const lineY = titleY + titleSize * 1.08 + 22;

  ctx.save();
  ctx.globalAlpha = logoIn * 0.3;
  const lockGlow = ctx.createRadialGradient(x, lockY, 20, x, lockY, mark * 1.5);
  lockGlow.addColorStop(0, "rgba(239,236,230,0.5)");
  lockGlow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = lockGlow;
  ctx.fillRect(x - mark * 1.55, lockY - mark * 1.3, mark * 3.1, mark * 2.6);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = bar;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 260 * bar, brandY - 48);
  ctx.lineTo(x + 260 * bar, brandY - 48);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(safe.side, titleY - titleSize * 0.62);
  ctx.lineTo(safe.side + 140 * bar, titleY - titleSize * 0.62);
  ctx.moveTo(width - safe.side, titleY - titleSize * 0.62);
  ctx.lineTo(width - safe.side - 140 * bar, titleY - titleSize * 0.62);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = logoIn;
  ctx.translate(x, lockY);
  const pop = 1.12 - logoIn * 0.12;
  ctx.scale(pop, pop);
  drawMark(ctx, assets?.strix, 0, 0, mark, 1);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = brand;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${feed ? 24 : 32}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", x, brandY - (feed ? 34 : 42));
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = kicker;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${feed ? 22 : 30}px Inter, sans-serif`;
  ctx.fillText("CAMPANHA OFICIAL", x, brandY);
  ctx.fillStyle = INK;
  ctx.globalAlpha = kicker * 0.85;
  ctx.fillRect(x - 56, brandY + 14, 112, 3);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title * 0.32;
  const glow = ctx.createRadialGradient(x, titleY + titleSize * 0.4, 16, x, titleY + titleSize * 0.4, 560);
  glow.addColorStop(0, "rgba(239,236,230,0.52)");
  glow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 560, titleY - titleSize, 1120, titleSize * 3);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${titleSize}px Rajdhani, sans-serif`;
  const settle = 1.1 - title * 0.1;
  ctx.translate(x, titleY);
  ctx.scale(settle, settle);
  ctx.beginPath();
  ctx.rect(-width * 0.5, -titleSize, width * Math.max(title, 0.08), titleSize * 2.5);
  ctx.clip();
  ctx.fillText(title1, 0, 0);
  ctx.fillText(title2, 0, titleSize * 0.92);
  const sweepX = -320 + title * 720;
  const sweep = ctx.createLinearGradient(sweepX, 0, sweepX + 260, 0);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.22)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(-360, -titleSize, 720, titleSize * 2.3);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = date;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 270 * Math.max(date, 0.35), lineY);
  ctx.lineTo(x + 270 * Math.max(date, 0.35), lineY);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${feed ? 40 : 52}px Inter, sans-serif`;
  const meta = countLabel ? `${footer}   ·   ${countLabel}` : footer;
  ctx.fillText(meta, x, lineY + 62);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = brand * 0.5;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(safe.side, Math.min(height - safe.bottom - 18, lineY + 118));
  ctx.lineTo(width - safe.side, Math.min(height - safe.bottom - 18, lineY + 118));
  ctx.stroke();
  ctx.restore();
}

function paintPlayerStagePersistent(ctx, timeline, time, presence) {
  if (presence <= 0) return;
  const { width, safe, season } = timeline;
  const geo = playerStageGeometry(timeline, cinematicCamera(timeline, time, 0));
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(safe.side, geo.headerY + 26);
  ctx.lineTo(width - safe.side, geo.headerY + 26);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `800 ${geo.type.gameIndex}px Inter, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("STRIX UNITED", safe.side, geo.headerY);
  ctx.textAlign = "right";
  ctx.font = `800 ${geo.type.competition}px Inter, sans-serif`;
  ctx.fillText(season || "FC 27", width - safe.side, geo.headerY);
  ctx.restore();
}

function paintPlayerVariable(ctx, timeline, time, assets, {
  person,
  photoIn = 1,
  nameIn = 1,
  positionIn,
  roleIn,
  phraseIn = 0,
  phrase = "",
  stage = "hero",
  indexLabel = "",
  local = 0,
} = {}) {
  const subject = person || timeline.person;
  if (!subject) return;
  const look = announceRoleLook(subject.extraRole);
  const camera = cinematicCamera(timeline, time, local, stage);
  const geo = playerStageGeometry(timeline, camera);
  const asset = assets?.byId?.[subject.id] || assets?.players?.[0];
  const classified = classifyAnnouncePhoto(asset?.bitmap);
  const posIn = positionIn == null ? nameIn : positionIn;
  const cargoIn = roleIn == null ? nameIn : roleIn;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, geo.headerY + 18, timeline.width, geo.typeBox.y - geo.headerY - 20);
  ctx.clip();
  paintSubject(ctx, asset?.bitmap, subject, {
    x: geo.frame.x - 28,
    y: geo.frame.y - 12,
    w: geo.frame.w + 56,
    h: geo.frame.h + 24,
    focusY: camera.focus,
  }, classified, {
    scale: camera.scale,
    alpha: photoIn,
    drift: camera.drift,
    assets,
    look,
  });
  const fadeTop = ctx.createLinearGradient(0, geo.headerY + 18, 0, geo.frame.y + 40);
  fadeTop.addColorStop(0, VOID);
  fadeTop.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = fadeTop;
  ctx.fillRect(0, geo.headerY + 18, timeline.width, Math.max(32, geo.frame.y + 40 - geo.headerY));
  const fade = ctx.createLinearGradient(0, geo.frame.y + geo.frame.h * 0.66, 0, geo.typeBox.y - 24);
  fade.addColorStop(0, "rgba(5,6,7,0)");
  fade.addColorStop(0.5, "rgba(5,6,7,0.28)");
  fade.addColorStop(1, VOID);
  ctx.fillStyle = fade;
  ctx.fillRect(0, geo.frame.y + geo.frame.h * 0.66, timeline.width, geo.typeBox.y - (geo.frame.y + geo.frame.h * 0.66));
  const side = ctx.createLinearGradient(0, 0, 56, 0);
  side.addColorStop(0, VOID);
  side.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = side;
  ctx.fillRect(0, geo.headerY + 18, 56, geo.typeBox.y - geo.headerY);
  const sideR = ctx.createLinearGradient(timeline.width - 56, 0, timeline.width, 0);
  sideR.addColorStop(0, "rgba(5,6,7,0)");
  sideR.addColorStop(1, VOID);
  ctx.fillStyle = sideR;
  ctx.fillRect(timeline.width - 56, geo.headerY + 18, 56, geo.typeBox.y - geo.headerY);
  ctx.restore();

  paintRoleAtmosphere(ctx, timeline, look, photoIn * 0.9);
  paintRoleMarks(ctx, timeline, look, Math.max(nameIn, photoIn) * 0.9);
  paintRoleSweep(ctx, timeline, look, local, timeline.still);

  if (nameIn <= 0 && posIn <= 0) return;
  const story = timeline.format !== "feed";
  const name = fitNameLayout(ctx, campaignName(subject), geo.typeBox.w, story ? 176 : 132, story ? 68 : 56);
  const metaSize = story ? 26 : 20;
  const cargoSize = story ? 18 : 15;
  const phraseSize = story ? 42 : 34;
  ctx.save();
  ctx.textAlign = "left";
  let cursor = geo.typeBox.y;
  if (indexLabel) {
    ctx.globalAlpha = nameIn;
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${story ? 22 : 16}px Inter, sans-serif`;
    ctx.fillText(indexLabel, geo.typeBox.x, cursor);
    cursor += 40;
  }
  const nameHeight = name.size * (0.92 * name.lines.length + 0.18);
  ctx.save();
  ctx.beginPath();
  ctx.rect(geo.typeBox.x - 10, cursor - 10, geo.typeBox.w * Math.max(0.14, nameIn), nameHeight + 18);
  ctx.clip();
  ctx.globalAlpha = nameIn;
  ctx.translate(0, (1 - nameIn) * 16);
  ctx.fillStyle = INK;
  name.lines.forEach((line, index) => {
    ctx.font = `700 ${name.size}px Rajdhani, sans-serif`;
    ctx.fillText(line, geo.typeBox.x, cursor + name.size * (0.82 + index * 0.92));
  });
  ctx.restore();
  const nameBottom = cursor + name.size * (0.82 + (name.lines.length - 1) * 0.92);
  const positionY = nameBottom + Math.max(40, Math.round(name.size * 0.42));
  ctx.globalAlpha = posIn;
  ctx.fillStyle = MUTED;
  ctx.font = `800 ${metaSize}px Inter, sans-serif`;
  ctx.fillText((subject.position || "MC").toUpperCase(), geo.typeBox.x, positionY);
  let ruleY = positionY + 22;
  if (subject.extraBadge) {
    const cargoY = positionY + metaSize + Math.max(16, Math.round(metaSize * 0.7));
    ctx.globalAlpha = cargoIn;
    ctx.fillStyle = look.ink;
    ctx.font = `800 ${cargoSize}px Inter, sans-serif`;
    ctx.fillText(subject.extraBadge, geo.typeBox.x, cargoY);
    ruleY = cargoY + 18;
  }
  ctx.globalAlpha = Math.max(nameIn, cargoIn) * 0.78;
  ctx.fillStyle = look.rule || INK;
  ctx.fillRect(geo.typeBox.x, ruleY, Math.min(look.id === "jogador" ? 180 : 148, geo.typeBox.w * 0.28), look.id === "jogador" ? 3 : 2);
  if (phrase && phraseIn > 0) {
    ctx.globalAlpha = nameIn * phraseIn;
    ctx.fillStyle = INK;
    let size = phraseSize;
    let lines = wrapPhrase(ctx, String(phrase).toUpperCase(), geo.typeBox.w, `600 ${size}px Inter, sans-serif`);
    while (lines.length > 1 && size > (story ? 32 : 28)) {
      size -= 2;
      lines = wrapPhrase(ctx, String(phrase).toUpperCase(), geo.typeBox.w, `600 ${size}px Inter, sans-serif`);
    }
    ctx.font = `600 ${size}px Inter, sans-serif`;
    lines.forEach((line, index) => {
      ctx.fillText(line, geo.typeBox.x, ruleY + 52 + index * Math.round(size * 1.22));
    });
  }
  ctx.restore();
}

function paintIndividualStage(ctx, timeline, time, assets) {
  const introEnd = timeline.introEnd || 1.08;
  const still = timeline.still;
  const scene = still ? null : announceSceneAt(timeline, time);
  const stage = still ? "close" : (scene?.type || "hero");
  const local = still ? 1 : Math.max(0, time - (scene?.start || introEnd));
  const presence = still ? 1 : reveal(time, introEnd, 0.22, easeOutExpo);
  const photoIn = still ? 1 : reveal(time, introEnd, 0.28, easeOutQuart);
  const nameIn = still ? 1 : reveal(time, introEnd + 0.06, 0.28, easeOutExpo);
  const positionIn = still ? 1 : reveal(time, introEnd + 0.22, 0.24, easeOutQuart);
  const roleIn = still ? 1 : reveal(time, introEnd + 0.38, 0.22, easeOutQuart);
  const phraseIn = still ? 1 : reveal(time, timeline.phraseStart || 2.15, 0.32, easeOutExpo);
  const look = announceRoleLook(timeline.person?.extraRole);
  paintPlayerStagePersistent(ctx, timeline, time, presence);
  if (presence <= 0) return;
  const incoming = still ? 1 : reveal(time, introEnd, 0.22, easeInOutCubic);
  const paintVariable = (target) => {
    paintPlayerVariable(target, timeline, time, assets, {
      person: timeline.person,
      photoIn,
      nameIn,
      positionIn,
      roleIn,
      phraseIn,
      phrase: timeline.phrase,
      stage,
      local,
    });
  };
  if (!still && incoming < 0.999) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, timeline.width * incoming, timeline.height);
    ctx.clip();
    paintVariable(ctx);
    ctx.restore();
  } else {
    paintVariable(ctx);
  }
  if (!still && (stage === "reveal" || stage === "reframe" || stage === "detail") && local < 0.18) {
    const pulse = Math.sin(clamp(local / 0.16) * Math.PI);
    const gain = stage === "reveal" ? look.flashGain : look.flashGain * 0.55;
    if (pulse > 0.05) paintPhotoFlash(ctx, timeline, pulse * gain, assets, look);
  }
  if (!still && stage === "detail" && local < 0.28) {
    composeAnnounceFx(ctx, assets?.fx?.flare01, {
      x: timeline.width * 0.12,
      y: timeline.height * 0.18,
      w: timeline.width * 0.76,
      h: 140,
      alpha: fxEnvelope(local, 0, 0.28) * 0.28,
      time,
    });
  }
}

function paintIndividual(ctx, timeline, time, assets) {
  const introEnd = timeline.introEnd || 1.08;
  const finaleStart = timeline.finaleStart || 8.15;
  const still = timeline.still;
  const phase = still || time >= introEnd ? "match" : "intro";
  paintAmbient(ctx, timeline, time, assets, phase, { owl: false });
  paintAnnounceStageFx(ctx, timeline, time, assets, {
    leak: still ? 0.04 : Math.max(fxEnvelope(time, 0, 0.7) * 0.22, fxEnvelope(time, finaleStart, 0.8) * 0.16),
    rays: still ? 0.05 : (phase === "intro" ? fxEnvelope(time, 0.02, 0.85) * 0.14 : 0.06),
  });
  paintSceneSweep(ctx, timeline, time);
  if (!still && time < introEnd + 0.3) paintCampaignOpening(ctx, timeline, time, assets);
  if (still || time >= introEnd) paintIndividualStage(ctx, timeline, time, assets);
  if (!still && time >= finaleStart + 0.22) {
    const lock = reveal(time, finaleStart + 0.22, 0.36, easeOutQuart);
    ctx.save();
    ctx.globalAlpha = lock * 0.9;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.font = `800 ${typeScale(timeline.format).brand}px Inter, sans-serif`;
    ctx.fillText("STRIX UNITED  ·  FC 27", timeline.width / 2, timeline.height - timeline.safe.bottom + 52);
    ctx.restore();
  }
  paintGrain(ctx, timeline, time, assets);
}

function teamBeatStage(local) {
  if (local < 0.55) return "reveal";
  if (local < 1.55) return "hero";
  if (local < 2.55) return "reframe";
  return "detail";
}

function paintTeamPersonStage(ctx, timeline, time, scene, assets, alpha = 1) {
  if (!scene?.person || alpha <= 0) return;
  const local = time - scene.start;
  const people = timeline.people || [];
  const stage = teamBeatStage(local);
  const photoIn = reveal(local, 0.01, 0.24, easeOutQuart) * alpha;
  const nameIn = reveal(local, 0.06, 0.22, easeOutExpo) * alpha;
  const positionIn = reveal(local, 0.16, 0.2, easeOutQuart) * alpha;
  const roleIn = reveal(local, 0.28, 0.2, easeOutQuart) * alpha;
  const exit = time > scene.end - 0.32 ? 1 - reveal(time, scene.end - 0.32, 0.32, easeInOutCubic) : 1;
  const look = announceRoleLook(scene.person.extraRole);
  ctx.save();
  ctx.globalAlpha = exit;
  paintPlayerVariable(ctx, timeline, time, assets, {
    person: scene.person,
    photoIn,
    nameIn,
    positionIn,
    roleIn,
    phraseIn: 0,
    stage,
    indexLabel: `${String((scene.index || 0) + 1).padStart(2, "0")}  /  ${String(people.length).padStart(2, "0")}`,
    local,
  });
  if (local < 0.16) {
    const pulse = Math.sin(clamp(local / 0.14) * Math.PI);
    if (pulse > 0.05) paintPhotoFlash(ctx, timeline, pulse * look.flashGain * 0.7, assets, look);
  }
  ctx.restore();
}

function wallMetrics(count, timeline) {
  const spec = announceGridSpec(count, timeline.format);
  const story = timeline.format !== "feed";
  const n = Math.max(1, count);
  const cols = spec.cols;
  const rows = Math.ceil(n / cols);
  const gap = story ? 22 : 18;
  const top0 = timeline.safe.top + (story ? 132 : 108);
  const bottom = timeline.height - timeline.safe.bottom;
  const availableH = bottom - top0;
  const availableW = timeline.width - timeline.safe.side * 2;
  let cellW;
  let cellH;
  if (n === 1) {
    cellW = Math.min(availableW * (story ? 0.72 : 0.7), availableH * 0.68);
    cellH = Math.min(availableH, cellW * spec.maxAspect);
  } else if (n === 2) {
    cellW = (availableW - gap) / 2;
    cellH = Math.min(availableH * 0.92, cellW * spec.maxAspect);
  } else {
    cellW = (availableW - gap * (cols - 1)) / cols;
    cellH = Math.min((availableH - gap * (rows - 1)) / rows, cellW * spec.maxAspect);
  }
  const usedH = rows * cellH + (rows - 1) * gap;
  const usedW = cols * cellW + (cols - 1) * gap;
  const top = top0 + Math.max(0, (availableH - usedH) * (n <= 2 ? 0.22 : 0.12));
  const left = timeline.safe.side + Math.max(0, (availableW - usedW) * 0.5);
  return { cols, rows, gap, top, left, cellW, cellH, nameReserve: spec.nameReserve };
}

function paintTeamRoster(ctx, timeline, time, scene, assets) {
  const { width, safe, title, format } = timeline;
  const story = format !== "feed";
  const people = scene?.people || timeline.people;
  const enter = timeline.still ? 1 : reveal(time, scene?.start || timeline.finaleStart, 0.42, easeOutExpo);
  const type = typeScale(format);
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = `800 ${type.finaleKicker}px Inter, sans-serif`;
  ctx.fillText("ANÚNCIO OFICIAL", safe.side, safe.top + 28);
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.min(type.finaleTitle, story ? 94 : 64)}px Rajdhani, sans-serif`;
  ctx.fillText(fitText(ctx, title || "ELENCO FC 27", width - safe.side * 2 - 80, ctx.font), safe.side, safe.top + 28 + Math.min(type.finaleTitle, story ? 94 : 64) * 0.9);
  if (scene?.pageCount > 1) {
    ctx.fillStyle = MUTED;
    ctx.font = "800 16px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${String(scene.pageIndex + 1).padStart(2, "0")} / ${String(scene.pageCount).padStart(2, "0")}`, width - safe.side, safe.top + 46);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(safe.side, safe.top + (story ? 118 : 96));
  ctx.lineTo(safe.side + 160, safe.top + (story ? 118 : 96));
  ctx.stroke();
  const metrics = wallMetrics(people.length, timeline);
  people.forEach((person, index) => {
    const col = index % metrics.cols;
    const row = Math.floor(index / metrics.cols);
    const x = metrics.left + col * (metrics.cellW + metrics.gap);
    const y = metrics.top + 18 + row * (metrics.cellH + metrics.gap);
    const photoH = metrics.cellH - metrics.nameReserve - 8;
    const asset = assets?.byId?.[person.id];
    const classified = classifyAnnouncePhoto(asset?.bitmap);
    const look = announceRoleLook(person.extraRole);
    paintSubject(ctx, asset?.bitmap, person, { x, y, w: metrics.cellW, h: photoH, focusY: photoFocusY(classified) }, classified, { alpha: enter, assets, look });
    if (look.id !== "jogador") {
      ctx.save();
      ctx.strokeStyle = look.border || look.rule;
      ctx.globalAlpha = enter * 0.7;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y + 4, metrics.cellW - 8, photoH - 8);
      ctx.restore();
    }
    const fade = ctx.createLinearGradient(0, y + photoH * 0.72, 0, y + photoH);
    fade.addColorStop(0, "rgba(5,6,7,0)");
    fade.addColorStop(1, "rgba(5,6,7,0.55)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, y + photoH * 0.72, metrics.cellW, photoH * 0.28);
    const name = fitNameLayout(ctx, campaignName(person), metrics.cellW, metrics.cellW > 360 ? 38 : 24, 16);
    name.lines.forEach((line, lineIndex) => {
      ctx.fillStyle = INK;
      ctx.font = `700 ${name.size}px Rajdhani, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(line, x, y + photoH + 26 + lineIndex * (name.size * 0.88));
    });
    const metaY = y + photoH + metrics.nameReserve - 6;
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${metrics.cellW > 360 ? 15 : 12}px Inter, sans-serif`;
    ctx.fillText(fitText(ctx, person.position || "", metrics.cellW, ctx.font), x, person.extraBadge ? metaY - 16 : metaY);
    if (person.extraBadge) {
      ctx.fillStyle = look.ink;
      ctx.fillText(fitText(ctx, person.extraBadge, metrics.cellW, ctx.font), x, metaY);
    }
  });
  ctx.restore();
}

function paintTeam(ctx, timeline, time, assets) {
  const introEnd = timeline.introEnd || 1.45;
  const finaleStart = timeline.finaleStart || timeline.duration;
  const still = timeline.still;
  const scene = announceSceneAt(timeline, time);
  const phase = still || time >= finaleStart ? "finale" : time >= introEnd ? "match" : "intro";
  paintAmbient(ctx, timeline, time, assets, phase === "intro" ? "intro" : "match", { owl: false });
  paintAnnounceStageFx(ctx, timeline, time, assets, {
    leak: still ? 0.04 : Math.max(fxEnvelope(time, 0, 0.7) * 0.2, fxEnvelope(time, finaleStart, 0.8) * 0.14),
    rays: still ? 0.05 : (phase === "intro" ? fxEnvelope(time, 0.02, 0.85) * 0.14 : 0.06),
  });
  paintSceneSweep(ctx, timeline, time);
  if (!still && time < introEnd + 0.3) {
    const count = timeline.people?.length || 0;
    paintCampaignOpening(ctx, timeline, time, assets, {
      countLabel: `${String(count).padStart(2, "0")} ${count === 1 ? "JOGADOR" : "JOGADORES"}`,
    });
  }
  if (still) {
    paintTeamRoster(ctx, timeline, time, scene, assets);
    paintGrain(ctx, timeline, time, assets);
    return;
  }
  if (time >= introEnd && time < finaleStart) {
    const { persistent, current, incoming } = (() => {
      const scenes = (timeline.scenes || []).filter((item) => item.type === "person");
      if (!scenes.length) return { persistent: 0, current: null, incoming: 1 };
      const first = scenes[0];
      const last = scenes[scenes.length - 1];
      const enter = reveal(time, first.start, 0.32, easeOutExpo);
      const exit = time > last.end - 0.32 ? 1 - reveal(time, last.end - 0.32, 0.32, easeInOutCubic) : 1;
      const now = scenes.find((item) => time >= item.start && time < item.end) || last;
      const local = time - now.start;
      return { persistent: enter * exit, current: now, incoming: now.index > 0 ? reveal(local, 0, 0.28, easeInOutCubic) : 1 };
    })();
    paintPlayerStagePersistent(ctx, timeline, time, persistent);
    if (!current || persistent <= 0) {
      paintGrain(ctx, timeline, time, assets);
      return;
    }
    const prev = current.index > 0
      ? (timeline.scenes || []).find((item) => item.type === "person" && item.index === current.index - 1)
      : null;
    if (prev && incoming < 1) {
      const wipe = (1 - incoming) * timeline.width;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, wipe, timeline.height);
      ctx.clip();
      paintTeamPersonStage(ctx, timeline, Math.min(time, prev.end - 0.01), prev, assets, persistent);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(wipe, 0, timeline.width, timeline.height);
      ctx.clip();
      paintTeamPersonStage(ctx, timeline, time, current, assets, persistent);
      ctx.restore();
      paintGrain(ctx, timeline, time, assets);
      return;
    }
    paintTeamPersonStage(ctx, timeline, time, current, assets, persistent);
    paintGrain(ctx, timeline, time, assets);
    return;
  }
  if (time >= finaleStart) paintTeamRoster(ctx, timeline, time, scene, assets);
  paintGrain(ctx, timeline, time, assets);
}

export function paintAnnounceFrame(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  if (timeline.kind === "individual") {
    paintIndividual(ctx, timeline, time, assets);
    return;
  }
  paintTeam(ctx, timeline, time, assets);
}
