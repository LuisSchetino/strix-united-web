import { opponentInitials } from "./agenda-media-core.js";
import { logoDrawRect } from "./agenda-paint.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";
import { announceSceneAt } from "./announce-timeline.js";

const INK = "#efece6";
const MUTED = "#a3a8ae";
const VOID = "#050607";
const RULE = "rgba(239,236,230,0.38)";

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

function coverPhoto(ctx, bitmap, dx, dy, dw, dh, focusY = 0.22) {
  const iw = bitmap.width;
  const ih = bitmap.height;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = Math.max(0, Math.min(ih - sh, ih * focusY - sh * 0.28));
  ctx.drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
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

function paintAmbient(ctx, timeline, time) {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (let index = 0; index < 12; index += 1) {
    const x = width * (0.1 + index * 0.075) + Math.sin(time * 0.16 + index) * 5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 36, height);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * 0.46)}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("STRIX", width * 0.52 + Math.sin(time * 0.12) * 8, height * 0.42);
  ctx.restore();

  const sweep = ((time * 0.1) % 1.4) - 0.22;
  const light = ctx.createLinearGradient(width * sweep, 0, width * sweep + 220, 0);
  light.addColorStop(0, "rgba(239,236,230,0)");
  light.addColorStop(0.5, "rgba(239,236,230,0.045)");
  light.addColorStop(1, "rgba(239,236,230,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = INK;
  const grain = Math.floor(time * 28);
  for (let index = 0; index < 70; index += 1) {
    const seed = (index * 173 + grain * 17) % 9973;
    ctx.fillRect(seed % width, (seed * 23) % height, 1, 1);
  }
  ctx.restore();
}

function paintCorners(ctx, timeline, alpha = 1) {
  const { width, height, safe } = timeline;
  const inset = Math.max(28, safe.side - 24);
  const arm = 28;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1.5;
  [[inset, inset, 1, 1], [width - inset, inset, -1, 1], [inset, height - inset, 1, -1], [width - inset, height - inset, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + arm * sy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + arm * sx, y);
    ctx.stroke();
  });
  ctx.restore();
}

function paintChrome(ctx, timeline, time, { kicker = "STRIX UNITED", season = "FC 27", alpha = 1 } = {}) {
  const { width, safe } = timeline;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = MUTED;
  ctx.font = "800 20px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(kicker, safe.side, safe.top - 8);
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.fillText(season, width - safe.side, safe.top - 8);
  ctx.fillStyle = RULE;
  ctx.fillRect(safe.side, safe.top + 8, width - safe.side * 2, 1);
  ctx.restore();
  paintCorners(ctx, timeline, alpha * 0.9);
}

function paintInitialsPlate(ctx, person, x, y, w, h) {
  ctx.fillStyle = "#12151a";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(239,236,230,0.08)";
  ctx.fillRect(x, y, 6, h);
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.22)}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(person?.initials || opponentInitials(person?.name), x + w / 2, y + h / 2);
}

function paintPortrait(ctx, bitmap, person, box, { scale = 1, alpha = 1, radius = 8 } = {}) {
  const { x, y, w, h } = box;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  roundRectPath(ctx, 0, 0, w, h, radius);
  ctx.clip();
  if (bitmap) coverPhoto(ctx, bitmap, 0, 0, w, h);
  else paintInitialsPlate(ctx, person, 0, 0, w, h);
  const veil = ctx.createLinearGradient(0, h * 0.45, 0, h);
  veil.addColorStop(0, "rgba(5,6,7,0)");
  veil.addColorStop(1, "rgba(5,6,7,0.55)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function displayName(person) {
  return String(person?.nick || person?.name || "").toUpperCase();
}

function paintBadge(ctx, person, x, y, alpha = 1) {
  const badge = person?.extraBadge || "";
  if (!badge) return 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "800 18px Inter, sans-serif";
  const width = ctx.measureText(badge).width + 22;
  roundRectPath(ctx, x, y - 16, width, 28, 3);
  ctx.fillStyle = "rgba(239,236,230,0.08)";
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badge, x + 11, y - 2);
  ctx.restore();
  return width;
}

