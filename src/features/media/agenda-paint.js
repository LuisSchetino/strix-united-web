import { opponentInitials } from "./agenda-media-core.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";

const INK = "#efece6";
const MUTED = "#a3a8ae";
const VOID = "#050607";
const RULE = "rgba(239,236,230,0.28)";

export function typeScale(format) {
  const story = format !== "feed";
  return {
    eyebrow: story ? 32 : 24,
    title: story ? 148 : 100,
    date: story ? 44 : 32,
    gameIndex: story ? 38 : 28,
    giantIndex: story ? 340 : 240,
    team: story ? 42 : 32,
    kickoff: story ? 132 : 92,
    competition: story ? 34 : 26,
    vs: story ? 28 : 22,
    finaleKicker: story ? 26 : 20,
    finaleTitle: story ? 86 : 60,
    finaleDate: story ? 32 : 24,
    finaleTime: story ? 78 : 56,
    finaleName: story ? 36 : 26,
    finaleComp: story ? 24 : 18,
    matchday: story ? 108 : 72,
    brand: story ? 32 : 24,
    logoMatch: story ? 300 : 220,
    logoFinale: story ? 78 : 58,
    logoIntro: story ? 248 : 176,
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

function paintSceneSweep(ctx, timeline, time) {
  const edges = [
    timeline.introEnd,
    ...timeline.scenes.filter((scene) => scene.type === "match").map((scene) => scene.start),
    timeline.finaleStart,
    timeline.lockupStart,
  ];
  const edge = edges.find((value) => time >= value && time < value + 0.42);
  if (edge == null) return;
  const progress = reveal(time, edge, 0.42, easeInOutCubic);
  const { width, height } = timeline;
  const x = width * (progress * 1.15 - 0.08);
  const sweep = ctx.createLinearGradient(x, 0, x + 180, 0);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.09)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, width, height);
}

function paintIntro(ctx, timeline, time, dayLabel, assets) {
  const { width, height, safe, matches } = timeline;
  const type = typeScale(timeline.format);
  const fadeOut = time > timeline.introEnd ? 1 - reveal(time, timeline.introEnd, 0.42, easeInOutCubic) : 1;
  const frame = reveal(time, 0.04, 0.55, easeOutExpo) * fadeOut;
  const brand = reveal(time, 0.14, 0.55, easeOutExpo) * fadeOut;
  const title = reveal(time, 0.32, 0.82, easeOutQuart) * fadeOut;
  const date = reveal(time, 1.05, 0.55, easeOutQuart) * fadeOut;
  const mark = reveal(time, 0.7, 0.75, easeOutExpo) * fadeOut;
  const x = width / 2;
  const y = safe.top + (timeline.format === "feed" ? 8 : 12);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width * Math.max(title, 0.12), height);
  ctx.clip();
  ctx.globalAlpha = brand;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.eyebrow}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", x, y + 36);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = frame;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(safe.side, y + 62);
  ctx.lineTo(safe.side + (width - safe.side * 2) * brand, y + 62);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.title}px Rajdhani, sans-serif`;
  ctx.translate((1 - title) * -40, 0);
  ctx.beginPath();
  ctx.rect(0, y + 80, width * Math.max(title, 0.1), type.title * 2.2);
  ctx.clip();
  ctx.fillText("AGENDA", x, y + 80 + type.title * 0.94);
  ctx.fillText("DO DIA", x, y + 80 + type.title * 1.9);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = date;
  const lineY = y + 108 + type.title * 2.05;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 160 * date, lineY);
  ctx.lineTo(x + 160 * date, lineY);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.date}px Inter, sans-serif`;
  ctx.fillText(dayLabel, x, lineY + 64);
  ctx.fillStyle = MUTED;
  ctx.font = `800 ${type.eyebrow}px Inter, sans-serif`;
  ctx.fillText(`${matches.length} ${matches.length === 1 ? "JOGO" : "JOGOS"}`, x, lineY + 116);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = mark * 0.96;
  const logoY = Math.min(height - safe.bottom - 40, lineY + (timeline.format === "feed" ? 200 : 280));
  drawLogo(ctx, assets?.strix, x, logoY, type.logoIntro, mark, 1.08 - mark * 0.08);
  ctx.restore();
}

