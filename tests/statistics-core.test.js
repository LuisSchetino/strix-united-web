import test from "node:test";
import assert from "node:assert/strict";
import { aggregatePlayerStatistics, aggregateTeamStatistics, buildRanking, canonicalPlayerName, formatPlayerHandle, uniqueMatches } from "../src/features/statistics/statistics-core.js";

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

test("métricas EA ausentes permanecem sem amostra e não viram zeros de produto", () => {
  const result = aggregateTeamStatistics([{ strix_score: 2, opponent_score: 0, performance: { players: [] } }]);
  assert.equal(result.goalsFor, 2, "placar da partida continua sendo dado oficial disponível");
  assert.equal(result.metricSamples.shots, 0);
  assert.equal(result.shotsPerGame, null);
  assert.equal(result.metricSamples.tackles, 0);
  assert.equal(result.tacklesPerGame, null);
  assert.equal(result.metricSamples.saves, 0);
  assert.equal(result.savesPerGame, null);
  assert.equal(result.passAccuracy, null);
  assert.equal(result.averageRating, null);
});

test("MOTM, clean sheet e campos de goleiro distinguem ausente de zero real", () => {
  const roster = [{ id: "gk", display_name: "GOLEIRO", positions: ["GK"], is_active: true }];
  const aliases = [{ ea_name: "GOLEIRO EA", player_id: "gk" }];
  const [missing] = aggregatePlayerStatistics([{ opponent_score: null, performance: { players: [{ eaName: "GOLEIRO EA", pos: "GK", rating: 8, saves: 2 }] } }], { players: roster, aliases });
  assert.equal(missing.metricSamples.mom, undefined);
  assert.equal(missing.mom, 0);
  assert.equal(missing.motmPercentage, null);
  assert.equal(missing.cleanSheetsGk, 0);
  assert.equal(missing.goalsAgainstSamples, 0);
  assert.equal(missing.reflexSaves, 0);
  const [zero] = aggregatePlayerStatistics([{ opponent_score: 0, performance: { players: [{ eaName: "GOLEIRO EA", pos: "GK", rating: 8, saves: 0, mom: 0, cleansheetsgk: 0, reflexSaves: 0 }] } }], { players: roster, aliases });
  assert.equal(zero.metricSamples.saves, 1);
  assert.equal(zero.metricSamples.mom, undefined);
  assert.equal(zero.metricSamples.cleansheetsgk, 1);
  assert.equal(zero.metricSamples.reflexSaves, 1);
  assert.equal(zero.saves, 0);
  assert.equal(zero.mom, 0);
  assert.equal(zero.cleanSheetsGk, 0);
  assert.equal(zero.goalsAgainstSamples, 1);
});

test("handle preserva o valor original e normaliza apenas a apresentação", () => {
  const stored = "@B7NFelipe";
  assert.equal(formatPlayerHandle(stored), "@b7nfelipe");
  assert.equal(stored, "@B7NFelipe");
});

test("zero tentativas continuam observadas, mas não produzem porcentagem infinita", () => {
  const result = aggregateTeamStatistics([{ strix_score: 0, opponent_score: 0, performance: { passesMade: 0, passesAttempts: 0, tackleAttempts: 0, tackles: 0, shots: 0, saves: 0 } }]);
  assert.equal(result.metricSamples.shots, 1);
  assert.equal(result.shotsPerGame, 0);
  assert.equal(result.passAccuracy, null);
  assert.equal(result.tackleAccuracy, null);
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
  assert.equal(players.find((player) => player.name === "JOAO").cleanSheets, 0, "clean sheets individuais só vêm dos campos EA correspondentes");
  assert.equal(players.find((player) => player.name === "CAIU").disconnected, true);
  assert.deepEqual(buildRanking(players, "averageRating").map((player) => player.name), ["ATACANTE"]);
});

