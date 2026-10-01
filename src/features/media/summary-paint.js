import { opponentInitials } from "./agenda-media-core.js";
import { logoDrawRect } from "./agenda-paint.js";
import { easeInOutCubic, easeOutExpo, easeOutQuart, reveal } from "./agenda-timeline.js";
import { summarySceneAt } from "./summary-timeline.js";

const INK = "#efece6";
const MUTED = "#a3a8ae";
const VOID = "#050607";
const RULE = "rgba(239,236,230,0.42)";

function clamp(value) {
  return Math.max(0, Math.min(1, value));
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

function drawMark(ctx, asset, x, y, box, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  if (asset?.bitmap) {
    const rect = logoDrawRect(asset, box);
    ctx.drawImage(asset.bitmap, rect.sx, rect.sy, rect.sw, rect.sh, -rect.dw / 2, -rect.dh / 2, rect.dw, rect.dh);
  } else {
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(box * 0.42)}px Rajdhani, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(asset?.initials || opponentInitials(asset?.name), 0, 2);
  }
  ctx.restore();
}

function paintAmbient(ctx, timeline, time) {
  const { width, height } = timeline;
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (let index = 0; index < 14; index += 1) {
    const x = width * (0.08 + index * 0.07) + Math.sin(time * 0.18 + index) * 6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 40, height);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(width * 0.42)}px Rajdhani, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("STRIX", width * 0.5 + Math.sin(time * 0.14) * 10, height * 0.38);
  ctx.restore();
  const sweep = ((time * 0.12) % 1.3) - 0.2;
  const light = ctx.createLinearGradient(width * sweep, 0, width * sweep + 240, 0);
  light.addColorStop(0, "rgba(255,255,255,0)");
  light.addColorStop(0.5, "rgba(255,255,255,0.045)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);
}

function paintCorners(ctx, timeline, alpha = 0.35) {
  const { width, height, safe } = timeline;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  const inset = 18;
  const arm = 36;
  [
    [safe.side, safe.top],
    [width - safe.side, safe.top],
    [safe.side, height - safe.bottom],
    [width - safe.side, height - safe.bottom],
  ].forEach(([x, y], index) => {
    const sx = index % 2 === 0 ? 1 : -1;
    const sy = index < 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, y + sy * arm);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * arm, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + sx * inset, y);
    ctx.lineTo(x + sx * inset, y + sy * inset);
    ctx.stroke();
  });
  ctx.restore();
}

function paintIntro(ctx, timeline, time) {
  const { width, safe, period } = timeline;
  const fade = time > timeline.introEnd - 0.28
    ? 1 - reveal(time, timeline.introEnd - 0.28, 0.28, easeInOutCubic)
    : 1;
  const title = reveal(time, 0.08, 0.42, easeOutExpo) * fade;
  const meta = reveal(time, 0.5, 0.3, easeOutQuart) * fade;
  const words = String(period?.title || "RESUMO DO DIA").split(" ");
  ctx.save();
  ctx.globalAlpha = reveal(time, 0, 0.28, easeOutQuart) * fade;
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  const bar = reveal(time, 0, 0.32, easeOutExpo);
  ctx.beginPath();
  ctx.moveTo(width / 2 - 220 * bar, safe.top + 72);
  ctx.lineTo(width / 2 + 220 * bar, safe.top + 72);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = title;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = "800 22px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", width / 2, safe.top + 54);
  ctx.fillStyle = INK;
  ctx.font = "700 96px Rajdhani, sans-serif";
  ctx.save();
  ctx.translate(width / 2, safe.top + 210);
  ctx.beginPath();
  ctx.rect(-width * 0.5, -90, width * Math.max(title, 0.08), 240);
  ctx.clip();
  ctx.fillText(words[0] || "RESUMO", 0, 0);
  ctx.fillText(words.slice(1).join(" ") || "DO DIA", 0, 92);
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = meta;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "700 28px Inter, sans-serif";
  ctx.fillText(period?.rangeLabel || "", width / 2, safe.top + 430);
  ctx.font = "800 44px Inter, sans-serif";
  ctx.fillText(`${String(period?.stats?.games || 0).padStart(2, "0")} JOGOS`, width / 2, safe.top + 492);
  ctx.restore();
}

