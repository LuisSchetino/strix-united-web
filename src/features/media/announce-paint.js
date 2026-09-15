import { opponentInitials } from "./agenda-media-core.js";
import { logoDrawRect } from "./agenda-paint.js";
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

function individualStage(timeline, time) {
  const scene = announceSceneAt(timeline, time);
  return scene?.type || "hero";
}

function paintIndividual(ctx, timeline, time, assets) {
  const { person, phrase, still } = timeline;
  if (still) {
    paintHeroComposition(ctx, timeline, 6.4, person, assets, {
      variant: "center",
      photoIn: 1,
      nameIn: 1,
      brushIn: 1,
      phraseIn: 1,
      phrase,
      stage: "close",
    });
    return;
  }

  const introEnd = timeline.introEnd || 1.32;
  if (time < introEnd - 0.3) {
    paintOpening(ctx, timeline, time, assets);
    return;
  }

  const stage = individualStage(timeline, time);
  const photoIn = reveal(time, introEnd - 0.08, 0.8, easeOutQuart);
  const nameIn = reveal(time, 2.15, 0.75, easeOutExpo);
  const brushIn = reveal(time, 3.05, 0.7, easeOutQuart);
  const phraseIn = reveal(time, timeline.finaleStart || 7.6, 0.5, easeOutExpo);
  const recede = time >= (timeline.finaleStart || 7.6)
    ? 1 - reveal(time, timeline.finaleStart, 0.85, easeInOutCubic) * 0.1
    : 1;
  const heroOpts = {
    variant: "center",
    photoIn: Math.max(photoIn, time >= introEnd - 0.3 ? 0.4 : 0),
    nameIn: stage === "reveal" ? 0 : nameIn,
    brushIn: stage === "reveal" || (stage === "hero" && time < 3.2) ? 0 : brushIn,
    phraseIn,
    phrase,
    recede,
    stage: stage === "intro" ? "reveal" : stage,
  };
  const closed = time < introEnd ? 1 - reveal(time, introEnd - 0.3, 0.3, easeInOutCubic) : 0;

  if (closed > 0.001) {
    paintOpening(ctx, timeline, Math.min(time, introEnd - 0.31), assets);
    const inked = paintInkReveal(ctx, timeline, closed, assets, (incoming) => {
      paintHeroComposition(incoming, timeline, time, person, assets, heroOpts);
    });
    if (!inked) paintHeroComposition(ctx, timeline, time, person, assets, heroOpts);
    paintCutCover(ctx, timeline, closed, assets, true, inked);
  } else {
    paintHeroComposition(ctx, timeline, time, person, assets, heroOpts);
  }

  if (time >= (timeline.finaleStart || 7.6) + 0.7) {
    const lock = reveal(time, timeline.finaleStart + 0.7, 0.5, easeOutExpo);
    ctx.save();
    ctx.globalAlpha = lock * 0.18;
    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, timeline.width, timeline.height);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = lock;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = "800 18px Inter, sans-serif";
    ctx.fillText("STRIX UNITED  ·  FC 27", timeline.safe.side, timeline.height - timeline.safe.bottom - 8);
    ctx.restore();
  }
}

function paintPlayerHero(ctx, timeline, time, scene, assets) {
  const local = time - scene.start;
  const photoIn = reveal(local, 0.22, 0.5, easeOutQuart);
  const nameIn = reveal(local, 0.5, 0.38, easeOutExpo);
  const brushIn = reveal(local, 0.68, 0.5, easeOutQuart);
  const detail = reveal(local, 2.55, 0.45, easeOutExpo);
  const exit = time > scene.end - 0.35 ? 1 - reveal(time, scene.end - 0.35, 0.35, easeInOutCubic) : 1;
  const people = timeline.people || [];
  const stage = local < 1.1 ? "hero" : (local < 2.5 ? "reframe" : "detail");
  paintHeroComposition(ctx, timeline, time, scene.person, assets, {
    variant: scene.variant || "center",
    photoIn: photoIn * exit,
    nameIn: nameIn * exit,
    brushIn: brushIn * exit,
    phraseIn: 0,
    indexLabel: `${String((scene.index || 0) + 1).padStart(2, "0")}  /  ${String(people.length).padStart(2, "0")}`,
    recede: 0.98 + detail * 0.03,
    stage,
  });
}

function paintTeamPerson(ctx, timeline, time, scene, assets) {
  const previous = (timeline.scenes || []).find((item) => item.type === "person" && item.index === scene.index - 1);
  if (previous && time < previous.end) {
    paintPlayerHero(ctx, timeline, Math.min(time, previous.end - 0.01), previous, assets);
  } else {
    paintBackground(ctx, timeline, null, time, 1);
  }
  const open = reveal(time, scene.start, 0.32, easeInOutCubic);
  const closed = 1 - open;
  const inked = paintInkReveal(ctx, timeline, closed, assets, (incoming) => {
    paintPlayerHero(incoming, timeline, time, scene, assets);
  });
  if (!inked) paintPlayerHero(ctx, timeline, time, scene, assets);
  paintCutCover(ctx, timeline, closed, assets, (scene.index || 0) % 2 === 0, inked);
}

