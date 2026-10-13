import test from "node:test";
import assert from "node:assert/strict";
import { matchNightDay } from "../src/features/agenda/agenda-time.js";
import { matchClock, smallHoursNight, withMatchClock } from "../src/features/matches/match-clock.js";
import { collectPeriodSummary, summaryPeriods } from "../src/features/media/summary-core.js";
import { summarizeNight } from "../src/features/statistics/statistics-core.js";

const sp = (date, time) => new Date(`${date}T${time}:00-03:00`).toISOString();

test("a revisão mostra a data e a hora de São Paulo, não a data de Londres", () => {
  // 23:40 do dia 8 em São Paulo já é dia 9 em UTC: o campo de data tem de mostrar 8.
  assert.deepEqual(matchClock(sp("2026-10-08", "23:40")), { date: "2026-10-08", time: "23:40" });
  assert.deepEqual(matchClock(sp("2026-10-09", "00:05")), { date: "2026-10-09", time: "00:05" });
  assert.deepEqual(matchClock("nada"), { date: "", time: "" });
});

test("mudar a hora não mexe na data, e mudar a data não mexe na hora", () => {
  let at = sp("2026-10-08", "21:10");
  at = withMatchClock(at, "time", "00:05");
  assert.deepEqual(matchClock(at), { date: "2026-10-08", time: "00:05" });
  // O caso que pulava para o dia 10: voltar para 23:59 fica no mesmo dia.
  at = withMatchClock(at, "time", "23:59");
  assert.deepEqual(matchClock(at), { date: "2026-10-08", time: "23:59" });
  at = withMatchClock(at, "time", "23:59");
  assert.deepEqual(matchClock(at), { date: "2026-10-08", time: "23:59" }, "repetir a mesma hora não anda um dia");
  at = withMatchClock(at, "date", "2026-10-09");
  assert.deepEqual(matchClock(at), { date: "2026-10-09", time: "23:59" });
  assert.equal(at, sp("2026-10-09", "23:59"));
});

test("um campo vazio ou incompleto não muda nada", () => {
  const at = sp("2026-10-08", "23:40");
  assert.equal(withMatchClock(at, "time", ""), at);
  assert.equal(withMatchClock(at, "date", ""), at);
  assert.equal(withMatchClock(at, "date", "2026-10"), at);
});

test("jogo que acaba de madrugada conta para a noite em que começou", () => {
  assert.equal(matchNightDay(sp("2026-10-08", "23:40")), "2026-10-08");
  assert.equal(matchNightDay(sp("2026-10-09", "00:05")), "2026-10-08");
  assert.equal(matchNightDay(sp("2026-10-09", "05:59")), "2026-10-08");
  assert.equal(matchNightDay(sp("2026-10-09", "06:00")), "2026-10-09");
  assert.equal(matchNightDay(sp("2026-10-09", "21:10")), "2026-10-09");
  assert.equal(matchNightDay("nada"), "");
  // A revisão avisa só quando o jogo é da madrugada.
  assert.equal(smallHoursNight(sp("2026-10-09", "00:20")), "2026-10-08");
  assert.equal(smallHoursNight(sp("2026-10-08", "23:40")), "");
});

test("o resumo do dia e a noite das estatísticas juntam o jogo da madrugada com os da noite", () => {
  const matches = [
    { id: "a", played_at: sp("2026-10-08", "21:10"), opponent_name: "Um", strix_score: 2, opponent_score: 0 },
    { id: "b", played_at: sp("2026-10-09", "00:05"), opponent_name: "Dois", strix_score: 1, opponent_score: 1 },
    { id: "c", played_at: sp("2026-10-09", "22:00"), opponent_name: "Três", strix_score: 0, opponent_score: 1 },
  ];
  const day8 = collectPeriodSummary({ matches }, { mode: "day", now: new Date(sp("2026-10-08", "12:00")) });
  assert.deepEqual(day8.matches.map((match) => match.id), ["a", "b"]);
  const day9 = collectPeriodSummary({ matches }, { mode: "day", now: new Date(sp("2026-10-09", "12:00")) });
  assert.deepEqual(day9.matches.map((match) => match.id), ["c"]);
  const periods = summaryPeriods({ matches }, { mode: "day", now: new Date(sp("2026-10-09", "23:00")) });
  assert.deepEqual(periods.map((period) => [period.key, period.count]), [["2026-10-09", 1], ["2026-10-08", 2]]);
  assert.equal(summarizeNight(matches, "2026-10-08").games, 2);
  assert.equal(summarizeNight(matches, "2026-10-09").games, 1);
});
