// The "night vision" model, painted: Agenda do dia and Relacionados da noite. Black and white,
// one face burnt out by its own glow, scan lines and noise, the headline in blackletter, small
// wide capitals set like a device's readouts, Rastro Blue for the details, a white blink on the
// hits, and the light going out at the end. The parts every piece shares are night-kit.js; when
// everything happens comes from night-plan.js; this file only draws one frame.
import {
  F, GLOW, GOTHIC, PALE, RASTRO_BLUE, WIDE, close, dashes, dayStamp, drawBand, drawCrest, drawFace, drawMedal, fit, flareAt, geometry, gothic,
  inCubic, lerp, linear, open, pad2, ramp, readout, widthOf, write,
} from "./night-kit.js";
import { nightPitch } from "./night-plan.js";

// ---------------------------------------------------------------- Agenda do dia
export function paintNightAgenda(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.night) return;
  const plan = timeline.night, g = geometry(timeline), t = time, matches = timeline.matches || [];
  const P1 = plan.pages[0]?.start ?? plan.back.agenda, R = plan.back.agenda;
  const games = t >= P1 && t < R, closing = t >= R;
  const punch = plan.punchAt ? plan.punchAt(t) : 0, flare = flareAt(plan, t);
  open(ctx, timeline, t, R);
  const away = games || closing ? 1 : ramp(t, plan.title.exit, P1 - plan.title.exit, inCubic);

  const subject = assets?.face?.bitmap || assets?.strix?.bitmap;
  drawFace(ctx, subject, g.box, { alpha: ramp(t, plan.intro[0], 0.8, linear) * (games ? 0.4 : 1), zoom: 1.03 + 0.06 * t / plan.duration, punch, flare, whole: !assets?.face?.bitmap });

  // the headline, and the band of readouts under it
  if (!games) {
    const head = Math.min(300 * g.s, fit(ctx, "Agenda", GOTHIC, 700, "normal", g.width - 180, 300));
    const top = g.band - head * 1.84 - 84 * g.k;
    const shown = closing ? 1 : 1 - away;
    const first = closing ? R : plan.title.agenda, second = closing ? plan.back.dodia : plan.title.dodia;
    if (t >= first) gothic(ctx, "Agenda", 74, top, head, { alpha: shown, soft: 1 - ramp(t, first, 0.27) });
    if (t >= second) gothic(ctx, "do Dia", 250, top + head * 0.84, head, { alpha: shown, soft: 1 - ramp(t, second, 0.27) });
    drawBand(ctx, g, closing ? ramp(t, R, 0.27, linear) : ramp(t, plan.title.fill, 0.27, linear) * (1 - away), { first: `${dayStamp(dayLabel)}\nBRASIL`, middle: `${pad2(matches.length)} ${matches.length === 1 ? "JOGO" : "JOGOS"}\nNOITE DE JOGO` });
  }
  dashes(ctx, g);

  // the games: three at a time, the one of the moment marked in blue
  plan.pages.forEach((page, p) => {
    const next = plan.pages[p + 1]?.start ?? R;
    if (t < page.start || t >= next) return;
    const gone = ramp(t, page.exit, next - page.exit, inCubic);
    ctx.save();
    ctx.globalAlpha *= 1 - gone;
    if (gone > 0.02 && typeof ctx.filter === "string") ctx.filter = `blur(${(18 * gone).toFixed(1)}px)`;
    readout(ctx, `AGENDA DO DIA   ·   ${p + 1} / ${plan.pages.length}`, g.width / 2, 330 * g.k, 20 * g.s, { align: "center", color: RASTRO_BLUE });
    page.rows.forEach((row, slot) => {
      if (t < row.at) return;
      const match = matches[row.index] || {}, top = (440 + slot * 400) * g.k, r = g.k;
      let other = 0;
      page.rows.forEach((item) => { if (item !== row) other = Math.max(other, ramp(t, item.lit, 0.13) * (1 - ramp(t, item.until, 0.17))); });
      const mine = ramp(t, row.lit, 0.13) * (1 - ramp(t, row.until, 0.2));
      ctx.save();
      ctx.globalAlpha *= 1 - 0.6 * other;
      ctx.fillStyle = RASTRO_BLUE; ctx.fillRect(56, top + 34 * r, 8, 170 * r * mine);
      write(ctx, match.kickoff || "—", 92, top + 26 * r, { weight: 900, size: 196 * r, stretch: "semi-expanded", tracking: -0.02, glow: 16, soft: 1 - ramp(t, row.at, 0.27) });
      drawCrest(ctx, assets?.opponents?.[row.index]?.bitmap, g.width - 260, top + 30 * r, 170 * r, ramp(t, row.at, 0.2, linear));
      const name = String(match.opponent || "Adversário").toUpperCase(), nameSize = fit(ctx, name, WIDE, 700, "expanded", g.width - 380, 46 * r, 0.04);
      write(ctx, name, 96, top + 252 * r, { weight: 700, size: nameSize, stretch: "expanded", tracking: 0.04, alpha: ramp(t, row.at + 0.1, 0.27) });
      const note = [String(match.competition || "Amistoso").toUpperCase(), match.leg === "ida" ? "JOGO IDA" : match.leg === "volta" ? "JOGO VOLTA" : ""].filter(Boolean).join("   ·   ");
      readout(ctx, note, 98, top + 314 * r, Math.min(19 * Math.max(r, 0.8), fit(ctx, note, WIDE, 700, "expanded", g.width - 190, 19, 0.12)), { color: RASTRO_BLUE, alpha: 0.9 * ramp(t, row.at + 0.2, 0.3) });
      ctx.restore();
    });
    ctx.restore();
  });

  close(ctx, timeline, t, flare);
}

