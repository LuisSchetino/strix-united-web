import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENDA_TEMPLATE_VERSION,
  agendaDurationSeconds,
  agendaFileName,
  canManageMedia,
  collectTodayAgenda,
  fingerprintAgendaRender,
  formatKickoff,
  opponentInitials,
} from "../src/features/media/agenda-media-core.js";

const day = "2026-09-02T18:00:00-03:00";

function workspaceWith(agenda) {
  return {
    agenda,
    competitions: [{ id: "c1", name: "Superliga Yeshua", logo_url: "https://ccbclubs.com.br/escudo.png" }],
    competitionFixtures: [{ id: "f1", round_label: "Rodada 9" }],
    assetUrl: (path) => `/storage/${path}`,
  };
}

test("Agenda do dia ignora amanhã, cancelados e concluídos", () => {
  const rows = collectTodayAgenda(workspaceWith([
    { id: "a", opponent_name: "Winner Elevens", scheduled_at: "2026-09-02T22:10:00-03:00", status: "scheduled", competition_name: "Amistoso" },
    { id: "b", opponent_name: "Amanhã FC", scheduled_at: "2026-09-03T22:10:00-03:00", status: "scheduled", competition_name: "Amistoso" },
    { id: "c", opponent_name: "Cancelado", scheduled_at: "2026-09-02T21:00:00-03:00", status: "cancelled", competition_name: "Amistoso" },
    { id: "d", opponent_name: "Já jogou", scheduled_at: "2026-09-02T20:00:00-03:00", status: "completed", competition_name: "Amistoso" },
  ]), new Date(day));
  assert.deepEqual(rows.map((row) => row.opponent), ["Winner Elevens"]);
  assert.equal(rows[0].kickoff, "22:10");
});

test("reusa identidade, competição e rodada sem inventar dados", () => {
  const [row] = collectTodayAgenda(workspaceWith([{
    id: "a",
    opponent_name: "Genius Esports",
    scheduled_at: "2026-09-02T22:40:00-03:00",
    status: "live",
    competition_id: "c1",
    competition_name: "Amistoso",
    source_fixture_id: "f1",
    resolved_opponent_logo_url: "https://ccbclubs.com.br/genius.png",
  }]), new Date(day));
  assert.equal(row.competition, "Superliga Yeshua");
  assert.equal(row.competition_logo, "https://ccbclubs.com.br/escudo.png");
  assert.equal(row.round, "Rodada 9");
  assert.equal(row.opponent_logo, "https://ccbclubs.com.br/genius.png");
});

test("nomes longos e horários de virada permanecem fiéis à Agenda", () => {
  const rows = collectTodayAgenda(workspaceWith([
    { id: "midnight", opponent_name: "Clube Atlético Extremamente Longo da Serra", scheduled_at: "2026-09-02T00:00:00-03:00", status: "scheduled", competition_name: "" },
    { id: "late", opponent_name: "CTX", scheduled_at: "2026-09-02T23:50:00-03:00", status: "scheduled", competition_name: "Copa com Nome Extraordinariamente Extenso" },
  ]), new Date(day));
  assert.equal(rows[0].kickoff, "00:00");
  assert.equal(rows[1].kickoff, "23:50");
  assert.equal(rows[0].competition, "");
  assert.equal(formatKickoff("invalid"), "");
});

test("fingerprint muda quando horário, adversário, logo ou jogo mudam", async () => {
  const base = {
    day: "2026-09-02",
    format: "story",
    templateVersion: AGENDA_TEMPLATE_VERSION,
    matches: [{ id: "1", scheduled_at: "2026-09-02T22:10:00-03:00", opponent: "Winner", opponent_logo: "a.png", competition: "Amistoso", competition_logo: "", round: "" }],
  };
  const original = await fingerprintAgendaRender(base);
  const moved = await fingerprintAgendaRender({
    ...base,
    matches: [{ ...base.matches[0], scheduled_at: "2026-09-02T22:40:00-03:00" }],
  });
  const logo = await fingerprintAgendaRender({
    ...base,
    matches: [{ ...base.matches[0], opponent_logo: "b.png" }],
  });
  const removed = await fingerprintAgendaRender({ ...base, matches: [] });
  assert.notEqual(original, moved);
  assert.notEqual(original, logo);
  assert.notEqual(original, removed);
});

test("duração respira no opening e no finale sem estourar o formato social", () => {
  assert.equal(agendaDurationSeconds(0), 0);
  assert.ok(agendaDurationSeconds(1) >= 11 && agendaDurationSeconds(1) <= 14);
  assert.ok(agendaDurationSeconds(3) >= 15 && agendaDurationSeconds(3) <= 17);
  assert.ok(agendaDurationSeconds(5) >= 18 && agendaDurationSeconds(5) <= 21);
  assert.ok(agendaDurationSeconds(6) >= 20 && agendaDurationSeconds(6) <= 24);
  assert.ok(agendaDurationSeconds(7) <= 24);
  assert.equal(agendaFileName({ day: "2026-09-02", format: "story" }), "strix-agenda-2026-09-02-story.mp4");
  assert.equal(agendaFileName({ day: "2026-09-02", format: "feed" }), "strix-agenda-2026-09-02-feed.mp4");
});

test("iniciais e permissão seguem o padrão Diretoria/Dev", () => {
  assert.equal(opponentInitials("Winner Elevens"), "WE");
  assert.equal(opponentInitials("CTX"), "CT");
  assert.equal(canManageMedia({ access_tier: "diretoria" }), true);
  assert.equal(canManageMedia({ access_tier: "player" }), false);
});
