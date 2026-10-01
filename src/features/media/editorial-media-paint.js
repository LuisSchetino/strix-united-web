import { logoDrawRect } from "./agenda-paint.js";
import { sceneAt, remap, easeOutQuart } from "./agenda-timeline.js";
import { relatedNightSceneAt } from "./related-night-timeline.js";
import { summarySceneAt } from "./summary-timeline.js";
import { announceSceneAt } from "./announce-timeline.js";

const PAPER = "#f0efe9";
const WHITE = "#fbfaf6";
const INK = "#111316";
const MUTED = "#73777a";
const HAIR = "#c9c7c0";
const GRAPHITE = "#282b2d";
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

function drawBase(ctx, timeline, { section, date = "", counter = "" } = {}) {
  const { width, height } = timeline;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setTransform?.(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, width, height);
  const s = width / 1080;
  const top = Math.round(112 * s);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, width, top);
  drawText(ctx, "STRIX UNITED", 68 * s, top * 0.48, 23 * s, { color: WHITE, weight: 800, maxWidth: width * 0.58 });
  drawText(ctx, "FC 27", width - 68 * s, top * 0.48, 17 * s, { color: "#d7d5cf", weight: 800, align: "right" });
  drawText(ctx, section.toUpperCase(), 68 * s, top + 39 * s, 12 * s, { color: MUTED, weight: 800 });
  if (date) drawText(ctx, date.toUpperCase(), width - 68 * s, top + 39 * s, 11 * s, { color: MUTED, weight: 700, align: "right", maxWidth: width * 0.5 });
  drawRule(ctx, 68 * s, height - 88 * s, width - 68 * s, HAIR, s);
  drawText(ctx, "STRIX UNITED  /  FC27", 68 * s, height - 53 * s, 10 * s, { color: MUTED, weight: 800 });
  if (counter) drawText(ctx, counter.toUpperCase(), width - 68 * s, height - 53 * s, 10 * s, { color: MUTED, weight: 800, align: "right" });
  ctx.restore();
}

