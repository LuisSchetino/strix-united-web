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
    title: story ? 178 : 120,
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

  const driftA = (time * (phase === "intro" ? 32 : 18)) % 140;
  const driftB = (time * (phase === "intro" ? -18 : -11)) % 180;
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

  if (phase === "intro" && timeline.matches?.length) {
    ctx.save();
    ctx.globalAlpha = 0.05 + breath * 0.012;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(width * 0.58)}px Rajdhani, sans-serif`;
    ctx.fillText(
      String(timeline.matches.length).padStart(2, "0"),
      width * 0.5 + Math.cos(time * 0.14) * 12,
      height * 0.8 + Math.sin(time * 0.18) * 8,
    );
    ctx.restore();
  }

  const owl = phase === "match"
    ? { x: width * 0.08, y: height * 0.9, box: width * 0.22, alpha: 0.01 }
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

function paintIntro(ctx, timeline, time, dayLabel) {
  const { width, height, safe, matches } = timeline;
  const type = typeScale(timeline.format);
  const fadeOut = time >= timeline.introEnd
    ? 1 - reveal(time, timeline.introEnd, 0.32, easeInOutCubic)
    : 1;
  const structure = reveal(time, 0, 0.28, easeOutExpo) * fadeOut;
  const brand = reveal(time, 0.08, 0.32, easeOutExpo) * fadeOut;
  const title = reveal(time, 0.14, 0.48, easeOutQuart) * fadeOut;
  const date = reveal(time, 0.62, 0.36, easeOutQuart) * fadeOut;
  const count = reveal(time, 0.82, 0.36, easeOutQuart) * fadeOut;
  const x = width / 2;
  const y = safe.top + (timeline.format === "feed" ? 4 : 10);
  const titleY = y + 92 + type.title * 0.78;
  const lineY = titleY + type.title * 1.12 + 28;
  const countY = lineY + 126;

  ctx.save();
  ctx.globalAlpha = structure;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  const bar = reveal(time, 0, 0.34, easeOutExpo);
  ctx.beginPath();
  ctx.moveTo(x - 220 * bar, y + 52);
  ctx.lineTo(x + 220 * bar, y + 52);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(safe.side, titleY - type.title * 0.72);
  ctx.lineTo(safe.side + 120 * bar, titleY - type.title * 0.72);
  ctx.moveTo(width - safe.side, titleY - type.title * 0.72);
  ctx.lineTo(width - safe.side - 120 * bar, titleY - type.title * 0.72);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = brand;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${type.eyebrow}px Inter, sans-serif`;
  ctx.fillText("STRIX UNITED", x, y + 28);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title * 0.2;
  const glow = ctx.createRadialGradient(x, titleY + type.title * 0.4, 12, x, titleY + type.title * 0.4, 380);
  glow.addColorStop(0, "rgba(239,236,230,0.32)");
  glow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 420, titleY - type.title, 840, type.title * 2.8);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${type.title}px Rajdhani, sans-serif`;
  const settle = 1.08 - title * 0.08;
  ctx.translate(x, titleY);
  ctx.scale(settle, settle);
  ctx.beginPath();
  ctx.rect(-width * 0.5, -type.title, width * Math.max(title, 0.08), type.title * 2.5);
  ctx.clip();
  ctx.fillText("AGENDA", 0, 0);
  ctx.fillText("DO DIA", 0, type.title * 0.96);
  const sweepX = -280 + title * 620;
  const sweep = ctx.createLinearGradient(sweepX, 0, sweepX + 220, 0);
  sweep.addColorStop(0, "rgba(255,255,255,0)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.18)");
  sweep.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(-300, -type.title, 600, type.title * 2.3);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = date;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 220 * date, lineY);
  ctx.lineTo(x + 220 * date, lineY);
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
  const countSize = timeline.format === "feed" ? 48 : 72;
  ctx.font = `800 ${countSize}px Inter, sans-serif`;
  const countLabel = String(matches.length).padStart(2, "0");
  ctx.fillText(`${countLabel} ${matches.length === 1 ? "JOGO" : "JOGOS"}`, x, countY);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = structure * 0.45;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  const floorY = Math.min(height - safe.bottom - 24, countY + 86);
  ctx.beginPath();
  ctx.moveTo(safe.side, floorY);
  ctx.lineTo(width - safe.side, floorY);
  ctx.stroke();
  ctx.restore();
}

export function matchStageWindow(timeline) {
  const scenes = (timeline?.scenes || []).filter((scene) => scene.type === "match");
  if (!scenes.length) return null;
  return { start: scenes[0].start, end: scenes[scenes.length - 1].end, scenes };
}

export function matchStagePresence(timeline, time) {
  const window = matchStageWindow(timeline);
  if (!window || time < window.start || time >= window.end) {
    return { persistent: 0, variable: 0, current: null, incoming: 0 };
  }
  const first = window.scenes[0];
  const last = window.scenes[window.scenes.length - 1];
  const enter = reveal(time, first.start, 0.34, easeOutExpo);
  const exit = time > last.end - 0.32
    ? 1 - reveal(time, last.end - 0.32, 0.32, easeInOutCubic)
    : 1;
  const current = window.scenes.find((scene) => time >= scene.start && time < scene.end) || last;
  const local = time - current.start;
  const incoming = current.index > 0 ? reveal(local, 0, 0.28, easeInOutCubic) : 1;
  return { persistent: enter * exit, variable: enter * exit, current, incoming };
}

function matchCardGeometry(timeline) {
  const { width, height, safe } = timeline;
  const type = typeScale(timeline.format);
  const centerY = safe.top + (height - safe.top - safe.bottom) * (timeline.format === "feed" ? 0.5 : 0.52);
  const box = type.logoMatch;
  const gap = timeline.format === "feed" ? 196 : 228;
  const logoY = centerY - 78;
  return {
    type,
    centerY,
    box,
    gap,
    logoY,
    leftX: width / 2 - gap,
    rightX: width / 2 + gap,
    nameY: logoY + box * 0.5 + 84,
    nameWidth: gap + 16,
    frameTop: centerY - (timeline.format === "feed" ? 230 : 290),
    frameH: timeline.format === "feed" ? 400 : 500,
  };
}

function paintMatchStagePersistent(ctx, timeline, time, assets) {
  const window = matchStageWindow(timeline);
  if (!window) return;
  const { persistent } = matchStagePresence(timeline, time);
  if (persistent <= 0) return;
  const { width, safe } = timeline;
  const geo = matchCardGeometry(timeline);
  const float = Math.sin(time * 0.7) * 3;

  ctx.save();
  ctx.globalAlpha = persistent;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(safe.side, safe.top + 62);
  ctx.lineTo(width - safe.side, safe.top + 62);
  ctx.stroke();

  ctx.strokeStyle = "rgba(239,236,230,0.38)";
  ctx.lineWidth = 2;
  const fl = 34;
  [
    [safe.side, geo.frameTop],
    [width - safe.side, geo.frameTop],
    [safe.side, geo.frameTop + geo.frameH],
    [width - safe.side, geo.frameTop + geo.frameH],
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

  drawLogo(ctx, assets.strix, geo.leftX, geo.logoY + float, geo.box, persistent, 1);

  ctx.save();
  ctx.globalAlpha = persistent;
  ctx.fillStyle = INK;
  ctx.font = `700 ${geo.type.vs}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("×", width / 2, geo.logoY + 12);
  ctx.font = `700 ${geo.type.team}px Rajdhani, sans-serif`;
  wrapText(ctx, "STRIX UNITED", geo.nameWidth, ctx.font, 2).forEach((line, index) => {
    ctx.fillText(line, geo.leftX, geo.nameY + index * (geo.type.team * 0.84));
  });
  ctx.restore();
}

