import test from "node:test";
import assert from "node:assert/strict";
import { classifyAgendaMatch, nextAgendaMatches } from "../src/features/agenda/agenda-time.js";

test("partida atrasada não bloqueia a próxima partida", () => {
  const now = new Date("2026-08-17T02:30:00-03:00");
  const overdue = { id: "caltion", scheduled_at: "2026-08-13T23:40:00-03:00", status: "scheduled" };
  const next = { id: "anidekai", scheduled_at: "2026-08-17T03:00:00-03:00", status: "scheduled" };
  assert.equal(classifyAgendaMatch(overdue, now), "overdue");
  assert.deepEqual(nextAgendaMatches([overdue, next], now).map((match) => match.id), ["anidekai"]);
});

test("virada de dia usa America/Sao_Paulo", () => {
  const now = new Date("2026-08-16T23:50:00-03:00");
  const midnight = { scheduled_at: "2026-08-17T00:00:00-03:00", status: "scheduled" };
  assert.equal(classifyAgendaMatch(midnight, now), "upcoming");
});
