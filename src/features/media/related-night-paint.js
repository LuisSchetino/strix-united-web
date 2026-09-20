import { opponentInitials } from "./agenda-media-core.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";
import { GROUP_KICKER } from "./related-night-core.js";
import {
  cameraHeroAmount,
  classifyHeroPhoto,
  heroPresence,
  heroStageBox,
  lowerThirdPresence,
} from "./related-night-hero.js";
import {
  PITCH,
  fieldQuad,
  projectFieldPoint,
  relatedNightCamera,
  relatedNightSafeBox,
} from "./related-night-layout.js";
import { relatedNightSceneAt } from "./related-night-timeline.js";

const INK = "#efece6";
const MUTED = "#a3a8ae";
const VOID = "#050607";
const PITCH_A = "#1d242c";
const PITCH_B = "#283039";
const RULE = "rgba(239,236,230,0.84)";
const METAL = "rgba(196,200,206,0.62)";

let heroLayer = null;

function fitText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1);
  return `${next}…`;
}

function coverPhoto(ctx, bitmap, dx, dy, dw, dh, focusY = 0.24) {
  const iw = bitmap.width;
  const ih = bitmap.height;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = Math.max(0, Math.min(ih - sh, ih * focusY - sh * 0.3));
  ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
}

function pt(u, v, timeline, camera) {
  return projectFieldPoint(u, v, timeline, camera);
}

function strokePoly(ctx, points, close = false) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  if (close) ctx.closePath();
  ctx.stroke();
}

function uvLine(timeline, camera, pairs) {
  return pairs.map(([u, v]) => pt(u, v, timeline, camera));
}

function ellipsePoints(cu, cv, ru, rv, samples, start = 0, end = Math.PI * 2) {
  const points = [];
  for (let index = 0; index <= samples; index += 1) {
    const a = start + ((end - start) * index) / samples;
    points.push([cu + ru * Math.cos(a), cv + rv * Math.sin(a)]);
  }
  return points;
}

