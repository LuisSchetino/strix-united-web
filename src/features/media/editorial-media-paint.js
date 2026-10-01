import { logoDrawRect } from "./agenda-paint.js";
import { sceneAt, remap, easeOutQuart } from "./agenda-timeline.js";
import { relatedNightSceneAt } from "./related-night-timeline.js";
import { summarySceneAt } from "./summary-timeline.js";
import { announceSceneAt } from "./announce-timeline.js";

const PAPER = "#efeee8";
const WHITE = "#fbfaf5";
const INK = "#111316";
const MUTED = "#a6a8a7";
const HAIR = "#c9c7c0";
const GRAPHITE = "#282b2d";
const VOID = "#090b0d";
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const ease = (value) => easeOutQuart(clamp(value));
const alphaIn = (ctx, value) => { ctx.globalAlpha = ease(value); };
const font = (ctx, weight, size, family = "Inter, Arial, sans-serif") => { ctx.font = `${weight} ${size}px ${family}`; };

function drawText(ctx, value, x, y, size, { color = INK, weight = 700, family = "Inter, Arial, sans-serif", align = "left", maxWidth = 0 } = {}) {
  const text = String(value ?? "");
  if (!text) return;
  font(ctx, weight, size, family);
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  if (maxWidth > 0) {
    let fitted = size;
    while (ctx.measureText(text).width > maxWidth && fitted > 13) { fitted -= 1; font(ctx, weight, fitted, family); }
    ctx.fillText(text, x, y, maxWidth);
  } else ctx.fillText(text, x, y);
}

function drawRule(ctx, x1, y, x2, color = HAIR, width = 1) {
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
}

function makeMetal(ctx, x1, y1, x2, y2, fallback = "#747879") {
  const gradient = ctx.createLinearGradient?.(x1, y1, x2, y2);
  if (!gradient) return fallback;
  gradient.addColorStop(0, "#181b1e");
  gradient.addColorStop(0.18, "#5c6265");
  gradient.addColorStop(0.32, "#d8d9d5");
  gradient.addColorStop(0.43, "#777d7e");
  gradient.addColorStop(0.58, "#f1f0e9");
  gradient.addColorStop(0.72, "#656b6c");
  gradient.addColorStop(1, "#181b1e");
  return gradient;
}

function drawChromeRibbons(ctx, width, height, time, s) {
  const drift = Math.sin(time * 0.22) * 18 * s;
  const ribbons = [
    [[-82 * s, height * 0.14 + drift], [28 * s, height * 0.29], [-26 * s, height * 0.42 - drift]],
    [[width + 80 * s, height * 0.58 - drift], [width - 26 * s, height * 0.72], [width + 28 * s, height * 0.87 + drift]],
  ];
  ribbons.forEach(([start, control, end]) => {
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    if (ctx.quadraticCurveTo) ctx.quadraticCurveTo(control[0], control[1], end[0], end[1]);
    else { ctx.lineTo(control[0], control[1]); ctx.lineTo(end[0], end[1]); }
    ctx.strokeStyle = makeMetal(ctx, start[0], start[1], end[0], end[1]);
    ctx.lineWidth = 72 * s;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.globalAlpha = 0.54;
    ctx.strokeStyle = "#f0efea";
    ctx.lineWidth = 1.3 * s;
    ctx.stroke();
    ctx.restore();
  });
}

