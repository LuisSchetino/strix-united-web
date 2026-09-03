import { opponentInitials } from "./agenda-media-core.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";
import { GROUP_KICKER } from "./related-night-core.js";
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
const PITCH_A = "#14181e";
const PITCH_B = "#1b2027";
const RULE = "rgba(239,236,230,0.55)";

function fitText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1);
  return `${next}…`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arc(x + w - rad, y + rad, rad, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arc(x + w - rad, y + h - rad, rad, 0, Math.PI / 2);
  ctx.lineTo(x + rad, y + h);
  ctx.arc(x + rad, y + h - rad, rad, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + rad);
  ctx.arc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function coverPhoto(ctx, bitmap, dx, dy, dw, dh, focusY = 0.28) {
  const iw = bitmap.width;
  const ih = bitmap.height;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = Math.max(0, Math.min(ih - sh, ih * focusY - sh * 0.32));
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

function paintEnvironment(ctx, timeline, time, camera) {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.5);
  sky.addColorStop(0, "#0c0f14");
  sky.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.5);

  const parallax = (camera.x || 0) * 0.3 + Math.sin(time * 0.12) * 6;
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  for (const side of [-1, 1]) {
    const originX = width * (side < 0 ? -0.04 : 1.04) + parallax * side;
    for (let row = 0; row < 16; row += 1) {
      ctx.beginPath();
      ctx.moveTo(originX, height * 0.05 + row * 48);
      ctx.lineTo(width * 0.5 + side * 80, height * 0.44 + row * 8);
      ctx.stroke();
    }
  }
  ctx.restore();

  const beamPulse = 0.07 + Math.sin(time * 0.65) * 0.018;
  [[0.1, 0.02, 0.38], [0.9, 0.02, 0.62]].forEach(([sx, sy, ex], index) => {
    const beam = ctx.createLinearGradient(width * sx, height * sy, width * ex, height * 0.7);
    beam.addColorStop(0, `rgba(239,236,230,${beamPulse + index * 0.01})`);
    beam.addColorStop(1, "rgba(239,236,230,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(width * sx - 14, height * sy);
    ctx.lineTo(width * sx + 14, height * sy);
    ctx.lineTo(width * ex + 140, height * 0.76);
    ctx.lineTo(width * ex - 140, height * 0.76);
    ctx.closePath();
    ctx.fill();
  });

  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = INK;
  const grain = Math.floor(time * 42);
  for (let index = 0; index < 80; index += 1) {
    const seed = (index * 173 + grain * 19) % 9973;
    ctx.fillRect((seed + parallax * 3) % width, (seed * 23 + Math.floor(time * 14) * 11) % height, 1, 1);
  }
  ctx.restore();
}

function paintGoal(ctx, timeline, camera, vGoal) {
  const into = vGoal > 0.5 ? -0.022 : 0.022;
  const left = pt(0.5 - PITCH.goalHalfU, vGoal, timeline, camera);
  const right = pt(0.5 + PITCH.goalHalfU, vGoal, timeline, camera);
  const leftBack = pt(0.5 - PITCH.goalHalfU, vGoal + into, timeline, camera);
  const rightBack = pt(0.5 + PITCH.goalHalfU, vGoal + into, timeline, camera);
  const heightPx = (vGoal > 0.5 ? 78 : 44) * left.scale;
  const backH = heightPx * 0.82;
  ctx.strokeStyle = "rgba(239,236,230,0.34)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(leftBack.x, leftBack.y);
  ctx.lineTo(leftBack.x, leftBack.y - backH);
  ctx.lineTo(rightBack.x, rightBack.y - backH);
  ctx.lineTo(rightBack.x, rightBack.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
  ctx.globalAlpha *= 0.18;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y - heightPx);
  ctx.lineTo(leftBack.x, leftBack.y - backH);
  ctx.moveTo(right.x, right.y - heightPx);
  ctx.lineTo(rightBack.x, rightBack.y - backH);
  ctx.stroke();
  ctx.globalAlpha /= 0.18;
  ctx.strokeStyle = "rgba(239,236,230,0.88)";
  ctx.lineWidth = vGoal > 0.5 ? 3.4 : 2.3;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(left.x, left.y - heightPx);
  ctx.lineTo(right.x, right.y - heightPx);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
}

function paintField(ctx, timeline, camera, presence) {
  const { width } = timeline;
  const quad = fieldQuad(timeline, camera);
  const apron = uvLine(timeline, camera, [[-0.07, -0.035], [1.07, -0.035], [1.07, 1.045], [-0.07, 1.045]]);
  ctx.save();
  ctx.globalAlpha = presence;

  ctx.beginPath();
  ctx.moveTo(apron[0].x, apron[0].y);
  apron.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = "#0b0d11";
  ctx.fill();
  ctx.strokeStyle = "rgba(239,236,230,0.16)";
  ctx.lineWidth = 8;
  ctx.stroke();

  const shadow = ctx.createLinearGradient(width / 2, apron[0].y, width / 2, apron[3].y + 80);
  shadow.addColorStop(0, "rgba(0,0,0,0)");
  shadow.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = shadow;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  quad.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = PITCH_A;
  ctx.fill();
  ctx.save();
  ctx.clip();

  for (let band = 0; band < 10; band += 1) {
    const u0 = band / 10;
    const u1 = (band + 1) / 10;
    const poly = uvLine(timeline, camera, [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    poly.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = band % 2 === 0 ? PITCH_B : "rgba(0,0,0,0.16)";
    ctx.fill();
  }

  const light = ctx.createRadialGradient(width / 2, quad[2].y - 80, 30, width / 2, quad[0].y, width * 0.85);
  light.addColorStop(0, "rgba(239,236,230,0.08)");
  light.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, timeline.width, timeline.height);

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2.6;
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

  const farSpot = pt(0.5, PITCH.penaltySpot, timeline, camera);
  const nearSpot = pt(0.5, 1 - PITCH.penaltySpot, timeline, camera);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(farSpot.x, farSpot.y, 3.2 * farSpot.scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(nearSpot.x, nearSpot.y, 3.2 * nearSpot.scale, 0, Math.PI * 2);
  ctx.fill();
  const center = pt(0.5, 0.5, timeline, camera);
  ctx.beginPath();
  ctx.arc(center.x, center.y, 3.8 * center.scale, 0, Math.PI * 2);
  ctx.fill();

  strokePoly(ctx, uvLine(
    timeline,
    camera,
    ellipsePoints(0.5, PITCH.penaltySpot, PITCH.circleRu, PITCH.circleRv, 18, Math.PI * 0.18, Math.PI * 0.82),
  ));
  strokePoly(ctx, uvLine(
    timeline,
    camera,
    ellipsePoints(0.5, 1 - PITCH.penaltySpot, PITCH.circleRu, PITCH.circleRv, 18, Math.PI * 1.18, Math.PI * 1.82),
  ));
  const cornerU = 1 / 68;
  const cornerV = PITCH.cornerR;
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(0, 0, cornerU, cornerV, 8, 0, Math.PI / 2)));
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(1, 0, cornerU, cornerV, 8, Math.PI / 2, Math.PI)));
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(1, 1, cornerU, cornerV, 8, Math.PI, Math.PI * 1.5)));
  strokePoly(ctx, uvLine(timeline, camera, ellipsePoints(0, 1, cornerU, cornerV, 8, Math.PI * 1.5, Math.PI * 2)));
  ctx.restore();

  paintGoal(ctx, timeline, camera, 0);
  paintGoal(ctx, timeline, camera, 1);

  ctx.strokeStyle = "rgba(239,236,230,0.7)";
  ctx.lineWidth = 3;
  strokePoly(ctx, quad, true);
  ctx.restore();
}

