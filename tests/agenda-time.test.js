import test from "node:test";
import assert from "node:assert/strict";
import { activeAgendaMatches, agendaHeroSelection, classifyAgendaMatch, nextAgendaMatches, todayAgendaMatches } from "../src/features/agenda/agenda-time.js";

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

test("vínculo da Agenda exclui removidos e mantém só registros ativos após reload", () => {
  const persistedRows = [
    { id: "A", scheduled_at: "2026-09-03T20:00:00-03:00", status: "scheduled" },
    { id: "B", scheduled_at: "2026-09-03T21:00:00-03:00", status: "scheduled", deleted_at: "2026-09-02T10:00:00Z" },
    { id: "C", scheduled_at: "2026-09-03T22:00:00-03:00", status: "scheduled", is_archived: true },
    { id: "D", scheduled_at: "2026-09-03T23:00:00-03:00", status: "scheduled" },
  ];
  const reloaded = JSON.parse(JSON.stringify(persistedRows));
  assert.deepEqual(activeAgendaMatches(reloaded).map(({ id }) => id), ["A", "D"]);
});

test("the Agenda list keeps cancelled games in their slot; everything else still reads only active ones", async () => {
  const { agendaListMatches, isAgendaMatchCancelled, todayAgendaMatches: today } = await import("../src/features/agenda/agenda-time.js");
  const now = new Date("2026-10-03T20:00:00-03:00");
  const rows = [
    { id: "a", status: "scheduled", scheduled_at: "2026-10-03T21:10:00-03:00" },
    { id: "b", status: "cancelled", cancelled_at: "2026-10-03T19:00:00-03:00", scheduled_at: "2026-10-03T21:40:00-03:00" },
    { id: "c", status: "cancelled", scheduled_at: "2026-10-05T21:10:00-03:00" },
    { id: "d", status: "cancelled", scheduled_at: "2026-10-01T21:10:00-03:00" },
    { id: "e", status: "completed", scheduled_at: "2026-10-03T19:10:00-03:00" },
    { id: "f", status: "scheduled", deleted_at: "2026-10-03T10:00:00-03:00", scheduled_at: "2026-10-03T22:10:00-03:00" },
  ];
  const list = agendaListMatches(rows, now);
  assert.deepEqual(list.map((row) => `${row.id}:${row.list_day}:${row.temporal_status}`), ["d:past:cancelled", "a:today:today", "b:today:cancelled", "c:upcoming:cancelled"]);
  assert.equal(isAgendaMatchCancelled(rows[1]), true);
  assert.equal(isAgendaMatchCancelled(rows[4]), false);
  assert.deepEqual(today(rows, now).map((row) => row.id), ["a"], "a Central e as mídias não leem jogo cancelado");
});

test("ida e volta: dois jogos da mesma noite contra o mesmo clube no mesmo campeonato", async () => {
  const { agendaLeg } = await import("../src/features/agenda/agenda-time.js");
  const game = (id, time, extra = {}) => ({ id, opponent_name: "Nightmare", competition_name: "Season Kickoff", scheduled_at: `2026-10-12T${time}:00-03:00`, status: "scheduled", ...extra });
  const first = game("a", "21:10"), second = game("b", "21:40"), other = game("c", "22:10", { opponent_name: "Outro" });
  assert.equal(agendaLeg(first, [second, first, other]), "ida");
  assert.equal(agendaLeg(second, [second, first, other]), "volta");
  assert.equal(agendaLeg(other, [second, first, other]), "");
  assert.equal(agendaLeg(first, [first]), "", "um jogo só não tem ida nem volta");
  assert.equal(agendaLeg(first, [first, game("d", "21:40", { status: "cancelled" })]), "", "o cancelado não conta");
  assert.equal(agendaLeg(first, [first, game("e", "21:40", { scheduled_at: "2026-10-13T21:40:00-03:00" })]), "", "outro dia não conta");
  const friendly = { competition_name: "AMISTOSO" };
  assert.equal(agendaLeg(game("f", "21:10", friendly), [game("f", "21:10", friendly), game("g", "21:40", friendly)]), "", "amistoso não tem ida e volta");
});

test("jogo ao vivo pelo vigia continua em Hoje depois da meia-noite", async () => {
  const { agendaListMatches } = await import("../src/features/agenda/agenda-time.js");
  const now = new Date("2026-10-04T00:10:00-03:00");
  const rows = [
    { id: "live", status: "scheduled", scheduled_at: "2026-10-03T23:40:00-03:00", live_seen_at: "2026-10-04T00:09:30-03:00" },
    { id: "over", status: "scheduled", scheduled_at: "2026-10-03T23:10:00-03:00", live_seen_at: "2026-10-03T23:58:00-03:00" },
  ];
  assert.deepEqual(agendaListMatches(rows, now).map((row) => `${row.id}:${row.list_day}`), ["over:past", "live:today"]);
});