function drawBase(ctx, timeline, { section, date = "", counter = "", time = 0 } = {}) {
  const { width, height } = timeline;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setTransform?.(1, 0, 0, 1, 0, 0);
  const s = width / 1080;
  const stage = ctx.createLinearGradient?.(0, 0, width * 0.82, height);
  if (stage) {
    stage.addColorStop(0, "#171a1d"); stage.addColorStop(0.46, VOID); stage.addColorStop(1, "#202326");
    ctx.fillStyle = stage;
  } else ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);

  // Tactical pitch geometry gives the videos a recurring Strix stage without a noisy texture.
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = "#d9d8d2";
  ctx.lineWidth = Math.max(1, s);
  const drift = Math.sin(time * 0.16) * 24 * s;
  ctx.beginPath();
  ctx.moveTo(width * 0.12 + drift, height * 0.22);
  ctx.lineTo(width * 0.5, height * 0.39);
  ctx.lineTo(width * 0.88 - drift, height * 0.22);
  ctx.moveTo(width * 0.12 - drift, height * 0.78);
  ctx.lineTo(width * 0.5, height * 0.61);
  ctx.lineTo(width * 0.88 + drift, height * 0.78);
  ctx.stroke();
  ctx.restore();

  // Vertical light columns drift slowly. They are the stage motion, not a metal ribbon.
  const column = ((time * 0.07) % 1) * width;
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(column, 0, Math.max(1, 2 * s), height);
  ctx.fillRect((column + width * 0.37) % width, 0, Math.max(1, s), height);
  ctx.restore();

  const sweepX = ((time * 0.28) % 1.7 - 0.32) * width;
  ctx.save(); ctx.globalAlpha = 0.11;
  ctx.fillStyle = makeMetal(ctx, sweepX, 0, sweepX + 70 * s, 0, "#c6c7c2");
  ctx.fillRect(sweepX, 0, 44 * s, height);
  ctx.restore();

  const top = Math.round(118 * s);
  ctx.fillStyle = "#090b0dee"; ctx.fillRect(0, 0, width, top);
  drawText(ctx, "STRIX UNITED  /  FILM ROOM", 64 * s, top * 0.43, 18 * s, { color: WHITE, weight: 900, maxWidth: width * 0.64 });
  drawText(ctx, "FC 27", width - 64 * s, top * 0.43, 17 * s, { color: "#c6c7c2", weight: 800, align: "right" });
  drawRule(ctx, 64 * s, top - 1, width - 64 * s, "#ffffff40", s);
  drawText(ctx, section.toUpperCase(), 64 * s, top + 34 * s, 12 * s, { color: "#d0d0ca", weight: 900 });
  if (date) drawText(ctx, date.toUpperCase(), width - 64 * s, top + 34 * s, 11 * s, { color: "#b2b4b2", weight: 800, align: "right", maxWidth: width * 0.5 });
  drawRule(ctx, 64 * s, height - 98 * s, width - 64 * s, "#ffffff4a", s);
  drawText(ctx, "NOITE DE JOGO  ·  STRIX UNITED", 64 * s, height - 57 * s, 11 * s, { color: "#c9cac5", weight: 900 });
  if (counter) drawText(ctx, counter.toUpperCase(), width - 64 * s, height - 57 * s, 11 * s, { color: "#e8e7e1", weight: 900, align: "right" });
  ctx.restore();
}

