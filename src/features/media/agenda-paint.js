import { opponentInitials } from "./agenda-media-core.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";

const INK = "#efece6";
const MUTED = "#9aa0a6";
const VOID = "#050607";

export function typeScale(format) {
  const story = format !== "feed";
  return {
    eyebrow: story ? 34 : 26,
    title: story ? 118 : 86,
    date: story ? 38 : 30,
    gameIndex: story ? 32 : 24,
    team: story ? 48 : 36,
    kickoff: story ? 118 : 86,
    competition: story ? 32 : 24,
    vs: story ? 26 : 20,
    finaleKicker: story ? 28 : 22,
    finaleTitle: story ? 78 : 56,
    finaleDate: story ? 36 : 28,
    finaleTime: story ? 88 : 62,
    finaleName: story ? 52 : 36,
    finaleComp: story ? 26 : 20,
    matchday: story ? 84 : 58,
    brand: story ? 34 : 26,
    logoMatch: story ? 276 : 214,
    logoFinale: story ? 92 : 66,
  };
}

function fitText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1);
  return `${next}…`;
}

function wrapText(ctx, text, maxWidth, font, maxLines = 2) {
  ctx.font = font;
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (lines.length < maxLines) lines.push(current);
  else lines[maxLines - 1] = fitText(ctx, `${lines[maxLines - 1] || current}`, maxWidth, font);
  return lines;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function measureOpaqueBounds(bitmap) {
  if (!bitmap) return { sx: 0, sy: 0, sw: 1, sh: 1 };
  const width = bitmap.width;
  const height = bitmap.height;
  const canRead = typeof document !== "undefined" && document.createElement;
  if (!canRead) return { sx: 0, sy: 0, sw: width, sh: height };
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { sx: 0, sy: 0, sw: width, sh: height };
  ctx.drawImage(bitmap, 0, 0);
  let data;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return { sx: 0, sy: 0, sw: width, sh: height };
  }
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 14) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return { sx: 0, sy: 0, sw: width, sh: height };
  return { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 };
}

function opticalBox(asset) {
  if (asset?.optical) return asset.optical;
  const box = measureOpaqueBounds(asset?.bitmap);
  if (asset) asset.optical = box;
  return box;
}

export function logoDrawRect(asset, box) {
  if (!asset?.bitmap) return { dw: box * 0.72, dh: box * 0.72, sx: 0, sy: 0, sw: 1, sh: 1 };
  const bounds = opticalBox(asset);
  const scale = Math.min(box / bounds.sw, box / bounds.sh);
  return {
    sx: bounds.sx,
    sy: bounds.sy,
    sw: bounds.sw,
    sh: bounds.sh,
    dw: bounds.sw * scale,
    dh: bounds.sh * scale,
  };
}

function drawLogo(ctx, asset, x, y, box, progress = 1, scale = 1) {
  const ready = clamp(progress);
  if (ready <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = ready;
  if (asset?.bitmap) {
    const rect = logoDrawRect(asset, box);
    ctx.drawImage(asset.bitmap, rect.sx, rect.sy, rect.sw, rect.sh, -rect.dw / 2, -rect.dh / 2, rect.dw, rect.dh);
  } else {
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(box * 0.5)}px Rajdhani, Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(asset?.initials || opponentInitials(asset?.name), 0, 2);
  }
  ctx.restore();
}

function paintAmbient(ctx, timeline, time) {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  const drift = (time * 14) % 160;
  ctx.save();
  ctx.globalAlpha = 0.075;
  ctx.strokeStyle = "#d8d3cb";
  ctx.lineWidth = 1;
  for (let x = -180 + drift; x < width + 100; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.2, height);
    ctx.stroke();
  }
  ctx.restore();

  const spotX = width * 0.16 + Math.sin(time * 0.28) * width * 0.06;
  const spotY = height * 0.2 + Math.cos(time * 0.22) * height * 0.05;
  const spot = ctx.createRadialGradient(spotX, spotY, 40, spotX, spotY, width * 0.72);
  spot.addColorStop(0, "rgba(255,255,255,0.045)");
  spot.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, width, height);
  const spot2X = width * 0.82 + Math.cos(time * 0.2) * width * 0.05;
  const spot2Y = height * 0.78 + Math.sin(time * 0.18) * height * 0.04;
  const spot2 = ctx.createRadialGradient(spot2X, spot2Y, 30, spot2X, spot2Y, width * 0.5);
  spot2.addColorStop(0, "rgba(255,255,255,0.03)");
  spot2.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spot2;
  ctx.fillRect(0, 0, width, height);

  const breathe = 0.03 + Math.sin(time * 0.65) * 0.01;
  ctx.save();
  ctx.globalAlpha = breathe;
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * 0.34)}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("STRIX", width * 0.5, height * 0.46 + Math.sin(time * 0.22) * 14);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = INK;
  const grainShift = Math.floor(time * 40);
  for (let index = 0; index < 90; index += 1) {
    const seed = (index * 127 + grainShift * 13) % 9973;
    ctx.fillRect(seed % width, (seed * 17) % height, 2, 2);
  }
  ctx.restore();
}

