import { opponentInitials } from "./agenda-media-core.js";
import { logoDrawRect } from "./agenda-paint.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";
import { classifyAnnouncePhoto, photoBoxForVariant } from "./announce-look.js";
import { announceSceneAt } from "./announce-timeline.js";

const INK = "#efece6";
const MUTED = "#a3a8ae";
const VOID = "#050607";
const RULE = "rgba(239,236,230,0.42)";

let grainTile = null;

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
  return lines.slice(0, 3);
}

function displayName(person) {
  return String(person?.nick || person?.name || "").toUpperCase();
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
    image.data[index + 3] = 30;
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return grainTile;
}

function coverPhoto(ctx, bitmap, dx, dy, dw, dh, focusY = 0.22) {
  const scale = Math.max(dw / bitmap.width, dh / bitmap.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (bitmap.width - sw) / 2;
  const sy = Math.max(0, Math.min(bitmap.height - sh, bitmap.height * focusY - sh * 0.28));
  ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
}

function containPhoto(ctx, bitmap, dx, dy, dw, dh) {
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

function paintGrain(ctx, timeline, time) {
  const tile = getGrainTile();
  if (!tile) return;
  const { width, height } = timeline;
  const shift = Math.round((time * 18) % 96);
  ctx.save();
  ctx.globalAlpha = 0.11 + Math.sin(time * 0.7) * 0.02;
  ctx.drawImage(tile, -shift, -shift, width + 96, height + 96);
  ctx.restore();
}

function paintAmbient(ctx, timeline, time) {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * 0.58)}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.translate(width * 0.52 + Math.sin(time * 0.11) * 18, height * 0.4 + Math.cos(time * 0.09) * 10);
  ctx.rotate(-0.08);
  ctx.fillText("STRIX", 0, 0);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (let index = 0; index < 16; index += 1) {
    const x = width * (0.04 + index * 0.07) + Math.sin(time * 0.13 + index) * 10;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 70, height);
    ctx.stroke();
  }
  ctx.restore();

  const sweep = ((time * 0.08) % 1.5) - 0.25;
  const light = ctx.createLinearGradient(width * sweep, 0, width * sweep + 280, height * 0.2);
  light.addColorStop(0, "rgba(239,236,230,0)");
  light.addColorStop(0.5, "rgba(239,236,230,0.055)");
  light.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, height * (0.18 + Math.sin(time * 0.2) * 0.02));
  ctx.lineTo(width, height * (0.22 + Math.cos(time * 0.17) * 0.02));
  ctx.stroke();
  ctx.restore();

  paintGrain(ctx, timeline, time);
}

