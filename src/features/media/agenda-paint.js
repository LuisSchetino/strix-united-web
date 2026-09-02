import { opponentInitials } from "./agenda-media-core.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, remap, reveal } from "./agenda-timeline.js";

const INK = "#efece6";
const MUTED = "#8d9298";
const GRAPHITE = "#111419";
const VOID = "#050607";

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

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawLogo(ctx, asset, x, y, size, progress = 1, scale = 1) {
  const ready = clamp(progress);
  if (ready <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = ready;
  const half = size / 2;
  ctx.beginPath();
  ctx.arc(0, 0, half, 0, Math.PI * 2);
  ctx.fillStyle = GRAPHITE;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (asset?.bitmap) {
    const image = asset.bitmap;
    const ratio = Math.min(size / image.width, size / image.height);
    const drawW = image.width * ratio;
    const drawH = image.height * ratio;
    ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(size * 0.28)}px Rajdhani, Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(asset?.initials || opponentInitials(asset?.name), 0, 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, half - 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(239,236,230,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function paintBackground(ctx, timeline, time) {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  const drift = (time * 18) % 160;
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#d9d4cc";
  ctx.lineWidth = 1;
  for (let x = -160 + drift; x < width + 80; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.22, height);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = time < 1.6 ? 0.045 : 0.02;
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * 0.28)}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("STRIX", width * 0.5, height * 0.42 + Math.sin(time * 0.35) * 10);
  ctx.restore();

  const glow = ctx.createRadialGradient(width * 0.5, height * 0.18, 20, width * 0.5, height * 0.22, width * 0.62);
  glow.addColorStop(0, "rgba(255,255,255,0.05)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function paintIntro(ctx, timeline, time, dayLabel) {
  const { width, safe } = timeline;
  const brand = reveal(time, 0.18, 0.5, easeOutExpo);
  const title = reveal(time, 0.48, 0.48, easeOutQuart);
  const date = reveal(time, 0.72, 0.38, easeOutQuart);
  const x = width / 2;
  const y = safe.top + 86;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y - 40, width * brand, 90);
  ctx.clip();
  ctx.globalAlpha = brand;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "800 28px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", x, y);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "700 92px Rajdhani, sans-serif";
  ctx.translate(0, (1 - title) * 28);
  ctx.beginPath();
  ctx.rect(safe.side, y + 18, width - safe.side * 2, 120);
  ctx.clip();
  ctx.fillText("AGENDA DO DIA", x, y + 108);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = date;
  ctx.strokeStyle = "rgba(239,236,230,0.35)";
  ctx.lineWidth = 2;
  const lineW = 86 * date;
  ctx.beginPath();
  ctx.moveTo(x - lineW, y + 138);
  ctx.lineTo(x + lineW, y + 138);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = "700 22px Inter, sans-serif";
  ctx.fillText(dayLabel, x, y + 176);
  ctx.restore();
}

function paintMatch(ctx, timeline, scene, time, assets) {
  const { width, height, safe, matches } = timeline;
  const local = time - scene.start;
  const enter = reveal(local, 0.05, 0.55, easeOutExpo);
  const logos = reveal(local, 0.12, 0.5, easeOutExpo);
  const meta = reveal(local, 0.42, 0.4, easeOutQuart);
  const match = scene.match;
  const contentTop = safe.top + (timeline.format === "feed" ? 210 : 320);
  const centerY = contentTop + (height - safe.top - safe.bottom - (timeline.format === "feed" ? 210 : 320)) * 0.42;
  const logoSize = timeline.format === "feed" ? 196 : 228;
  const gap = 168;
  const wipe = width * enter;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, centerY - 280, wipe, 620);
  ctx.clip();

  ctx.globalAlpha = enter;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = "800 16px Inter, sans-serif";
  ctx.fillText(matches.length > 1 ? `JOGO ${String(scene.index + 1).padStart(2, "0")}` : "CONFRONTO", width / 2, centerY - 236);

  drawLogo(
    ctx,
    assets.strix,
    width / 2 - gap,
    centerY - 40,
    logoSize,
    logos,
    1.1 - logos * 0.1,
  );
  drawLogo(
    ctx,
    assets.opponents[scene.index],
    width / 2 + gap,
    centerY - 40,
    logoSize,
    logos,
    1.1 - logos * 0.1,
  );

  ctx.save();
  ctx.globalAlpha = logos;
  ctx.strokeStyle = "rgba(239,236,230,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2, centerY - 88);
  ctx.lineTo(width / 2, centerY + 8);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = "800 20px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VS", width / 2, centerY - 32);
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "700 34px Rajdhani, sans-serif";
  ctx.fillText("STRIX UNITED", width / 2 - gap, centerY + 122);
  const opponentLines = wrapText(ctx, (match.opponent || "ADVERSÁRIO").toUpperCase(), 380, "700 34px Rajdhani, sans-serif", 2);
  opponentLines.forEach((line, index) => {
    ctx.fillText(line, width / 2 + gap, centerY + 118 + index * 30);
  });

  ctx.save();
  ctx.globalAlpha = meta;
  ctx.fillStyle = INK;
  ctx.font = "700 92px Rajdhani, sans-serif";
  ctx.fillText(match.kickoff || "", width / 2, centerY + 230);
  const detail = [match.competition, match.round].filter(Boolean).join("  ·  ").toUpperCase();
  if (detail) {
    ctx.fillStyle = MUTED;
    ctx.font = "700 20px Inter, sans-serif";
    ctx.fillText(fitText(ctx, detail, width - safe.side * 2, ctx.font), width / 2, centerY + 278);
  }
  ctx.restore();
  ctx.restore();
}

