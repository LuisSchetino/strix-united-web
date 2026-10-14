import test from "node:test";
import assert from "node:assert/strict";
import { agendaStatus, lineupState, untilLabel } from "../src/features/agenda/agenda-status.js";

const now = new Date("2026-10-02T23:30:00Z"); // 20:30 em São Paulo

test("status da Agenda fala o tempo até o jogo, nunca declara partida ao vivo", () => {
  assert.deepEqual(agendaStatus({ scheduled_at: "2026-10-03T00:10:00Z" }, now), { tone: "today", label: "em 40 min" });
  assert.deepEqual(agendaStatus({ scheduled_at: "2026-10-02T23:10:00Z" }, now), { tone: "soon", label: "Em campo" });
  assert.deepEqual(agendaStatus({ scheduled_at: "2026-10-02T22:10:00Z" }, now), { tone: "past", label: "Aguardando resultado" });
  assert.equal(agendaStatus({ scheduled_at: "2026-10-03T23:00:00Z" }, now).label, "Amanhã");
  assert.equal(agendaStatus({ scheduled_at: "2026-10-06T00:10:00Z" }, now).label, "Em 3 dias");
  assert.equal(agendaStatus({ scheduled_at: "2026-10-03T00:10:00Z", status: "cancelled" }, now).tone, "cancelled");
  assert.equal(agendaStatus({ scheduled_at: "2026-10-03T00:10:00Z", status: "live" }, now).label, "Em breve");
});

test("rótulos curtos de tempo e escalação", () => {
  assert.equal(untilLabel(5), "em 5 min");
  assert.equal(untilLabel(120), "em 2h");
  assert.equal(untilLabel(135), "em 2h 15min");
  assert.equal(lineupState({ lineup: ["a", "b", ""] }).short, "Escalação 2/11");
  assert.equal(lineupState({}).short, "Sem escalação");
});

test("com o sinal do vigia do PC o jogo fica em campo com placar e minuto", () => {
  const seen = new Date(now.getTime() - 60_000).toISOString();
  const live = { scheduled_at: "2026-10-03T00:10:00Z", live_seen_at: seen, live_strix_score: 2, live_opponent_score: 1, live_minute: 34 };
  assert.deepEqual(agendaStatus(live, now), { tone: "soon", label: "Em campo · 2×1 · 34'", live: true });
  // o sinal envelheceu depois do horário: acabou, falta o resultado
  const old = { ...live, scheduled_at: "2026-10-02T22:50:00Z", live_seen_at: new Date(now.getTime() - 10 * 60_000).toISOString() };
  assert.deepEqual(agendaStatus(old, now), { tone: "past", label: "Aguardando resultado" });
  // jogo encerrado ou cancelado não volta a ficar em campo
  assert.equal(agendaStatus({ ...live, status: "cancelled" }, now).tone, "cancelled");
  assert.equal(agendaStatus({ ...live, status: "completed" }, now).label, "Jogado");
});
