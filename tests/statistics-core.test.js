import test from "node:test";
import assert from "node:assert/strict";
import { aggregatePlayerStatistics, aggregateTeamStatistics, buildRanking, uniqueMatches } from "../src/features/statistics/statistics-core.js";

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

test("não conta duas vezes a mesma partida reconciliada", () => {
  const duplicate = { ...matches[0], id: "provider-copy", raw_ea: { performance: matches[0].performance } };
  assert.equal(uniqueMatches([matches[0], duplicate]).length, 1);
  assert.equal(aggregateTeamStatistics([matches[0], duplicate]).goalsFor, 3);
});

test("separa goleiro e exclui desconexão de rankings", () => {
  const withRoles = [{ strix_score: 1, opponent_score: 0, performance: { players: [
    { eaName: "JOAO", position: "GOL", rating: 8, saves: 5, passesMade: 12, passesAttempts: 15 },
    { eaName: "CAIU", rating: 3, goals: 0, assists: 0, passesMade: 0, passesAttempts: 0, shots: 0, tackles: 0, saves: 0 },
    { eaName: "ATACANTE", rating: 7.5, goals: 1, passesMade: 20, passesAttempts: 25 },
  ] } }];
  const players = aggregatePlayerStatistics(withRoles);
  assert.equal(players.find((player) => player.name === "JOAO").goalkeeper, true);
  assert.equal(players.find((player) => player.name === "JOAO").cleanSheets, 1);
  assert.equal(players.find((player) => player.name === "CAIU").disconnected, true);
  assert.deepEqual(buildRanking(players, "averageRating").map((player) => player.name), ["ATACANTE"]);
});

test("precisão exige amostra mínima de passes", () => {
  const ranking = buildRanking([
    { name: "UM PASSE", handle: "one", passAccuracy: 100, passAttempts: 1, rankingEligible: true },
    { name: "VOLUME", handle: "volume", passAccuracy: 90, passAttempts: 40, rankingEligible: true },
  ], "passAccuracy");
  assert.deepEqual(ranking.map((player) => player.name), ["VOLUME"]);
});