function paintFinale(ctx, timeline, time, assets, dayLabel) {
  const { width, height, safe, matches, finaleStart } = timeline;
  const local = time - finaleStart;
  const enter = reveal(local, 0, 0.7, easeOutExpo);
  const lockup = reveal(local, 1.15, 0.45, easeOutQuart);
  const compact = matches.length >= 5;
  const row = compact ? 86 : matches.length === 1 ? 118 : 98;
  const blockH = matches.length * row;
  const startY = Math.max(safe.top + 210, (height - safe.bottom + safe.top) / 2 - blockH / 2 - 20);

  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = "800 16px Inter, sans-serif";
  ctx.fillText("AGENDA COMPLETA", width / 2, startY - 52);
  ctx.fillStyle = INK;
  ctx.font = "700 28px Rajdhani, sans-serif";
  ctx.fillText(dayLabel, width / 2, startY - 18);

  matches.forEach((match, index) => {
    const stagger = reveal(local, 0.08 + index * 0.08, 0.42, easeOutQuart);
    const y = startY + index * row + (1 - stagger) * 24;
    ctx.save();
    ctx.globalAlpha = stagger;
    roundedRect(ctx, safe.side, y, width - safe.side * 2, row - 12, 8);
    ctx.fillStyle = "rgba(17,20,25,0.72)";
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = "700 36px Rajdhani, sans-serif";
    ctx.fillText(match.kickoff || "", safe.side + 28, y + row * 0.58);
    drawLogo(ctx, assets.strix, safe.side + 186, y + (row - 12) / 2, compact ? 42 : 52, 1, 1);
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.font = "800 14px Inter, sans-serif";
    ctx.fillText("VS", safe.side + 236, y + row * 0.58);
    drawLogo(ctx, assets.opponents[index], safe.side + 286, y + (row - 12) / 2, compact ? 42 : 52, 1, 1);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = compact ? "700 24px Rajdhani, sans-serif" : "700 28px Rajdhani, sans-serif";
    const name = fitText(ctx, (match.opponent || "").toUpperCase(), width - safe.side * 2 - 360, ctx.font);
    ctx.fillText(name, safe.side + 328, y + row * 0.5);
    if (match.competition && !compact) {
      ctx.fillStyle = MUTED;
      ctx.font = "700 13px Inter, sans-serif";
      ctx.fillText(fitText(ctx, match.competition.toUpperCase(), width - safe.side * 2 - 360, ctx.font), safe.side + 328, y + row * 0.72);
    }
    ctx.restore();
  });

  ctx.save();
  ctx.globalAlpha = lockup;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", width / 2, height - safe.bottom + 36);
  ctx.font = "700 42px Rajdhani, sans-serif";
  ctx.fillText("MATCHDAY", width / 2, height - safe.bottom + 84);
  ctx.restore();
  ctx.restore();
}

export function paintAgendaFrame(ctx, { timeline, time, assets, dayLabel }) {
  if (!ctx || !timeline) return;
  paintBackground(ctx, timeline, time);
  const intro = reveal(time, 0, 1.5, easeInOutCubic);
  if (intro > 0 && time < timeline.finaleStart + 0.35) {
    paintIntro(ctx, timeline, time, dayLabel);
  }
  for (const scene of timeline.scenes) {
    if (scene.type !== "match") continue;
    if (time < scene.start - 0.05 || time > scene.end + 0.12) continue;
    paintMatch(ctx, timeline, scene, time, assets);
  }
  if (time >= timeline.finaleStart - 0.05) {
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
