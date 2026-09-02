import { opponentInitials } from "./agenda-media-core.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";

const INK = "#efece6";
const MUTED = "#a3a8ae";
const VOID = "#050607";
const RULE = "rgba(239,236,230,0.28)";

export function typeScale(format) {
  const story = format !== "feed";
  return {
    eyebrow: story ? 28 : 22,
    title: story ? 132 : 92,
    date: story ? 40 : 30,
    gameIndex: story ? 26 : 20,
    giantIndex: story ? 420 : 300,
    team: story ? 44 : 34,
    kickoff: story ? 128 : 90,
    competition: story ? 28 : 22,
    vs: story ? 22 : 18,
    finaleKicker: story ? 26 : 20,
    finaleTitle: story ? 92 : 64,
    finaleDate: story ? 34 : 26,
    finaleTime: story ? 96 : 68,
    finaleName: story ? 48 : 34,
    finaleComp: story ? 22 : 18,
    matchday: story ? 88 : 60,
    brand: story ? 28 : 22,
    logoMatch: story ? 336 : 248,
    logoFinale: story ? 128 : 92,
    logoIntro: story ? 220 : 164,
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
    ctx.font = `700 ${Math.round(box * 0.48)}px Rajdhani, Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(asset?.initials || opponentInitials(asset?.name), 0, 2);
  }
  ctx.restore();
}

function paintCorners(ctx, timeline, alpha = 0.55) {
  const { width, height, safe } = timeline;
  const len = 42;
  const inset = 36;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  const corners = [
    [inset, safe.top - 40],
    [width - inset, safe.top - 40],
    [inset, height - safe.bottom + 40],
    [width - inset, height - safe.bottom + 40],
  ];
  corners.forEach(([x, y], index) => {
    const dirX = index % 2 === 0 ? 1 : -1;
    const dirY = index < 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, y + len * dirY);
    ctx.lineTo(x, y);
    ctx.lineTo(x + len * dirX, y);
    ctx.stroke();
  });
  ctx.restore();
}

function paintAmbient(ctx, timeline, time, assets, phase = "intro") {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  const driftA = (time * 18) % 140;
  const driftB = (time * -11) % 180;
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#e5dfd6";
  ctx.lineWidth = 1;
  for (let x = -200 + driftA; x < width + 120; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.16, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.035;
  ctx.lineWidth = 2;
  for (let x = -240 + driftB; x < width + 160; x += 118) {
    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(x + height * 0.1, 0);
    ctx.stroke();
  }
  ctx.restore();

  const breath = Math.sin(time * 0.55);
  ctx.save();
  ctx.globalAlpha = 0.028 + breath * 0.006;
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * 0.42)}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  const wordY = phase === "intro" ? height * 0.36 : phase === "finale" ? height * 0.22 : height * 0.18;
  ctx.fillText("STRIX", width * 0.5 + Math.sin(time * 0.16) * 14, wordY);
  ctx.restore();

  const owl = phase === "match"
    ? { x: width * 0.12, y: height * 0.82, box: width * 0.52, alpha: 0.02 }
    : phase === "finale"
      ? { x: width * 0.93, y: height * 0.9, box: width * 0.4, alpha: 0.016 }
      : null;
  if (assets?.strix && owl) {
    ctx.save();
    ctx.globalAlpha = owl.alpha + breath * 0.004;
    drawLogo(ctx, assets.strix, owl.x + Math.sin(time * 0.2) * 8, owl.y, Math.round(owl.box), 1, 1);
    ctx.restore();
  }

  const sweep = ((time * 0.11) % 1.35) - 0.18;
  const sweepX = width * sweep;
  const light = ctx.createLinearGradient(sweepX, 0, sweepX + 260, 0);
  light.addColorStop(0, "rgba(255,255,255,0)");
  light.addColorStop(0.5, "rgba(255,255,255,0.04)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  const spot = ctx.createRadialGradient(width * 0.2, height * 0.12, 8, width * 0.2, height * 0.12, width * 0.65);
  spot.addColorStop(0, "rgba(255,255,255,0.04)");
  spot.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, width, height);

  const veil = ctx.createRadialGradient(width * 0.5, height * 0.48, 40, width * 0.5, height * 0.48, width * 0.78);
  veil.addColorStop(0, "rgba(5,6,7,0.78)");
  veil.addColorStop(0.55, "rgba(5,6,7,0.42)");
  veil.addColorStop(1, "rgba(5,6,7,0.08)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = INK;
  const grainShift = Math.floor(time * 56);
  for (let index = 0; index < 160; index += 1) {
    const seed = (index * 131 + grainShift * 17) % 9973;
    ctx.fillRect(seed % width, (seed * 19) % height, 2, 2);
  }
  ctx.restore();

  paintCorners(ctx, timeline, 0.32 + Math.sin(time * 0.75) * 0.05);
}

function paintIntro(ctx, timeline, time, dayLabel, assets) {
  const { width, height, safe, matches } = timeline;
  const type = typeScale(timeline.format);
  const fadeOut = time > timeline.introEnd ? 1 - reveal(time, timeline.introEnd, 0.38, easeInOutCubic) : 1;
  const frame = reveal(time, 0.04, 0.5, easeOutExpo) * fadeOut;
  const brand = reveal(time, 0.16, 0.55, easeOutExpo) * fadeOut;
  const title = reveal(time, 0.38, 0.78, easeOutQuart) * fadeOut;
  const date = reveal(time, 1.0, 0.55, easeOutQuart) * fadeOut;
  const mark = reveal(time, 0.62, 0.7, easeOutExpo) * fadeOut;
  const x = width / 2;
  const y = safe.top + (timeline.format === "feed" ? 16 : 20);

  ctx.save();
  ctx.globalAlpha = frame;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(safe.side, safe.top - 24);
  ctx.lineTo(safe.side, safe.top - 24 + 80 * frame);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = brand;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.eyebrow}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", x, y + 28);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(safe.side, y + 52);
  ctx.lineTo(safe.side + (width - safe.side * 2) * brand, y + 52);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = VOID;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.title}px Rajdhani, sans-serif`;
  ctx.translate((1 - title) * -36, (1 - title) * 18);
  ctx.beginPath();
  ctx.rect(0, y + 68, width * Math.max(title, 0.1), type.title * 2.15);
  ctx.clip();
  ctx.fillStyle = INK;
  ctx.fillText("AGENDA", x, y + 68 + type.title * 0.92);
  ctx.fillText("DO DIA", x, y + 68 + type.title * 1.86);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = date;
  const lineY = y + 88 + type.title * 2.05;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 148 * date, lineY);
  ctx.lineTo(x + 148 * date, lineY);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.date}px Inter, sans-serif`;
  ctx.fillText(dayLabel, x, lineY + 58);
  ctx.fillStyle = MUTED;
  ctx.font = `800 ${type.eyebrow}px Inter, sans-serif`;
  ctx.fillText(`${matches.length} ${matches.length === 1 ? "JOGO" : "JOGOS"}`, x, lineY + 104);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = mark * 0.94;
  drawLogo(ctx, assets?.strix, x, lineY + (timeline.format === "feed" ? 150 : 210), type.logoIntro, mark, 1.1 - mark * 0.1);
  ctx.restore();
}

function paintMatch(ctx, timeline, scene, time, assets) {
  const { width, height, safe, matches } = timeline;
  const type = typeScale(timeline.format);
  const local = time - scene.start;
  const enter = reveal(local, 0, 0.3, easeOutExpo);
  const logos = reveal(local, 0.06, 0.38, easeOutExpo);
  const meta = reveal(local, 0.14, 0.4, easeOutQuart);
  const exit = time > scene.end - 0.16 ? 1 - reveal(time, scene.end - 0.16, 0.16, easeInOutCubic) : 1;
  const match = scene.match;
  const indexLabel = String(scene.index + 1).padStart(2, "0");
  const centerY = safe.top + (height - safe.top - safe.bottom) * (timeline.format === "feed" ? 0.5 : 0.52);
  const box = type.logoMatch;
  const gap = timeline.format === "feed" ? 208 : 240;
  const presence = enter * exit;
  const wipe = (1 - enter) * width;

  ctx.save();
  ctx.globalAlpha = presence * 0.2;
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.font = `800 ${type.giantIndex}px Rajdhani, sans-serif`;
  ctx.fillText(indexLabel, safe.side - 8 + (1 - enter) * 48, centerY + type.giantIndex * 0.22);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = presence;
  ctx.beginPath();
  ctx.rect(wipe * 0.35, 0, width, height);
  ctx.clip();

  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = `800 ${type.gameIndex}px Inter, sans-serif`;
  ctx.fillText(matches.length > 1 ? `JOGO ${indexLabel}` : "CONFRONTO", safe.side, safe.top + 28);
  ctx.textAlign = "right";
  ctx.fillText((match.competition || "AGENDA").toUpperCase(), width - safe.side, safe.top + 28);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(safe.side, safe.top + 50);
  ctx.lineTo(width - safe.side, safe.top + 50);
  ctx.stroke();

  const frameTop = centerY - (timeline.format === "feed" ? 250 : 310);
  const frameH = timeline.format === "feed" ? 430 : 540;
  ctx.save();
  ctx.strokeStyle = "rgba(239,236,230,0.42)";
  ctx.lineWidth = 2;
  const fl = 36;
  [
    [safe.side, frameTop],
    [width - safe.side, frameTop],
    [safe.side, frameTop + frameH],
    [width - safe.side, frameTop + frameH],
  ].forEach(([fx, fy], index) => {
    const dirX = index % 2 === 0 ? 1 : -1;
    const dirY = index < 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(fx, fy + fl * dirY);
    ctx.lineTo(fx, fy);
    ctx.lineTo(fx + fl * dirX, fy);
    ctx.stroke();
  });
  ctx.restore();

  const float = Math.sin(time * 0.9) * 5;
  drawLogo(ctx, assets.strix, width / 2 - gap - (1 - logos) * 40, centerY - 86 + float, box, logos, 1.1 - logos * 0.1);
  drawLogo(ctx, assets.opponents[scene.index], width / 2 + gap + (1 - logos) * 40, centerY - 86 - float, box, logos, 1.1 - logos * 0.1);

  ctx.save();
  ctx.globalAlpha = logos;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 20, centerY - 168);
  ctx.lineTo(width / 2 + 20, centerY - 8);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `800 ${type.vs}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("VS", width / 2, centerY - 78);
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.team}px Rajdhani, sans-serif`;
  const nameWidth = gap + 28;
  wrapText(ctx, "STRIX UNITED", nameWidth, ctx.font, 2).forEach((line, index) => {
    ctx.fillText(line, width / 2 - gap, centerY + 112 + index * (type.team * 0.84));
  });
  wrapText(ctx, (match.opponent || "ADVERSÁRIO").toUpperCase(), nameWidth, `700 ${type.team}px Rajdhani, sans-serif`, 2).forEach((line, index) => {
    ctx.fillText(line, width / 2 + gap, centerY + 112 + index * (type.team * 0.84));
  });

  ctx.save();
  ctx.globalAlpha = meta;
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.kickoff}px Rajdhani, sans-serif`;
  ctx.fillText(match.kickoff || "", width / 2, centerY + 274);
  const detail = [match.competition, match.round].filter(Boolean).join("  ·  ").toUpperCase();
  if (detail) {
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${type.competition}px Inter, sans-serif`;
    ctx.fillText(fitText(ctx, detail, width - safe.side * 2, ctx.font), width / 2, centerY + 326);
  }
  ctx.restore();
  ctx.restore();
}

function finaleGeometry(timeline) {
  const { height, safe, matches } = timeline;
  const feed = timeline.format === "feed";
  const startY = safe.top + (feed ? 2 : 6);
  const header = feed ? 118 : 150;
  const lockupY = height - safe.bottom;
  const row = (lockupY - startY - header) / Math.max(matches.length, 1);
  return { startY, header, lockupY, row };
}

function paintFinale(ctx, timeline, time, assets, dayLabel) {
  const { width, safe, matches, finaleStart, lockupStart } = timeline;
  const type = typeScale(timeline.format);
  const local = time - finaleStart;
  const enter = reveal(local, 0, 0.62, easeOutExpo);
  const lockup = reveal(time, lockupStart, 0.48, easeOutQuart);
  const { startY, header, lockupY, row } = finaleGeometry(timeline);
  const logoBox = Math.min(type.logoFinale, Math.max(56, row * 0.38));

  ctx.save();
  ctx.globalAlpha = enter;
  const plate = ctx.createLinearGradient(0, startY, 0, lockupY);
  plate.addColorStop(0, "rgba(5,6,7,0.18)");
  plate.addColorStop(0.5, "rgba(5,6,7,0.08)");
  plate.addColorStop(1, "rgba(5,6,7,0.22)");
  ctx.fillStyle = plate;
  ctx.fillRect(safe.side - 8, startY, width - safe.side * 2 + 16, lockupY - startY);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = `800 ${type.finaleKicker}px Inter, sans-serif`;
  ctx.fillText("AGENDA COMPLETA", safe.side, startY + 24);
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.finaleTitle}px Rajdhani, sans-serif`;
  ctx.fillText("AGENDA", safe.side, startY + 24 + type.finaleTitle * 0.92);
  ctx.textAlign = "right";
  ctx.font = `700 ${type.finaleDate}px Inter, sans-serif`;
  ctx.fillText(dayLabel, width - safe.side, startY + 24 + type.finaleTitle * 0.55);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(safe.side, startY + header - 18);
  ctx.lineTo(safe.side + 220, startY + header - 18);
  ctx.stroke();

  matches.forEach((match, index) => {
    const stagger = reveal(local, 0.1 + index * 0.1, 0.46, easeOutQuart);
    const y = startY + header + index * row;
    const mid = y + row * 0.52;
    const float = Math.sin(time * 0.7 + index) * 3;
    ctx.save();
    ctx.globalAlpha = stagger * 0.1;
    ctx.fillStyle = INK;
    ctx.textAlign = "right";
    ctx.font = `800 ${Math.round(row * 0.72)}px Rajdhani, sans-serif`;
    ctx.fillText(String(index + 1).padStart(2, "0"), width - safe.side + 8, y + row * 0.78);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = stagger;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.min(type.finaleTime, row * 0.36)}px Rajdhani, sans-serif`;
    ctx.fillText(match.kickoff || "", safe.side, mid + type.finaleTime * 0.18);

    const logosX = timeline.format === "feed" ? 340 : 368;
    drawLogo(ctx, assets.strix, logosX, mid + float, logoBox, 1, 1);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(logosX + logoBox * 0.48, mid - 22);
    ctx.lineTo(logosX + logoBox * 0.7, mid + 18);
    ctx.stroke();
    drawLogo(ctx, assets.opponents[index], logosX + logoBox * 1.18, mid - float, logoBox, 1, 1);

    const nameX = logosX + logoBox * 1.78;
    const nameMax = width - safe.side - nameX - 8;
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.min(type.finaleName, row * 0.18)}px Rajdhani, sans-serif`;
    wrapText(ctx, (match.opponent || "").toUpperCase(), nameMax, ctx.font, 2).forEach((line, lineIndex) => {
      ctx.fillText(line, nameX, mid - 6 + lineIndex * (type.finaleName * 0.84));
    });
    if (match.competition) {
      ctx.fillStyle = MUTED;
      ctx.font = `800 ${type.finaleComp}px Inter, sans-serif`;
      ctx.fillText(fitText(ctx, [match.competition, match.round].filter(Boolean).join(" · ").toUpperCase(), nameMax, ctx.font), nameX, mid + row * 0.24);
    }
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(safe.side, y + row - 4);
    ctx.lineTo(safe.side + 160, y + row - 4);
    ctx.stroke();
    ctx.restore();
  });

  ctx.save();
  ctx.globalAlpha = lockup;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.brand}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", width / 2, lockupY + 44);
  ctx.font = `700 ${type.matchday}px Rajdhani, sans-serif`;
  ctx.fillText("MATCHDAY", width / 2, lockupY + 44 + type.matchday * 0.86);
  ctx.restore();
  ctx.restore();
}

export function paintAgendaFrame(ctx, { timeline, time, assets, dayLabel }) {
  if (!ctx || !timeline) return;
  const phase = time < timeline.introEnd
    ? "intro"
    : time < timeline.finaleStart
      ? "match"
      : "finale";
  paintAmbient(ctx, timeline, time, assets, phase);
  if (time < timeline.introEnd + 0.42) {
    paintIntro(ctx, timeline, time, dayLabel, assets);
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