function heroScreenBox(timeline, scene, assets) {
  if (scene?.type !== "player") return null;
  const { width, height, safe } = timeline;
  const story = timeline.format !== "feed";
  const player = scene.player;
  const asset = assets?.byId?.[player.id] || assets?.players?.[player.index];
  const hasPhoto = Boolean(asset?.bitmap);
  const onLeft = player.u >= 0.5;
  if (hasPhoto) {
    const heroW = story ? width * 0.4 : width * 0.32;
    const heroH = heroW * 1.58;
    const x = onLeft ? safe.side + heroW * 0.18 : width - safe.side - heroW * 0.18;
    const y = Math.min(height * 0.5, height - safe.bottom - heroH * 0.34 - 90);
    const plateW = Math.min(width * 0.48, 520);
    const plateH = story ? 108 : 88;
    const plateX = onLeft ? safe.side : width - safe.side - plateW;
    const plateY = Math.min(y + heroH * 0.46, height - safe.bottom - plateH - 8);
    return {
      left: Math.min(x - heroW * 0.5, plateX) - 12,
      right: Math.max(x + heroW * 0.5, plateX + plateW) + 12,
      top: y - heroH * 0.52,
      bottom: plateY + plateH + 8,
      featuredId: player.id,
    };
  }
  const cardW = story ? 340 : 290;
  const cardH = 150;
  const x = onLeft ? safe.side : width - safe.side - cardW;
  const y = Math.min(height - safe.bottom - cardH - 18, height * 0.64);
  return {
    left: x - 10,
    right: x + cardW + 10,
    top: y - 10,
    bottom: y + cardH + 10,
    featuredId: player.id,
  };
}