function paintMatch(ctx, timeline, scene, time, assets) {
  const { width, height, safe, matches } = timeline;
  const type = typeScale(timeline.format);
  const local = time - scene.start;
  const enter = reveal(local, 0, 0.42, easeOutExpo);
  const logos = reveal(local, 0.08, 0.42, easeOutExpo);
  const meta = reveal(local, 0.16, 0.42, easeOutQuart);
  const exit = time > scene.end - 0.38 ? 1 - reveal(time, scene.end - 0.38, 0.38, easeInOutCubic) : 1;
  const match = scene.match;
  const indexLabel = String(scene.index + 1).padStart(2, "0");
  const centerY = safe.top + (height - safe.top - safe.bottom) * (timeline.format === "feed" ? 0.52 : 0.54);
  const box = type.logoMatch;
  const gap = timeline.format === "feed" ? 196 : 228;
  const presence = enter * exit;
  const wipe = (1 - enter) * width;

  ctx.save();
  ctx.globalAlpha = presence * 0.11;
  ctx.fillStyle = INK;
  ctx.textAlign = "right";
  ctx.font = `800 ${type.giantIndex}px Rajdhani, sans-serif`;
  ctx.fillText(indexLabel, width - 18 + (1 - enter) * 40, safe.top + type.giantIndex * 0.62);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = presence;
  ctx.beginPath();
  ctx.rect(wipe * 0.42, 0, width, height);
  ctx.clip();

  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.font = `800 ${type.gameIndex}px Inter, sans-serif`;
  ctx.fillText(matches.length > 1 ? `JOGO ${indexLabel}` : "CONFRONTO", safe.side, safe.top + 36);
  ctx.textAlign = "right";
  ctx.font = `800 ${type.competition}px Inter, sans-serif`;
  ctx.fillText(fitText(ctx, (match.competition || "AGENDA").toUpperCase(), 520, ctx.font), width - safe.side, safe.top + 36);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(safe.side, safe.top + 62);
  ctx.lineTo(width - safe.side, safe.top + 62);
  ctx.stroke();

  const frameTop = centerY - (timeline.format === "feed" ? 240 : 300);
  const frameH = timeline.format === "feed" ? 420 : 520;
  ctx.save();
  ctx.strokeStyle = "rgba(239,236,230,0.4)";
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

  const float = Math.sin(time * 0.85) * 4;
  const logoY = centerY - 70;
  drawLogo(ctx, assets.strix, width / 2 - gap - (1 - logos) * 48, logoY + float, box, logos, 1.06 - logos * 0.06);
  drawLogo(ctx, assets.opponents[scene.index], width / 2 + gap + (1 - logos) * 48, logoY - float, box, logos, 1.06 - logos * 0.06);

  ctx.save();
  ctx.globalAlpha = logos;
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.vs}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("×", width / 2, logoY + 10);
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.team}px Rajdhani, sans-serif`;
  const nameWidth = gap + 20;
  const nameY = logoY + box * 0.5 + 58;
  wrapText(ctx, "STRIX UNITED", nameWidth, ctx.font, 2).forEach((line, index) => {
    ctx.fillText(line, width / 2 - gap, nameY + index * (type.team * 0.84));
  });
  wrapText(ctx, (match.opponent || "ADVERSÁRIO").toUpperCase(), nameWidth, `700 ${type.team}px Rajdhani, sans-serif`, 2).forEach((line, index) => {
    ctx.fillText(line, width / 2 + gap, nameY + index * (type.team * 0.84));
  });

  ctx.save();
  ctx.globalAlpha = meta;
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.kickoff}px Rajdhani, sans-serif`;
  ctx.fillText(match.kickoff || "", width / 2, nameY + 118);
  const detail = [match.competition, match.round].filter(Boolean).join("  ·  ").toUpperCase();
  if (detail) {
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${type.competition}px Inter, sans-serif`;
    ctx.fillText(fitText(ctx, detail, width - safe.side * 2, ctx.font), width / 2, nameY + 168);
  }
  ctx.restore();
  ctx.restore();
}

function finaleGeometry(timeline) {
  const { height, safe, matches } = timeline;
  const feed = timeline.format === "feed";
  const startY = safe.top + (feed ? 4 : 8);
  const header = feed ? 118 : 148;
  const endY = height - safe.bottom - 8;
  const row = (endY - startY - header) / Math.max(matches.length, 1);
  return { startY, header, endY, row };
}

function paintFinale(ctx, timeline, time, assets, dayLabel) {
  const { width, safe, matches, finaleStart, lockupStart } = timeline;
  const type = typeScale(timeline.format);
  const local = time - finaleStart;
  const enter = reveal(local, 0, 0.55, easeOutExpo);
  const fadeOut = time >= lockupStart ? 1 - reveal(time, lockupStart, 0.42, easeInOutCubic) : 1;
  const presence = enter * fadeOut;
  const { startY, header, row } = finaleGeometry(timeline);
  const logoBox = Math.min(type.logoFinale, Math.max(48, row * 0.28));

  ctx.save();
  ctx.globalAlpha = presence;
  ctx.beginPath();
  ctx.rect(0, (1 - enter) * 80, width, timeline.height);
  ctx.clip();
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = `800 ${type.finaleKicker}px Inter, sans-serif`;
  ctx.fillText("AGENDA COMPLETA", safe.side, startY + 24);
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.finaleTitle}px Rajdhani, sans-serif`;
  ctx.fillText("AGENDA", safe.side, startY + 24 + type.finaleTitle * 0.9);
  ctx.textAlign = "right";
  ctx.font = `700 ${type.finaleDate}px Inter, sans-serif`;
  ctx.fillText(dayLabel, width - safe.side, startY + 24 + type.finaleTitle * 0.52);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(safe.side, startY + header - 20);
  ctx.lineTo(safe.side + 180, startY + header - 20);
  ctx.stroke();

  matches.forEach((match, index) => {
    const stagger = reveal(local, 0.12 + index * 0.1, 0.42, easeOutQuart);
    const y = startY + header + index * row;
    const mid = y + row * 0.5;
    ctx.save();
    ctx.globalAlpha = stagger * 0.055;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = `800 ${Math.round(Math.min(row * 0.55, 120))}px Rajdhani, sans-serif`;
    ctx.fillText(String(index + 1).padStart(2, "0"), safe.side - 8, y + row * 0.78);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = stagger;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = `700 ${Math.min(type.finaleTime, row * 0.28)}px Rajdhani, sans-serif`;
    ctx.fillText(match.kickoff || "", width / 2, mid - row * 0.22);

    const float = Math.sin(time * 0.7 + index) * 2;
    const leftX = width / 2 - 118;
    const rightX = width / 2 + 118;
    ctx.textAlign = "right";
    ctx.font = `700 ${Math.min(type.finaleName, row * 0.14)}px Rajdhani, sans-serif`;
    ctx.fillText(fitText(ctx, "STRIX UNITED", 230, ctx.font), leftX - logoBox * 0.72, mid + 8);
    drawLogo(ctx, assets.strix, leftX, mid + 8 + float, logoBox, 1, 1);
    ctx.textAlign = "center";
    ctx.font = `700 ${type.vs}px Rajdhani, sans-serif`;
    ctx.fillText("×", width / 2, mid + 14);
    drawLogo(ctx, assets.opponents[index], rightX, mid + 8 - float, logoBox, 1, 1);
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.min(type.finaleName, row * 0.14)}px Rajdhani, sans-serif`;
    ctx.fillText(fitText(ctx, (match.opponent || "").toUpperCase(), 230, ctx.font), rightX + logoBox * 0.72, mid + 8);
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${type.finaleComp}px Inter, sans-serif`;
    ctx.fillText(
      fitText(ctx, [match.competition, match.round].filter(Boolean).join(" · ").toUpperCase() || "AGENDA", 640, ctx.font),
      width / 2,
      mid + row * 0.28,
    );
    ctx.restore();
  });
  ctx.restore();
}