function paintMatchVariableBlock(ctx, timeline, scene, time, assets, alpha, offsetX = 0) {
  if (!scene || alpha <= 0) return;
  const { width, safe, matches } = timeline;
  const geo = matchCardGeometry(timeline);
  const match = scene.match;
  const indexLabel = String(scene.index + 1).padStart(2, "0");
  const float = Math.sin(time * 0.7) * 3;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(offsetX, 0);

  ctx.fillStyle = INK;
  ctx.textAlign = "right";
  ctx.font = `800 ${geo.type.giantIndex}px Rajdhani, sans-serif`;
  ctx.globalAlpha = alpha * 0.07;
  ctx.fillText(indexLabel, width - 22, safe.top - 36);
  ctx.globalAlpha = alpha;
  ctx.textAlign = "left";
  ctx.font = `800 ${geo.type.gameIndex}px Inter, sans-serif`;
  ctx.fillText(matches.length > 1 ? `JOGO ${indexLabel}` : "CONFRONTO", safe.side, safe.top + 36);
  ctx.textAlign = "right";
  ctx.font = `800 ${geo.type.competition}px Inter, sans-serif`;
  ctx.fillText(fitText(ctx, (match.competition || "AGENDA").toUpperCase(), 480, ctx.font), width - safe.side, safe.top + 36);

  drawLogo(ctx, assets.opponents[scene.index], geo.rightX, geo.logoY + float, geo.box, 1, 1);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `700 ${geo.type.team}px Rajdhani, sans-serif`;
  wrapText(ctx, (match.opponent || "ADVERSÁRIO").toUpperCase(), geo.nameWidth, ctx.font, 2).forEach((line, index) => {
    ctx.fillText(line, geo.rightX, geo.nameY + index * (geo.type.team * 0.84));
  });
  ctx.font = `700 ${geo.type.kickoff}px Rajdhani, sans-serif`;
  ctx.fillText(match.kickoff || "", width / 2, geo.nameY + 128);
  const detail = [match.competition, match.round].filter(Boolean).join("  ·  ").toUpperCase();
  if (detail) {
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${geo.type.competition}px Inter, sans-serif`;
    ctx.fillText(fitText(ctx, detail, width - safe.side * 2, ctx.font), width / 2, geo.nameY + 178);
  }
  ctx.restore();
}

function paintMatchVariableContent(ctx, timeline, time, assets) {
  const { persistent, current, incoming } = matchStagePresence(timeline, time);
  if (!current || persistent <= 0) return;
  const window = matchStageWindow(timeline);
  const { width } = timeline;
  const prev = current.index > 0 ? window.scenes[current.index - 1] : null;
  if (prev && incoming < 1) {
    const wipe = (1 - incoming) * width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, wipe, timeline.height);
    ctx.clip();
    paintMatchVariableBlock(ctx, timeline, prev, time, assets, persistent, -40 * incoming);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(wipe, 0, width, timeline.height);
    ctx.clip();
    paintMatchVariableBlock(ctx, timeline, current, time, assets, persistent, 48 * (1 - incoming));
    ctx.restore();
    return;
  }
  paintMatchVariableBlock(ctx, timeline, current, time, assets, persistent, 0);
}

export function finaleDensity(count) {
  if (count <= 3) return "spacious";
  if (count <= 5) return "medium";
  if (count <= 6) return "compact";
  return "dense";
}

export function finaleRowLayout(timeline) {
  const { width, height, safe, matches } = timeline;
  const count = matches.length;
  const density = finaleDensity(count);
  const feed = timeline.format === "feed";
  const type = typeScale(timeline.format);
  const startY = safe.top + (density === "dense" ? 2 : feed ? 4 : 6);
  const header = density === "dense"
    ? (feed ? 86 : 100)
    : density === "compact"
      ? (feed ? 96 : 118)
      : density === "medium"
        ? (feed ? 108 : 132)
        : (feed ? 118 : 148);
  const endY = height - safe.bottom - (density === "dense" ? 2 : 6);
  const row = (endY - startY - header) / Math.max(count, 1);
  const logoScale = density === "spacious" ? 1.22 : density === "medium" ? 1.2 : density === "compact" ? 1.05 : 0.84;
  const logoBox = Math.min(
    type.logoFinale * logoScale,
    Math.max(48, row * (density === "spacious" ? 0.28 : density === "medium" ? 0.3 : density === "compact" ? 0.2 : 0.16)),
  );
  const minCompGap = density === "spacious" ? 30 : density === "medium" ? 26 : density === "compact" ? 20 : 18;
  const timeScale = density === "medium" || density === "spacious" ? 1.18 : 1;
  const timeH = Math.min(type.finaleTime * timeScale, row * (density === "dense" ? 0.2 : 0.32));
  const nameH = Math.min(type.finaleName * (density === "medium" ? 1.15 : 1), row * 0.14);
  const matchupH = Math.max(logoBox, nameH);
  const compH = Math.min(type.finaleComp * (density === "medium" ? 1.1 : 1), row * 0.13);
  const stack = timeH + 12 + matchupH + minCompGap + compH;
  const pad = Math.max(4, (row - stack) / 2);
  const usable = width - safe.side * 2;
  const span = usable * (density === "dense" ? 0.74 : density === "compact" ? 0.78 : 0.82);
  return {
    density,
    startY,
    header,
    endY,
    row,
    logoBox,
    minCompGap,
    timeH,
    matchupH,
    compH,
    pad,
    span,
    nameMax: Math.max(220, (span / 2) - logoBox - 36),
    decorative: density === "dense" ? 0.025 : density === "compact" ? 0.04 : 0.05,
    type,
  };
}

export function finaleRowZones(layout, index) {
  const y = layout.startY + layout.header + index * layout.row;
  const timeY = y + layout.pad + layout.timeH;
  const matchupMid = y + layout.pad + layout.timeH + 10 + layout.matchupH / 2;
  const matchupBottom = matchupMid + layout.matchupH / 2;
  const compY = matchupBottom + layout.minCompGap + layout.compH * 0.75;
  return { y, timeY, matchupMid, matchupBottom, compY };
}

function paintFinale(ctx, timeline, time, assets, dayLabel) {
  const { width, height, safe, matches, finaleStart } = timeline;
  const local = time - finaleStart;
  const enter = reveal(local, 0, 0.42, easeOutExpo);
  const close = reveal(time, timeline.duration - 0.9, 0.45, easeOutQuart);
  const layout = finaleRowLayout(timeline);
  const { type, startY, header, row, logoBox, decorative } = layout;

  ctx.save();
  ctx.globalAlpha = enter;
  ctx.beginPath();
  ctx.rect(0, (1 - enter) * 80, width, timeline.height);
  ctx.clip();
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = `800 ${type.finaleKicker}px Inter, sans-serif`;
  ctx.fillText("AGENDA COMPLETA", safe.side, startY + 22);
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.min(type.finaleTitle, header * 0.62)}px Rajdhani, sans-serif`;
  ctx.fillText("AGENDA", safe.side, startY + 22 + Math.min(type.finaleTitle, header * 0.62) * 0.88);
  ctx.textAlign = "right";
  ctx.font = `700 ${type.finaleDate}px Inter, sans-serif`;
  ctx.fillText(dayLabel, width - safe.side, startY + 22 + Math.min(type.finaleTitle, header * 0.62) * 0.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(safe.side, startY + header - 18);
  ctx.lineTo(safe.side + 160, startY + header - 18);
  ctx.stroke();

  matches.forEach((match, index) => {
    const stagger = reveal(local, 0.12 + index * 0.08, 0.42, easeOutQuart);
    const zones = finaleRowZones(layout, index);
    ctx.save();
    ctx.globalAlpha = stagger * decorative;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = `800 ${Math.round(Math.min(row * 0.42, layout.density === "dense" ? 72 : 110))}px Rajdhani, sans-serif`;
    ctx.fillText(String(index + 1).padStart(2, "0"), safe.side - 8, zones.y + row * 0.82);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = stagger;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = `700 ${layout.timeH}px Rajdhani, sans-serif`;
    ctx.fillText(match.kickoff || "", width / 2, zones.timeY);

    const float = Math.sin(time * 0.7 + index) * 2;
    const leftX = width / 2 - layout.span * 0.12;
    const rightX = width / 2 + layout.span * 0.12;
    const nameSize = Math.min(type.finaleName * (layout.density === "medium" ? 1.12 : 1), layout.matchupH * 0.46);
    ctx.textAlign = "right";
    ctx.font = `700 ${nameSize}px Rajdhani, sans-serif`;
    ctx.fillText(fitText(ctx, "STRIX UNITED", layout.nameMax, ctx.font), leftX - logoBox * 0.72, zones.matchupMid + 8);
    drawLogo(ctx, assets.strix, leftX, zones.matchupMid + float, logoBox, 1, 1);
    ctx.textAlign = "center";
    ctx.font = `700 ${type.vs}px Rajdhani, sans-serif`;
    ctx.fillText("×", width / 2, zones.matchupMid + 10);
    drawLogo(ctx, assets.opponents[index], rightX, zones.matchupMid - float, logoBox, 1, 1);
    ctx.textAlign = "left";
    ctx.font = `700 ${nameSize}px Rajdhani, sans-serif`;
    ctx.fillText(fitText(ctx, (match.opponent || "").toUpperCase(), layout.nameMax, ctx.font), rightX + logoBox * 0.72, zones.matchupMid + 8);
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${layout.compH}px Inter, sans-serif`;
    ctx.fillText(
      fitText(ctx, [match.competition, match.round].filter(Boolean).join(" · ").toUpperCase() || "AGENDA", 720, ctx.font),
      width / 2,
      zones.compY,
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
  if (time >= 0 && time < timeline.introEnd + 0.34) {
    paintIntro(ctx, timeline, time, dayLabel);
  }
  if (time >= timeline.introEnd && time < timeline.finaleStart) {
    paintMatchStagePersistent(ctx, timeline, time, assets);
    paintMatchVariableContent(ctx, timeline, time, assets);
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