function paintStadium(ctx, timeline, time, camera) {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.42);
  sky.addColorStop(0, "#0b0e13");
  sky.addColorStop(0.55, "#07090c");
  sky.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.5);

  const parallax = (camera.x || 0) * 0.22 + Math.sin(time * 0.1) * 5;
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#1a2028";
  for (let row = 0; row < 11; row += 1) {
    const y = height * 0.08 + row * 28;
    ctx.fillRect(-40 + parallax, y, width + 80, 10);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    const originX = width * (side < 0 ? -0.08 : 1.08) + parallax * side;
    for (let row = 0; row < 12; row += 1) {
      ctx.beginPath();
      ctx.moveTo(originX, height * 0.04 + row * 42);
      ctx.lineTo(width * 0.46 + side * 70, height * 0.4 + row * 10);
      ctx.stroke();
    }
  }
  ctx.restore();

  const pulse = 0.07 + Math.sin(time * 0.7) * 0.018;
  [[0.08, 0.04, 0.36], [0.92, 0.05, 0.62]].forEach(([sx, sy, ex], index) => {
    const beam = ctx.createLinearGradient(width * sx, height * sy, width * ex, height * 0.68);
    beam.addColorStop(0, `rgba(239,236,230,${pulse + index * 0.015})`);
    beam.addColorStop(1, "rgba(239,236,230,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(width * sx - 18, height * sy);
    ctx.lineTo(width * sx + 18, height * sy);
    ctx.lineTo(width * ex + 160, height * 0.74);
    ctx.lineTo(width * ex - 160, height * 0.74);
    ctx.closePath();
    ctx.fill();
  });

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (let mesh = 0; mesh < 8; mesh += 1) {
    ctx.beginPath();
    ctx.moveTo(-20, height * 0.18 + mesh * 70 + Math.sin(time * 0.2 + mesh) * 6);
    ctx.quadraticCurveTo(width * 0.18, height * 0.42 + mesh * 18, width * 0.28, height * 0.86);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = INK;
  const grain = Math.floor(time * 38);
  for (let index = 0; index < 90; index += 1) {
    const seed = (index * 173 + grain * 19) % 9973;
    ctx.fillRect((seed + parallax * 2) % width, (seed * 23) % height, 1, 1);
  }
  ctx.restore();
}

function paintGoal(ctx, timeline, camera, vGoal) {
  const into = vGoal > 0.5 ? -0.02 : 0.02;
  const left = pt(0.5 - PITCH.goalHalfU, vGoal, timeline, camera);
  const right = pt(0.5 + PITCH.goalHalfU, vGoal, timeline, camera);
  const leftBack = pt(0.5 - PITCH.goalHalfU, vGoal + into, timeline, camera);
  const rightBack = pt(0.5 + PITCH.goalHalfU, vGoal + into, timeline, camera);
  const heightPx = (vGoal > 0.5 ? 64 : 38) * left.scale;
  ctx.strokeStyle = "rgba(239,236,230,0.28)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(leftBack.x, leftBack.y);
  ctx.lineTo(leftBack.x, leftBack.y - heightPx * 0.8);
  ctx.lineTo(rightBack.x, rightBack.y - heightPx * 0.8);
  ctx.lineTo(rightBack.x, rightBack.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(239,236,230,0.9)";
  ctx.lineWidth = vGoal > 0.5 ? 3.2 : 2.1;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(left.x, left.y - heightPx);
  ctx.lineTo(right.x, right.y - heightPx);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
}

function paintSectorLight(ctx, timeline, camera, spotlight) {
  const amount = spotlight?.amount || 0;
  if (amount < 0.02) return;
  const v = { GOL: 0.88, DEF: 0.72, MEI: 0.46, ATA: 0.18 }[spotlight.group] ?? 0.5;
  const center = pt(0.5, v, timeline, camera);
  const radius = 240 * center.scale;
  const glow = ctx.createRadialGradient(center.x, center.y, 8, center.x, center.y, radius);
  glow.addColorStop(0, `rgba(239,236,230,${0.13 * amount})`);
  glow.addColorStop(0.55, `rgba(239,236,230,${0.05 * amount})`);
  glow.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, timeline.width, timeline.height);
}

function paintField(ctx, timeline, camera, presence, spotlight) {
  const { width } = timeline;
  const quad = fieldQuad(timeline, camera);
  const rim = uvLine(timeline, camera, [[-0.035, -0.02], [1.035, -0.02], [1.035, 1.028], [-0.035, 1.028]]);
  const drop = 18;
  ctx.save();
  ctx.globalAlpha = presence;

  ctx.beginPath();
  ctx.moveTo(rim[0].x + 8, rim[0].y + drop);
  rim.slice(1).forEach((point) => ctx.lineTo(point.x + 8, point.y + drop));
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(rim[0].x, rim[0].y);
  rim.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  const tray = ctx.createLinearGradient(rim[0].x, rim[0].y, rim[3].x, rim[3].y);
  tray.addColorStop(0, "#2a3038");
  tray.addColorStop(1, "#12151a");
  ctx.fillStyle = tray;
  ctx.fill();
  ctx.strokeStyle = METAL;
  ctx.lineWidth = 3.4;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  quad.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = PITCH_A;
  ctx.fill();
  ctx.save();
  ctx.clip();

  for (let band = 0; band < 10; band += 1) {
    const v0 = band / 10;
    const v1 = (band + 1) / 10;
    const poly = uvLine(timeline, camera, [[0, v0], [1, v0], [1, v1], [0, v1]]);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    poly.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = band % 2 === 0 ? PITCH_B : "rgba(0,0,0,0.16)";
    ctx.fill();
  }

  const light = ctx.createRadialGradient(width * 0.44, quad[2].y - 60, 20, width * 0.44, quad[0].y, width * 0.7);
  light.addColorStop(0, "rgba(239,236,230,0.1)");
  light.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, timeline.width, timeline.height);

  paintSectorLight(ctx, timeline, camera, spotlight);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2.9;
  strokePoly(ctx, uvLine(timeline, camera, [[0, 0], [1, 0], [1, 1], [0, 1]]), true);
  strokePoly(ctx, uvLine(timeline, camera, [[0, 0.5], [1, 0.5]]));

  const box = (depth, half) => [
    [0.5 - half, depth],
    [0.5 + half, depth],
    [0.5 + half, 0],
    [0.5 - half, 0],
  ];
  const nearBox = (depth, half) => [
    [0.5 - half, 1 - depth],
    [0.5 + half, 1 - depth],
    [0.5 + half, 1],
    [0.5 - half, 1],
  ];
  strokePoly(ctx, uvLine(timeline, camera, box(PITCH.penaltyDepth, PITCH.penaltyHalfU)), true);
  strokePoly(ctx, uvLine(timeline, camera, nearBox(PITCH.penaltyDepth, PITCH.penaltyHalfU)), true);
  strokePoly(ctx, uvLine(timeline, camera, box(PITCH.goalAreaDepth, PITCH.goalAreaHalfU)), true);
  strokePoly(ctx, uvLine(timeline, camera, nearBox(PITCH.goalAreaDepth, PITCH.goalAreaHalfU)), true);
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(0.5, 0.5, PITCH.circleRu, PITCH.circleRv, 48)));

  const spots = [
    pt(0.5, PITCH.penaltySpot, timeline, camera),
    pt(0.5, 1 - PITCH.penaltySpot, timeline, camera),
    pt(0.5, 0.5, timeline, camera),
  ];
  ctx.fillStyle = INK;
  spots.forEach((spot, index) => {
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, (index === 2 ? 3.6 : 3) * spot.scale, 0, Math.PI * 2);
    ctx.fill();
  });
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(0.5, PITCH.penaltySpot, PITCH.circleRu, PITCH.circleRv, 16, Math.PI * 0.18, Math.PI * 0.82)));
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(0.5, 1 - PITCH.penaltySpot, PITCH.circleRu, PITCH.circleRv, 16, Math.PI * 1.18, Math.PI * 1.82)));
  const cornerU = 1 / 68;
  const cornerV = PITCH.cornerR;
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(0, 0, cornerU, cornerV, 7, 0, Math.PI / 2)));
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(1, 0, cornerU, cornerV, 7, Math.PI / 2, Math.PI)));
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(1, 1, cornerU, cornerV, 7, Math.PI, Math.PI * 1.5)));
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(0, 1, cornerU, cornerV, 7, Math.PI * 1.5, Math.PI * 2)));
  ctx.restore();

  paintGoal(ctx, timeline, camera, 0);
  paintGoal(ctx, timeline, camera, 1);
  ctx.strokeStyle = "rgba(239,236,230,0.78)";
  ctx.lineWidth = 2.4;
  strokePoly(ctx, quad, true);
  ctx.restore();
}

