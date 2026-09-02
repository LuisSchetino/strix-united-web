import test from "node:test";
import assert from "node:assert/strict";
import { agendaHeroSelection, classifyAgendaMatch, nextAgendaMatches, todayAgendaMatches } from "../src/features/agenda/agenda-time.js";

test("partida atrasada não bloqueia a próxima partida", () => {
  const now = new Date("2026-08-17T02:30:00-03:00");
  const overdue = { id: "caltion", scheduled_at: "2026-08-13T23:40:00-03:00", status: "scheduled" };
  const next = { id: "anidekai", scheduled_at: "2026-08-17T03:00:00-03:00", status: "scheduled" };
  assert.equal(classifyAgendaMatch(overdue, now), "overdue");
  assert.deepEqual(nextAgendaMatches([overdue, next], now).map((match) => match.id), ["anidekai"]);
});

test("hero does not present tomorrow as tonight", () => {
  const now = new Date("2026-09-02T20:00:00-03:00");
  const tomorrow = { id: "tomorrow", scheduled_at: "2026-09-03T22:10:00-03:00", status: "scheduled" };
  assert.deepEqual(agendaHeroSelection([tomorrow], now), { match: { ...tomorrow, temporal_status: "upcoming" }, isToday: false });
});

test("hero selects the next match of the current Sao Paulo day", () => {
  const now = new Date("2026-09-02T21:00:00-03:00");
  const matches = [
    { id: "played-time", scheduled_at: "2026-09-02T20:30:00-03:00", status: "scheduled" },
    { id: "tonight", scheduled_at: "2026-09-02T22:10:00-03:00", status: "scheduled" },
    { id: "tomorrow", scheduled_at: "2026-09-03T22:10:00-03:00", status: "scheduled" },
  ];
  const selection = agendaHeroSelection(matches, now);
  assert.equal(selection.match.id, "tonight");
  assert.equal(selection.isToday, true);
});

test("virada de dia usa America/Sao_Paulo", () => {
  const now = new Date("2026-08-16T23:50:00-03:00");
  const midnight = { scheduled_at: "2026-08-17T00:00:00-03:00", status: "scheduled" };
  assert.equal(classifyAgendaMatch(midnight, now), "upcoming");
});

test("Agenda da noite contém somente partidas do dia em São Paulo", () => {
  const now = new Date("2026-09-01T19:00:00-03:00");
  const matches = [
    { id: "earlier-today", scheduled_at: "2026-09-01T18:30:00-03:00", status: "scheduled" },
    { id: "today", scheduled_at: "2026-09-01T23:10:00-03:00", status: "scheduled" },
    { id: "tomorrow", scheduled_at: "2026-09-02T22:10:00-03:00", status: "scheduled" },
    { id: "next-week", scheduled_at: "2026-09-08T22:10:00-03:00", status: "scheduled" },
  ];
  assert.deepEqual(todayAgendaMatches(matches, now).map((match) => match.id), ["earlier-today", "today"]);
});