function drawLogo(ctx, asset, x, y, size, fallback = "") {
  const bitmap = asset?.bitmap;
  if (bitmap) {
    const rect = logoDrawRect(asset, size);
    ctx.drawImage(bitmap, rect.sx, rect.sy, rect.sw, rect.sh, x - rect.dw / 2, y - rect.dh / 2, rect.dw, rect.dh);
  } else {
    const initials = asset?.initials || String(fallback || asset?.name || "S").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
    drawText(ctx, initials || "S", x, y, size * 0.27, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
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

function drawNumber(ctx, value, x, y, size, align = "left") {
  drawText(ctx, String(value), x, y, size, { color: INK, weight: 800, family: "Rajdhani, Inter, sans-serif", align });
}

function matchCounter(index, count) {
  return `${String(Math.max(1, index + 1)).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
}

function paintMatchComposition(ctx, timeline, match, assets, progress, index, count, dayLabel, time = 0, { score = false } = {}) {
  if (!match) return;
  const { width, height } = timeline; const s = width / 1080;
  const x = 66 * s; const y = 215 * s; const w = width - 132 * s; const h = Math.min(height * 0.62, 1180 * s);
  ctx.save(); alphaIn(ctx, progress); ctx.translate(Math.sin(time * 0.45) * 5 * s, (1 - ease(progress)) * 18 * s);
  ctx.fillStyle = WHITE; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = HAIR; ctx.lineWidth = s; ctx.strokeRect(x + 0.5 * s, y + 0.5 * s, w - s, h - s);
  drawText(ctx, score ? "RESULTADO" : "CONFRONTO", x + 34 * s, y + 38 * s, 11 * s, { color: MUTED, weight: 900 });
  drawText(ctx, matchCounter(index, count), x + w - 34 * s, y + 38 * s, 11 * s, { color: MUTED, weight: 800, align: "right" });
  drawRule(ctx, x + 34 * s, y + 68 * s, x + w - 34 * s, HAIR, s);
  drawText(ctx, match.competition || "AMISTOSO", width / 2, y + 112 * s, 22 * s, { color: GRAPHITE, weight: 800, align: "center", maxWidth: w - 90 * s });
  const logoY = y + h * 0.52;
  const size = Math.min(225 * s, h * 0.32);
  drawLogo(ctx, assets?.strix, x + w * 0.27, logoY, size, "STRIX");
  drawLogo(ctx, assets?.opponent || assets?.opponents?.[index], x + w * 0.73, logoY, size, match.opponent);
  if (score) {
    drawNumber(ctx, match.strix_score, width * 0.41, logoY + 6 * s, 92 * s, "center");
    drawText(ctx, "–", width / 2, logoY + 4 * s, 40 * s, { color: MUTED, weight: 500, align: "center" });
    drawNumber(ctx, match.opponent_score, width * 0.59, logoY + 6 * s, 92 * s, "center");
  } else {
    drawText(ctx, "VS", width / 2, logoY, 42 * s, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
  }
  drawText(ctx, "STRIX UNITED", x + w * 0.27, y + h * 0.77, 31 * s, { color: INK, weight: 900, align: "center", maxWidth: w * 0.34 });
  drawText(ctx, match.opponent || "ADVERSÁRIO", x + w * 0.73, y + h * 0.77, 29 * s, { color: INK, weight: 900, align: "center", maxWidth: w * 0.36 });
  const when = [match.dateLabel || dayLabel, match.kickoff].filter(Boolean).join("  ·  ");
  if (when) drawText(ctx, when, width / 2, y + h - 46 * s, 23 * s, { color: MUTED, weight: 800, align: "center", maxWidth: w - 70 * s });
  ctx.restore();
}

export function paintEditorialAgenda(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.width) return;
  const scene = sceneAt(timeline, time); const count = timeline.matches?.length || 0;
  drawBase(ctx, timeline, { section: "Agenda do dia", date: dayLabel, counter: count ? `${String(count).padStart(2, "0")} JOGOS` : "" });
  if (scene?.type === "intro") {
    const progress = ease(remap(time, scene.start, Math.min(scene.end, scene.start + 0.55)));
    drawText(ctx, "HOJE", timeline.width / 2, timeline.height * 0.39, timeline.width * 0.13, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawText(ctx, "A CIDADE É NOSSA.", timeline.width / 2, timeline.height * 0.46, timeline.width * 0.032, { color: MUTED, weight: 800, align: "center" });
    const first = timeline.matches?.[0];
    if (first) paintMatchComposition(ctx, timeline, first, { ...assets, opponent: assets?.opponents?.[0] }, progress * 0.42, 0, count, dayLabel, time);
    return;
  }
  const matchScene = scene?.type === "match" ? scene : null;
  const match = matchScene?.match || timeline.matches?.at(-1) || timeline.matches?.[0];
  const progress = matchScene ? ease(remap(time, matchScene.start, Math.min(matchScene.end, matchScene.start + 0.45))) : 1;
  const index = matchScene?.index ?? Math.max(0, count - 1);
  paintMatchComposition(ctx, timeline, match, { ...assets, opponent: assets?.opponents?.[index] }, progress, index, count, dayLabel, time);
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
    ctx.save(); alphaIn(ctx, progress - index * 0.055); ctx.fillStyle = WHITE; ctx.fillRect(x, y, cellW, cellH); ctx.strokeStyle = HAIR; ctx.lineWidth = s; ctx.strokeRect(x, y, cellW, cellH);
    drawText(ctx, label, x + 24 * s, y + 42 * s, 17 * s, { color: MUTED, weight: 900 });
    drawText(ctx, value, x + 24 * s, y + cellH * 0.62, 48 * s, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif", maxWidth: cellW - 48 * s });
    ctx.restore();
  });
}

export function paintEditorialSummary(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.width) return;
  const scene = summarySceneAt(timeline, time); const matches = timeline.matches || [];
  drawBase(ctx, timeline, { section: timeline.period?.mode === "week" ? "Resumo da semana" : "Resumo do dia", date: timeline.period?.rangeLabel || dayLabel, counter: `${String(matches.length).padStart(2, "0")} JOGOS` });
  if (scene?.type === "intro") {
    drawText(ctx, "A TEMPORADA", 66 * timeline.width / 1080, timeline.height * 0.25, 14 * timeline.width / 1080, { color: MUTED, weight: 900 });
    drawText(ctx, "EM NÚMEROS.", 66 * timeline.width / 1080, timeline.height * 0.31, 46 * timeline.width / 1080, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif" });
    drawResultsStats(ctx, timeline, timeline.period, 1);
    return;
  }
  if (scene?.type === "stats") {
    drawText(ctx, "O RECORTE", 66 * timeline.width / 1080, timeline.height * 0.25, 14 * timeline.width / 1080, { color: MUTED, weight: 900 });
    drawText(ctx, "DA NOITE.", 66 * timeline.width / 1080, timeline.height * 0.31, 46 * timeline.width / 1080, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif" });
    drawResultsStats(ctx, timeline, timeline.period, ease(remap(time, scene.start, scene.start + 0.7)));
    return;
  }
  const result = scene?.type === "result" ? scene : null;
  const match = result?.match || matches.at(-1);
  if (match) {
    const progress = result ? ease(remap(time, result.start, Math.min(result.end, result.start + 0.38))) : 1;
    paintMatchComposition(ctx, timeline, match, { ...assets, opponent: assets?.opponents?.[result?.index ?? matches.length - 1] }, progress, result?.index ?? matches.length - 1, matches.length, dayLabel, time, { score: true });
  }
}

function finalRoster(ctx, timeline, players, page = 0, total = 0) {
  const { width, height } = timeline; const s = width / 1080; const cols = width > height ? 3 : 2; const rows = Math.ceil(players.length / cols);
  const x0 = 58 * s; const y0 = height * 0.29; const gapX = 20 * s; const areaW = width - x0 * 2; const cellW = (areaW - gapX * (cols - 1)) / cols; const cellH = Math.min(62 * s, height * 0.50 / Math.max(rows, 1));
  players.forEach((player, index) => {
    const col = index % cols; const row = Math.floor(index / cols); const x = x0 + col * (cellW + gapX); const y = y0 + row * (cellH + 8 * s);
    ctx.fillStyle = WHITE; ctx.fillRect(x, y, cellW, cellH); drawRule(ctx, x, y + cellH, x + cellW, HAIR, s);
    drawText(ctx, String(player.number || String(index + 1).padStart(2, "0")), x + 12 * s, y + cellH / 2, 20 * s, { color: MUTED, weight: 800, family: "Rajdhani, Inter, sans-serif" });
    drawText(ctx, player.name, x + 48 * s, y + cellH * 0.40, 30 * s, { color: INK, weight: 900, maxWidth: cellW - 62 * s });
    drawText(ctx, player.extraBadge || player.position || "ELENCO", x + 48 * s, y + cellH * 0.75, 18 * s, { color: MUTED, weight: 800, maxWidth: cellW - 62 * s });
  });
  if (total > 1) drawText(ctx, `${String(page + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, width - 58 * s, height * 0.25, 11 * s, { color: MUTED, weight: 900, align: "right" });
}

export function paintEditorialRelated(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  const scene = relatedNightSceneAt(timeline, time); const players = timeline.players || []; const count = players.length;
  drawBase(ctx, timeline, { section: "Relacionados da noite", counter: `${String(count).padStart(2, "0")} NOMES` });
  if (scene?.type === "intro") {
    drawText(ctx, "QUEM VAI", timeline.width / 2, timeline.height * 0.38, timeline.width * 0.09, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawText(ctx, "FAZER A NOITE?", timeline.width / 2, timeline.height * 0.46, timeline.width * 0.072, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawText(ctx, `${count} RELACIONADOS`, timeline.width / 2, timeline.height * 0.53, 21 * timeline.width / 1080, { color: MUTED, weight: 800, align: "center" });
    return;
  }
  if (scene?.type === "finale") {
    drawText(ctx, "A LISTA.", 66 * timeline.width / 1080, timeline.height * 0.24, 44 * timeline.width / 1080, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif" });
    finalRoster(ctx, timeline, players);
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
}

function paintSingleAnnouncement(ctx, timeline, time, assets) {
  const scene = announceSceneAt(timeline, time); const person = scene?.person || timeline.person;
  const { width, height } = timeline; const s = width / 1080;
  if (!person) return;
  const first = scene?.type === "intro" ? 0 : scene?.type === "reveal" ? 0.5 : scene?.type === "hero" ? 1 : 1;
  const asset = assets?.byId?.[person.id] || assets?.players?.[0];
  const portraitY = height * (timeline.format === "feed" ? 0.14 : 0.16);
  const portraitH = height * (timeline.format === "feed" ? 0.52 : 0.58);
  const inset = 58 * s;
  ctx.save(); ctx.globalAlpha = ease(first); ctx.translate(Math.sin(time * 0.46) * 5 * s, (1 - ease(first)) * 24 * s);
  drawPortrait(ctx, asset, inset, portraitY, width - inset * 2, portraitH, person.name);
  drawRule(ctx, inset, portraitY + portraitH + 22 * s, width - inset, INK, 2 * s);
  drawText(ctx, timeline.announceType === "jogador" ? "NOVO CAPÍTULO" : "NOVO NOME", inset, portraitY + portraitH + 62 * s, 17 * s, { color: MUTED, weight: 900 });
  drawText(ctx, person.name, inset, portraitY + portraitH + 128 * s, 45 * s, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif", maxWidth: width - inset * 2 });
  drawText(ctx, [person.position, person.extraBadge].filter(Boolean).join("  ·  "), inset, portraitY + portraitH + 166 * s, 19 * s, { color: MUTED, weight: 800, maxWidth: width - inset * 2 });
  if (person.number !== "" && person.number != null) drawNumber(ctx, `#${person.number}`, width - inset, portraitY + portraitH + 164 * s, 19 * s, "right");
  if (timeline.phrase) drawText(ctx, timeline.phrase, inset, portraitY + portraitH + 220 * s, 19 * s, { color: GRAPHITE, weight: 700, maxWidth: width - inset * 2 });
  ctx.restore();
}

export function paintEditorialAnnounce(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.width) return;
  const count = timeline.people?.length || 0;
  drawBase(ctx, timeline, { section: timeline.kind === "team" ? "Elenco FC27" : "Anúncio oficial", counter: `${String(count).padStart(2, "0")} ${count === 1 ? "NOME" : "NOMES"}` });
  if (timeline.kind !== "team") { paintSingleAnnouncement(ctx, timeline, time, assets); return; }
  const scene = announceSceneAt(timeline, time);
  if (scene?.type === "intro") {
    drawText(ctx, "UMA NOVA", timeline.width / 2, timeline.height * 0.39, timeline.width * 0.083, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawText(ctx, "TEMPORADA.", timeline.width / 2, timeline.height * 0.47, timeline.width * 0.083, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif", align: "center" });
    drawText(ctx, `${count} NOMES · UM SÓ ESCUDO`, timeline.width / 2, timeline.height * 0.54, 12 * timeline.width / 1080, { color: MUTED, weight: 800, align: "center" });
    return;
  }
  if (scene?.type === "finale") {
    drawText(ctx, timeline.title || "ELENCO FC27", 58 * timeline.width / 1080, timeline.height * 0.23, 38 * timeline.width / 1080, { color: INK, weight: 900, family: "Rajdhani, Inter, sans-serif" });
    finalRoster(ctx, timeline, scene.people || [], scene.pageIndex || 0, scene.pageCount || 0);
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
}