function markerHiddenByHero(point, box, player) {
  if (!box || player.id === box.featuredId) return false;
  return point.x >= box.left + 18 && point.x <= box.right && point.y >= box.top && point.y <= box.plateY + 20;
}

function heroBuffer(width, height) {
  if (!heroLayer || heroLayer.width !== width || heroLayer.height !== height) {
    heroLayer = typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(width, height)
      : (typeof document !== "undefined" ? document.createElement("canvas") : null);
    if (heroLayer) {
      heroLayer.width = width;
      heroLayer.height = height;
    }
  }
  if (!heroLayer) return null;
  const ctx = heroLayer.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

function applyHeroMask(ctx, width, height, cutout) {
  const mask = ctx.createLinearGradient(0, 0, 0, height);
  mask.addColorStop(0, "rgba(0,0,0,0.08)");
  mask.addColorStop(0.07, "#000");
  mask.addColorStop(cutout ? 0.84 : 0.52, "#000");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, width, height);
  const side = ctx.createLinearGradient(0, 0, width, 0);
  side.addColorStop(0, "rgba(0,0,0,0)");
  side.addColorStop(0.12, "#000");
  side.addColorStop(0.88, "#000");
  side.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
}

function paintNormalizedPhoto(ctx, bitmap, width, height) {
  const info = classifyHeroPhoto(bitmap);
  const cutout = info.kind === "cutout";
  const layer = heroBuffer(width, height);
  if (!layer) {
    coverPhoto(ctx, bitmap, 0, 0, width, height, 0.2);
    return;
  }
  if (cutout) {
    layer.save();
    layer.filter = "blur(14px)";
    layer.globalAlpha = 0.42;
    coverPhoto(layer, bitmap, 10, 16, width, height, 0.2);
    layer.filter = "none";
    layer.globalAlpha = 1;
    coverPhoto(layer, bitmap, 0, 0, width, height, 0.2);
    layer.restore();
  } else {
    layer.fillStyle = VOID;
    layer.fillRect(0, 0, width, height);
    layer.save();
    layer.filter = info.strongBg ? "blur(22px)" : "blur(12px)";
    layer.globalAlpha = info.strongBg ? 0.28 : 0.4;
    coverPhoto(layer, bitmap, -width * 0.08, -height * 0.04, width * 1.16, height * 1.12, 0.28);
    layer.restore();
    layer.fillStyle = info.strongBg ? "rgba(5,6,7,0.58)" : "rgba(5,6,7,0.32)";
    layer.fillRect(0, 0, width, height);
    coverPhoto(layer, bitmap, 0, 0, width, height, 0.2);
    if (info.strongBg) {
      const wash = layer.createRadialGradient(width * 0.5, height * 0.28, 20, width * 0.5, height * 0.32, width * 0.62);
      wash.addColorStop(0, "rgba(5,6,7,0)");
      wash.addColorStop(1, "rgba(5,6,7,0.42)");
      layer.fillStyle = wash;
      layer.fillRect(0, 0, width, height);
    }
  }
  applyHeroMask(layer, width, height, cutout);
  ctx.drawImage(heroLayer, 0, 0);
}

