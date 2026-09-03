import { opponentInitials } from "./agenda-media-core.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";
import { GROUP_KICKER } from "./related-night-core.js";
import { fieldQuad, projectFieldPoint } from "./related-night-layout.js";
import { relatedNightSceneAt } from "./related-night-timeline.js";

const INK = "#efece6";
const MUTED = "#a3a8ae";
const VOID = "#050607";
const PITCH = "#14171b";
const PITCH_DEEP = "#0c0e11";
const RULE = "rgba(239,236,230,0.34)";

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function fitText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1);
  return `${next}…`;
}

function cameraFor(timeline, time) {
  const breathX = Math.sin(time * 0.55) * 7;
  const breathY = Math.sin(time * 0.37) * 4;
  const breathZ = 1 + Math.sin(time * 0.42) * 0.014;
  if (time < timeline.introEnd) {
    return { x: breathX, y: 10 + breathY, zoom: 1.03 * breathZ };
  }
  if (time >= timeline.finaleStart) {
    const open = reveal(time, timeline.finaleStart, 0.85, easeOutQuart);
    return { x: breathX * 0.55, y: breathY - 14 * open, zoom: (1.07 - open * 0.11) * breathZ };
  }
  const scene = relatedNightSceneAt(timeline, time);
  const player = scene?.type === "player" ? scene.player : null;
  const enter = player ? reveal(time - scene.start, 0, 0.3, easeOutExpo) : 0;
  return {
    x: breathX + (player ? (player.u - 0.5) * -52 * enter : 0),
    y: breathY + (player ? (0.5 - player.v) * 16 * enter : 0),
    zoom: (1.02 + enter * 0.045) * breathZ,
  };
}

function paintAmbient(ctx, timeline, time, assets) {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#e5dfd6";
  ctx.lineWidth = 1;
  const drift = (time * 16) % 90;
  for (let x = -180 + drift; x < width + 120; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.14, height);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.03 + Math.sin(time * 0.5) * 0.006;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(width * 0.46)}px Rajdhani, sans-serif`;
  ctx.fillText("STRIX", width * 0.5 + Math.sin(time * 0.18) * 12, height * 0.28);
  ctx.restore();

  if (assets?.strix) {
    ctx.save();
    ctx.globalAlpha = 0.016 + Math.sin(time * 0.45) * 0.004;
    drawPhoto(ctx, assets.strix, width * 0.88, height * 0.82, width * 0.62, 1);
    ctx.restore();
  }

  const sweepX = width * (((time * 0.09) % 1.3) - 0.2);
  const light = ctx.createLinearGradient(sweepX, 0, sweepX + 240, 0);
  light.addColorStop(0, "rgba(255,255,255,0)");
  light.addColorStop(0.5, "rgba(255,255,255,0.035)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = INK;
  const grain = Math.floor(time * 48);
  for (let index = 0; index < 140; index += 1) {
    const seed = (index * 131 + grain * 17) % 9973;
    ctx.fillRect(seed % width, (seed * 19) % height, 2, 2);
  }
  ctx.restore();
}

function drawPhoto(ctx, asset, x, y, box, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.beginPath();
  ctx.arc(x, y, box / 2, 0, Math.PI * 2);
  ctx.clip();
  if (asset?.bitmap) {
    const iw = asset.bitmap.width;
    const ih = asset.bitmap.height;
    const scale = Math.max(box / iw, box / ih);
    ctx.drawImage(asset.bitmap, x - (iw * scale) / 2, y - (ih * scale) / 2, iw * scale, ih * scale);
  } else {
    ctx.fillStyle = "#1a1e23";
    ctx.fillRect(x - box / 2, y - box / 2, box, box);
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(box * 0.32)}px Rajdhani, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(asset?.initials || opponentInitials(asset?.name), x, y + 2);
  }
  ctx.restore();
}

function paintField(ctx, timeline, time, camera, presence) {
  const { width } = timeline;
  const quad = fieldQuad(timeline, camera);
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  quad.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  const grass = ctx.createLinearGradient(width / 2, quad[0].y, width / 2, quad[2].y);
  grass.addColorStop(0, PITCH_DEEP);
  grass.addColorStop(0.55, PITCH);
  grass.addColorStop(1, "#1a1d22");
  ctx.fillStyle = grass;
  ctx.fill();
  ctx.clip();

  const glow = ctx.createRadialGradient(width / 2, quad[0].y + 40, 20, width / 2, quad[1].y, width * 0.7);
  glow.addColorStop(0, "rgba(239,236,230,0.07)");
  glow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, timeline.width, timeline.height);

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  const lines = [0.18, 0.5, 0.82];
  lines.forEach((v) => {
    const left = projectFieldPoint(0.08, v, timeline, camera);
    const right = projectFieldPoint(0.92, v, timeline, camera);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  });
  [[0.22, 0], [0.78, 0], [0.22, 1], [0.78, 1]].forEach(([u, v]) => {
    const a = projectFieldPoint(u, v === 0 ? 0 : 0.82, timeline, camera);
    const b = projectFieldPoint(u, v === 0 ? 0.18 : 1, timeline, camera);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  const center = projectFieldPoint(0.5, 0.5, timeline, camera);
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, 78 * center.scale, 36 * center.scale, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  quad.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function paintMarker(ctx, timeline, player, camera, assets, alpha, featured) {
  const point = projectFieldPoint(player.u, player.v, timeline, camera);
  const box = (featured ? 86 : 68) * point.scale;
  const asset = assets?.players?.[player.index] || assets?.byId?.[player.id];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(5,6,7,0.45)";
  ctx.beginPath();
  ctx.ellipse(point.x, point.y + box * 0.42, box * 0.38, box * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  drawPhoto(ctx, asset, point.x, point.y, box, 1);
  if (featured) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, box / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(18 + point.scale * 10)}px Inter, sans-serif`;
  const nameY = point.y + box * 0.72;
  ctx.fillText(fitText(ctx, String(player.name || "").toUpperCase(), 168, ctx.font), point.x, nameY);
  ctx.fillStyle = MUTED;
  ctx.font = `800 ${Math.round(13 + point.scale * 6)}px Inter, sans-serif`;
  ctx.fillText(player.position || "", point.x, nameY + 18);
  ctx.restore();
}

