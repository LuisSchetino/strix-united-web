import { opponentInitials } from "./agenda-media-core.js";
import { logoDrawRect, paintAmbient, paintSceneSweep, typeScale } from "./agenda-paint.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";
import { composeAnnounceFx, fxEnvelope } from "./announce-fx.js";
import {
  announceGridSpec,
  campaignName,
  classifyAnnouncePhoto,
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
  ctx.fillStyle = "rgba(5,6,7,0.66)";
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

function containBottom(ctx, bitmap, dx, dy, dw, dh) {
  const scale = Math.max(dw / bitmap.width, dh / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, dx + (dw - w) / 2, dy + dh - h, w, h);
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

function paintGrade(ctx, x, y, w, h) {
  ctx.fillStyle = "rgba(5,6,7,0.16)";
  ctx.fillRect(x, y, w, h);
  const vig = ctx.createRadialGradient(x + w / 2, y + h * 0.4, Math.min(w, h) * 0.16, x + w / 2, y + h * 0.42, Math.max(w, h) * 0.72);
  vig.addColorStop(0, "rgba(5,6,7,0)");
  vig.addColorStop(1, "rgba(5,6,7,0.36)");
  ctx.fillStyle = vig;
  ctx.fillRect(x, y, w, h);
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
    ctx.globalAlpha = 0.32;
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

function paintPhotoFlash(ctx, timeline, amount, assets) {
  const closed = clamp(amount);
  if (closed <= 0.001) return;
  if (composeAnnounceFx(ctx, assets?.fx?.flash01, {
    x: 0,
    y: 0,
    w: timeline.width,
    h: timeline.height,
    alpha: closed,
  })) return;
  ctx.fillStyle = `rgba(239,236,230,${0.78 * closed})`;
  ctx.fillRect(0, 0, timeline.width, timeline.height);
}

function paintNameAccent(ctx, box, progress, y) {
  const amount = clamp(progress);
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.55 * amount;
  ctx.fillStyle = INK;
  ctx.fillRect(box.x, y, Math.min(box.w * 0.42, 220) * (0.35 + amount * 0.65), 3);
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

function paintSubject(ctx, bitmap, person, box, classified, { scale = 1, alpha = 1, drift = 0, assets } = {}) {
  const { x, y, w, h, focusY = 0.22 } = box;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2 + drift, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  if (!bitmap) {
    paintCampaignFallback(ctx, person, { x: 0, y: 0, w, h }, assets);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  if (classified?.crop === "cutout") {
    containBottom(ctx, bitmap, -w * 0.04, 0, w * 1.08, h);
  } else {
    coverPhoto(ctx, bitmap, 0, 0, w, h, focusY || photoFocusY(classified));
  }
  paintGrade(ctx, 0, 0, w, h);
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
  const meta = [person.position || "MC", person.extraBadge].filter(Boolean).join("  ·  ");
  const metaSize = stage === "detail" || stage === "close" || !story ? 16 : 14;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = `800 ${metaSize}px Inter, sans-serif`;
  ctx.fillText(meta, box.x, box.y);
  const nameY = box.y + (story ? 70 : 58);
  layout.lines.forEach((line, index) => {
    ctx.fillStyle = INK;
    ctx.font = `700 ${layout.size}px Rajdhani, sans-serif`;
    ctx.fillText(line, box.x, nameY + index * (layout.size * 0.86));
  });
  const accentY = nameY + layout.lines.length * (layout.size * 0.86) - layout.size * 0.18;
  paintNameAccent(ctx, box, brushProgress, accentY);
  if (stage === "detail" || stage === "close" || timeline.format === "feed") {
    ctx.fillStyle = MUTED;
    ctx.font = "800 13px Inter, sans-serif";
    ctx.fillText(timeline.season || "FC 27", box.x, accentY + 28);
  }
  if (phrase && phraseAlpha > 0) {
    ctx.globalAlpha = alpha * phraseAlpha;
    ctx.fillStyle = RULE;
    ctx.fillRect(box.x, accentY + 46, 36, 2);
    ctx.fillStyle = INK;
    ctx.font = story ? "600 26px Inter, sans-serif" : "600 25px Inter, sans-serif";
    wrapPhrase(ctx, phrase, box.w, ctx.font).forEach((line, index) => {
      ctx.fillText(line, box.x, accentY + 84 + index * 32);
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
  if (still) return { scale: 1.05, drift: 0, bg: 1.03, focusShift: 0, plateLift: 0.35 };
  if (stage === "reveal") return { scale: 1.1, drift: Math.sin(time * 0.35) * 12, bg: 1.07, focusShift: 0.03, plateLift: 0 };
  if (stage === "hero") return { scale: 1.03, drift: Math.sin(time * 0.15) * 8, bg: 1.02, focusShift: 0, plateLift: 0 };
  if (stage === "reframe") return { scale: 1.15, drift: Math.sin(time * 0.22) * 20, bg: 1.09, focusShift: -0.055, plateLift: 0.2 };
  if (stage === "detail") return { scale: 1.08, drift: Math.sin(time * 0.13) * 10, bg: 1.04, focusShift: -0.02, plateLift: 0.35 };
  return { scale: 1.02, drift: Math.sin(time * 0.1) * 5, bg: 1.02, focusShift: 0, plateLift: 0.45 };
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
  composeAnnounceFx(ctx, assets?.fx?.smoke01, {
    x: 0,
    y: timeline.height * 0.28,
    w: timeline.width,
    h: timeline.height * 0.62,
    alpha: photoIn,
    time,
  });
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

function stageCamera(stage = "hero", local = 0) {
  const ken = clamp(Number(local) / 1.7);
  const maps = {
    reveal: { scale: 1.22, focus: 0.1, drift: 14, lift: 4, inset: 36 },
    hero: { scale: 1.08, focus: 0.16, drift: 8, lift: 0, inset: 62 },
    reframe: { scale: 1.34, focus: 0.07, drift: 20, lift: -12, inset: 98 },
    detail: { scale: 1.18, focus: 0.3, drift: 6, lift: 8, inset: 52 },
    close: { scale: 1.06, focus: 0.17, drift: 4, lift: 4, inset: 78 },
  };
  const base = maps[stage] || maps.hero;
  return {
    ...base,
    scale: base.scale + ken * 0.04,
    focus: clamp(base.focus + ken * 0.012, 0.06, 0.34),
    drift: base.drift + Math.sin(local * 0.9) * 2,
  };
}

function playerStageGeometry(timeline, stage = "hero", local = 0) {
  const { width, height, safe, format } = timeline;
  const story = format !== "feed";
  const type = typeScale(format);
  const camera = stageCamera(stage, local);
  const typeReserve = story ? 372 : 268;
  const gap = story ? 108 : 72;
  const typeBox = {
    x: safe.side,
    y: height - safe.bottom - typeReserve + (story ? 52 : 36),
    w: width - safe.side * 2,
  };
  const inset = story ? camera.inset : Math.max(24, camera.inset - 22);
  const frameTop = safe.top + (story ? 84 : 54) + camera.lift * 0.4;
  const frame = {
    x: safe.side + inset,
    y: frameTop,
    w: width - (safe.side + inset) * 2,
    h: Math.max(360, typeBox.y - gap - frameTop),
  };
  return { type, headerY: safe.top + (story ? 36 : 22), frame, typeBox, gap };
}

function paintAnnounceStageFx(ctx, timeline, time, assets, { leak = 0, rays = 0, smoke = 0 } = {}) {
  const { width, height } = timeline;
  const drift = Math.sin(time * 0.33) * 48;
  const rise = Math.cos(time * 0.21) * 36;
  if (smoke > 0.02) {
    composeAnnounceFx(ctx, assets?.fx?.smoke01, {
      x: -width * 0.12 + drift,
      y: height * 0.18 + rise,
      w: width * 1.24,
      h: height * 0.92,
      alpha: smoke,
      scale: 1.1 + Math.sin(time * 0.15) * 0.05,
      rotation: Math.sin(time * 0.08) * 0.03,
      time: time * 0.72,
    });
  }
  if (rays > 0.02) {
    composeAnnounceFx(ctx, assets?.fx?.lightSweep01, {
      x: -width * 0.06 + drift * 0.45,
      y: -height * 0.08 + rise * 0.35,
      w: width * 1.12,
      h: height * 1.08,
      alpha: rays,
      scale: 1.12,
      time: time * 0.78,
    });
  }
  if (leak > 0.02) {
    composeAnnounceFx(ctx, assets?.fx?.flare01, {
      x: -width * 0.04,
      y: -height * 0.06,
      w: width * 1.08,
      h: height * 0.7,
      alpha: leak,
      time: time,
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
  const type = typeScale(timeline.format);
  const introEnd = timeline.introEnd || 1.18;
  const fadeOut = time >= introEnd ? 1 - reveal(time, introEnd, 0.32, easeInOutCubic) : 1;
  const logoIn = (timeline.still ? 1 : 0.94 + reveal(time, 0, 0.2, easeOutExpo) * 0.06) * fadeOut;
  const brand = (timeline.still ? 1 : 0.92 + reveal(time, 0, 0.18, easeOutExpo) * 0.08) * fadeOut;
  const title = (timeline.still ? 1 : 0.88 + reveal(time, 0.02, 0.28, easeOutQuart) * 0.12) * fadeOut;
  const date = (timeline.still ? 1 : 0.4 + reveal(time, 0.08, 0.32, easeOutQuart) * 0.6) * fadeOut;
  const bar = (timeline.still ? 1 : reveal(time, 0, 0.26, easeOutExpo)) * fadeOut;
  const x = width / 2;
  const feed = timeline.format === "feed";
  const mark = feed ? 150 : 188;
  const lockY = height * (feed ? 0.27 : 0.3);
  const brandY = lockY - mark * 0.52 - (feed ? 28 : 36);
  const titleY = lockY + mark * 0.52 + type.title * 0.88 + (feed ? 18 : 28);
  const lineY = titleY + type.title * 1.08 + 20;

  ctx.save();
  ctx.globalAlpha = bar;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 230 * bar, brandY - 42);
  ctx.lineTo(x + 230 * bar, brandY - 42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(safe.side, titleY - type.title * 0.7);
  ctx.lineTo(safe.side + 110 * bar, titleY - type.title * 0.7);
  ctx.moveTo(width - safe.side, titleY - type.title * 0.7);
  ctx.lineTo(width - safe.side - 110 * bar, titleY - type.title * 0.7);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = logoIn;
  drawMark(ctx, assets?.strix, x, lockY, mark, 1);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = brand;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.eyebrow}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", x, brandY);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title * 0.24;
  const glow = ctx.createRadialGradient(x, titleY + type.title * 0.35, 12, x, titleY + type.title * 0.35, 460);
  glow.addColorStop(0, "rgba(239,236,230,0.4)");
  glow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 480, titleY - type.title, 960, type.title * 2.9);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.title}px Rajdhani, sans-serif`;
  const settle = 1.04 - title * 0.04;
  ctx.translate(x, titleY);
  ctx.scale(settle, settle);
  ctx.beginPath();
  ctx.rect(-width * 0.5, -type.title, width * Math.max(title, 0.92), type.title * 2.5);
  ctx.clip();
  ctx.fillText(title1, 0, 0);
  ctx.fillText(title2, 0, type.title * 0.94);
  const sweepX = -300 + title * 680;
  const sweep = ctx.createLinearGradient(sweepX, 0, sweepX + 240, 0);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.18)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(-320, -type.title, 640, type.title * 2.3);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = date;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 250 * Math.max(date, 0.35), lineY);
  ctx.lineTo(x + 250 * Math.max(date, 0.35), lineY);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.date}px Inter, sans-serif`;
  ctx.fillText(footer, x, lineY + 58);
  if (countLabel) {
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${timeline.format === "feed" ? 28 : 36}px Inter, sans-serif`;
    ctx.fillText(countLabel, x, lineY + 114);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = brand * 0.45;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(safe.side, Math.min(height - safe.bottom - 18, lineY + (countLabel ? 164 : 122)));
  ctx.lineTo(width - safe.side, Math.min(height - safe.bottom - 18, lineY + (countLabel ? 164 : 122)));
  ctx.stroke();
  ctx.restore();
}

function paintPlayerStagePersistent(ctx, timeline, time, presence) {
  if (presence <= 0) return;
  const { width, safe, season } = timeline;
  const geo = playerStageGeometry(timeline);
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
  phraseIn = 0,
  phrase = "",
  stage = "hero",
  indexLabel = "",
  local = 0,
} = {}) {
  const subject = person || timeline.person;
  if (!subject) return;
  const geo = playerStageGeometry(timeline, stage, local);
  const camera = stageCamera(stage, local);
  const asset = assets?.byId?.[subject.id] || assets?.players?.[0];
  const classified = classifyAnnouncePhoto(asset?.bitmap);
  const float = Math.sin(time * 0.55) * 5;
  const drift = Math.sin(time * 0.14) * (camera.drift * 0.38);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, geo.headerY + 18, timeline.width, geo.typeBox.y - geo.headerY - 24);
  ctx.clip();
  paintSubject(ctx, asset?.bitmap, subject, {
    x: geo.frame.x - 22,
    y: geo.frame.y - 10 + float,
    w: geo.frame.w + 44,
    h: geo.frame.h + 8,
    focusY: camera.focus,
  }, classified, {
    scale: camera.scale + Math.sin(time * 0.18) * 0.012,
    alpha: photoIn,
    drift,
    assets,
  });
  const fadeTop = ctx.createLinearGradient(0, geo.headerY + 18, 0, geo.frame.y + 64);
  fadeTop.addColorStop(0, VOID);
  fadeTop.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = fadeTop;
  ctx.fillRect(0, geo.headerY + 18, timeline.width, Math.max(40, geo.frame.y + 64 - geo.headerY));
  const fade = ctx.createLinearGradient(0, geo.frame.y + geo.frame.h * 0.42, 0, geo.typeBox.y - 18);
  fade.addColorStop(0, "rgba(5,6,7,0)");
  fade.addColorStop(0.48, "rgba(5,6,7,0.5)");
  fade.addColorStop(1, VOID);
  ctx.fillStyle = fade;
  ctx.fillRect(0, geo.frame.y + geo.frame.h * 0.5, timeline.width, geo.typeBox.y - (geo.frame.y + geo.frame.h * 0.5));
  const side = ctx.createLinearGradient(0, 0, 130, 0);
  side.addColorStop(0, VOID);
  side.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = side;
  ctx.fillRect(0, geo.headerY + 18, 130, geo.typeBox.y - geo.headerY);
  const sideR = ctx.createLinearGradient(timeline.width - 130, 0, timeline.width, 0);
  sideR.addColorStop(0, "rgba(5,6,7,0)");
  sideR.addColorStop(1, VOID);
  ctx.fillStyle = sideR;
  ctx.fillRect(timeline.width - 130, geo.headerY + 18, 130, geo.typeBox.y - geo.headerY);
  ctx.restore();

  if (nameIn <= 0) return;
  const name = fitNameLayout(ctx, campaignName(subject), geo.typeBox.w, Math.round(geo.type.kickoff * 0.88), 46);
  const meta = [subject.position || "MC", subject.extraBadge].filter(Boolean).join("  ·  ");
  ctx.save();
  ctx.globalAlpha = nameIn;
  ctx.textAlign = "left";
  if (indexLabel) {
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${geo.type.finaleKicker}px Inter, sans-serif`;
    ctx.fillText(indexLabel, geo.typeBox.x, geo.typeBox.y - 10);
  }
  ctx.fillStyle = MUTED;
  ctx.font = `800 ${geo.type.competition}px Inter, sans-serif`;
  ctx.fillText(meta, geo.typeBox.x, geo.typeBox.y + (indexLabel ? 24 : 0));
  ctx.fillStyle = INK;
  name.lines.forEach((line, index) => {
    ctx.font = `700 ${name.size}px Rajdhani, sans-serif`;
    ctx.fillText(line, geo.typeBox.x, geo.typeBox.y + (indexLabel ? 44 : 22) + name.size * (0.9 + index * 0.86));
  });
  const ruleY = geo.typeBox.y + (indexLabel ? 58 : 38) + name.lines.length * (name.size * 0.86);
  ctx.fillStyle = INK;
  ctx.globalAlpha = nameIn * 0.7;
  ctx.fillRect(geo.typeBox.x, ruleY, Math.min(160, geo.typeBox.w * 0.28), 2);
  if (phrase && phraseIn > 0) {
    ctx.globalAlpha = nameIn * phraseIn;
    ctx.fillStyle = INK;
    ctx.font = timeline.format === "feed"
      ? `600 ${geo.type.finaleName}px Inter, sans-serif`
      : "600 28px Inter, sans-serif";
    wrapPhrase(ctx, String(phrase).toUpperCase(), geo.typeBox.w, ctx.font).forEach((line, index) => {
      ctx.fillText(line, geo.typeBox.x, ruleY + 62 + index * 36);
    });
  }
  ctx.restore();
}

function paintIndividualStage(ctx, timeline, time, assets) {
  const introEnd = timeline.introEnd || 1.18;
  const still = timeline.still;
  const scene = still ? null : announceSceneAt(timeline, time);
  const stage = still ? "close" : (scene?.type || "hero");
  const local = still ? 1 : Math.max(0, time - (scene?.start || introEnd));
  const presence = still ? 1 : reveal(time, introEnd, 0.24, easeOutExpo);
  const photoIn = still ? 1 : reveal(time, introEnd, 0.34, easeOutQuart);
  const nameIn = still ? 1 : reveal(time, introEnd + 0.02, 0.32, easeOutExpo);
  const phraseIn = still ? 1 : reveal(time, timeline.phraseStart || 4.05, 0.42, easeOutExpo);
  paintPlayerStagePersistent(ctx, timeline, time, presence);
  if (presence <= 0) return;
  const incoming = still ? 1 : reveal(time, introEnd, 0.24, easeInOutCubic);
  const paintVariable = (target) => {
    paintPlayerVariable(target, timeline, time, assets, {
      person: timeline.person,
      photoIn,
      nameIn,
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
    return;
  }
  paintVariable(ctx);
}

function paintIndividual(ctx, timeline, time, assets) {
  const introEnd = timeline.introEnd || 1.18;
  const finaleStart = timeline.finaleStart || 8.2;
  const still = timeline.still;
  const phase = still || time >= introEnd ? "match" : "intro";
  paintAmbient(ctx, timeline, time, assets, phase, { owl: false });
  paintAnnounceStageFx(ctx, timeline, time, assets, {
    leak: still ? 0.08 : Math.max(fxEnvelope(time, 0, 0.9) * 0.55, fxEnvelope(time, finaleStart, 1) * 0.4),
    rays: still ? 0.08 : (phase === "intro" ? fxEnvelope(time, 0.02, 1.05) * 0.22 : 0.05),
    smoke: still ? 0.08 : (phase === "intro" ? 0.03 : 0.08),
  });
  paintSceneSweep(ctx, timeline, time);
  if (!still && time < introEnd + 0.34) paintCampaignOpening(ctx, timeline, time, assets);
  if (still || time >= introEnd) paintIndividualStage(ctx, timeline, time, assets);
  if (!still && time >= finaleStart + 0.28) {
    const lock = reveal(time, finaleStart + 0.28, 0.4, easeOutQuart);
    ctx.save();
    ctx.globalAlpha = lock * 0.9;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.font = `800 ${typeScale(timeline.format).brand}px Inter, sans-serif`;
    ctx.fillText("STRIX UNITED  ·  FC 27", timeline.width / 2, timeline.height - timeline.safe.bottom + 52);
    ctx.restore();
  }
}

function teamBeatStage(local) {
  if (local < 0.72) return "reveal";
  if (local < 1.85) return "hero";
  return "reframe";
}

function paintTeamPersonStage(ctx, timeline, time, scene, assets, alpha = 1) {
  if (!scene?.person || alpha <= 0) return;
  const local = time - scene.start;
  const people = timeline.people || [];
  const stage = teamBeatStage(local);
  const photoIn = reveal(local, 0.02, 0.3, easeOutQuart) * alpha;
  const nameIn = reveal(local, 0.06, 0.28, easeOutExpo) * alpha;
  const exit = time > scene.end - 0.32 ? 1 - reveal(time, scene.end - 0.32, 0.32, easeInOutCubic) : 1;
  ctx.save();
  ctx.globalAlpha = exit;
  paintPlayerVariable(ctx, timeline, time, assets, {
    person: scene.person,
    photoIn,
    nameIn,
    phraseIn: 0,
    stage,
    indexLabel: `${String((scene.index || 0) + 1).padStart(2, "0")}  /  ${String(people.length).padStart(2, "0")}`,
    local,
  });
  ctx.restore();
}

function wallMetrics(count, timeline) {
  const spec = announceGridSpec(count, timeline.format);
  const story = timeline.format !== "feed";
  const cols = spec.cols;
  const rows = Math.ceil(Math.max(1, count) / cols);
  const gap = story ? 22 : 18;
  const top0 = timeline.safe.top + (story ? 132 : 108);
  const bottom = timeline.height - timeline.safe.bottom;
  const availableH = bottom - top0;
  const availableW = timeline.width - timeline.safe.side * 2;
  const cellW = (availableW - gap * (cols - 1)) / cols;
  const cellH = Math.min((availableH - gap * (rows - 1)) / rows, cellW * spec.maxAspect);
  const used = rows * cellH + (rows - 1) * gap;
  const top = top0 + Math.max(0, (availableH - used) * 0.12);
  return { cols, rows, gap, top, cellW, cellH, nameReserve: spec.nameReserve };
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
  ctx.font = `700 ${Math.min(type.finaleTitle, story ? 86 : 60)}px Rajdhani, sans-serif`;
  ctx.fillText(fitText(ctx, title || "ELENCO FC 27", width - safe.side * 2 - 80, ctx.font), safe.side, safe.top + 28 + Math.min(type.finaleTitle, story ? 86 : 60) * 0.9);
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
    const x = safe.side + col * (metrics.cellW + metrics.gap);
    const y = metrics.top + 18 + row * (metrics.cellH + metrics.gap);
    const photoH = metrics.cellH - metrics.nameReserve - 8;
    const asset = assets?.byId?.[person.id];
    const classified = classifyAnnouncePhoto(asset?.bitmap);
    paintSubject(ctx, asset?.bitmap, person, { x, y, w: metrics.cellW, h: photoH, focusY: photoFocusY(classified) }, classified, { alpha: enter, assets });
    const fade = ctx.createLinearGradient(0, y + photoH * 0.72, 0, y + photoH);
    fade.addColorStop(0, "rgba(5,6,7,0)");
    fade.addColorStop(1, "rgba(5,6,7,0.55)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, y + photoH * 0.72, metrics.cellW, photoH * 0.28);
    const name = fitNameLayout(ctx, campaignName(person), metrics.cellW, metrics.cellW > 360 ? 28 : 18, 14);
    name.lines.forEach((line, lineIndex) => {
      ctx.fillStyle = INK;
      ctx.font = `700 ${name.size}px Rajdhani, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(line, x, y + photoH + 24 + lineIndex * (name.size * 0.9));
    });
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${metrics.cellW > 360 ? 13 : 11}px Inter, sans-serif`;
    ctx.fillText(fitText(ctx, [person.position, person.extraBadge].filter(Boolean).join("  ·  "), metrics.cellW, ctx.font), x, y + photoH + metrics.nameReserve - 6);
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
    leak: still ? 0.07 : Math.max(fxEnvelope(time, 0, 0.9) * 0.5, fxEnvelope(time, finaleStart, 0.85) * 0.32),
    rays: still ? 0.07 : (phase === "intro" ? fxEnvelope(time, 0.02, 1.05) * 0.2 : 0.05),
    smoke: still ? 0.07 : (phase === "intro" ? 0.03 : 0.07),
  });
  paintSceneSweep(ctx, timeline, time);
  if (!still && time < introEnd + 0.34) {
    const count = timeline.people?.length || 0;
    paintCampaignOpening(ctx, timeline, time, assets, {
      countLabel: `${String(count).padStart(2, "0")} ${count === 1 ? "JOGADOR" : "JOGADORES"}`,
    });
  }
  if (still) {
    paintTeamRoster(ctx, timeline, time, scene, assets);
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
    if (!current || persistent <= 0) return;
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
      return;
    }
    paintTeamPersonStage(ctx, timeline, time, current, assets, persistent);
    return;
  }
  if (time >= finaleStart) paintTeamRoster(ctx, timeline, time, scene, assets);
}

export function paintAnnounceFrame(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  if (timeline.kind === "individual") {
    paintIndividual(ctx, timeline, time, assets);
    return;
  }
  paintTeam(ctx, timeline, time, assets);
}