function paintIndividual(ctx, timeline, time, assets) {
  const { width, height, safe, person, phrase, still, format } = timeline;
  const story = format !== "feed";
  const local = still ? 2.4 : time;
  const photoIn = still ? 1 : reveal(local, 0.12, 0.72, easeOutQuart);
  const nameIn = still ? 1 : reveal(local, 0.38, 0.7, easeOutExpo);
  const phraseIn = still ? 1 : reveal(local, 0.9, 0.55, easeOutExpo);
  const chromeIn = still ? 1 : reveal(local, 0.04, 0.4, easeOutExpo);
  const close = still ? 1 : time >= timeline.finaleStart
    ? 1 - reveal(time, timeline.finaleStart, 0.9, easeInOutCubic) * 0.15
    : 1;
  const ken = still ? 1 : 1 + Math.min(0.045, time * 0.004);
  const asset = assets?.byId?.[person?.id] || assets?.players?.[0];

  paintAmbient(ctx, timeline, time);
  paintChrome(ctx, timeline, time, { alpha: chromeIn * close, season: timeline.season });

  if (story) {
    const photoW = width * 0.62;
    const photoH = height - safe.top - 80;
    const photoX = width - photoW + 40;
    const photoY = safe.top + 36;
    ctx.save();
    ctx.globalAlpha = photoIn * close;
    ctx.translate(photoX + photoW / 2, photoY + photoH / 2);
    ctx.scale(0.94 + photoIn * 0.06 * ken, 0.94 + photoIn * 0.06 * ken);
    ctx.translate(-photoW / 2, -photoH / 2);
    if (asset?.bitmap) coverPhoto(ctx, asset.bitmap, 0, 0, photoW, photoH);
    else paintInitialsPlate(ctx, person, 0, 0, photoW, photoH);
    ctx.restore();
    const fade = ctx.createLinearGradient(width * 0.18, 0, width * 0.78, 0);
    fade.addColorStop(0, VOID);
    fade.addColorStop(0.42, "rgba(5,6,7,0.88)");
    fade.addColorStop(1, "rgba(5,6,7,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, height);
    const bottom = ctx.createLinearGradient(0, height * 0.62, 0, height);
    bottom.addColorStop(0, "rgba(5,6,7,0)");
    bottom.addColorStop(1, "rgba(5,6,7,0.82)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = nameIn * close;
    ctx.translate(0, (1 - nameIn) * 28);
    ctx.fillStyle = MUTED;
    ctx.font = "800 22px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(person?.position || "MC", safe.side, safe.top + 86);
    paintBadge(ctx, person, safe.side + 86, safe.top + 86, nameIn * close);
    const name = fitText(ctx, displayName(person), width * 0.62, "700 128px Rajdhani, sans-serif");
    ctx.fillStyle = INK;
    ctx.font = "700 128px Rajdhani, sans-serif";
    ctx.fillText(name, safe.side, safe.top + 214);
    if (person?.nick && person.nick !== person.name) {
      ctx.fillStyle = MUTED;
      ctx.font = "800 22px Inter, sans-serif";
      ctx.fillText(String(person.name).toUpperCase(), safe.side, safe.top + 258);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = phraseIn * close;
    ctx.fillStyle = RULE;
    ctx.fillRect(safe.side, height - safe.bottom + 24, 48, 2);
    ctx.fillStyle = INK;
    ctx.font = "600 34px Inter, sans-serif";
    const wrapped = wrapPhrase(ctx, phrase, width - safe.side * 2, "600 34px Inter, sans-serif");
    wrapped.forEach((line, index) => {
      ctx.fillText(line, safe.side, height - safe.bottom + 78 + index * 42);
    });
    ctx.restore();
  } else {
    const photoH = height * 0.46;
    ctx.save();
    ctx.globalAlpha = photoIn;
    if (asset?.bitmap) coverPhoto(ctx, asset.bitmap, 0, 0, width, photoH);
    else paintInitialsPlate(ctx, person, 0, 0, width, photoH);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, photoH * 0.52, 0, photoH + 28);
    fade.addColorStop(0, "rgba(5,6,7,0)");
    fade.addColorStop(1, VOID);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, photoH + 30);
    paintChrome(ctx, timeline, time, { alpha: chromeIn, season: timeline.season });

    const copyTop = photoH + 18;
    ctx.save();
    ctx.fillStyle = MUTED;
    ctx.font = "800 20px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(person?.position || "MC", safe.side, copyTop + 28);
    paintBadge(ctx, person, safe.side + 82, copyTop + 28);
    ctx.fillStyle = INK;
    ctx.font = "700 96px Rajdhani, sans-serif";
    ctx.fillText(fitText(ctx, displayName(person), width - safe.side * 2, ctx.font), safe.side, copyTop + 124);
    if (person?.nick && person.nick !== person.name) {
      ctx.fillStyle = MUTED;
      ctx.font = "800 20px Inter, sans-serif";
      ctx.fillText(String(person.name).toUpperCase(), safe.side, copyTop + 162);
    }
    ctx.fillStyle = RULE;
    ctx.fillRect(safe.side, copyTop + 198, 40, 2);
    ctx.fillStyle = INK;
    ctx.font = "600 32px Inter, sans-serif";
    wrapPhrase(ctx, phrase, width - safe.side * 2, ctx.font).forEach((line, index) => {
      ctx.fillText(line, safe.side, copyTop + 252 + index * 40);
    });
    ctx.restore();
  }

  if (!still && time >= timeline.finaleStart + 0.35) {
    const lock = reveal(time, timeline.finaleStart + 0.35, 0.7, easeOutExpo);
    ctx.save();
    ctx.globalAlpha = lock * 0.22;
    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = lock;
    drawMark(ctx, assets?.strix, width / 2, height * 0.46, 168, lock);
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillText("STRIX UNITED · FC 27", width / 2, height * 0.58);
    ctx.restore();
  }
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

function paintTeamIntro(ctx, timeline, time, assets) {
  const { width, height, safe, title, season } = timeline;
  const enter = reveal(time, 0, 0.7, easeOutExpo);
  paintAmbient(ctx, timeline, time);
  paintChrome(ctx, timeline, time, { alpha: enter, season });
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.translate(0, (1 - enter) * 24);
  drawMark(ctx, assets?.strix, width / 2, safe.top + 220, 150, enter);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = "800 22px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", width / 2, safe.top + 330);
  ctx.fillStyle = INK;
  ctx.font = "700 86px Rajdhani, sans-serif";
  ctx.fillText(fitText(ctx, title || "ELENCO FC 27", width - safe.side * 2, ctx.font), width / 2, safe.top + 430);
  ctx.fillStyle = MUTED;
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillText(`${String(timeline.people.length).padStart(2, "0")} NOMES  ·  ${season}`, width / 2, safe.top + 492);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.35 + enter * 0.4;
  ctx.fillStyle = RULE;
  ctx.fillRect(width / 2 - 28, height - safe.bottom + 40, 56, 2);
  ctx.restore();
}

function paintTeamPerson(ctx, timeline, time, scene, assets) {
  const { width, height, safe, people } = timeline;
  const local = time - scene.start;
  const enter = reveal(local, 0, 0.28, easeOutQuart);
  const exit = time > scene.end - 0.16 ? 1 - reveal(time, scene.end - 0.16, 0.16, easeInOutCubic) : 1;
  const presence = enter * exit;
  const person = scene.person;
  const asset = assets?.byId?.[person.id];
  paintAmbient(ctx, timeline, time);
  paintChrome(ctx, timeline, time, { season: timeline.season, alpha: presence });

  const photoW = width * 0.78;
  const photoH = height * 0.58;
  const photoX = (width - photoW) / 2;
  const photoY = safe.top + 48;
  paintPortrait(ctx, asset?.bitmap, person, { x: photoX, y: photoY, w: photoW, h: photoH }, {
    scale: 0.96 + enter * 0.04,
    alpha: presence,
    radius: 6,
  });

  ctx.save();
  ctx.globalAlpha = presence;
  ctx.fillStyle = MUTED;
  ctx.font = "800 20px Inter, sans-serif";
  ctx.textAlign = "left";
  const indexLabel = `${String((scene.index || 0) + 1).padStart(2, "0")} / ${String(people.length).padStart(2, "0")}`;
  ctx.fillText(indexLabel, safe.side, photoY + photoH + 56);
  ctx.textAlign = "right";
  ctx.fillText(person.position || "MC", width - safe.side, photoY + photoH + 56);
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = "700 92px Rajdhani, sans-serif";
  ctx.fillText(fitText(ctx, displayName(person), width - safe.side * 2, ctx.font), safe.side, photoY + photoH + 148);
  paintBadge(ctx, person, safe.side, photoY + photoH + 196, presence);
  ctx.restore();
}

function gridMetrics(count, width, height, safe, story) {
  const cols = count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : 5;
  const rows = Math.ceil(count / cols);
  const gap = story ? 16 : 14;
  const top = safe.top + (story ? 86 : 64);
  const bottom = height - safe.bottom + (story ? 8 : 4);
  const availableH = bottom - top;
  const availableW = width - safe.side * 2;
  const cellW = (availableW - gap * (cols - 1)) / cols;
  const cellH = Math.min((availableH - gap * (rows - 1)) / rows, cellW * 1.28);
  return { cols, rows, gap, top, cellW, cellH };
}

function paintTeamGrid(ctx, timeline, time, assets) {
  const { width, height, safe, people, title, season, format } = timeline;
  const story = format !== "feed";
  const enter = timeline.still ? 1 : reveal(time, timeline.finaleStart, 0.45, easeOutExpo);
  paintAmbient(ctx, timeline, time);
  paintChrome(ctx, timeline, time, { season, alpha: enter });
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = INK;
  ctx.font = story ? "700 54px Rajdhani, sans-serif" : "700 52px Rajdhani, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(fitText(ctx, title || "ELENCO FC 27", width - safe.side * 2, ctx.font), safe.side, safe.top + 72);

  const metrics = gridMetrics(people.length, width, height, safe, story);
  people.forEach((person, index) => {
    const col = index % metrics.cols;
    const row = Math.floor(index / metrics.cols);
    const x = safe.side + col * (metrics.cellW + metrics.gap);
    const y = metrics.top + 18 + row * (metrics.cellH + metrics.gap);
    const photoH = metrics.cellH - 52;
    const asset = assets?.byId?.[person.id];
    paintPortrait(ctx, asset?.bitmap, person, { x, y, w: metrics.cellW, h: photoH }, { alpha: enter, radius: 4 });
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = `700 ${metrics.cellW > 180 ? 22 : 16}px Rajdhani, sans-serif`;
    ctx.fillText(fitText(ctx, displayName(person), metrics.cellW, ctx.font), x, y + photoH + 22);
    ctx.fillStyle = MUTED;
    ctx.font = "800 12px Inter, sans-serif";
    const meta = [person.position, person.extraBadge].filter(Boolean).join("  ·  ");
    ctx.fillText(fitText(ctx, meta, metrics.cellW, ctx.font), x, y + photoH + 40);
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
    paintTeamIntro(ctx, timeline, time, assets);
    return;
  }
  if (scene.type === "person") {
    paintTeamPerson(ctx, timeline, time, scene, assets);
    return;
  }
  paintTeamGrid(ctx, timeline, time, assets);
}