function paintIntro(ctx, timeline, time, dayLabel, assets) {
  const { width, height, safe, players } = timeline;
  const fadeOut = time > timeline.introEnd - 0.3
    ? 1 - reveal(time, timeline.introEnd - 0.3, 0.3, easeInOutCubic)
    : 1;
  const brand = reveal(time, 0.05, 0.36, easeOutExpo) * fadeOut;
  const title = reveal(time, 0.18, 0.5, easeOutQuart) * fadeOut;
  const date = reveal(time, 0.62, 0.36, easeOutQuart) * fadeOut;
  const count = reveal(time, 0.86, 0.32, easeOutQuart) * fadeOut;
  const x = width / 2;
  const y = safe.top + 28;

  ctx.save();
  ctx.globalAlpha = brand;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "800 32px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", x, y + 28);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 100 * brand, y + 50);
  ctx.lineTo(x + 100 * brand, y + 50);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "700 118px Rajdhani, sans-serif";
  const settle = 1.04 - title * 0.04;
  ctx.translate(x, y + 86 + 110);
  ctx.scale(settle, settle);
  ctx.beginPath();
  ctx.rect(-width * 0.5, -110, width * Math.max(title, 0.1), 250);
  ctx.clip();
  ctx.fillText("RELACIONADOS", 0, 0);
  ctx.fillText("DA NOITE", 0, 108);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = date;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "700 40px Inter, sans-serif";
  ctx.fillText(dayLabel, x, y + 430);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = count;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "800 48px Inter, sans-serif";
  ctx.fillText(`${players.length} RELACIONADOS`, x, y + 500);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = reveal(time, 0.4, 0.5, easeOutExpo) * fadeOut * 0.94;
  drawPhoto(ctx, assets?.strix, x, height - safe.bottom - 70, 220, 1);
  ctx.restore();
}

