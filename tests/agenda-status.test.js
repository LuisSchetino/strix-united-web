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
