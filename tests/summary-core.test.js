import test from "node:test";
import assert from "node:assert/strict";
import {
  collectPeriodSummary,
  fingerprintSummaryRender,
  saoPauloWeekBounds,
  SUMMARY_TEMPLATE_VERSION,
  summaryDurationSeconds,
  summaryFileName,
} from "../src/features/media/summary-core.js";
import { buildSummaryTimeline } from "../src/features/media/summary-timeline.js";
import { describeSummaryFrame, summaryFrameTime, renderSummaryFrame } from "../src/features/media/summary-frame.js";

const now = new Date("2026-09-03T18:00:00-03:00");

function match(id, iso, strix, opponent, name = "POA CITY") {
  return {
    id,
    played_at: `${iso}T21:10:00-03:00`,
    opponent_name: name,
    strix_score: strix,
    opponent_score: opponent,
    competition_name: "Superliga Yeshua",
  };
}

test("resumo do dia filtra só o dia de São Paulo e ignora sem placar", () => {
  const workspace = {
    matches: [
      match("a", "2026-09-03", 3, 1),
      match("b", "2026-09-03", 1, 1, "Maquina"),
      match("c", "2026-09-02", 2, 0, "Summit"),
      { id: "d", played_at: "2026-09-03T22:00:00-03:00", opponent_name: "Sem placar" },
    ],
  };
  const day = collectPeriodSummary(workspace, { mode: "day", now });
  assert.equal(day.mode, "day");
  assert.equal(day.matches.length, 2);
  assert.equal(day.stats.wins, 1);
  assert.equal(day.stats.draws, 1);
  assert.equal(day.stats.goalsFor, 4);
  assert.equal(day.title, "RESUMO DO DIA");
});

test("resumo da semana cobre segunda a domingo em São Paulo", () => {
  const week = saoPauloWeekBounds(now);
  assert.equal(week.start, "2026-08-31");
  assert.equal(week.end, "2026-09-06");
  const workspace = {
    matches: [
      match("a", "2026-08-31", 2, 0),
      match("b", "2026-09-03", 1, 2, "Genius"),
      match("c", "2026-09-07", 4, 1, "Fora"),
    ],
  };
  const summary = collectPeriodSummary(workspace, { mode: "week", now });
  assert.equal(summary.mode, "week");
  assert.equal(summary.matches.length, 2);
  assert.equal(summary.stats.wins, 1);
  assert.equal(summary.stats.losses, 1);
  assert.equal(summary.title, "RESUMO DA SEMANA");
});

test("fingerprint muda quando o placar muda", async () => {
  const base = {
    mode: "day",
    day: "2026-09-03",
    format: "story",
    templateVersion: SUMMARY_TEMPLATE_VERSION,
    matches: [{ id: "a", opponent: "POA", opponent_logo: "x.png", competition: "Amistoso", played_at: "t", strix_score: 2, opponent_score: 1 }],
  };
  const original = await fingerprintSummaryRender(base);
  const same = await fingerprintSummaryRender({ ...base, matches: [{ ...base.matches[0] }] });
  const changed = await fingerprintSummaryRender({
    ...base,
    matches: [{ ...base.matches[0], strix_score: 3 }],
  });
  assert.equal(original, same);
  assert.notEqual(original, changed);
  assert.equal(summaryFileName({ day: "2026-09-03", mode: "week", format: "story" }), "strix-resumo-semana-2026-09-03-story.mp4");
});

test("período sem jogos não gera composição", () => {
  const empty = collectPeriodSummary({ matches: [] }, { mode: "day", now });
  const timeline = buildSummaryTimeline(empty, { format: "story" });
  assert.equal(empty.matches.length, 0);
  assert.equal(summaryDurationSeconds(0), 0);
  assert.equal(timeline.duration, 0);
  assert.equal(timeline.totalFrames, 0);
  assert.equal(describeSummaryFrame(timeline, 0).sceneType, "none");
});

