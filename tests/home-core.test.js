import test from "node:test";
import assert from "node:assert/strict";
import { buildHomeModel, greetingFor, lineupState, relativeKickoff, resultOf } from "../src/features/home/home-core.js";

const at = (iso) => new Date(iso);
const now = at("2026-10-02T23:30:00Z"); // 20:30 em São Paulo

test("saudação segue o horário de São Paulo", () => {
  assert.equal(greetingFor(at("2026-10-02T12:00:00Z")), "Bom dia");
  assert.equal(greetingFor(at("2026-10-02T18:00:00Z")), "Boa tarde");
  assert.equal(greetingFor(now), "Boa noite");
});

test("contagem relativa do próximo jogo", () => {
  assert.equal(relativeKickoff("2026-10-03T00:10:00Z", now), "em 40 min");
  assert.equal(relativeKickoff("2026-10-03T01:42:00Z", now), "em 2h 12min");
  assert.equal(relativeKickoff("2026-10-03T23:30:00Z", now), "amanhã");
  assert.match(relativeKickoff("2026-10-05T00:10:00Z", now), /04\/10/);
});

test("estado da escalação conta só posições preenchidas", () => {
  assert.equal(lineupState({ lineup: [] }).kind, "pending");
  assert.equal(lineupState({ lineup: ["a", "", "b"] }).label, "Escalação em montagem · 2/11");
  assert.equal(lineupState({ lineup: Array(11).fill("x") }).kind, "ready");
});

test("resultado só existe com placar numérico", () => {
  assert.equal(resultOf({ strix_score: 2, opponent_score: 1 }), "V");
  assert.equal(resultOf({ strix_score: 0, opponent_score: 0 }), "E");
  assert.equal(resultOf({ strix_score: 1, opponent_score: 3 }), "D");
  assert.equal(resultOf({ strix_score: null, opponent_score: 1 }), null);
});

test("modelo da Home: agora, noite, último resultado e temporada a partir dos dados reais", () => {
  const agenda = [
    { id: "a1", scheduled_at: "2026-10-03T00:10:00Z", opponent_name: "Maquina", status: "scheduled", lineup: Array(11).fill("p") },
    { id: "a2", scheduled_at: "2026-10-03T00:40:00Z", opponent_name: "Sinceridade FC", status: "scheduled" },
    { id: "a3", scheduled_at: "2026-10-04T00:10:00Z", opponent_name: "POA City", status: "scheduled" },
    { id: "a4", scheduled_at: "2026-10-02T22:00:00Z", opponent_name: "Velho", status: "cancelled" },
  ];
  const matches = [
    { id: "m1", played_at: "2026-10-01T00:10:00Z", opponent_name: "A", strix_score: 2, opponent_score: 1 },
    { id: "m2", played_at: "2026-10-01T00:40:00Z", opponent_name: "B", strix_score: 0, opponent_score: 0 },
  ];
  const model = buildHomeModel({ agenda, matches, now });
  assert.equal(model.next.match.id, "a1");
  assert.equal(model.next.state.kind, "upcoming");
  assert.equal(model.next.lineup.kind, "ready");
  assert.deepEqual(model.tonight.map((match) => match.id), ["a1", "a2"]);
  assert.deepEqual(model.nextDays.map((match) => match.id), ["a3"]);
  assert.equal(model.last.match.id, "m2");
  assert.equal(model.last.result, "E");
  assert.equal(model.season.wins, 1);
  assert.equal(model.season.draws, 1);
  assert.deepEqual(model.season.form.map((item) => item.result), ["E", "V"]);
});

test("jogo cujo horário passou não é declarado ao vivo", () => {
  const agenda = [{ id: "a1", scheduled_at: "2026-10-02T23:10:00Z", opponent_name: "Maquina", status: "scheduled" }];
  assert.equal(buildHomeModel({ agenda, now }).next.state.label, "Começou às 20:10");
  const late = [{ id: "a1", scheduled_at: "2026-10-02T22:10:00Z", opponent_name: "Maquina", status: "scheduled" }];
  assert.equal(buildHomeModel({ agenda: late, now }).next.state.kind, "awaiting");
});

test("sem agenda e sem histórico a Home não inventa conteúdo", () => {
  const model = buildHomeModel({ agenda: [], matches: [], now });
  assert.equal(model.next, null);
  assert.equal(model.last, null);
  assert.equal(model.season, null);
  assert.deepEqual(model.tonight, []);
});

test("jogo com sinal do vigia lidera a Home ao vivo, com placar e minuto", () => {
  const live = new Date("2026-10-02T23:50:00Z");
  const agenda = [
    { id: "a", scheduled_at: "2026-10-02T23:10:00Z", opponent_name: "BDL Esports", status: "scheduled", live_seen_at: "2026-10-02T23:49:20Z", live_strix_score: 2, live_opponent_score: 1, live_minute: 67 },
    { id: "b", scheduled_at: "2026-10-03T00:10:00Z", opponent_name: "Night Hunters", status: "scheduled" },
  ];
  const model = buildHomeModel({ agenda, matches: [], now: live });
  assert.equal(model.mode, "next");
  assert.equal(model.next.match.id, "a");
  assert.equal(model.next.state.kind, "live");
  assert.deepEqual(model.next.state.live, { strix: 2, opponent: 1, minute: 67, phase: "live" });
  // sinal velho: volta a valer o próximo horário
  const stale = buildHomeModel({ agenda, matches: [], now: new Date("2026-10-02T23:58:00Z") });
  assert.equal(stale.next.match.id, "b");
});
