import assert from "node:assert/strict";
import { test } from "node:test";
import { isResultOfGame } from "../src/features/agenda/agenda-time.js";
import { tonightPlayed } from "../src/features/home/home-core.js";
import { agendaMutationForFixture } from "../shared/provider-agenda.js";

const now = new Date("2026-10-09T01:50:00Z"); // 22:50 de 08/10 em São Paulo
const game = { id: "a1", status: "completed", scheduled_at: "2026-10-09T01:40:00Z", opponent_name: "NIGHTMARE ES", competition_name: "P11 - CHAMPIONS TROPHY" };
const firstLeg = { id: "m1", agenda_match_id: "a1", played_at: "2026-10-02T01:45:00Z", strix_score: 1, opponent_score: 2 };
const secondLeg = { id: "m2", agenda_match_id: "a1", played_at: "2026-10-09T01:44:00Z", strix_score: 3, opponent_score: 0 };

test("o resultado da ida não vale para o jogo da volta", () => {
  assert.equal(isResultOfGame(game, firstLeg), false);
  assert.equal(isResultOfGame(game, secondLeg), true);
  assert.equal(isResultOfGame(game, null), false);
  assert.deepEqual(tonightPlayed({ agenda: [game], matches: [firstLeg], now }), []);
});

test("com o resultado da volta importado, é ele que aparece", () => {
  const played = tonightPlayed({ agenda: [game], matches: [firstLeg, secondLeg], now });
  assert.equal(played.length, 1);
  assert.equal(played[0].matchId, "m2");
  assert.equal(played[0].strix, 3);
});

test("quando a organização muda a data de um jogo já jogado, ele volta a ser jogo marcado", () => {
  const fixture = { id: "f1", home_team_name: "STRIX UNITED", away_team_name: "NIGHTMARE ES", scheduled_at: "2026-10-09T01:40:00Z", status: "scheduled" };
  const context = { competition: { id: "c1", name: "P11 - CHAMPIONS TROPHY" }, edition: { id: "e1" }, actorUserId: "u1", now };
  const moved = agendaMutationForFixture({ id: "a1", status: "completed", opponent_name: "NIGHTMARE ES", opponent_team_id: null, competition_id: "c1", scheduled_at: "2026-10-02T01:40:00Z" }, fixture, context);
  assert.equal(moved.action, "update");
  assert.equal(moved.payload.status, "scheduled");
  const same = agendaMutationForFixture({ id: "a1", status: "completed", opponent_name: "NIGHTMARE ES", opponent_team_id: null, competition_id: "c1", scheduled_at: "2026-10-09T01:40:00Z" }, fixture, context);
  assert.equal(same.payload.status, "completed");
});