function wallMetrics(count, timeline) {
  const spec = announceGridSpec(count, timeline.format);
  const story = timeline.format !== "feed";
  const cols = spec.cols;
  const rows = Math.ceil(Math.max(1, count) / cols);
  const gap = story ? 14 : 12;
  const top0 = timeline.safe.top + (story ? 86 : 70);
  const bottom = timeline.height - timeline.safe.bottom;
  const availableH = bottom - top0;
  const availableW = timeline.width - timeline.safe.side * 2;
  const cellW = (availableW - gap * (cols - 1)) / cols;
  const cellH = Math.min((availableH - gap * (rows - 1)) / rows, cellW * spec.maxAspect);
  const used = rows * cellH + (rows - 1) * gap;
  const top = top0 + Math.max(0, (availableH - used) * 0.18);
  return { cols, rows, gap, top, cellW, cellH, nameReserve: spec.nameReserve };
}

function paintTeamGrid(ctx, timeline, time, scene, assets) {
  const { width, safe, title, season, format } = timeline;
  const story = format !== "feed";
  const people = scene?.people || timeline.people;
  const enter = timeline.still ? 1 : reveal(time, scene?.start || timeline.finaleStart, 0.4, easeOutExpo);
  paintBackground(ctx, timeline, assets?.byId?.[people[0]?.id]?.bitmap, time, 1);
  paintChrome(ctx, timeline, { season, alpha: enter });
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = INK;
  ctx.font = story ? "700 54px Rajdhani, sans-serif" : "700 48px Rajdhani, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(fitText(ctx, title || "ELENCO FC 27", width - safe.side * 2 - 90, ctx.font), safe.side, safe.top + 62);
  if (scene?.pageCount > 1) {
    ctx.fillStyle = MUTED;
    ctx.font = "800 15px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${String(scene.pageIndex + 1).padStart(2, "0")} / ${String(scene.pageCount).padStart(2, "0")}`, width - safe.side, safe.top + 50);
  }
  const metrics = wallMetrics(people.length, timeline);
  people.forEach((person, index) => {
    const col = index % metrics.cols;
    const row = Math.floor(index / metrics.cols);
    const x = safe.side + col * (metrics.cellW + metrics.gap);
    const y = metrics.top + row * (metrics.cellH + metrics.gap);
    const photoH = metrics.cellH - metrics.nameReserve;
    const asset = assets?.byId?.[person.id];
    const classified = classifyAnnouncePhoto(asset?.bitmap);
    paintSubject(ctx, asset?.bitmap, person, { x, y, w: metrics.cellW, h: photoH, focusY: photoFocusY(classified) }, classified, { alpha: enter, assets });
    const name = fitNameLayout(ctx, campaignName(person), metrics.cellW, metrics.cellW > 360 ? 26 : 18, 14);
    name.lines.forEach((line, lineIndex) => {
      ctx.fillStyle = INK;
      ctx.font = `700 ${name.size}px Rajdhani, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(line, x, y + photoH + 20 + lineIndex * (name.size * 0.9));
    });
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${metrics.cellW > 360 ? 13 : 11}px Inter, sans-serif`;
    ctx.fillText(fitText(ctx, [person.position, person.extraBadge].filter(Boolean).join("  ·  "), metrics.cellW, ctx.font), x, y + photoH + metrics.nameReserve - 8);
  });
  ctx.restore();
  paintGrain(ctx, timeline, time, assets);
}

export function paintAnnounceFrame(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  const scene = announceSceneAt(timeline, time);
  if (timeline.kind === "individual") {
    paintIndividual(ctx, timeline, time, assets);
    return;
  }
  if (!scene || scene.type === "intro") {
    if (!timeline.still && time > (timeline.introEnd || 1.45) - 0.28) {
      const first = (timeline.scenes || []).find((item) => item.type === "person");
      if (first) {
        paintPlayerHero(ctx, timeline, first.start + 0.01, first, assets);
        paintShutter(ctx, timeline, 1 - reveal(time, timeline.introEnd - 0.28, 0.28, easeInOutCubic));
        return;
      }
    }
    paintOpening(ctx, timeline, time, assets);
    return;
  }
  if (scene.type === "person") {
    paintTeamPerson(ctx, timeline, time, scene, assets);
    return;
  }
  paintTeamGrid(ctx, timeline, time, scene, assets);
}