function paintIntro(ctx, timeline, time, dayLabel) {
  const { width, safe } = timeline;
  const type = typeScale(timeline.format);
  const fadeOut = time > timeline.introEnd
    ? 1 - reveal(time, timeline.introEnd, 0.38, easeInOutCubic)
    : 1;
  const brand = reveal(time, 0.08, 0.7, easeOutExpo) * fadeOut;
  const title = reveal(time, 0.42, 0.7, easeOutQuart) * fadeOut;
  const date = reveal(time, 0.95, 0.55, easeOutQuart) * fadeOut;
  const x = width / 2;
  const y = safe.top + (timeline.format === "feed" ? 70 : 120);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y - 50, width * brand, 80);
  ctx.clip();
  ctx.globalAlpha = brand;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.brand}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", x, y);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.title}px Rajdhani, sans-serif`;
  ctx.translate(0, (1 - title) * 36);
  ctx.beginPath();
  ctx.rect(safe.side - 10, y + 10, width - safe.side * 2 + 20, type.title + 36);
  ctx.clip();
  ctx.fillText("AGENDA", x, y + type.title);
  ctx.fillText("DO DIA", x, y + type.title * 1.82);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = date;
  ctx.strokeStyle = "rgba(239,236,230,0.4)";
  ctx.lineWidth = 2;
  const lineW = 110 * date;
  const lineY = y + type.title * 2.05;
  ctx.beginPath();
  ctx.moveTo(x - lineW, lineY);
  ctx.lineTo(x + lineW, lineY);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.date}px Inter, sans-serif`;
  ctx.fillText(dayLabel, x, lineY + 52);
  ctx.restore();
}

function paintMatch(ctx, timeline, scene, time, assets) {
  const { width, height, safe, matches } = timeline;
  const type = typeScale(timeline.format);
  const local = time - scene.start;
  const beat = scene.end - scene.start;
  const enter = reveal(local, 0, 0.58, easeOutExpo);
  const logos = reveal(local, 0.08, 0.55, easeOutExpo);
  const meta = reveal(local, 0.28, 0.5, easeOutQuart);
  const exit = time > scene.end - 0.18 ? 1 - reveal(time, scene.end - 0.18, 0.18, easeInOutCubic) : 1;
  const match = scene.match;
  const centerY = safe.top + (height - safe.top - safe.bottom) * (timeline.format === "feed" ? 0.46 : 0.5);
  const box = type.logoMatch;
  const gap = timeline.format === "feed" ? 186 : 214;

  ctx.save();
  ctx.globalAlpha = enter * exit;
  ctx.beginPath();
  ctx.rect(0, centerY - 420, width * Math.max(enter, 0.12), 860);
  ctx.clip();

  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.gameIndex}px Inter, sans-serif`;
  ctx.fillText(matches.length > 1 ? `JOGO ${String(scene.index + 1).padStart(2, "0")}` : "CONFRONTO", width / 2, centerY - 318);

  const float = Math.sin(time * 0.9) * 3;
  drawLogo(ctx, assets.strix, width / 2 - gap, centerY - 78 + float, box, logos, 1.06 - logos * 0.06);
  drawLogo(ctx, assets.opponents[scene.index], width / 2 + gap, centerY - 78 - float, box, logos, 1.06 - logos * 0.06);

  ctx.save();
  ctx.globalAlpha = logos;
  ctx.strokeStyle = "rgba(239,236,230,0.32)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2, centerY - 150);
  ctx.lineTo(width / 2, centerY - 16);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `800 ${type.vs}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("VS", width / 2, centerY - 74);
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.team}px Rajdhani, sans-serif`;
  const nameWidth = gap + 40;
  wrapText(ctx, "STRIX UNITED", nameWidth, ctx.font, 2).forEach((line, index) => {
    ctx.fillText(line, width / 2 - gap, centerY + 92 + index * (type.team * 0.86));
  });
  wrapText(ctx, (match.opponent || "ADVERSÁRIO").toUpperCase(), nameWidth, `700 ${type.team}px Rajdhani, sans-serif`, 2).forEach((line, index) => {
    ctx.fillText(line, width / 2 + gap, centerY + 92 + index * (type.team * 0.86));
  });

  ctx.save();
  ctx.globalAlpha = meta;
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.kickoff}px Rajdhani, sans-serif`;
  ctx.fillText(match.kickoff || "", width / 2, centerY + 248);
  const detail = [match.competition, match.round].filter(Boolean).join("  ·  ").toUpperCase();
  if (detail) {
    ctx.fillStyle = MUTED;
    ctx.font = `700 ${type.competition}px Inter, sans-serif`;
    ctx.fillText(fitText(ctx, detail, width - safe.side * 2, ctx.font), width / 2, centerY + 302);
  }
  ctx.restore();
  ctx.restore();
}

function paintFinale(ctx, timeline, time, assets, dayLabel) {
  const { width, height, safe, matches, finaleStart, lockupStart } = timeline;
  const type = typeScale(timeline.format);
  const local = time - finaleStart;
  const enter = reveal(local, 0, 0.85, easeOutExpo);
  const lockup = reveal(time, lockupStart, 0.55, easeOutQuart);
  const compact = matches.length >= 5;
  const row = compact
    ? (timeline.format === "feed" ? 100 : 124)
    : matches.length === 1
      ? (timeline.format === "feed" ? 188 : 230)
      : (timeline.format === "feed" ? 148 : 178);
  const header = timeline.format === "feed" ? 108 : 136;
  const blockH = header + matches.length * row;
  const startY = Math.max(safe.top + 36, (height - safe.bottom + safe.top) / 2 - blockH / 2 - 30);

  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.finaleKicker}px Inter, sans-serif`;
  ctx.fillText("AGENDA DO DIA", width / 2, startY);
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.finaleDate}px Rajdhani, sans-serif`;
  ctx.fillText(dayLabel, width / 2, startY + 46);

  matches.forEach((match, index) => {
    const stagger = reveal(local, 0.16 + index * 0.1, 0.5, easeOutQuart);
    const y = startY + header + index * row;
    ctx.save();
    ctx.globalAlpha = stagger;
    ctx.strokeStyle = "rgba(239,236,230,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(safe.side, y);
    ctx.lineTo(width - safe.side, y);
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = `700 ${type.finaleTime}px Rajdhani, sans-serif`;
    ctx.fillText(match.kickoff || "", safe.side, y + row * 0.62);

    const mid = safe.side + (timeline.format === "feed" ? 210 : 248);
    const logoY = y + row * 0.52;
    const float = Math.sin(time * 0.7 + index) * 2;
    drawLogo(ctx, assets.strix, mid, logoY + float, type.logoFinale, 1, 1);
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.font = `800 ${type.vs}px Inter, sans-serif`;
    ctx.fillText("VS", mid + 58, y + row * 0.58);
    drawLogo(ctx, assets.opponents[index], mid + 116, logoY - float, type.logoFinale, 1, 1);

    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = `700 ${type.finaleName}px Rajdhani, sans-serif`;
    const nameX = mid + 168;
    const nameMax = width - safe.side - nameX;
    const name = fitText(ctx, (match.opponent || "").toUpperCase(), nameMax, ctx.font);
    ctx.fillText(name, nameX, y + row * (compact ? 0.58 : 0.48));
    if (match.competition && !compact) {
      ctx.fillStyle = MUTED;
      ctx.font = `700 ${type.finaleComp}px Inter, sans-serif`;
      ctx.fillText(fitText(ctx, [match.competition, match.round].filter(Boolean).join(" · ").toUpperCase(), nameMax, ctx.font), nameX, y + row * 0.72);
    }
    ctx.restore();
  });

  ctx.save();
  ctx.globalAlpha = lockup;
  ctx.strokeStyle = "rgba(239,236,230,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 90, height - safe.bottom + 8);
  ctx.lineTo(width / 2 + 90, height - safe.bottom + 8);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.brand}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", width / 2, height - safe.bottom + 52);
  ctx.font = `700 ${type.matchday}px Rajdhani, sans-serif`;
  ctx.fillText("MATCHDAY", width / 2, height - safe.bottom + 52 + type.matchday * 0.9);
  ctx.restore();
  ctx.restore();
}

export function paintAgendaFrame(ctx, { timeline, time, assets, dayLabel }) {
  if (!ctx || !timeline) return;
  paintAmbient(ctx, timeline, time);
  if (time < timeline.introEnd + 0.42) {
    paintIntro(ctx, timeline, time, dayLabel);
  }
  for (const scene of timeline.scenes) {
    if (scene.type !== "match") continue;
    if (time < scene.start || time > scene.end + 0.02) continue;
    paintMatch(ctx, timeline, scene, time, assets);
  }
  if (time >= timeline.finaleStart - 0.04) {
    paintFinale(ctx, timeline, time, assets, dayLabel);
  }
}

export function measureSafeZones(timeline) {
  return {
    format: timeline.format,
    width: timeline.width,
    height: timeline.height,
    ...timeline.safe,
    contentHeight: timeline.height - timeline.safe.top - timeline.safe.bottom,
  };
}