// ---------------------------------------------------------------- Relacionados da noite
/** The pitch as thin lit lines, drawn from the goal line up as `grow` goes 0 → 1. */
function drawPitch(ctx, box, grow) {
  if (grow <= 0) return;
  const { x, y, w, h } = box, cx = x + w / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 30, y + h * (1 - grow) - 30, w + 60, h * grow + 60); ctx.clip();
  ctx.fillStyle = "rgba(6,6,6,0.5)"; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha *= 0.42; ctx.strokeStyle = PALE; ctx.lineWidth = 2.5; ctx.shadowColor = GLOW; ctx.shadowBlur = 12;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, y + h / 2, w * 0.13, 0, Math.PI * 2); ctx.stroke();
  for (const [edge, dir] of [[y, 1], [y + h, -1]]) {
    ctx.strokeRect(cx - w * 0.28, Math.min(edge, edge + dir * h * 0.15), w * 0.56, h * 0.15);
    ctx.strokeRect(cx - w * 0.12, Math.min(edge, edge + dir * h * 0.055), w * 0.24, h * 0.055);
    ctx.beginPath(); ctx.arc(cx, edge + dir * h * 0.15, w * 0.09, dir > 0 ? 0 : Math.PI, dir > 0 ? Math.PI : Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha /= 0.42; ctx.shadowBlur = 0; ctx.fillStyle = RASTRO_BLUE;
  ctx.beginPath(); ctx.arc(cx, y + h / 2, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** A short jolt of the whole cover on each hit, settling within a few frames. */
function coverShake(t, hits, k) {
  const power = Math.max(0, ...hits.map((at) => (t >= at ? Math.exp(-(t - at) / 0.07) : 0)));
  return { x: Math.sin(t * 97) * 14 * k * power, y: Math.cos(t * 83) * 10 * k * power };
}

/** A ring of Rastro blue leaving the crest on each hit, growing and fading as it goes. */
function coverRings(ctx, g, t, hits) {
  const cx = g.width / 2, cy = g.box.y + g.box.h * 0.42;
  ctx.save();
  ctx.strokeStyle = PALE; ctx.shadowColor = RASTRO_BLUE; ctx.shadowBlur = 30;
  for (const at of hits) {
    const p = (t - at) / 0.9;
    if (p < 0 || p > 1) continue;
    ctx.globalAlpha = 0.85 * (1 - p) ** 1.5;
    ctx.lineWidth = lerp(14, 2, p) * g.k;
    ctx.beginPath(); ctx.arc(cx, cy, lerp(120, 760, 1 - (1 - p) ** 3) * g.k, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** A slanted beam of light sweeping across the crest once, on its way in. */
function coverBeam(ctx, g, t, until) {
  const p = clampUnit(t / Math.max(F, until * 0.8));
  if (p <= 0 || p >= 1) return;
  const x = lerp(-0.4, 1.4, p) * g.width, y = g.box.y + g.box.h * 0.42;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(x, y); ctx.rotate(-0.42);
  const beam = ctx.createLinearGradient(-120 * g.k, 0, 120 * g.k, 0);
  beam.addColorStop(0, "rgba(47,128,255,0)"); beam.addColorStop(0.45, "rgba(120,176,255,0.35)"); beam.addColorStop(0.5, "rgba(255,255,255,0.55)"); beam.addColorStop(0.55, "rgba(120,176,255,0.35)"); beam.addColorStop(1, "rgba(47,128,255,0)");
  ctx.fillStyle = beam; ctx.fillRect(-120 * g.k, -g.height, 240 * g.k, g.height * 2);
  ctx.restore();
}

const clampUnit = (value) => Math.max(0, Math.min(1, value));

const SEPARATOR = "   ·   ";
/** Names set in a row, broken into lines no wider than `width` (a name is never split). */
function nameLines(ctx, names, size, width) {
  const lines = [];
  let line = "";
  for (const name of names) {
    const next = line ? line + SEPARATOR + name : name;
    if (line && widthOf(ctx, next, WIDE, 700, size, "expanded", 0.04) > width) { lines.push(line); line = name; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function paintNightRelated(ctx, { timeline, time = 0, assets, dayLabel = "" } = {}) {
  if (!timeline?.night) return;
  const plan = timeline.night, g = geometry(timeline), t = time, players = timeline.players || [];
  const pitch = timeline.pitch || nightPitch(players), S = plan.start;
  const punch = plan.punchAt ? plan.punchAt(t) : 0, flare = flareAt(plan, t);
  open(ctx, timeline, t, S, 1.06);
  const count = `${pad2(players.length)} ${players.length === 1 ? "NOME" : "NOMES"}`;
  const crest = assets?.strix?.bitmap, first = `${dayStamp(dayLabel)}\nBRASIL`;

  if (t < S) {
    // the cover: the crest comes in from close and lands on the first hit, each hit sends a
    // ring out of it, a beam of light crosses it, and the piece's name slides in word by word
    const { first: hit1, second: hit2 } = plan.title;
    const landed = ramp(t, hit1, 0.35), shake = coverShake(t, [hit1, hit2], g.k);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    coverRings(ctx, g, t, [0, hit1, hit2]);
    drawFace(ctx, crest, g.box, { alpha: ramp(t, 0, 0.35, linear), zoom: lerp(lerp(1.5, 1.18, ramp(t, 0, hit1, linear)), 1.03, landed) + 0.05 * punch, punch, flare, whole: true });
    coverBeam(ctx, g, t, S);
    ctx.restore();
    readout(ctx, `NOITE DE JOGO   ·   ${count}`, g.width / 2, 120 * g.k, 18 * g.s, { align: "center", color: RASTRO_BLUE, alpha: ramp(t, 0.1, 0.3) * (0.75 + 0.25 * Math.sin(t * 18)) });
    const head = Math.min(230 * g.s, fit(ctx, "Relacionados", GOTHIC, 700, "normal", g.width - 150, 230));
    const top = g.band - head * 1.84 - 84 * g.k;
    if (t >= hit1) gothic(ctx, "Relacionados", 74 - 160 * (1 - ramp(t, hit1, 0.3)), top, head, { soft: 1 - ramp(t, hit1, 0.27) });
    if (t >= hit2) gothic(ctx, "da Noite", 250 + 160 * (1 - ramp(t, hit2, 0.3)), top + head * 0.84, head, { soft: 1 - ramp(t, hit2, 0.27) });
    drawBand(ctx, g, ramp(t, hit2, 0.27, linear), { first, middle: `${count}\nNOITE DE JOGO` });
  } else {
    // the pitch: every line of the team lands on a strong beat, from the goal forward
    drawFace(ctx, crest, g.box, { alpha: 0.2, zoom: 1.03, punch, flare, whole: true });
    // With a line-up the headline is the eleven, set in the readouts' heavy wide capitals
    // (blackletter capitals do not read); without one it stays the piece's blackletter name.
    if (pitch.lined) write(ctx, "XI INICIAL", g.width / 2, 168 * g.k, { weight: 900, size: Math.min(96 * g.s, fit(ctx, "XI INICIAL", WIDE, 900, "expanded", g.width - 300, 96, 0.06)), stretch: "expanded", tracking: 0.06, align: "center", glow: 18, soft: 1 - ramp(t, S, 0.27) });
    else gothic(ctx, "Relacionados", g.width / 2, 150 * g.k, Math.min(132 * g.s, fit(ctx, "Relacionados", GOTHIC, 700, "normal", g.width - 300, 132)), { align: "center", soft: 1 - ramp(t, S, 0.27) });
    const box = { x: 70, y: 318 * g.k, w: g.width - 140, h: 1030 * g.k };
    drawPitch(ctx, box, ramp(t, S, 0.5));
    const rows = pitch.rows, gap = rows.length > 1 ? 0.81 * box.h / (rows.length - 1) : box.h;
    const most = Math.max(1, ...rows.map((row) => row.length)), radius = Math.min(70 * g.k, gap * 0.33, box.w / most * 0.29);
    rows.forEach((row, i) => {
      const line = plan.lines[i] ?? S, column = Math.min(260, box.w / row.length - 14);
      row.forEach((entry, j) => {
        const arrive = line + j * F * 2;
        if (t < arrive) return;
        const player = entry.player, x = box.x + entry.u * box.w;
        // The wings stand a little ahead of the two in the middle.
        const y = box.y + box.h * (rows.length > 1 ? 0.885 - i * 0.81 / (rows.length - 1) : 0.5) - (row.length === 4 && player.position === "ALA" ? gap * 0.14 : 0);
        const photo = assets?.byId?.[player.id]?.bitmap || assets?.players?.[entry.index]?.bitmap;
        const number = player.number !== "" && player.number != null ? pad2(player.number) : "";
        drawMedal(ctx, photo, x, y, radius * lerp(1.4, 1, ramp(t, arrive, 0.3)), { alpha: ramp(t, arrive, 0.1, linear), flare: Math.exp(-(t - arrive) / 0.12), fallback: number || String(player.name || "?").slice(0, 2).toUpperCase() });
        const name = String(player.name || "").toUpperCase(), size = Math.min(30 * g.s, fit(ctx, name, WIDE, 700, "expanded", column, 30, 0.04));
        const note = [player.position, photo && number ? `Nº ${number}` : ""].filter(Boolean).join("  ·  "), small = 16 * g.s, shown = ramp(t, arrive + 0.08, 0.25);
        // a dark plate under the name, so the pitch's lines do not cross it
        const plate = Math.max(widthOf(ctx, name, WIDE, 700, size, "expanded", 0.04), widthOf(ctx, note, WIDE, 700, small, "expanded", 0.12)) + 22;
        ctx.save(); ctx.globalAlpha *= shown; ctx.fillStyle = "rgba(6,6,6,0.78)"; ctx.fillRect(x - plate / 2, y + radius + 8, plate, size * 0.72 + small + 24); ctx.restore();
        write(ctx, name, x, y + radius + 15, { weight: 700, size, stretch: "expanded", tracking: 0.04, align: "center", alpha: shown });
        readout(ctx, note, x, y + radius + 23 + size * 0.72, small, { align: "center", color: RASTRO_BLUE, alpha: ramp(t, arrive + 0.14, 0.25) });
      });
    });
    // who is on the list for the night's other games
    if (plan.strip != null && t >= plan.strip && pitch.bench.length) {
      const top = box.y + box.h + 46 * g.k, names = pitch.bench.map((entry) => String(entry.player.name || "").toUpperCase());
      readout(ctx, "RELACIONADOS", 74, top, 16 * g.s, { color: RASTRO_BLUE, alpha: ramp(t, plan.strip, 0.25) });
      let size = 27 * g.s, lines = nameLines(ctx, names, size, g.width - 148);
      while (lines.length > 2 && size > 15) { size -= 2; lines = nameLines(ctx, names, size, g.width - 148); }
      lines.slice(0, 3).forEach((line, i) => write(ctx, line, 74, top + 34 * g.s + i * size * 1.45, { weight: 700, size, stretch: "expanded", tracking: 0.04, alpha: ramp(t, plan.strip + 0.07 + i * 0.07, 0.25) }));
    }
    drawBand(ctx, g, 1, { first, middle: `${count}\nNOITE DE JOGO` });
  }
  dashes(ctx, g);
  close(ctx, timeline, t, flare);
}