test("timeline cobre opening, números, resultados e fechamento", () => {
  const period = collectPeriodSummary({
    matches: [match("a", "2026-09-03", 2, 1), match("b", "2026-09-03", 0, 0, "Maquina")],
  }, { mode: "day", now });
  const timeline = buildSummaryTimeline(period, { format: "story" });
  assert.equal(describeSummaryFrame(timeline, 0.4).sceneType, "intro");
  assert.equal(describeSummaryFrame(timeline, timeline.statsStart + 0.2).sceneType, "stats");
  assert.equal(describeSummaryFrame(timeline, timeline.statsEnd + 0.2).sceneType, "result");
  assert.equal(describeSummaryFrame(timeline, timeline.outroStart - 0.05).sceneType, "finale");
  assert.equal(summaryDurationSeconds(2), timeline.outroStart);
  assert.equal(timeline.duration, timeline.outroStart + 5);
  assert.ok(timeline.duration >= 8 && timeline.duration <= 22);
});

test("preview e encode compartilham o relógio do resumo", () => {
  const period = collectPeriodSummary({
    matches: [match("a", "2026-09-03", 1, 0)],
  }, { mode: "day", now });
  const timeline = buildSummaryTimeline(period, { format: "story" });
  const times = [];
  for (let index = 0; index < timeline.totalFrames; index += 1) times.push(summaryFrameTime(index, timeline));
  for (let index = 1; index < times.length; index += 1) {
    assert.ok(times[index] >= times[index - 1]);
  }
});

test("painter cobre intro, stats, resultado e finale", () => {
  const period = collectPeriodSummary({
    matches: [match("a", "2026-09-03", 3, 1), match("b", "2026-09-03", 2, 2, "Summit")],
  }, { mode: "day", now });
  const timeline = buildSummaryTimeline(period, { format: "story" });
  const ctx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    clip() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    moveTo() {},
    lineTo() {},
    rect() {},
    arc() {},
    translate() {},
    scale() {},
    setLineDash() {},
    drawImage() {},
    measureText(text) { return { width: String(text).length * 10 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    textAlign: "left",
    textBaseline: "alphabetic",
  };
  const assets = { strix: { bitmap: null, initials: "SU" }, opponents: [{ bitmap: null, initials: "PC" }] };
  assert.doesNotThrow(() => renderSummaryFrame(ctx, { timeline, timeSec: 0.5, assets, dayLabel: "03 DE SET" }));
  assert.doesNotThrow(() => renderSummaryFrame(ctx, { timeline, timeSec: timeline.statsStart + 0.3, assets }));
  assert.doesNotThrow(() => renderSummaryFrame(ctx, { timeline, timeSec: timeline.statsEnd + 0.3, assets }));
  assert.doesNotThrow(() => renderSummaryFrame(ctx, { timeline, timeSec: timeline.finaleStart + 0.4, assets }));
});

test("the summary can be made for an earlier day: only days with imported results are offered", async () => {
  const { summaryPeriods, defaultSummaryPeriod, collectPeriodSummary, summaryInstant } = await import("../src/features/media/summary-core.js");
  const workspace = { matches: [
    { id: "a", played_at: "2026-10-03T21:10:00-03:00", opponent_name: "POA CITY", strix_score: 2, opponent_score: 1 },
    { id: "b", played_at: "2026-10-03T23:40:00-03:00", opponent_name: "SUMMIT", strix_score: 0, opponent_score: 0 },
    { id: "c", played_at: "2026-10-01T22:10:00-03:00", opponent_name: "CTX", strix_score: 1, opponent_score: 3 },
    { id: "d", played_at: "2026-09-25T22:10:00-03:00", opponent_name: "SEM PLACAR" },
  ] };
  const now = new Date("2026-10-04T00:22:00-03:00");
  const days = summaryPeriods(workspace, { mode: "day", now });
  assert.deepEqual(days.map((entry) => [entry.key, entry.count]), [["2026-10-04", 0], ["2026-10-03", 2], ["2026-10-01", 1]]);
  assert.deepEqual(days.slice(0, 2).map((entry) => entry.label), ["HOJE", "ONTEM"]);
  assert.match(days[2].label, /^01 /);
  assert.equal(defaultSummaryPeriod(days), "2026-10-03", "depois da meia-noite o resumo abre no último dia com jogos");
  const yesterday = collectPeriodSummary(workspace, { mode: "day", now: summaryInstant("2026-10-03") });
  assert.deepEqual(yesterday.matches.map((match) => match.id), ["a", "b"]);
  assert.equal(yesterday.day, "2026-10-03");
  const weeks = summaryPeriods(workspace, { mode: "week", now });
  assert.equal(weeks[0].label, "ESTA SEMANA");
  assert.equal(weeks[0].count, 3);
  assert.equal(weeks.length, 1, "uma partida sem placar não cria período");
});