function paintHero(ctx, timeline, scene, time, assets) {
  const { width, height, safe } = timeline;
  const local = time - scene.start;
  const enter = reveal(local, 0.04, 0.28, easeOutExpo);
  const exit = time > scene.end - 0.22 ? 1 - reveal(time, scene.end - 0.22, 0.22, easeInOutCubic) : 1;
  const presence = enter * exit;
  if (presence <= 0.01) return;
  const player = scene.player;
  const asset = assets?.players?.[player.index] || assets?.byId?.[player.id];
  const x = timeline.format === "feed" ? 210 : 236;
  const y = height - safe.bottom - (timeline.format === "feed" ? 210 : 280);

  ctx.save();
  ctx.globalAlpha = presence * 0.55;
  const veil = ctx.createLinearGradient(0, y - 260, 0, height);
  veil.addColorStop(0, "rgba(5,6,7,0)");
  veil.addColorStop(1, "rgba(5,6,7,0.72)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, y - 280, width * 0.62, 560);
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.96 + presence * 0.04, 0.96 + presence * 0.04);
  drawPhoto(ctx, asset, 0, 0, timeline.format === "feed" ? 280 : 340, presence);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = presence;
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.font = "700 54px Rajdhani, sans-serif";
  ctx.fillText(fitText(ctx, String(player.name || "").toUpperCase(), 420, ctx.font), 72, y + (timeline.format === "feed" ? 168 : 206));
  ctx.fillStyle = MUTED;
  ctx.font = "800 26px Inter, sans-serif";
  ctx.fillText(player.position || "", 72, y + (timeline.format === "feed" ? 202 : 246));
  ctx.restore();
}

function paintChrome(ctx, timeline, time, dayLabel) {
  const { width, safe, players } = timeline;
  const scene = relatedNightSceneAt(timeline, time);
  const finale = time >= timeline.finaleStart;
  if (time < timeline.introEnd) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = "800 22px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", safe.side, safe.top - 36);
  ctx.textAlign = "right";
  ctx.fillText(dayLabel, width - safe.side, safe.top - 36);
  if (scene?.type === "player" && !finale) {
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = "800 28px Inter, sans-serif";
    ctx.fillText(GROUP_KICKER[scene.player.group] || "RELACIONADOS", width / 2, safe.top + 8);
  }
  if (finale) {
    const show = reveal(time, timeline.finaleStart + 0.35, 0.45, easeOutQuart);
    ctx.globalAlpha = show;
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillText("STRIX UNITED", width / 2, timeline.height - safe.bottom + 36);
    ctx.font = "700 42px Rajdhani, sans-serif";
    ctx.fillText("RELACIONADOS DA NOITE", width / 2, timeline.height - safe.bottom + 82);
    ctx.fillStyle = MUTED;
    ctx.font = "800 24px Inter, sans-serif";
    ctx.fillText(`${players.length} RELACIONADOS`, width / 2, timeline.height - safe.bottom + 118);
  }
  ctx.restore();
}

export function paintRelatedNightFrame(ctx, { timeline, time, assets, dayLabel }) {
  if (!ctx || !timeline) return;
  const camera = cameraFor(timeline, time);
  const fieldIn = time >= timeline.introEnd - 0.28
    ? reveal(time, timeline.introEnd - 0.28, 0.32, easeOutQuart)
    : 0;
  paintAmbient(ctx, timeline, time, assets);
  if (fieldIn > 0.01) {
    paintField(ctx, timeline, time, camera, fieldIn);
    for (const scene of timeline.scenes) {
      if (scene.type !== "player") continue;
      const appear = reveal(time, scene.start + 0.18, 0.28, easeOutExpo);
      if (appear <= 0.01) continue;
      const featured = time >= scene.start && time < scene.end;
      paintMarker(ctx, timeline, { ...scene.player, index: scene.index }, camera, assets, appear * fieldIn, featured);
    }
  }
  if (time >= 0 && time < timeline.introEnd) {
    paintIntro(ctx, timeline, time, dayLabel, assets);
  }
  const scene = relatedNightSceneAt(timeline, time);
  if (scene?.type === "player" && time >= timeline.introEnd) {
    paintHero(ctx, timeline, scene, time, assets);
  }
  paintChrome(ctx, timeline, time, dayLabel);
}