function drawLogo(ctx, asset, x, y, size, fallback = "", fallbackColor = INK) {
  const bitmap = asset?.bitmap;
  if (bitmap) {
    const rect = logoDrawRect(asset, size);
    ctx.drawImage(bitmap, rect.sx, rect.sy, rect.sw, rect.sh, x - rect.dw / 2, y - rect.dh / 2, rect.dw, rect.dh);
  } else {
    const initials = asset?.initials || String(fallback || asset?.name || "S").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
    drawText(ctx, initials || "S", x, y, size * 0.27, { color: fallbackColor, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
  }
}

function drawPortrait(ctx, asset, x, y, width, height, name = "") {
  ctx.fillStyle = "#d9d7d0"; ctx.fillRect(x, y, width, height);
  if (asset?.bitmap) {
    const bitmap = asset.bitmap;
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const dw = bitmap.width * scale; const dh = bitmap.height * scale;
    const dx = x + (width - dw) / 2;
    const dy = y + Math.min(height * 0.04, (height - dh) * 0.15);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
    ctx.globalAlpha = 0.96; ctx.drawImage(bitmap, dx, dy, dw, dh); ctx.restore();
  } else {
    drawText(ctx, String(name || "S").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 3).toUpperCase(), x + width / 2, y + height / 2, Math.min(width, height) * 0.2, { color: "#848681", weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
  }
}

function drawNumber(ctx, value, x, y, size, align = "left", color = INK) {
  drawText(ctx, String(value), x, y, size, { color, weight: 800, family: "Rajdhani, Inter, sans-serif", align });
}

function matchCounter(index, count) {
  return `${String(Math.max(1, index + 1)).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
}

function drawWipe(ctx, width, height, progress) {
  const open = ease(clamp(progress));
  if (open >= 0.98) return;
  const band = (1 - open) * height * 0.5;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, width, band);
  ctx.fillRect(0, height - band, width, band + 2);
  ctx.restore();
}

function drawRevealLabel(ctx, text, x, y, size, progress, options = {}) {
  const p = ease(progress);
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.translate(0, (1 - p) * (options.offset ?? 36));
  drawText(ctx, text, x, y, size, options);
  ctx.restore();
}

function paintMatchComposition(ctx, timeline, match, assets, progress, index, count, dayLabel, time = 0, { score = false } = {}) {
  if (!match) return;
  const { width, height } = timeline; const s = width / 1080;
  const x = 58 * s; const y = 246 * s; const w = width - 116 * s; const h = Math.min(height * 0.64, 1220 * s);
  const p = ease(progress);
  ctx.save(); ctx.globalAlpha *= p; ctx.translate(Math.sin(time * 0.33) * 7 * s, (1 - p) * 24 * s);
  ctx.fillStyle = "#111417"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#ffffff50"; ctx.lineWidth = 1.2 * s; ctx.strokeRect(x + s, y + s, w - 2 * s, h - 2 * s);
  drawRule(ctx, x + 32 * s, y + 70 * s, x + w - 32 * s, "#ffffff45", s);
  drawText(ctx, score ? "PÓS-JOGO  /  PLACAR FINAL" : "PRÉ-JOGO  /  CONFRONTO", x + 32 * s, y + 38 * s, 13 * s, { color: "#d1d1cb", weight: 900 });
  drawText(ctx, matchCounter(index, count), x + w - 32 * s, y + 38 * s, 13 * s, { color: "#d1d1cb", weight: 800, align: "right" });
  drawRevealLabel(ctx, match.competition || "AMISTOSO", width / 2, y + 132 * s, 24 * s, p, { color: WHITE, weight: 800, align: "center", maxWidth: w - 90 * s });
  drawRule(ctx, width / 2 - 42 * s, y + 164 * s, width / 2 + 42 * s, "#c7c8c4", 2 * s);
  const logoY = y + h * 0.51;
  const size = score ? Math.min(248 * s, h * 0.38) : Math.min(300 * s, h * 0.42);
  ctx.save(); ctx.translate(x + w * 0.25, logoY); ctx.scale(0.84 + p * 0.16, 0.84 + p * 0.16); drawLogo(ctx, assets?.strix, 0, 0, size, "STRIX", WHITE); ctx.restore();
  ctx.save(); ctx.translate(x + w * 0.75, logoY); ctx.scale(0.84 + p * 0.16, 0.84 + p * 0.16); drawLogo(ctx, assets?.opponent || assets?.opponents?.[index], 0, 0, size, match.opponent, WHITE); ctx.restore();
  if (score) {
    drawNumber(ctx, match.strix_score, width * 0.405, logoY + 5 * s, 108 * s, "center", WHITE);
    drawText(ctx, "–", width / 2, logoY + 4 * s, 42 * s, { color: "#c4c4bf", weight: 500, align: "center" });
    drawNumber(ctx, match.opponent_score, width * 0.595, logoY + 5 * s, 108 * s, "center", WHITE);
  } else drawText(ctx, "VS", width / 2, logoY, 72 * s, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
  drawText(ctx, "STRIX UNITED", x + w * 0.25, y + h * 0.78, 32 * s, { color: WHITE, weight: 900, align: "center", maxWidth: w * 0.34 });
  drawText(ctx, match.opponent || "ADVERSÁRIO", x + w * 0.75, y + h * 0.78, 30 * s, { color: WHITE, weight: 900, align: "center", maxWidth: w * 0.36 });
  const when = [match.dateLabel || dayLabel, match.kickoff].filter(Boolean).join("  ·  ");
  if (when) drawText(ctx, when, width / 2, y + h - 54 * s, 22 * s, { color: "#c8c9c5", weight: 800, align: "center", maxWidth: w - 70 * s });
  ctx.restore();
}

function paintFixtureRow(ctx, timeline, match, { index, totalCount, pageCount, pageTime, rowIndex, asset, strixAsset } = {}) {
  if (!match) return;
  const { width, height } = timeline; const s = width / 1080;
  const left = 62 * s; const rowW = width - left * 2; const gap = 17 * s;
  const top = height * 0.31; const bottom = height * 0.81;
  const rows = Math.max(1, Math.min(4, pageCount));
  const maxRow = rows === 1 ? 650 * s : rows === 2 ? 430 * s : rows === 3 ? 320 * s : 246 * s;
  const rowH = Math.min(maxRow, (bottom - top - gap * (rows - 1)) / rows);
  const totalH = rows * rowH + (rows - 1) * gap;
  const rowY = (top + bottom - totalH) / 2 + rowIndex * (rowH + gap);
  const progress = ease(remap(pageTime, 0.08 + rowIndex * 0.12, 0.55 + rowIndex * 0.12));
  const scale = Math.min(1.55, Math.max(1, rowH / (246 * s)));
  ctx.save();
  ctx.globalAlpha *= progress;
  ctx.translate(-(1 - progress) * (64 + rowIndex * 7) * s, (1 - progress) * 20 * s);
  ctx.fillStyle = rowIndex % 2 === 0 ? "#12161a" : "#0c0f12";
  ctx.fillRect(left, rowY, rowW, rowH);
  ctx.fillStyle = "#f5f5f5"; ctx.fillRect(left, rowY, 8 * s, rowH * ease(progress));
  ctx.strokeStyle = "#ffffff85"; ctx.lineWidth = 1.1 * s; ctx.strokeRect(left + s, rowY + s, rowW - 2 * s, rowH - 2 * s);

  const metaW = (rows === 1 ? 310 : 278) * s;
  drawText(ctx, `${String(index + 1).padStart(2, "0")}  /  ${String(totalCount).padStart(2, "0")}`, left + 29 * s, rowY + 30 * s * scale, 12 * s * scale, { color: "#aeb4bb", weight: 900 });
  drawText(ctx, match.competition || "AMISTOSO", left + 29 * s, rowY + 66 * s * scale, 22 * s * scale, { color: WHITE, weight: 900, maxWidth: metaW - 48 * s });
  if (match.round) drawText(ctx, match.round, left + 29 * s, rowY + 96 * s * scale, 13 * s * scale, { color: "#aeb4bb", weight: 700, maxWidth: metaW - 48 * s });
  drawRule(ctx, left + 29 * s, rowY + rowH * 0.59, left + metaW - 20 * s, "#12141635", s);
  drawText(ctx, "HORÁRIO", left + 29 * s, rowY + rowH * 0.70, 10 * s * scale, { color: "#8e969f", weight: 900 });
  drawText(ctx, match.kickoff || "A DEFINIR", left + 29 * s, rowY + rowH * 0.86, (match.kickoff ? 52 : 27) * s * scale, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif" });

  const matchupLeft = left + metaW;
  const matchupW = rowW - metaW - 22 * s;
  const strixX = matchupLeft + matchupW * 0.25;
  const opponentX = matchupLeft + matchupW * 0.75;
  const logoY = rowY + rowH * 0.43;
  const logoCap = rows === 1 ? 250 : rows === 2 ? 176 : rows === 3 ? 132 : 108;
  const logoSize = Math.min(logoCap * s, rowH * 0.36);
  ctx.save(); ctx.translate(strixX, logoY); ctx.scale(0.91 + progress * 0.09, 0.91 + progress * 0.09); drawLogo(ctx, strixAsset, 0, 0, logoSize, "STRIX"); ctx.restore();
  ctx.save(); ctx.translate(opponentX, logoY); ctx.scale(0.91 + progress * 0.09, 0.91 + progress * 0.09); drawLogo(ctx, asset, 0, 0, logoSize, match.opponent); ctx.restore();
  drawText(ctx, "VS", (strixX + opponentX) / 2, logoY, 28 * s * scale, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
  drawText(ctx, "STRIX UNITED", strixX, rowY + rowH * 0.81, 18 * s * scale, { color: WHITE, weight: 900, align: "center", maxWidth: matchupW * 0.46 });
  drawText(ctx, match.opponent || "ADVERSÁRIO", opponentX, rowY + rowH * 0.81, 18 * s * scale, { color: WHITE, weight: 900, align: "center", maxWidth: matchupW * 0.46 });
  ctx.restore();
}

export function paintEditorialAgenda(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.width) return;
  const scene = sceneAt(timeline, time); const count = timeline.matches?.length || 0;
  const gameLabel = `${String(count).padStart(2, "0")} ${count === 1 ? "JOGO" : "JOGOS"}`;
  drawBase(ctx, timeline, { section: "Agenda do dia", date: dayLabel, counter: count ? gameLabel : "", time });
  if (scene?.type === "intro") {
    const s = timeline.width / 1080;
    const progress = remap(time, scene.start, scene.start + 0.72);
    ctx.save(); ctx.globalAlpha = 0.075; drawText(ctx, String(count).padStart(2, "0"), timeline.width * 0.83, timeline.height * 0.48, timeline.width * 0.48, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" }); ctx.restore();
    drawRevealLabel(ctx, "MATCHDAY  /  STRIX UNITED", 72 * s, timeline.height * 0.30, 16 * s, progress, { color: "#c7c8c3", weight: 900 });
    drawRevealLabel(ctx, "AGENDA", 67 * s, timeline.height * 0.405, 132 * s, progress, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", maxWidth: timeline.width - 130 * s });
    drawRevealLabel(ctx, "DO DIA", 74 * s, timeline.height * 0.49, 70 * s, remap(time, 0.22, 0.96), { color: "#d2d2cc", weight: 800, family: "Rajdhani, Inter, sans-serif" });
    drawRule(ctx, 74 * s, timeline.height * 0.54, timeline.width - 74 * s, "#ffffff70", 1.2 * s);
    drawRevealLabel(ctx, `${gameLabel} ${count === 1 ? "MARCADO" : "MARCADOS"}`, 74 * s, timeline.height * 0.585, 27 * s, remap(time, 0.34, 1.16), { color: WHITE, weight: 900 });
    drawRevealLabel(ctx, dayLabel.toUpperCase(), 74 * s, timeline.height * 0.63, 17 * s, remap(time, 0.42, 1.2), { color: "#aeb0ae", weight: 800 });
    drawWipe(ctx, timeline.width, timeline.height, remap(time, scene.start + 0.92, scene.start + 1.65), s);
    return;
  }
  if (scene?.type === "page") {
    const s = timeline.width / 1080;
    const pageMatches = scene.matches || [];
    const elapsed = time - scene.start;
    drawRevealLabel(ctx, "PARTIDAS MARCADAS", 64 * s, timeline.height * 0.235, 32 * s, remap(elapsed, 0.05, 0.42), { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif" });
    drawText(ctx, `PÁGINA ${String(scene.pageIndex + 1).padStart(2, "0")}  /  ${String(scene.pageCount).padStart(2, "0")}`, timeline.width - 64 * s, timeline.height * 0.235, 13 * s, { color: "#b8bab7", weight: 900, align: "right" });
    pageMatches.forEach((match, rowIndex) => paintFixtureRow(ctx, timeline, match, {
      index: scene.firstMatchIndex + rowIndex,
      totalCount: count,
      pageCount: pageMatches.length,
      pageTime: elapsed,
      rowIndex,
      asset: assets?.opponents?.[scene.firstMatchIndex + rowIndex],
      strixAsset: assets?.strix,
    }));
    drawWipe(ctx, timeline.width, timeline.height, remap(elapsed, 0, 0.62), s);
    return;
  }
  if (scene?.type === "finale") {
    const s = timeline.width / 1080;
    const progress = remap(time, scene.start, scene.start + 0.6);
    ctx.save(); ctx.globalAlpha = 0.08; drawText(ctx, "STRIX", timeline.width / 2, timeline.height * 0.46, 174 * s, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" }); ctx.restore();
    drawRevealLabel(ctx, "A NOITE TEM", timeline.width / 2, timeline.height * 0.39, 31 * s, progress, { color: "#bcbeba", weight: 900, align: "center" });
    drawRevealLabel(ctx, "HORA E LUGAR.", timeline.width / 2, timeline.height * 0.47, 66 * s, remap(time, scene.start + 0.12, scene.start + 0.8), { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center", maxWidth: timeline.width - 100 * s });
    drawRule(ctx, timeline.width * 0.30, timeline.height * 0.53, timeline.width * 0.70, "#ffffff55", 1.2 * s);
    drawRevealLabel(ctx, `${gameLabel}  ·  ${dayLabel.toUpperCase()}`, timeline.width / 2, timeline.height * 0.58, 19 * s, remap(time, scene.start + 0.18, scene.start + 0.9), { color: "#d0d1cd", weight: 800, align: "center", maxWidth: timeline.width - 120 * s });
    drawWipe(ctx, timeline.width, timeline.height, remap(time, scene.start, scene.start + 0.52), s);
  }
}

function drawResultsStats(ctx, timeline, period, progress) {
  const { width, height } = timeline; const s = width / 1080; const stats = period?.stats || {};
  const values = [
    ["JOGOS", stats.games], ["CAMPANHA", `${stats.wins ?? "—"}V · ${stats.draws ?? "—"}E · ${stats.losses ?? "—"}D`],
    ["GOLS", `${stats.goalsFor ?? "—"}–${stats.goalsAgainst ?? "—"}`], ["EFICIÊNCIA", stats.efficiency == null ? "—" : `${stats.efficiency}%`],
  ];
  const left = 66 * s; const top = height * 0.40; const gap = 18 * s; const cellW = (width - 132 * s - gap) / 2; const cellH = height * 0.14;
  values.forEach(([label, value], index) => {
    const col = index % 2; const row = Math.floor(index / 2); const x = left + col * (cellW + gap); const y = top + row * (cellH + gap);
    const reveal = ease(progress - index * 0.075);
    ctx.save(); ctx.globalAlpha *= reveal; ctx.translate(0, (1 - reveal) * 24 * s); ctx.fillStyle = "#12161a"; ctx.fillRect(x, y, cellW, cellH); ctx.strokeStyle = "#ffffff24"; ctx.lineWidth = s; ctx.strokeRect(x, y, cellW, cellH);
    drawText(ctx, label, x + 24 * s, y + 42 * s, 17 * s, { color: "#aeb4bb", weight: 900 });
    drawText(ctx, value, x + 24 * s, y + cellH * 0.62, 52 * s, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", maxWidth: cellW - 48 * s });
    ctx.restore();
  });
}

export function paintEditorialSummary(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.width) return;
  const scene = summarySceneAt(timeline, time); const matches = timeline.matches || [];
  drawBase(ctx, timeline, { section: timeline.period?.mode === "week" ? "Resumo da semana" : "Resumo do dia", date: timeline.period?.rangeLabel || dayLabel, counter: `${String(matches.length).padStart(2, "0")} JOGOS`, time });
  if (scene?.type === "intro") {
    const s = timeline.width / 1080; const reveal = remap(time, scene.start + 0.08, scene.start + 0.72);
    drawRevealLabel(ctx, "STRIX UNITED  /  TEMPORADA", 66 * s, timeline.height * 0.25, 16 * s, reveal, { color: "#c7c8c3", weight: 900 });
    drawRevealLabel(ctx, "A NOITE", 64 * s, timeline.height * 0.335, 91 * s, reveal, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif" });
    drawRevealLabel(ctx, "EM NÚMEROS.", 70 * s, timeline.height * 0.405, 54 * s, remap(time, scene.start + 0.2, scene.start + 0.9), { color: "#d2d2cc", weight: 900, family: "Rajdhani, Inter, sans-serif" });
    drawResultsStats(ctx, timeline, timeline.period, 1);
    drawWipe(ctx, timeline.width, timeline.height, remap(time, scene.end - 0.48, scene.end), s);
    return;
  }
  if (scene?.type === "stats") {
    const s = timeline.width / 1080; const reveal = remap(time, scene.start + 0.06, scene.start + 0.48);
    drawRevealLabel(ctx, "O RECORTE", 66 * s, timeline.height * 0.25, 16 * s, reveal, { color: "#c7c8c3", weight: 900 });
    drawRevealLabel(ctx, "DA NOITE.", 64 * s, timeline.height * 0.31, 50 * s, remap(time, scene.start + 0.12, scene.start + 0.58), { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif" });
    drawResultsStats(ctx, timeline, timeline.period, remap(time, scene.start + 0.18, scene.start + 0.95));
    drawWipe(ctx, timeline.width, timeline.height, remap(time, scene.end - 0.45, scene.end), s);
    return;
  }
  if (scene?.type === "finale") {
    const s = timeline.width / 1080; const reveal = remap(time, scene.start + 0.1, scene.start + 0.65);
    drawRevealLabel(ctx, "STRIX UNITED", timeline.width / 2, timeline.height * 0.42, 27 * s, reveal, { color: "#c7c8c3", weight: 900, align: "center" });
    drawRevealLabel(ctx, "A HISTÓRIA", timeline.width / 2, timeline.height * 0.49, 61 * s, reveal, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawRevealLabel(ctx, "CONTINUA.", timeline.width / 2, timeline.height * 0.55, 61 * s, remap(time, scene.start + 0.2, scene.start + 0.78), { color: "#c7c8c3", weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawText(ctx, `${String(matches.length).padStart(2, "0")} JOGOS  ·  ${timeline.period?.rangeLabel || dayLabel}`.toUpperCase(), timeline.width / 2, timeline.height * 0.62, 15 * s, { color: "#b3b5b3", weight: 800, align: "center", maxWidth: timeline.width - 120 * s });
    drawWipe(ctx, timeline.width, timeline.height, remap(time, scene.start, scene.start + 0.52), s);
    return;
  }
  const result = scene?.type === "result" ? scene : null;
  const match = result?.match || matches.at(-1);
  if (match) {
    const progress = result ? ease(remap(time, result.start, Math.min(result.end, result.start + 0.38))) : 1;
    paintMatchComposition(ctx, timeline, match, { ...assets, opponent: assets?.opponents?.[result?.index ?? matches.length - 1] }, progress, result?.index ?? matches.length - 1, matches.length, dayLabel, time, { score: true });
  }
}

function finalRoster(ctx, timeline, players, page = 0, total = 0, time = 0) {
  const { width, height } = timeline; const s = width / 1080; const cols = width > height ? 3 : 2; const rows = Math.ceil(players.length / cols);
  const x0 = 58 * s; const y0 = height * 0.29; const gapX = 20 * s; const areaW = width - x0 * 2; const cellW = (areaW - gapX * (cols - 1)) / cols; const cellH = Math.min(62 * s, height * 0.50 / Math.max(rows, 1));
  players.forEach((player, index) => {
    const col = index % cols; const row = Math.floor(index / cols); const x = x0 + col * (cellW + gapX); const y = y0 + row * (cellH + 8 * s);
    const reveal = ease(remap(time, 0.08 + index * 0.065, 0.48 + index * 0.065));
    ctx.save(); ctx.globalAlpha *= reveal; ctx.translate((1 - reveal) * 26 * s, 0);
    ctx.fillStyle = WHITE; ctx.fillRect(x, y, cellW, cellH); drawRule(ctx, x, y + cellH, x + cellW, HAIR, s);
    drawText(ctx, String(player.number || String(index + 1).padStart(2, "0")), x + 12 * s, y + cellH / 2, 20 * s, { color: MUTED, weight: 800, family: "Rajdhani, Inter, sans-serif" });
    drawText(ctx, player.name, x + 48 * s, y + cellH * 0.40, 30 * s, { color: INK, weight: 900, maxWidth: cellW - 62 * s });
    drawText(ctx, player.extraBadge || player.position || "ELENCO", x + 48 * s, y + cellH * 0.75, 18 * s, { color: MUTED, weight: 800, maxWidth: cellW - 62 * s });
    ctx.restore();
  });
  if (total > 1) drawText(ctx, `${String(page + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, width - 58 * s, height * 0.25, 11 * s, { color: MUTED, weight: 900, align: "right" });
}

export function paintEditorialRelated(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  const scene = relatedNightSceneAt(timeline, time); const players = timeline.players || []; const count = players.length;
  drawBase(ctx, timeline, { section: "Relacionados da noite", counter: `${String(count).padStart(2, "0")} NOMES`, time });
  if (scene?.type === "intro") {
    const s = timeline.width / 1080; const reveal = remap(time, scene.start + 0.08, scene.start + 0.66);
    drawRevealLabel(ctx, "QUEM VAI", timeline.width / 2, timeline.height * 0.39, timeline.width * 0.09, reveal, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawRevealLabel(ctx, "FAZER A NOITE?", timeline.width / 2, timeline.height * 0.47, timeline.width * 0.072, remap(time, scene.start + 0.18, scene.start + 0.8), { color: "#d2d2cc", weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawRevealLabel(ctx, `${count} RELACIONADOS`, timeline.width / 2, timeline.height * 0.54, 21 * s, remap(time, scene.start + 0.28, scene.start + 0.9), { color: "#c7c8c3", weight: 800, align: "center" });
    drawWipe(ctx, timeline.width, timeline.height, remap(time, scene.end - 0.5, scene.end), s);
    return;
  }
  if (scene?.type === "finale") {
    const s = timeline.width / 1080;
    drawRevealLabel(ctx, "A LISTA.", 66 * s, timeline.height * 0.24, 44 * s, remap(time, scene.start + 0.06, scene.start + 0.45), { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif" });
    finalRoster(ctx, timeline, players, 0, 0, time - scene.start);
    return;
  }
  const player = scene?.player || players[0];
  if (!player) return;
  const s = timeline.width / 1080; const progress = scene ? ease(remap(time, scene.start, Math.min(scene.end, scene.start + 0.35))) : 1;
  const x = 66 * s; const y = timeline.height * 0.23; const w = timeline.width - x * 2; const h = timeline.height * 0.56;
  ctx.save(); alphaIn(ctx, progress); ctx.translate((1 - ease(progress)) * 26 * s + Math.sin(time * 0.52) * 5 * s, 0);
  const asset = assets?.byId?.[player.id] || assets?.players?.[scene?.index || 0];
  drawPortrait(ctx, asset, x, y, w, h, player.name);
  ctx.fillStyle = INK; ctx.fillRect(x, y + h - 150 * s, w, 150 * s);
  drawText(ctx, `${String((scene?.index || 0) + 1).padStart(2, "0")}  /  ${String(count).padStart(2, "0")}`, x + 28 * s, y + h - 124 * s, 16 * s, { color: "#babbb7", weight: 800 });
  drawText(ctx, player.name, x + 28 * s, y + h - 80 * s, 48 * s, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", maxWidth: w - 56 * s });
  drawText(ctx, [player.position, player.extraBadge || player.group].filter(Boolean).join("  ·  "), x + 28 * s, y + h - 34 * s, 18 * s, { color: "#c7c8c4", weight: 800, maxWidth: w - 56 * s });
  ctx.restore();
  drawWipe(ctx, timeline.width, timeline.height, remap(time, scene?.start || 0, (scene?.start || 0) + 0.48), s);
}

function paintSingleAnnouncement(ctx, timeline, time, assets) {
  const scene = announceSceneAt(timeline, time); const person = scene?.person || timeline.person;
  const { width, height } = timeline; const s = width / 1080;
  if (!person) return;
  if (scene?.type === "intro") {
    const reveal = remap(time, scene.start + 0.06, scene.start + 0.62);
    drawRevealLabel(ctx, "ANÚNCIO OFICIAL", width / 2, height * 0.39, 18 * s, reveal, { color: "#c7c8c3", weight: 900, align: "center" });
    drawRevealLabel(ctx, "UM NOVO", width / 2, height * 0.46, 75 * s, reveal, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawRevealLabel(ctx, "CAPÍTULO.", width / 2, height * 0.53, 75 * s, remap(time, scene.start + 0.12, scene.start + 0.74), { color: "#d2d2cc", weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawWipe(ctx, width, height, remap(time, scene.end - 0.46, scene.end), s);
    return;
  }
  const first = scene ? remap(time, scene.start, scene.start + 0.46) : 1;
  const asset = assets?.byId?.[person.id] || assets?.players?.[0];
  const portraitY = height * (timeline.format === "feed" ? 0.14 : 0.16);
  const portraitH = height * (timeline.format === "feed" ? 0.52 : 0.58);
  const inset = 58 * s;
  ctx.save(); ctx.globalAlpha = ease(first); ctx.translate(Math.sin(time * 0.34) * 7 * s, (1 - ease(first)) * 46 * s);
  drawPortrait(ctx, asset, inset, portraitY, width - inset * 2, portraitH, person.name);
  drawRule(ctx, inset, portraitY + portraitH + 22 * s, width - inset, "#ffffff70", 2 * s);
  drawText(ctx, timeline.announceType === "jogador" ? "NOVO CAPÍTULO" : "NOVO NOME", inset, portraitY + portraitH + 62 * s, 17 * s, { color: "#bfc1be", weight: 900 });
  drawText(ctx, person.name, inset, portraitY + portraitH + 128 * s, 45 * s, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", maxWidth: width - inset * 2 });
  drawText(ctx, [person.position, person.extraBadge].filter(Boolean).join("  ·  "), inset, portraitY + portraitH + 166 * s, 19 * s, { color: "#c7c8c4", weight: 800, maxWidth: width - inset * 2 });
  if (person.number !== "" && person.number != null) drawNumber(ctx, `#${person.number}`, width - inset, portraitY + portraitH + 164 * s, 19 * s, "right", WHITE);
  if (timeline.phrase) drawText(ctx, timeline.phrase, inset, portraitY + portraitH + 220 * s, 19 * s, { color: "#d5d5d0", weight: 700, maxWidth: width - inset * 2 });
  ctx.restore();
  drawWipe(ctx, width, height, remap(time, scene?.start || 0, (scene?.start || 0) + 0.48), s);
}

export function paintEditorialAnnounce(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  const count = timeline.people?.length || 0;
  drawBase(ctx, timeline, { section: timeline.kind === "team" ? "Elenco FC27" : "Anúncio oficial", counter: `${String(count).padStart(2, "0")} ${count === 1 ? "NOME" : "NOMES"}`, time });
  if (timeline.kind !== "team") { paintSingleAnnouncement(ctx, timeline, time, assets); return; }
  const scene = announceSceneAt(timeline, time);
  if (scene?.type === "intro") {
    const s = timeline.width / 1080; const reveal = remap(time, scene.start + 0.08, scene.start + 0.68);
    drawRevealLabel(ctx, "UM CLUBE.", timeline.width / 2, timeline.height * 0.39, timeline.width * 0.087, reveal, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawRevealLabel(ctx, "UMA TEMPORADA.", timeline.width / 2, timeline.height * 0.47, timeline.width * 0.073, remap(time, scene.start + 0.14, scene.start + 0.78), { color: "#d2d2cc", weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawRevealLabel(ctx, `${count} NOMES · UM SÓ ESCUDO`, timeline.width / 2, timeline.height * 0.54, 15 * s, remap(time, scene.start + 0.25, scene.start + 0.88), { color: "#c7c8c3", weight: 800, align: "center" });
    drawWipe(ctx, timeline.width, timeline.height, remap(time, scene.end - 0.48, scene.end), s);
    return;
  }
  if (scene?.type === "finale") {
    const s = timeline.width / 1080;
    drawRevealLabel(ctx, timeline.title || "ELENCO FC27", 58 * s, timeline.height * 0.23, 38 * s, remap(time, scene.start + 0.05, scene.start + 0.42), { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif" });
    finalRoster(ctx, timeline, scene.people || [], scene.pageIndex || 0, scene.pageCount || 0, time - scene.start);
    return;
  }
  const person = scene?.person || timeline.people?.[0];
  if (!person) return;
  const index = scene?.index || 0; const progress = scene ? ease(remap(time, scene.start, scene.start + 0.34)) : 1;
  const s = timeline.width / 1080; const x = 66 * s; const y = timeline.height * 0.22; const w = timeline.width - x * 2; const h = timeline.height * 0.55;
  const asset = assets?.byId?.[person.id] || assets?.players?.[index];
  ctx.save(); ctx.globalAlpha = progress; ctx.translate((1 - progress) * timeline.width * 0.09 + Math.sin(time * 0.46) * 5 * s, 0);
  drawPortrait(ctx, asset, x, y, w, h, person.name);
  ctx.fillStyle = INK; ctx.fillRect(x, y + h - 146 * s, w, 146 * s);
  drawText(ctx, `JOGADOR  ${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`, x + 25 * s, y + h - 116 * s, 16 * s, { color: "#c7c8c4", weight: 800 });
  drawText(ctx, person.name, x + 25 * s, y + h - 73 * s, 45 * s, { color: WHITE, weight: 900, family: "Rajdhani, Inter, sans-serif", maxWidth: w - 50 * s });
  drawText(ctx, [person.position, person.extraBadge].filter(Boolean).join("  ·  "), x + 25 * s, y + h - 32 * s, 17 * s, { color: "#c7c8c4", weight: 800, maxWidth: w - 50 * s });
  ctx.restore();
  drawWipe(ctx, timeline.width, timeline.height, remap(time, scene.start, scene.start + 0.48), s);
}
