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
    countHero: story ? 52 : 36,
    giantIndex: story ? 188 : 136,
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
    brand: story ? 28 : 22,
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
  ctx.globalAlpha = (phase === "intro" ? 0.04 : 0.028) + breath * 0.006;
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * (phase === "intro" ? 0.48 : 0.42))}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  const wordY = phase === "intro" ? height * 0.4 : phase === "finale" ? height * 0.22 : height * 0.18;
  ctx.fillText("STRIX", width * 0.5 + Math.sin(time * 0.16) * 14, wordY);
  ctx.restore();

  const owl = phase === "match"
    ? { x: width * 0.1, y: height * 0.86, box: width * 0.46, alpha: 0.014 }
    : phase === "finale"
      ? { x: width * 0.94, y: height * 0.92, box: width * 0.36, alpha: 0.012 }
      : { x: width * 0.86, y: height * 0.78, box: width * 0.7, alpha: 0.018 };
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
  ].filter((value) => value > 0 && value < timeline.duration);
  const edge = edges.find((value) => time >= value && time < value + 0.36);
  if (edge == null) return;
  const progress = reveal(time, edge, 0.36, easeInOutCubic);
  const { width, height } = timeline;
  const x = width * (progress * 1.12 - 0.06);
  const sweep = ctx.createLinearGradient(x, 0, x + 170, 0);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.07)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, width, height);
}