function markerHiddenByHero(point, box, player) {
  if (!box || player.id === box.featuredId) return false;
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function paintMarker(ctx, timeline, player, camera, alpha, featured, heroBox) {
  const point = projectFieldPoint(player.u, player.v, timeline, camera);
  if (markerHiddenByHero(point, heroBox, player)) return;
  const name = String(player.name || "").toUpperCase();
  const size = Math.round(20 + point.scale * 12);
  const maxW = 168 * (0.88 + point.scale * 0.28);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(239,236,230,0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  ctx.lineTo(point.x, point.y - 10 * point.scale);
  ctx.stroke();
  ctx.fillStyle = featured ? INK : "rgba(239,236,230,0.92)";
  ctx.beginPath();
  ctx.arc(point.x, point.y, featured ? 5.8 : 4.4, 0, Math.PI * 2);
  ctx.fill();
  if (featured) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  const labelY = point.y - 16 * point.scale;
  ctx.font = `800 ${size}px Inter, sans-serif`;
  const label = fitText(ctx, name, maxW, ctx.font);
  const pos = String(player.position || "");
  ctx.font = `800 ${Math.max(11, size - 8)}px Inter, sans-serif`;
  const posW = ctx.measureText(pos).width;
  ctx.font = `800 ${size}px Inter, sans-serif`;
  const nameW = ctx.measureText(label).width;
  const boxW = Math.max(nameW, posW) + 18;
  const boxH = size + 16;
  ctx.fillStyle = "rgba(5,6,7,0.62)";
  roundRectPath(ctx, point.x - boxW / 2, labelY - boxH + 6, boxW, boxH, 4);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `800 ${size}px Inter, sans-serif`;
  ctx.fillText(label, point.x, labelY - 4);
  ctx.fillStyle = featured ? INK : MUTED;
  ctx.font = `800 ${Math.max(11, size - 8)}px Inter, sans-serif`;
  ctx.fillText(pos, point.x, labelY + 12);
  ctx.restore();
}

function paintHero(ctx, timeline, scene, time, assets) {
  const { width, height, safe } = timeline;
  const story = timeline.format !== "feed";
  const local = time - scene.start;
  const enter = reveal(local, 0.02, 0.32, easeOutExpo);
  const exit = time > scene.end - 0.24 ? 1 - reveal(time, scene.end - 0.24, 0.24, easeInOutCubic) : 1;
  const presence = enter * exit;
  if (presence <= 0.01) return;

  const player = scene.player;
  const asset = assets?.byId?.[player.id] || assets?.players?.[player.index];
  const hasPhoto = Boolean(asset?.bitmap);
  const onLeft = player.u >= 0.5;
  const seq = String((scene.index || 0) + 1).padStart(2, "0");
  const slide = (1 - enter) * (onLeft ? -80 : 80);

  if (hasPhoto) {
    const heroW = story ? width * 0.4 : width * 0.32;
    const heroH = heroW * 1.58;
    const x = (onLeft ? safe.side + heroW * 0.18 : width - safe.side - heroW * 0.18) + slide;
    const y = Math.min(height * 0.5, height - safe.bottom - heroH * 0.34 - 90);
    ctx.save();
    ctx.globalAlpha = presence * 0.28;
    const veil = ctx.createLinearGradient(onLeft ? 0 : width * 0.58, 0, onLeft ? width * 0.46 : width, 0);
    veil.addColorStop(0, "rgba(5,6,7,0.55)");
    veil.addColorStop(1, "rgba(5,6,7,0)");
    ctx.fillStyle = veil;
    ctx.fillRect(onLeft ? 0 : width * 0.54, 0, width * 0.46, height);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = presence * 0.4;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(x, y + heroH * 0.42, heroW * 0.28, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.96 + presence * 0.04, 0.96 + presence * 0.04);
    ctx.beginPath();
    ctx.moveTo(-heroW * 0.48, heroH * 0.48);
    ctx.lineTo(-heroW * 0.48, -heroH * 0.18);
    ctx.quadraticCurveTo(-heroW * 0.46, -heroH * 0.5, 0, -heroH * 0.5);
    ctx.quadraticCurveTo(heroW * 0.46, -heroH * 0.5, heroW * 0.48, -heroH * 0.18);
    ctx.lineTo(heroW * 0.48, heroH * 0.48);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = presence;
    coverPhoto(ctx, asset.bitmap, -heroW / 2, -heroH / 2, heroW, heroH, 0.22);
    const fade = ctx.createLinearGradient(0, heroH * 0.08, 0, heroH / 2);
    fade.addColorStop(0, "rgba(5,6,7,0)");
    fade.addColorStop(0.55, "rgba(5,6,7,0.18)");
    fade.addColorStop(1, "rgba(5,6,7,0.92)");
    ctx.fillStyle = fade;
    ctx.fillRect(-heroW / 2, heroH * 0.02, heroW, heroH * 0.48);
    const rim = ctx.createLinearGradient(onLeft ? -heroW / 2 : heroW / 2, -heroH / 2, onLeft ? heroW / 4 : -heroW / 4, heroH / 4);
    rim.addColorStop(0, "rgba(239,236,230,0.28)");
    rim.addColorStop(1, "rgba(239,236,230,0)");
    ctx.fillStyle = rim;
    ctx.fillRect(-heroW / 2, -heroH / 2, heroW, heroH);
    ctx.restore();
    ctx.restore();
    paintLowerThird(ctx, timeline, player, seq, presence, onLeft, y + heroH * 0.46);
    return;
  }

  const cardW = story ? 340 : 290;
  const cardH = 150;
  const x = (onLeft ? safe.side : width - safe.side - cardW) + slide;
  const y = Math.min(height - safe.bottom - cardH - 18, height * 0.64);
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.fillStyle = "rgba(10,12,16,0.92)";
  roundRectPath(ctx, x, y, cardW, cardH, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(239,236,230,0.22)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = INK;
  roundRectPath(ctx, x, y, 6, cardH, 2);
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText(`${seq}  ·  ${player.position || "MEI"}`, x + 26, y + 38);
  ctx.fillStyle = INK;
  ctx.font = "800 48px Rajdhani, sans-serif";
  ctx.fillText(asset?.initials || opponentInitials(player.name), x + 26, y + 90);
  ctx.font = `700 ${story ? 38 : 32}px Rajdhani, sans-serif`;
  ctx.fillText(fitText(ctx, String(player.name || "").toUpperCase(), cardW - 52, ctx.font), x + 26, y + 130);
  ctx.restore();
}

function paintLowerThird(ctx, timeline, player, seq, presence, onLeft, plateY) {
  const { width, safe } = timeline;
  const story = timeline.format !== "feed";
  const plateW = Math.min(width * 0.48, 520);
  const plateH = story ? 108 : 88;
  const x = onLeft ? safe.side : width - safe.side - plateW;
  const y = Math.min(plateY, timeline.height - safe.bottom - plateH - 8);
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.fillStyle = "rgba(8,10,12,0.9)";
  roundRectPath(ctx, x, y, plateW, plateH, 8);
  ctx.fill();
  ctx.fillStyle = INK;
  roundRectPath(ctx, x, y, 7, plateH, 2);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = "800 22px Inter, sans-serif";
  ctx.fillText(`${seq}  ·  ${player.position || "MEI"}`, x + 26, y + 34);
  ctx.fillStyle = INK;
  ctx.font = `700 ${story ? 64 : 46}px Rajdhani, sans-serif`;
  ctx.fillText(fitText(ctx, String(player.name || "").toUpperCase(), plateW - 48, ctx.font), x + 26, y + 88);
  ctx.restore();
}

function paintSectorKicker(ctx, timeline, scene, time) {
  if (scene?.type !== "player" || !scene.groupLead) return;
  const local = time - scene.start;
  const enter = reveal(local, 0.04, 0.18, easeOutExpo);
  const hold = local < 0.95 ? 1 : 1 - reveal(local, 0.95, 0.22, easeInOutCubic);
  const presence = enter * hold;
  if (presence <= 0.02) return;
  const { width, safe } = timeline;
  const label = GROUP_KICKER[scene.player.group] || "RELACIONADOS";
  const count = `${String(scene.groupSize || 0).padStart(2, "0")} RELACIONADOS`;
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.translate(width / 2, safe.top + 68);
  ctx.fillStyle = "rgba(8,10,12,0.86)";
  roundRectPath(ctx, -230, -6, 460, 84, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(239,236,230,0.32)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "800 30px Inter, sans-serif";
  ctx.fillText(label, 0, 32);
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText(count, 0, 58);
  ctx.restore();
}

function paintIntro(ctx, timeline, time, dayLabel) {
  const { width, height, safe, players } = timeline;
  const fadeOut = time > timeline.introEnd - 0.4
    ? 1 - reveal(time, timeline.introEnd - 0.4, 0.4, easeInOutCubic)
    : 1;
  if (fadeOut <= 0.01) return;
  const title = reveal(time, 0.16, 0.4, easeOutExpo) * fadeOut;
  const meta = reveal(time, 0.58, 0.32, easeOutQuart) * fadeOut;
  const rise = (1 - fadeOut) * -80;
  const titleY = safe.top + 88;

  ctx.save();
  ctx.globalAlpha = fadeOut * 0.38;
  const scrim = ctx.createLinearGradient(0, 0, 0, height * 0.48);
  scrim.addColorStop(0, "rgba(5,6,7,0.58)");
  scrim.addColorStop(1, "rgba(5,6,7,0)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, width, height * 0.5);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = reveal(time, 0.04, 0.3, easeOutQuart) * fadeOut;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  const sweep = reveal(time, 0.05, 0.42, easeOutExpo);
  ctx.beginPath();
  ctx.moveTo(width * 0.14, safe.top + 28);
  ctx.lineTo(width * (0.14 + 0.72 * sweep), safe.top + 28);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(width / 2, titleY + 150 + rise);
  ctx.globalAlpha = title;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = "800 24px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", 0, -128);
  ctx.fillStyle = INK;
  ctx.font = "700 118px Rajdhani, sans-serif";
  ctx.save();
  ctx.beginPath();
  ctx.rect(-width * 0.5, -126, width * Math.max(title, 0.08), 270);
  ctx.clip();
  ctx.fillText("RELACIONADOS", 0, 0);
  ctx.fillText("DA NOITE", 0, 108);
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = meta;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "700 34px Inter, sans-serif";
  ctx.fillText(dayLabel, width / 2, titleY + 312 + rise);
  ctx.font = "800 42px Inter, sans-serif";
  ctx.fillText(`${players.length} RELACIONADOS`, width / 2, titleY + 368 + rise);
  ctx.restore();
}

function paintChrome(ctx, timeline, time, dayLabel) {
  if (time < timeline.introEnd - 0.18) return;
  const { width, safe, players } = timeline;
  const box = relatedNightSafeBox(timeline);
  const show = reveal(time, timeline.introEnd - 0.18, 0.26, easeOutQuart);
  const finale = time >= timeline.finaleStart;
  ctx.save();
  ctx.globalAlpha = show;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", box.left, safe.top + 28);
  ctx.textAlign = "right";
  ctx.fillText(dayLabel, box.right, safe.top + 28);
  if (finale) {
    const hold = reveal(time, timeline.finaleStart + 0.28, 0.42, easeOutQuart);
    ctx.globalAlpha = hold;
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = "700 48px Rajdhani, sans-serif";
    ctx.fillText("RELACIONADOS DA NOITE", width / 2, box.bottom - 48);
    ctx.fillStyle = MUTED;
    ctx.font = "800 24px Inter, sans-serif";
    ctx.fillText(`${players.length} RELACIONADOS`, width / 2, box.bottom - 14);
  }
  ctx.restore();
}

function paintVignette(ctx, timeline) {
  const { width, height } = timeline;
  const vignette = ctx.createRadialGradient(width / 2, height * 0.5, width * 0.24, width / 2, height * 0.5, width * 0.84);
  vignette.addColorStop(0, "rgba(5,6,7,0)");
  vignette.addColorStop(1, "rgba(5,6,7,0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

export function paintRelatedNightFrame(ctx, { timeline, time, assets, dayLabel }) {
  if (!ctx || !timeline) return;
  const camera = relatedNightCamera(timeline, time);
  const fieldIn = reveal(time, 0.08, 0.62, easeOutQuart);
  const scene = relatedNightSceneAt(timeline, time);
  const heroBox = scene?.type === "player" && time >= timeline.introEnd
    ? heroScreenBox(timeline, scene, assets)
    : null;
  paintEnvironment(ctx, timeline, time, camera);
  if (fieldIn > 0.01) {
    paintField(ctx, timeline, camera, fieldIn);
    for (const item of timeline.scenes) {
      if (item.type !== "player") continue;
      const appear = reveal(time, item.start + 0.18, 0.28, easeOutExpo);
      if (appear <= 0.01) continue;
      const featured = time >= item.start && time < item.end;
      paintMarker(ctx, timeline, item.player, camera, appear * fieldIn, featured, heroBox);
    }
  }
  if (time >= 0 && time < timeline.introEnd) {
    paintIntro(ctx, timeline, time, dayLabel);
  }
  if (scene?.type === "player" && time >= timeline.introEnd) {
    paintHero(ctx, timeline, scene, time, assets);
    paintSectorKicker(ctx, timeline, scene, time);
  }
  paintChrome(ctx, timeline, time, dayLabel);
  paintVignette(ctx, timeline);
}