function paintLockup(ctx, timeline, time, assets) {
  const { width, height, safe } = timeline;
  const type = typeScale(timeline.format);
  const enter = reveal(time, timeline.lockupStart, 0.55, easeOutExpo);
  const x = width / 2;
  const y = safe.top + (height - safe.top - safe.bottom) * 0.42;

  ctx.save();
  ctx.globalAlpha = enter;
  ctx.beginPath();
  ctx.rect(0, y - 280, width * Math.max(enter, 0.08), 620);
  ctx.clip();
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.brand}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", x, y - 160);
  drawLogo(ctx, assets?.strix, x, y - 20, type.logoIntro * 0.82, enter, 1.06 - enter * 0.06);
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.matchday}px Rajdhani, sans-serif`;
  ctx.fillText("MATCHDAY", x, y + 180);
  ctx.restore();
}

export function paintAgendaFrame(ctx, { timeline, time, assets, dayLabel }) {
  if (!ctx || !timeline) return;
  const phase = time < timeline.introEnd
    ? "intro"
    : time < timeline.finaleStart
      ? "match"
      : time < timeline.lockupStart
        ? "finale"
        : "lockup";
  paintAmbient(ctx, timeline, time, assets, phase);
  paintSceneSweep(ctx, timeline, time);
  if (time < timeline.introEnd + 0.42) {
    paintIntro(ctx, timeline, time, dayLabel, assets);
  }
  for (const scene of timeline.scenes) {
    if (scene.type !== "match") continue;
    if (time < scene.start - 0.04 || time > scene.end + 0.06) continue;
    paintMatch(ctx, timeline, scene, time, assets);
  }
  if (time >= timeline.finaleStart - 0.06 && time < timeline.lockupStart + 0.42) {
    paintFinale(ctx, timeline, time, assets, dayLabel);
  }
  if (time >= timeline.lockupStart - 0.04) {
    paintLockup(ctx, timeline, time, assets);
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