function paintIntro(ctx, timeline, time, dayLabel, assets) {
  const { width, height, safe, matches } = timeline;
  const type = typeScale(timeline.format);
  const fadeOut = time > timeline.introEnd - 0.32
    ? 1 - reveal(time, timeline.introEnd - 0.32, 0.32, easeInOutCubic)
    : 1;
  const brand = reveal(time, 0.06, 0.42, easeOutExpo) * fadeOut;
  const title = reveal(time, 0.2, 0.64, easeOutQuart) * fadeOut;
  const date = reveal(time, 0.78, 0.46, easeOutQuart) * fadeOut;
  const count = reveal(time, 1.02, 0.4, easeOutQuart) * fadeOut;
  const mark = reveal(time, 0.48, 0.72, easeOutExpo) * fadeOut;
  const x = width / 2;
  const y = safe.top + (timeline.format === "feed" ? 12 : 24);
  const titleY = y + 78 + type.title * 0.94;
  const lineY = titleY + type.title * 1.08 + 36;
  const countY = lineY + 132;
  const logoFloor = height - safe.bottom - (timeline.format === "feed" ? 56 : 72);
  const logoY = Math.min(logoFloor, (countY + 90 + logoFloor) / 2);

  ctx.save();
  ctx.globalAlpha = brand;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.eyebrow}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", x, y + 28);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 110 * brand, y + 52);
  ctx.lineTo(x + 110 * brand, y + 52);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title * 0.22;
  const glow = ctx.createRadialGradient(x, titleY + type.title * 0.4, 12, x, titleY + type.title * 0.4, 320);
  glow.addColorStop(0, "rgba(239,236,230,0.34)");
  glow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 360, titleY - type.title, 720, type.title * 2.6);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.title}px Rajdhani, sans-serif`;
  const settle = 1.045 - title * 0.045;
  ctx.translate(x, titleY);
  ctx.scale(settle, settle);
  ctx.beginPath();
  ctx.rect(-width * 0.5, -type.title, width * Math.max(title, 0.1), type.title * 2.4);
  ctx.clip();
  ctx.fillText("AGENDA", 0, 0);
  ctx.fillText("DO DIA", 0, type.title * 0.96);
  const sweepX = -220 + title * 520;
  const sweep = ctx.createLinearGradient(sweepX, 0, sweepX + 180, 0);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.16)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(-260, -type.title, 520, type.title * 2.2);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = date;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 186 * date, lineY);
  ctx.lineTo(x + 186 * date, lineY);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.date}px Inter, sans-serif`;
  ctx.fillText(dayLabel, x, lineY + 64);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = count;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.countHero}px Inter, sans-serif`;
  ctx.fillText(`${matches.length} ${matches.length === 1 ? "JOGO" : "JOGOS"}`, x, countY);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = mark * 0.96;
  drawLogo(ctx, assets?.strix, x, logoY, type.logoIntro, mark, 1.07 - mark * 0.07);
  ctx.restore();
}

function paintMatch(ctx, timeline, scene, time, assets) {
  const { width, height, safe, matches } = timeline;
  const type = typeScale(timeline.format);
  const local = time - scene.start;
  const enter = reveal(local, 0, 0.34, easeOutExpo);
  const logos = reveal(local, 0.06, 0.34, easeOutExpo);
  const meta = reveal(local, 0.12, 0.34, easeOutQuart);
  const exit = time > scene.end - 0.28 ? 1 - reveal(time, scene.end - 0.28, 0.28, easeInOutCubic) : 1;
  const match = scene.match;
  const indexLabel = String(scene.index + 1).padStart(2, "0");
  const centerY = safe.top + (height - safe.top - safe.bottom) * (timeline.format === "feed" ? 0.5 : 0.52);
  const box = type.logoMatch;
  const gap = timeline.format === "feed" ? 196 : 228;
  const presence = enter * exit;
  const wipe = (1 - enter) * width;

  ctx.save();
  ctx.globalAlpha = presence * 0.07;
  ctx.fillStyle = INK;
  ctx.textAlign = "right";
  ctx.font = `800 ${type.giantIndex}px Rajdhani, sans-serif`;
  ctx.fillText(indexLabel, width - 22, safe.top - 36);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = presence;
  ctx.beginPath();
  ctx.rect(wipe * 0.38, 0, width, height);
  ctx.clip();

  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.font = `800 ${type.gameIndex}px Inter, sans-serif`;
  ctx.fillText(matches.length > 1 ? `JOGO ${indexLabel}` : "CONFRONTO", safe.side, safe.top + 36);
  ctx.textAlign = "right";
  ctx.font = `800 ${type.competition}px Inter, sans-serif`;
  ctx.fillText(fitText(ctx, (match.competition || "AGENDA").toUpperCase(), 480, ctx.font), width - safe.side, safe.top + 36);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(safe.side, safe.top + 62);
  ctx.lineTo(width - safe.side, safe.top + 62);
  ctx.stroke();

  const frameTop = centerY - (timeline.format === "feed" ? 230 : 290);
  const frameH = timeline.format === "feed" ? 400 : 500;
  ctx.save();
  ctx.strokeStyle = "rgba(239,236,230,0.38)";
  ctx.lineWidth = 2;
  const fl = 34;
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

  const float = Math.sin(time * 0.7) * 3;
  const logoY = centerY - 78;
  const leftX = width / 2 - gap;
  const rightX = width / 2 + gap;
  drawLogo(ctx, assets.strix, leftX, logoY + float, box, logos, 1);
  drawLogo(ctx, assets.opponents[scene.index], rightX, logoY + float, box, logos, 1);

  ctx.save();
  ctx.globalAlpha = logos;
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.vs}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("×", width / 2, logoY + 12);
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.team}px Rajdhani, sans-serif`;
  const nameWidth = gap + 16;
  const nameY = logoY + box * 0.5 + 84;
  wrapText(ctx, "STRIX UNITED", nameWidth, ctx.font, 2).forEach((line, index) => {
    ctx.fillText(line, leftX, nameY + index * (type.team * 0.84));
  });
  wrapText(ctx, (match.opponent || "ADVERSÁRIO").toUpperCase(), nameWidth, `700 ${type.team}px Rajdhani, sans-serif`, 2).forEach((line, index) => {
    ctx.fillText(line, rightX, nameY + index * (type.team * 0.84));
  });

  ctx.save();
  ctx.globalAlpha = meta;
  ctx.fillStyle = INK;
  ctx.font = `700 ${type.kickoff}px Rajdhani, sans-serif`;
  ctx.fillText(match.kickoff || "", width / 2, nameY + 128);
  const detail = [match.competition, match.round].filter(Boolean).join("  ·  ").toUpperCase();
  if (detail) {
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${type.competition}px Inter, sans-serif`;
    ctx.fillText(fitText(ctx, detail, width - safe.side * 2, ctx.font), width / 2, nameY + 178);
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
  const { width, height, safe, matches, finaleStart } = timeline;
  const type = typeScale(timeline.format);
  const local = time - finaleStart;
  const enter = reveal(local, 0, 0.42, easeOutExpo);
  const close = reveal(time, timeline.duration - 0.9, 0.45, easeOutQuart);
  const presence = enter;
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
    ctx.fillText(fitText(ctx, "STRIX UNITED", 280, ctx.font), leftX - logoBox * 0.72, mid + 8);
    drawLogo(ctx, assets.strix, leftX, mid + 8 + float, logoBox, 1, 1);
    ctx.textAlign = "center";
    ctx.font = `700 ${type.vs}px Rajdhani, sans-serif`;
    ctx.fillText("×", width / 2, mid + 14);
    drawLogo(ctx, assets.opponents[index], rightX, mid + 8 - float, logoBox, 1, 1);
    ctx.textAlign = "left";
    ctx.font = `700 ${Math.min(type.finaleName, row * 0.14)}px Rajdhani, sans-serif`;
    ctx.fillText(fitText(ctx, (match.opponent || "").toUpperCase(), 280, ctx.font), rightX + logoBox * 0.72, mid + 8);
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

  ctx.save();
  ctx.globalAlpha = close * 0.9;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.brand}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED  ·  AGENDA DO DIA", width / 2, height - safe.bottom + 52);
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
  paintSceneSweep(ctx, timeline, time);
  if (time >= 0 && time < timeline.introEnd) {
    paintIntro(ctx, timeline, time, dayLabel, assets);
  }
  for (const scene of timeline.scenes) {
    if (scene.type !== "match") continue;
    if (time < scene.start || time >= scene.end) continue;
    paintMatch(ctx, timeline, scene, time, assets);
  }
  if (time >= timeline.finaleStart) {
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