function paintMarker(ctx, timeline, player, camera, alpha, featured, heroBox) {
  const point = projectFieldPoint(player.u, player.v, timeline, camera);
  if (markerHiddenByHero(point, heroBox, player)) return;
  const name = String(player.name || "").toUpperCase();
  const size = Math.max(28, Math.round(26 + point.scale * 15));
  const posSize = Math.max(13, Math.round(size * 0.52));
  const label = fitText(ctx, name, 210 * point.scale + 80, `800 ${size}px Inter, sans-serif`);
  const pos = String(player.position || "");
  const dot = 4.2 + point.scale * 2.4;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.88)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = featured ? INK : player.group === "GOL" ? "rgba(214,196,150,0.95)" : INK;
  ctx.beginPath();
  ctx.arc(point.x, point.y, featured ? dot + 1.4 : dot, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `800 ${size}px Inter, sans-serif`;
  ctx.fillText(label, point.x, point.y + size + 10);
  ctx.fillStyle = featured ? INK : MUTED;
  ctx.font = `800 ${posSize}px Inter, sans-serif`;
  ctx.fillText(pos, point.x, point.y + size + posSize + 16);
  ctx.restore();
}

function paintHero(ctx, timeline, scene, time, assets) {
  const presence = heroPresence(scene, time);
  if (presence <= 0.01) return;
  const { width, height } = timeline;
  const stage = heroStageBox(timeline);
  const player = scene.player;
  const asset = assets?.byId?.[player.id] || assets?.players?.[player.index];
  const hasPhoto = Boolean(asset?.bitmap);
  const seq = shirtLabel(player);
  const slide = (1 - presence) * 84;
  const x = stage.left + slide;
  const y = stage.portraitTop;

  ctx.save();
  ctx.globalAlpha = presence * 0.38;
  const veil = ctx.createLinearGradient(width * 0.58, 0, width, 0);
  veil.addColorStop(0, "rgba(5,6,7,0)");
  veil.addColorStop(1, "rgba(5,6,7,0.5)");
  ctx.fillStyle = veil;
  ctx.fillRect(width * 0.55, 0, width * 0.45, height);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = presence;
  ctx.translate(x, y);
  if (hasPhoto) {
    ctx.save();
    ctx.globalAlpha = presence * 0.4;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(stage.portraitW * 0.5, stage.portraitH * 0.92, stage.portraitW * 0.28, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paintNormalizedPhoto(ctx, asset.bitmap, stage.portraitW, stage.portraitH);
    const rim = ctx.createLinearGradient(0, 0, 18, 0);
    rim.addColorStop(0, "rgba(239,236,230,0.28)");
    rim.addColorStop(1, "rgba(239,236,230,0)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, 18, stage.portraitH * 0.78);
    const sweepX = ((time * 0.35) % 1.4) * stage.portraitW - 40;
    const sweep = ctx.createLinearGradient(sweepX, 0, sweepX + 70, 0);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.5, "rgba(255,255,255,0.07)");
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, stage.portraitW, stage.portraitH * 0.7);
  } else {
    const wash = ctx.createRadialGradient(stage.portraitW * 0.5, stage.portraitH * 0.38, 12, stage.portraitW * 0.5, stage.portraitH * 0.4, stage.portraitW * 0.58);
    wash.addColorStop(0, "rgba(42,48,56,0.55)");
    wash.addColorStop(1, "rgba(5,6,7,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, stage.portraitW, stage.portraitH);
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(stage.portraitW * 0.34)}px Rajdhani, sans-serif`;
    ctx.fillText(asset?.initials || opponentInitials(player.name), stage.portraitW * 0.5, stage.portraitH * 0.46);
  }
  ctx.restore();
  paintLowerThird(ctx, timeline, player, seq, lowerThirdPresence(scene, time), stage, slide);
}

function shirtLabel(player) {
  const raw = player?.number ?? player?.shirt_number;
  if (raw === "" || raw == null) return "";
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? String(numeric).padStart(2, "0") : String(raw);
}

function paintLowerThird(ctx, timeline, player, seq, presence, stage, slide = 0) {
  if (presence <= 0.01) return;
  const story = timeline.format !== "feed";
  const x = stage.left + 6 + slide;
  const y = stage.plateY;
  const name = fitText(ctx, String(player.name || "").toUpperCase(), stage.width - 12, `700 ${story ? 76 : 56}px Rajdhani, sans-serif`);
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillText(seq ? `${seq}  ·  ${player.position || "MEI"}` : (player.position || "MEI"), x, y + 22);
  ctx.strokeStyle = "rgba(239,236,230,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + 34);
  ctx.lineTo(x + Math.min(stage.width * 0.78, 320), y + 38);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `700 ${story ? 76 : 56}px Rajdhani, sans-serif`;
  ctx.fillText(name, x, y + 98);
  ctx.restore();
}

function paintSectorKicker(ctx, timeline, scene, time) {
  if (scene?.type !== "player" || !scene.groupLead) return;
  const local = time - scene.start;
  const enter = reveal(local, 0.04, 0.16, easeOutExpo);
  const hold = local < 0.9 ? 1 : 1 - reveal(local, 0.9, 0.2, easeInOutCubic);
  const presence = enter * hold;
  if (presence <= 0.02) return;
  const { safe } = timeline;
  const label = GROUP_KICKER[scene.player.group] || "RELACIONADOS";
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.translate(safe.side + 196, safe.top + 58);
  ctx.fillStyle = "rgba(8,10,12,0.88)";
  ctx.beginPath();
  ctx.moveTo(-210, 0);
  ctx.lineTo(210, 0);
  ctx.lineTo(196, 72);
  ctx.lineTo(-196, 72);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(239,236,230,0.28)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "800 28px Inter, sans-serif";
  ctx.fillText(label, 0, 34);
  ctx.fillStyle = MUTED;
  ctx.font = "800 16px Inter, sans-serif";
  ctx.fillText(`${String(scene.groupSize || 0).padStart(2, "0")} RELACIONADOS`, 0, 56);
  ctx.restore();
}

function paintIntro(ctx, timeline, time, dayLabel) {
  const { width, height, safe, players } = timeline;
  const fadeOut = time > timeline.introEnd - 0.38
    ? 1 - reveal(time, timeline.introEnd - 0.38, 0.38, easeInOutCubic)
    : 1;
  if (fadeOut <= 0.01) return;
  const title = reveal(time, 0.1, 0.42, easeOutExpo) * fadeOut;
  const meta = reveal(time, 0.48, 0.32, easeOutQuart) * fadeOut;
  const rise = (1 - fadeOut) * -70;

  ctx.save();
  ctx.globalAlpha = fadeOut * 0.42;
  const scrim = ctx.createLinearGradient(0, 0, 0, height * 0.52);
  scrim.addColorStop(0, "rgba(5,6,7,0.62)");
  scrim.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, width, height * 0.55);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = reveal(time, 0, 0.28, easeOutQuart) * fadeOut;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  const sweep = reveal(time, 0, 0.4, easeOutExpo);
  ctx.beginPath();
  ctx.moveTo(width * 0.16, safe.top + 36);
  ctx.lineTo(width * (0.16 + 0.68 * sweep), safe.top + 36);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(width / 2, safe.top + 220 + rise);
  ctx.globalAlpha = title;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = "800 22px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", 0, -118);
  ctx.fillStyle = INK;
  ctx.font = "700 108px Rajdhani, sans-serif";
  ctx.save();
  ctx.beginPath();
  ctx.rect(-width * 0.5, -116, width * Math.max(title, 0.08), 250);
  ctx.clip();
  ctx.fillText("RELACIONADOS", 0, 0);
  ctx.fillText("DA NOITE", 0, 100);
  const lightX = -320 + title * 680;
  const shine = ctx.createLinearGradient(lightX, 0, lightX + 180, 0);
  shine.addColorStop(0, "rgba(255,255,255,0)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.16)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(-360, -120, 720, 240);
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = meta;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "700 30px Inter, sans-serif";
  ctx.fillText(dayLabel, width / 2, safe.top + 470 + rise);
  ctx.font = "800 40px Inter, sans-serif";
  ctx.fillText(`${players.length} RELACIONADOS`, width / 2, safe.top + 522 + rise);
  ctx.restore();
}

function paintChrome(ctx, timeline, time, dayLabel) {
  if (time < timeline.introEnd - 0.16) return;
  const { width, safe, players } = timeline;
  const box = relatedNightSafeBox(timeline);
  const show = reveal(time, timeline.introEnd - 0.16, 0.24, easeOutQuart);
  ctx.save();
  ctx.globalAlpha = show;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", box.left, safe.top + 26);
  ctx.textAlign = "right";
  ctx.fillText(dayLabel, box.right, safe.top + 26);
  if (time >= timeline.finaleStart) {
    const hold = reveal(time, timeline.finaleStart + 0.24, 0.4, easeOutQuart);
    ctx.globalAlpha = hold;
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = "700 44px Rajdhani, sans-serif";
    ctx.fillText("RELACIONADOS DA NOITE", width / 2, box.bottom - 40);
    ctx.fillStyle = MUTED;
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillText(`${players.length} RELACIONADOS`, width / 2, box.bottom - 10);
  }
  ctx.restore();
}

function paintVignette(ctx, timeline) {
  const { width, height } = timeline;
  const vignette = ctx.createRadialGradient(width * 0.42, height * 0.5, width * 0.18, width / 2, height * 0.5, width * 0.9);
  vignette.addColorStop(0, "rgba(5,6,7,0)");
  vignette.addColorStop(1, "rgba(5,6,7,0.56)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

export function paintRelatedNightFrame(ctx, { timeline, time, assets, dayLabel }) {
  if (!ctx || !timeline) return;
  const scene = relatedNightSceneAt(timeline, time);
  const showingHero = scene?.type === "player" && time >= timeline.introEnd && time < timeline.finaleStart;
  const camera = relatedNightCamera(timeline, time, { hero: showingHero ? cameraHeroAmount(scene, time, timeline) : 0 });
  const fieldIn = reveal(time, 0.06, 0.58, easeOutQuart);
  const stage = showingHero ? { ...heroStageBox(timeline), featuredId: scene.player.id } : null;
  paintStadium(ctx, timeline, time, camera);
  if (fieldIn > 0.01) {
    paintField(ctx, timeline, camera, fieldIn, {
      group: scene?.player?.group,
      amount: showingHero ? heroPresence(scene, time) * fieldIn : 0,
    });
    for (const item of timeline.scenes) {
      if (item.type !== "player") continue;
      const appear = reveal(time, item.start + 0.16, 0.26, easeOutExpo);
      if (appear <= 0.01) continue;
      const featured = showingHero && item.player.id === scene.player.id;
      paintMarker(ctx, timeline, item.player, camera, appear * fieldIn, featured, stage);
    }
  }
  if (time >= 0 && time < timeline.introEnd) {
    paintIntro(ctx, timeline, time, dayLabel);
  }
  paintVignette(ctx, timeline);
  if (showingHero) {
    paintHero(ctx, timeline, scene, time, assets);
    paintSectorKicker(ctx, timeline, scene, time);
  }
  paintChrome(ctx, timeline, time, dayLabel);
}
