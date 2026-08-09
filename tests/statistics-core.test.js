import test from "node:test";
import assert from "node:assert/strict";
import { aggregatePlayerStatistics, aggregateTeamStatistics } from "../src/features/statistics/statistics-core.js";

const matches = [{ strix_score: 3, opponent_score: 1, performance: { passes: "80/100", shots: 9, tackles: 5, goalkeeperSaves: 2, averageRating: 7.5, players: [{ eaName: "OBEEN", rating: 8, goals: 1, assists: 2, passesMade: 30, passesAttempts: 40, tackles: 3, shots: 2 }] } }, { strix_score: 1, opponent_score: 1, performance: { passes: "45/60", players: [{ eaName: "OBEEN", rating: 7, passesMade: 20, passesAttempts: 25 }] } }];

test("estatísticas do time calculam campanha, médias e precisão", () => {
  const result = aggregateTeamStatistics(matches, [{ is_active: true }, { is_active: false }]);
  assert.equal(result.games, 2);
  assert.equal(result.wins, 1);
  assert.equal(result.draws, 1);
  assert.equal(result.averageGoalsFor, 2);
  assert.equal(result.passAccuracy, 78);
  assert.equal(result.activeSquad, 1);
});

test("estatísticas individuais consolidam G+A e passes", () => {
  const [player] = aggregatePlayerStatistics(matches);
  assert.equal(player.games, 2);
  assert.equal(player.goalAssists, 3);
  assert.equal(player.passesMade, 50);
  assert.equal(player.passAccuracy, 77);
  assert.equal(player.averageRating, 7.5);
});