function paintStrokes(ctx, timeline, time, progress = 1) {
  const strokes = timeline.look?.strokes || [];
  const amount = clamp(progress);
  if (!amount) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  strokes.forEach((stroke, strokeIndex) => {
    const points = stroke.points || [];
    const visible = Math.max(2, Math.floor(points.length * amount));
    const shown = points.slice(0, visible);
    ctx.globalAlpha = (stroke.alpha || 0.22) * (0.82 + Math.sin(time * 0.55 + strokeIndex) * 0.12);
    ctx.beginPath();
    shown.forEach((point, index) => {
      ctx.lineWidth = (point.w || 8) * (stroke.kind === "slash" ? 1.25 : 1);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    if (stroke.kind === "spray" || stroke.kind === "ring") {
      shown.forEach((point, index) => {
        if (index % 2) return;
        ctx.globalAlpha = (stroke.alpha || 0.22) * 0.55;
        ctx.beginPath();
        ctx.arc(point.x + 6, point.y - 4, Math.max(1.2, (point.w || 8) * 0.18), 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
  ctx.restore();
}

function paintCorners(ctx, timeline, alpha = 1) {
  const { width, height, safe } = timeline;
  const inset = Math.max(36, safe.side - 18);
  const arm = 34;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  [[inset, inset, 1, 1], [width - inset, inset, -1, 1], [inset, height - inset, 1, -1], [width - inset, height - inset, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + arm * sy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + arm * sx, y);
    ctx.stroke();
  });
  ctx.restore();
}

function paintChrome(ctx, timeline, time, { alpha = 1, kicker = "STRIX UNITED", season = "FC 27" } = {}) {
  const { width, safe } = timeline;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(kicker, safe.side, safe.top - 4);
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.fillText(season, width - safe.side, safe.top - 4);
  ctx.fillStyle = RULE;
  ctx.fillRect(safe.side, safe.top + 10, width - safe.side * 2, 1);
  ctx.restore();
  paintCorners(ctx, timeline, alpha * 0.85);
}

function clipInkWipe(ctx, timeline, progress) {
  const { width, height } = timeline;
  const amount = clamp(progress);
  const reach = amount * (width + height);
  ctx.beginPath();
  ctx.moveTo(-height, 0);
  ctx.lineTo(reach, 0);
  ctx.lineTo(reach - height, height);
  ctx.lineTo(-height, height);
  ctx.closePath();
  ctx.clip();
}

function paintInitialsPlate(ctx, person, x, y, w, h) {
  ctx.fillStyle = "#101318";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(239,236,230,0.08)";
  ctx.fillRect(x, y, 8, h);
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.28)}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(person?.initials || opponentInitials(person?.name), x + w / 2, y + h / 2);
}

function paintHeroPhoto(ctx, bitmap, person, box, classified, { scale = 1, alpha = 1 } = {}) {
  const { x, y, w, h, focusY = 0.22 } = box;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  if (!bitmap) {
    paintInitialsPlate(ctx, person, 0, 0, w, h);
    ctx.restore();
    return;
  }
  if (classified?.crop === "cutout") {
    containPhoto(ctx, bitmap, -w * 0.08, 0, w * 1.16, h);
  } else {
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    coverPhoto(ctx, bitmap, 0, 0, w, h, classified?.crop === "selfie" ? 0.16 : focusY);
    const veil = ctx.createLinearGradient(0, h * 0.52, 0, h);
    veil.addColorStop(0, "rgba(5,6,7,0)");
    veil.addColorStop(1, "rgba(5,6,7,0.48)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);
    if (classified?.strongBg) {
      const side = ctx.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, "rgba(5,6,7,0.28)");
      side.addColorStop(0.42, "rgba(5,6,7,0)");
      side.addColorStop(1, "rgba(5,6,7,0.12)");
      ctx.fillStyle = side;
      ctx.fillRect(0, 0, w, h);
    }
  }
  ctx.restore();
}

function paintRoleMark(ctx, person, x, y, alpha = 1) {
  const badge = person?.extraBadge || "";
  if (!badge) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = MUTED;
  ctx.font = "800 16px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(badge, x, y);
  ctx.restore();
}

function paintOpening(ctx, timeline, time, assets, { intoHero = false } = {}) {
  const { width, height, safe, season } = timeline;
  const enter = timeline.still ? 1 : reveal(time, 0, 0.55, easeOutQuart);
  const typeIn = timeline.still ? 1 : reveal(time, 0.28, 0.7, easeOutExpo);
  const markIn = timeline.still ? 1 : reveal(time, 0.7, 0.5, easeOutExpo);
  paintAmbient(ctx, timeline, time);
  paintStrokes(ctx, timeline, time, reveal(time, 0.18, 0.9, easeOutQuart) || (timeline.still ? 1 : 0));
  paintChrome(ctx, timeline, time, { alpha: enter, season });
  ctx.save();
  ctx.globalAlpha = typeIn;
  ctx.translate(width / 2, height * 0.42 + (1 - typeIn) * 40);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "800 22px Inter, sans-serif";
  ctx.fillText("NOVA TEMPORADA", 0, -118);
  ctx.font = `700 ${Math.round(width * 0.24)}px Rajdhani, sans-serif`;
  ctx.fillText("STRIX", 0, 18);
  ctx.font = "700 86px Rajdhani, sans-serif";
  ctx.fillText(season || "FC 27", 0, 118);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = markIn;
  drawMark(ctx, assets?.strix, width / 2, safe.top + 210, 132, markIn);
  ctx.restore();
  if (intoHero) {
    ctx.save();
    clipInkWipe(ctx, timeline, 1 - reveal(time, timeline.introEnd - 0.35, 0.35, easeInOutCubic));
    ctx.fillStyle = VOID;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function paintNameStack(ctx, person, timeline, { x, y, width, alpha, variant }) {
  const { safe } = timeline;
  const story = timeline.format !== "feed";
  const nameSize = variant === "bleed" || variant === "overlap" ? (story ? 118 : 84) : (story ? 104 : 78);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(person.position || "MC", x, y);
  paintRoleMark(ctx, person, x + 78, y, alpha);
  ctx.fillStyle = INK;
  ctx.font = `700 ${nameSize}px Rajdhani, sans-serif`;
  const name = fitText(ctx, displayName(person), width - safe.side * 2, ctx.font);
  ctx.fillText(name, x, y + (story ? 92 : 72));
  if (person.nick && person.nick !== person.name) {
    ctx.fillStyle = MUTED;
    ctx.font = "800 18px Inter, sans-serif";
    ctx.fillText(String(person.name).toUpperCase(), x, y + (story ? 132 : 104));
  }
  ctx.restore();
}

function paintIndividual(ctx, timeline, time, assets) {
  const { width, height, safe, person, phrase, still, format } = timeline;
  const story = format !== "feed";
  const local = still ? 5.4 : time;
  const asset = assets?.byId?.[person?.id] || assets?.players?.[0];
  const classified = classifyAnnouncePhoto(asset?.bitmap);
  const variant = timeline.look?.variants?.[0] || "overlap";
  if (!still && time < timeline.introEnd - 0.12) {
    paintOpening(ctx, timeline, time, assets, { intoHero: true });
    return;
  }

  paintAmbient(ctx, timeline, local);
  paintStrokes(ctx, timeline, local, still ? 1 : reveal(local, 1.4, 1.1, easeOutQuart));
  const photoIn = still ? 1 : reveal(local, 1.55, 0.7, easeOutQuart);
  const nameIn = still ? 1 : reveal(local, 2.1, 0.65, easeOutExpo);
  const phraseIn = still ? 1 : reveal(local, 7.4, 0.6, easeOutExpo);
  const close = still ? 1 : time >= (timeline.finaleStart || 9.2)
    ? 1 - reveal(time, timeline.finaleStart, 0.7, easeInOutCubic) * 0.12
    : 1;
  const ken = still ? 1.02 : 1 + Math.min(0.05, Math.max(0, local - 3) * 0.006);

  ctx.save();
  if (!still) clipInkWipe(ctx, timeline, reveal(local, 1.45, 0.55, easeOutQuart));
  const box = photoBoxForVariant(variant, timeline, classified);
  paintHeroPhoto(ctx, asset?.bitmap, person, box, classified, { scale: 0.92 + photoIn * 0.1 * ken, alpha: photoIn * close });
  ctx.restore();

  const fade = ctx.createLinearGradient(0, 0, width * 0.58, 0);
  fade.addColorStop(0, "rgba(5,6,7,0.42)");
  fade.addColorStop(0.55, "rgba(5,6,7,0.08)");
  fade.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = nameIn * 0.26 * close;
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * 0.38)}px Rajdhani, sans-serif`;
  ctx.fillText(displayName(person), safe.side - 36, height * 0.56);
  ctx.restore();

  paintChrome(ctx, timeline, local, { alpha: close, season: timeline.season });
  paintNameStack(ctx, person, timeline, {
    x: safe.side,
    y: story ? height - safe.bottom - 188 : box.h + 36,
    width,
    alpha: nameIn * close,
    variant,
  });

  ctx.save();
  ctx.globalAlpha = phraseIn * close;
  ctx.fillStyle = RULE;
  const phraseY = story ? height - safe.bottom - 52 : box.h + 148;
  ctx.fillRect(safe.side, phraseY - 28, 52, 2);
  ctx.fillStyle = INK;
  ctx.font = story ? "600 28px Inter, sans-serif" : "600 26px Inter, sans-serif";
  wrapPhrase(ctx, phrase, width - safe.side * 2, ctx.font).slice(0, story ? 2 : 3).forEach((line, index) => {
    ctx.fillText(line, safe.side, phraseY + index * 34);
  });
  ctx.restore();

  if (!still && time >= timeline.finaleStart + 0.25) {
    const lock = reveal(time, timeline.finaleStart + 0.25, 0.7, easeOutExpo);
    ctx.save();
    ctx.globalAlpha = lock * 0.28;
    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = lock;
    drawMark(ctx, assets?.strix, width / 2, height * 0.46, 160, lock);
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = "800 20px Inter, sans-serif";
    ctx.fillText("STRIX UNITED · FC 27", width / 2, height * 0.58);
    ctx.restore();
  }
}

function paintPlayerHero(ctx, timeline, time, scene, assets) {
  const { width, height, safe, people } = timeline;
  const person = scene.person;
  const local = time - scene.start;
  const enter = reveal(local, 0, scene.enter || 0.48, easeOutQuart);
  const exit = time > scene.end - 0.38 ? 1 - reveal(time, scene.end - 0.38, 0.38, easeInOutCubic) : 1;
  const presence = enter * exit;
  const asset = assets?.byId?.[person.id];
  const classified = classifyAnnouncePhoto(asset?.bitmap);
  const variant = scene.variant || "left";
  const ken = 1 + Math.min(0.04, local * 0.008);
  const box = photoBoxForVariant(variant, timeline, classified);

  ctx.save();
  ctx.globalAlpha = presence * 0.22;
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * (variant === "overlap" || variant === "bleed" ? 0.36 : 0.28))}px Rajdhani, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(displayName(person), variant === "left" ? width * 0.22 : safe.side - 28, height * 0.54);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = presence;
  paintHeroPhoto(ctx, asset?.bitmap, person, box, classified, { scale: ken, alpha: presence });

  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.textAlign = "left";
  const indexLabel = `${String((scene.index || 0) + 1).padStart(2, "0")} / ${String(people.length).padStart(2, "0")}`;
  ctx.fillText(indexLabel, safe.side, safe.top + 52);

  const copyY = variant === "stack" ? Math.min(box.y + box.h + 48, height - safe.bottom - 188) : height - safe.bottom - 148;
  ctx.fillText(person.position || "MC", safe.side, copyY);
  paintRoleMark(ctx, person, safe.side + 78, copyY, presence);
  ctx.fillStyle = INK;
  ctx.font = `700 ${variant === "bleed" ? 118 : 102}px Rajdhani, sans-serif`;
  ctx.fillText(fitText(ctx, displayName(person), width - safe.side * 2, ctx.font), safe.side, copyY + 92);
  if (person.nick && person.nick !== person.name) {
    ctx.fillStyle = MUTED;
    ctx.font = "800 18px Inter, sans-serif";
    ctx.fillText(String(person.name).toUpperCase(), safe.side, copyY + 132);
  }
  ctx.restore();
}

function paintTeamPerson(ctx, timeline, time, scene, assets) {
  paintAmbient(ctx, timeline, time);
  paintStrokes(ctx, timeline, time, 0.85);
  paintChrome(ctx, timeline, time, { season: timeline.season });
  const previous = (timeline.scenes || []).find((item) => item.type === "person" && item.index === scene.index - 1);
  if (previous && time < previous.end) {
    ctx.save();
    clipInkWipe(ctx, timeline, 1 - reveal(time, scene.start, 0.4, easeInOutCubic));
    paintPlayerHero(ctx, timeline, Math.min(time, previous.end - 0.01), previous, assets);
    ctx.restore();
  }
  ctx.save();
  clipInkWipe(ctx, timeline, reveal(time, scene.start, 0.46, easeOutQuart));
  paintPlayerHero(ctx, timeline, time, scene, assets);
  ctx.restore();
}

function wallMetrics(count, timeline) {
  const { width, height, safe, format } = timeline;
  const story = format !== "feed";
  const cols = count <= 4 ? 2 : count <= 8 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const gap = story ? 18 : 12;
  const top = safe.top + (story ? 110 : 86);
  const bottom = height - safe.bottom + 8;
  const availableH = bottom - top;
  const availableW = width - safe.side * 2;
  const cellW = (availableW - gap * (cols - 1)) / cols;
  const cellH = Math.min((availableH - gap * (rows - 1)) / rows, cellW * 1.42);
  return { cols, rows, gap, top, cellW, cellH };
}

function paintTeamGrid(ctx, timeline, time, scene, assets) {
  const { width, safe, title, season, format } = timeline;
  const story = format !== "feed";
  const people = scene?.people || timeline.people;
  const enter = timeline.still ? 1 : reveal(time, scene?.start || timeline.finaleStart, 0.4, easeOutExpo);
  paintAmbient(ctx, timeline, time);
  paintStrokes(ctx, timeline, time, 0.7);
  paintChrome(ctx, timeline, time, { season, alpha: enter });
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = INK;
  ctx.font = story ? "700 58px Rajdhani, sans-serif" : "700 48px Rajdhani, sans-serif";
  ctx.textAlign = "left";
  const heading = scene?.pageCount > 1
    ? `${title || "ELENCO FC 27"}  ${scene.pageIndex + 1}/${scene.pageCount}`
    : (title || "ELENCO FC 27");
  ctx.fillText(fitText(ctx, heading, width - safe.side * 2, ctx.font), safe.side, safe.top + 72);

  const metrics = wallMetrics(people.length, timeline);
  people.forEach((person, index) => {
    const col = index % metrics.cols;
    const row = Math.floor(index / metrics.cols);
    const x = safe.side + col * (metrics.cellW + metrics.gap);
    const y = metrics.top + row * (metrics.cellH + metrics.gap);
    const photoH = metrics.cellH - 58;
    const asset = assets?.byId?.[person.id];
    const classified = classifyAnnouncePhoto(asset?.bitmap);
    paintHeroPhoto(ctx, asset?.bitmap, person, { x, y, w: metrics.cellW, h: photoH, focusY: 0.2 }, classified, { alpha: enter });
    ctx.fillStyle = INK;
    ctx.font = `700 ${metrics.cellW > 200 ? 24 : 16}px Rajdhani, sans-serif`;
    ctx.fillText(fitText(ctx, displayName(person), metrics.cellW, ctx.font), x, y + photoH + 24);
    ctx.fillStyle = MUTED;
    ctx.font = "800 12px Inter, sans-serif";
    ctx.fillText(fitText(ctx, [person.position, person.extraBadge].filter(Boolean).join("  ·  "), metrics.cellW, ctx.font), x, y + photoH + 42);
  });
  ctx.restore();
}

export function paintAnnounceFrame(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  const scene = announceSceneAt(timeline, time);
  if (timeline.kind === "individual") {
    paintIndividual(ctx, timeline, time, assets);
    return;
  }
  if (!scene || scene.type === "intro") {
    paintOpening(ctx, timeline, time, assets, { intoHero: true });
    return;
  }
  if (scene.type === "person") {
    paintTeamPerson(ctx, timeline, time, scene, assets);
    return;
  }
  paintTeamGrid(ctx, timeline, time, scene, assets);
}
