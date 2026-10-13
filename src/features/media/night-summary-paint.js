// Resumo do dia / da semana in the "night vision" model: the cover (the face, the headline), the
// results three at a time, each score landing on a hit, then the record of the period over the
// face, and the light going out. The shared parts are night-kit.js; the timing is night-plan.js
// `planNightSummary`.
import {
  GOTHIC, RASTRO_BLUE, WIDE, close, dashes, dayStamp, drawBand, drawCrest, drawFace, fit, flareAt, geometry, gothic, inCubic, linear, open, pad2,
  ramp, readout, shade, write,
} from "./night-kit.js";

const RESULT = { W: "VITÓRIA", D: "EMPATE", L: "DERROTA" };

/** The period as the band's first readout: a day in one line, a week in two ("05 OUT –" / "11 OUT 2026"). */
function periodStamp(period) {
  const [from, to] = dayStamp(period.rangeLabel).split(/\s+–\s+/);
  return to ? `${from} –\n${to}` : `${from}\nBRASIL`;
}

export function paintNightSummary(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.night) return;
  const plan = timeline.night, g = geometry(timeline), t = time, matches = timeline.matches || [], period = timeline.period || {};
  const week = period.mode === "week", stats = period.stats || {};
  const P1 = plan.pages[0]?.start ?? plan.totals.start, T = plan.totals.start;
  const results = t >= P1 && t < T, totals = t >= T;
  const punch = plan.punchAt ? plan.punchAt(t) : 0, flare = flareAt(plan, t);
  open(ctx, timeline, t, T);
  const away = results || totals ? 1 : ramp(t, plan.title.exit, P1 - plan.title.exit, inCubic);
  const band = { first: periodStamp(period), middle: `${pad2(matches.length)} ${matches.length === 1 ? "JOGO" : "JOGOS"}\n${stats.wins || 0}V  ${stats.draws || 0}E  ${stats.losses || 0}D` };

  const subject = assets?.face?.bitmap || assets?.strix?.bitmap;
  drawFace(ctx, subject, g.box, { alpha: ramp(t, plan.intro[0], 0.8, linear) * (results ? 0.4 : 1), zoom: 1.03 + 0.06 * t / plan.duration, punch, flare, whole: !assets?.face?.bitmap });

  // the cover: the headline and the band of readouts under it
  if (!results && !totals) {
    const second = week ? "da Semana" : "do Dia", inset = week ? 110 : 250;
    const head = Math.min(300 * g.s, fit(ctx, "Resumo", GOTHIC, 700, "normal", g.width - 180, 300), fit(ctx, second, GOTHIC, 700, "normal", g.width - inset - 70, 300));
    const top = g.band - head * 1.84 - 84 * g.k;
    if (t >= plan.title.first) gothic(ctx, "Resumo", 74, top, head, { alpha: 1 - away, soft: 1 - ramp(t, plan.title.first, 0.27) });
    if (t >= plan.title.second) gothic(ctx, second, inset, top + head * 0.84, head, { alpha: 1 - away, soft: 1 - ramp(t, plan.title.second, 0.27) });
    drawBand(ctx, g, ramp(t, plan.title.fill, 0.27, linear) * (1 - away), band);
  }
  dashes(ctx, g);

  // the results: three at a time, the one of the moment marked in blue
  plan.pages.forEach((page, p) => {
    const next = plan.pages[p + 1]?.start ?? T;
    if (t < page.start || t >= next) return;
    const gone = ramp(t, page.exit, next - page.exit, inCubic);
    ctx.save();
    ctx.globalAlpha *= 1 - gone;
    if (gone > 0.02 && typeof ctx.filter === "string") ctx.filter = `blur(${(18 * gone).toFixed(1)}px)`;
    readout(ctx, `${period.title || "RESUMO"}   ·   ${p + 1} / ${plan.pages.length}`, g.width / 2, 330 * g.k, 20 * g.s, { align: "center", color: RASTRO_BLUE });
    page.rows.forEach((row, slot) => {
      if (t < row.at) return;
      const match = matches[row.index] || {}, top = (440 + slot * 400) * g.k, r = g.k;
      let other = 0;
      page.rows.forEach((item) => { if (item !== row) other = Math.max(other, ramp(t, item.lit, 0.13) * (1 - ramp(t, item.until, 0.17))); });
      const mine = ramp(t, row.lit, 0.13) * (1 - ramp(t, row.until, 0.2));
      ctx.save();
      ctx.globalAlpha *= 1 - 0.6 * other;
      ctx.fillStyle = RASTRO_BLUE; ctx.fillRect(56, top + 34 * r, 8, 170 * r * mine);
      const score = `${match.strix_score ?? "–"}–${match.opponent_score ?? "–"}`;
      write(ctx, score, 92, top + 26 * r, { weight: 900, size: Math.min(196 * r, fit(ctx, score, WIDE, 900, "semi-expanded", g.width - 420, 196)), stretch: "semi-expanded", tracking: -0.02, glow: 16, soft: 1 - ramp(t, row.at, 0.27) });
      drawCrest(ctx, assets?.opponents?.[row.index]?.bitmap, g.width - 260, top + 30 * r, 170 * r, ramp(t, row.at, 0.2, linear));
      const name = String(match.opponent || "Adversário").toUpperCase(), nameSize = fit(ctx, name, WIDE, 700, "expanded", g.width - 380, 46 * r, 0.04);
      write(ctx, name, 96, top + 252 * r, { weight: 700, size: nameSize, stretch: "expanded", tracking: 0.04, alpha: ramp(t, row.at + 0.1, 0.27) });
      const note = [RESULT[match.result] || "", String(match.competition || "Amistoso").toUpperCase(), week ? match.dateLabel || "" : ""].filter(Boolean).join("   ·   ");
      readout(ctx, note, 98, top + 314 * r, Math.min(19 * Math.max(r, 0.8), fit(ctx, note, WIDE, 700, "expanded", g.width - 190, 19, 0.12)), { color: RASTRO_BLUE, alpha: 0.9 * ramp(t, row.at + 0.2, 0.3) });
      ctx.restore();
    });
    ctx.restore();
  });

  // the record of the period: wins, draws and defeats, each on a hit, then the goals
  if (totals) {
    const span = (g.width - 148) / 3, size = 240 * g.s, lineTop = g.band - 52 * g.s, labelTop = lineTop - 62 * g.s, numberTop = labelTop - 30 * g.s - size * 0.72;
    const word = Math.min(190 * g.s, fit(ctx, "Retrospecto", GOTHIC, 700, "normal", g.width - 150, 190)), wordTop = numberTop - 44 * g.s - word * 0.86;
    shade(ctx, g, wordTop, ramp(t, T, 0.3, linear));
    gothic(ctx, "Retrospecto", 74, wordTop, word, { soft: 1 - ramp(t, T, 0.27) });
    [[stats.wins, "VITÓRIAS", T], [stats.draws, "EMPATES", plan.totals.draws], [stats.losses, "DERROTAS", plan.totals.losses]].forEach(([value, label, at], i) => {
      if (t < at) return;
      const text = String(value || 0), x = 74 + i * span;
      write(ctx, text, x, numberTop, { weight: 900, size: Math.min(size, fit(ctx, text, WIDE, 900, "semi-expanded", span - 40, size)), stretch: "semi-expanded", tracking: -0.02, glow: 16, soft: 1 - ramp(t, at, 0.27) });
      readout(ctx, label, x + 4, labelTop, 24 * g.s, { color: RASTRO_BLUE, alpha: ramp(t, at + 0.08, 0.25) });
    });
    const goals = `GOLS ${pad2(stats.goalsFor || 0)} : ${pad2(stats.goalsAgainst || 0)}   ·   APROVEITAMENTO ${stats.efficiency || 0}%`;
    readout(ctx, goals, 78, lineTop, Math.min(22 * g.s, fit(ctx, goals, WIDE, 700, "expanded", g.width - 156, 22, 0.12)), { alpha: ramp(t, plan.totals.line, 0.3) });
    drawBand(ctx, g, ramp(t, T, 0.27, linear), band);
  }

  close(ctx, timeline, t, flare);
}