function paintStats(ctx, timeline, time) {
  const { width, safe, period } = timeline;
  const local = time - timeline.statsStart;
  const enter = reveal(local, 0, 0.32, easeOutExpo);
  const exit = time > timeline.statsEnd - 0.22
    ? 1 - reveal(time, timeline.statsEnd - 0.22, 0.22, easeInOutCubic)
    : 1;
  const presence = enter * exit;
  if (presence <= 0.01) return;
  const stats = period?.stats || {};
  const cells = [
    ["JOGOS", String(stats.games || 0).padStart(2, "0")],
    ["VITÓRIAS", String(stats.wins || 0).padStart(2, "0")],
    ["EMPATES", String(stats.draws || 0).padStart(2, "0")],
    ["DERROTAS", String(stats.losses || 0).padStart(2, "0")],
    ["GOLS PRÓ", String(stats.goalsFor || 0).padStart(2, "0")],
    ["GOLS SOFRIDOS", String(stats.goalsAgainst || 0).padStart(2, "0")],
  ];
  const gap = 22;
  const cellW = (width - safe.side * 2 - gap) / 2;
  const cellH = 168;
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillText("DESEMPENHO", safe.side, safe.top + 36);
  ctx.fillStyle = INK;
  ctx.font = "700 42px Rajdhani, sans-serif";
  ctx.fillText(period?.title || "RESUMO", safe.side, safe.top + 82);
  cells.forEach((cell, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = safe.side + col * (cellW + gap);
    const y = safe.top + 130 + row * (cellH + 18) + (1 - enter) * 24;
    ctx.fillStyle = "rgba(14,16,20,0.92)";
    roundRectPath(ctx, x, y, cellW, cellH, 10);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillRect(x, y, 6, cellH);
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    ctx.font = "800 18px Inter, sans-serif";
    ctx.fillText(cell[0], x + 24, y + 42);
    ctx.fillStyle = INK;
    ctx.font = "700 78px Rajdhani, sans-serif";
    ctx.fillText(cell[1], x + 24, y + 126);
  });
  const saldo = Number(stats.goalDifference || 0);
  const saldoLabel = `${saldo > 0 ? "+" : ""}${saldo}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = "800 22px Inter, sans-serif";
  ctx.fillText(
    `SALDO ${saldoLabel}   ·   APROVEITAMENTO ${String(stats.efficiency || 0).padStart(2, "0")}%`,
    width / 2,
    safe.top + 130 + 3 * (cellH + 18) + 18,
  );
  ctx.restore();
}

function resultWord(code) {
  if (code === "W") return "VITÓRIA";
  if (code === "L") return "DERROTA";
  return "EMPATE";
}

function paintResult(ctx, timeline, scene, time, assets) {
  const { width, height, safe, matches } = timeline;
  const local = time - scene.start;
  const enter = reveal(local, 0, 0.28, easeOutExpo);
  const exit = time > scene.end - 0.2 ? 1 - reveal(time, scene.end - 0.2, 0.2, easeInOutCubic) : 1;
  const presence = enter * exit;
  if (presence <= 0.01) return;
  const match = scene.match;
  const seq = String((scene.index || 0) + 1).padStart(2, "0");
  const opponent = assets?.opponents?.[scene.index] || { initials: match.initials, name: match.opponent };
  const strix = assets?.strix;
  ctx.save();
  ctx.globalAlpha = presence;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText(`JOGO ${seq}  ·  ${String(matches.length).padStart(2, "0")}`, safe.side, safe.top + 28);
  ctx.textAlign = "right";
  ctx.fillText(match.dateLabel, width - safe.side, safe.top + 28);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = "800 28px Inter, sans-serif";
  ctx.fillText(resultWord(match.result), width / 2, safe.top + 120);
  ctx.font = "700 160px Rajdhani, sans-serif";
  ctx.fillText(`${match.strix_score}  –  ${match.opponent_score}`, width / 2, safe.top + 300 + (1 - enter) * 30);
  drawMark(ctx, strix, width * 0.28, height * 0.58, 128, presence);
  drawMark(ctx, opponent, width * 0.72, height * 0.58, 128, presence);
  ctx.fillStyle = MUTED;
  ctx.font = "800 36px Inter, sans-serif";
  ctx.fillText("×", width / 2, height * 0.585);
  ctx.fillStyle = INK;
  ctx.font = "700 34px Rajdhani, sans-serif";
  ctx.fillText("STRIX UNITED", width * 0.28, height * 0.58 + 96);
  ctx.fillText(fitText(ctx, String(match.opponent || "").toUpperCase(), width * 0.34, ctx.font), width * 0.72, height * 0.58 + 96);
  ctx.fillStyle = MUTED;
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillText(String(match.competition || "AMISTOSO").toUpperCase(), width / 2, height - safe.bottom - 36);
  ctx.restore();
}

function paintFinale(ctx, timeline, time, assets) {
  const { width, height, safe, matches, period, finaleStart } = timeline;
  const enter = reveal(time - finaleStart, 0, 0.36, easeOutExpo);
  if (enter <= 0.01) return;
  const count = matches.length;
  const columns = count >= 8 ? 2 : 1;
  const rows = Math.ceil(count / columns);
  const dense = count >= 6;
  const startY = safe.top + 110;
  const endY = height - safe.bottom - 70;
  const row = (endY - startY) / Math.max(rows, 1);
  const colW = (width - safe.side * 2) / columns;
  ctx.save();
  ctx.globalAlpha = enter;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText(period?.title || "RESUMO", safe.side, safe.top + 30);
  ctx.fillStyle = INK;
  ctx.font = "700 48px Rajdhani, sans-serif";
  ctx.fillText("RESULTADOS", safe.side, safe.top + 78);
  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillText(period?.rangeLabel || "", width - safe.side, safe.top + 78);
  matches.forEach((match, index) => {
    const col = index % columns;
    const rowIndex = Math.floor(index / columns);
    const cx = safe.side + col * colW + colW / 2;
    const y = startY + rowIndex * row + row * 0.55;
    const opponent = assets?.opponents?.[index];
    ctx.fillStyle = "rgba(239,236,230,0.08)";
    ctx.font = `800 ${dense ? 32 : 54}px Rajdhani, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(String(index + 1).padStart(2, "0"), cx - colW * 0.42, y);
    ctx.fillStyle = INK;
    ctx.font = `700 ${dense ? 32 : 44}px Rajdhani, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${match.strix_score} – ${match.opponent_score}`, cx, y - (dense ? 10 : 14));
    drawMark(ctx, assets?.strix, cx - colW * 0.18, y - (dense ? 8 : 12), dense ? 30 : 46, enter);
    drawMark(ctx, opponent, cx + colW * 0.18, y - (dense ? 8 : 12), dense ? 30 : 46, enter);
    ctx.fillStyle = MUTED;
    ctx.font = `800 ${dense ? 13 : 16}px Inter, sans-serif`;
    ctx.fillText(fitText(ctx, String(match.opponent || "").toUpperCase(), colW * 0.7, ctx.font), cx, y + (dense ? 18 : 24));
  });
  ctx.fillStyle = MUTED;
  ctx.font = "800 18px Inter, sans-serif";
  ctx.fillText("STRIX UNITED", width / 2, height - safe.bottom + 36);
  ctx.restore();
}

export function paintSummaryFrame(ctx, { timeline, time, assets, dayLabel }) {
  if (!ctx || !timeline) return;
  paintAmbient(ctx, timeline, time);
  paintCorners(ctx, timeline, 0.28 + Math.sin(time * 0.6) * 0.04);
  const scene = summarySceneAt(timeline, time);
  if (time < timeline.introEnd) paintIntro(ctx, timeline, time, dayLabel);
  if (scene?.type === "stats") paintStats(ctx, timeline, time);
  if (scene?.type === "result") paintResult(ctx, timeline, scene, time, assets);
  if (time >= timeline.finaleStart) paintFinale(ctx, timeline, time, assets);
}