test("usa métricas EA diretas sem somar breakdowns ou tratar zero segundos como atuação", () => {
  const sample = [{ played_at: "2026-09-01T23:00:00-03:00", strix_score: 2, opponent_score: 1, performance: { players: [
    { eaPlayerId: "ea-1", eaName: "Goleiro", pos: "GK", secondsPlayed: 0, rating: 8, goals: 1, assists: 1, shots: 2, passesMade: 8, passesAttempts: 10, tackles: 2, tackleAttempts: 4, mom: 1, cleansheetsdef: 2, cleansheetsgk: 1, saves: 4, reflexSaves: 3, crossSaves: 2, goodDirectionSaves: 1 },
  ] } }];
  const [player] = aggregatePlayerStatistics(sample);
  assert.equal(player.eaPlayerIds[0], "ea-1");
  assert.equal(player.goalAssists, 2);
  assert.equal(player.shotConversion, 50);
  assert.equal(player.passAccuracy, 80);
  assert.equal(player.tackleAccuracy, 50);
  assert.equal(player.mom, 0, "quem não entrou em campo não leva o MOTM, mesmo com o campo da EA");
  assert.equal(player.cleanSheetsDef, 2);
  assert.equal(player.cleanSheetsGk, 1);
  assert.equal(player.saves, 4, "breakdown de defesas não é somado ao total oficial");
  assert.equal(player.reflexSaves, 3);
  assert.equal(player.goalkeeperGames, 0, "secondsPlayed igual a zero não conta automaticamente como atuação");
  assert.equal(player.goalsAgainst, 0);
});

test("MOTM é a maior nota do elenco em vitória ou empate e não existe na derrota", () => {
  const roster = [
    { id: "gk", display_name: "GOLEIRO", positions: ["GOL"], is_active: true },
    { id: "linha", display_name: "LINHA", positions: ["ATA"], is_active: true },
    { id: "nunes", display_name: "NUNES", positions: ["ATA"], is_active: true },
  ];
  const aliases = [
    { ea_name: "Goleiro EA", player_id: "gk" },
    { ea_name: "Linha EA", player_id: "linha" },
    { ea_name: "Nunes", player_id: "nunes" },
  ];
  const won = aggregatePlayerStatistics([{
    strix_score: 2,
    opponent_score: 1,
    performance: { players: [
      { eaName: "Goleiro EA", pos: "GK", rating: 8, saves: 4, secondsPlayed: 900 },
      { eaName: "Nunes", rating: 10, secondsPlayed: 900 },
      { eaName: "Fora do elenco", rating: 11, secondsPlayed: 900 },
    ] },
  }], { players: roster, aliases });
  assert.equal(won.find((player) => player.name === "NUNES").mom, 1);
  assert.equal(won.find((player) => player.name === "GOLEIRO").mom, 0);
  assert.equal(won.some((player) => player.name === "Fora do elenco"), false);
  const drawn = aggregatePlayerStatistics([{
    strix_score: 1,
    opponent_score: 1,
    performance: { players: [
      { eaName: "Linha EA", rating: 7.5, secondsPlayed: 900 },
      { eaName: "Nunes", rating: 7, secondsPlayed: 900 },
    ] },
  }], { players: roster, aliases });
  assert.deepEqual(buildRanking(drawn, "mom").map((player) => player.name), ["LINHA"]);
  const lost = aggregatePlayerStatistics([{
    strix_score: 0,
    opponent_score: 2,
    performance: { players: [{ eaName: "Goleiro EA", pos: "GK", rating: 8, saves: 4, mom: 1, secondsPlayed: 900 }] },
  }], { players: roster, aliases });
  assert.equal(lost.find((player) => player.name === "GOLEIRO").mom, 0);
  assert.equal(buildRanking(lost, "mom").length, 0);
});

test("precisão exige amostra mínima de passes", () => {
  const ranking = buildRanking([
    { name: "UM PASSE", handle: "one", passAccuracy: 100, passAttempts: 1, rankingEligible: true },
    { name: "VOLUME", handle: "volume", passAccuracy: 90, passAttempts: 40, rankingEligible: true },
  ], "passAccuracy");
  assert.deepEqual(ranking.map((player) => player.name), ["VOLUME"]);
});

test("aliases diferentes consolidam no jogador canônico e respeitam elenco ativo", () => {
  const aliasedMatches = [{ played_at: "2026-08-01T22:00:00-03:00", opponent_name: "A", performance: { players: [{ eaName: "Obenzera", rating: 8, goals: 1 }] } }, { played_at: "2026-08-02T22:00:00-03:00", opponent_name: "B", performance: { players: [{ eaName: "Obenzeira", rating: 7, assists: 1 }] } }];
  const roster = [{ id: "oben", display_name: "OBEN", positions: ["MC"], is_active: true }];
  const aliases = [{ ea_name: "Obenzera", player_id: "oben" }, { ea_name: "Obenzeira", player_id: "oben" }];
  const result = aggregatePlayerStatistics(aliasedMatches, { players: roster, aliases });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "OBEN");
  assert.equal(result[0].goalAssists, 2);
  assert.equal(canonicalPlayerName("obenzeira", roster, aliases), "OBEN");
  result[0].active = false;
  assert.equal(buildRanking(result, "goals").length, 0);
});
