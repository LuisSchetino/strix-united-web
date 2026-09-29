import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { aggregatePlayerStatistics, buildPlayerProfile, buildPlayerProfileChoices, buildPositionContext, classifyPlayerData, saoPauloDay, summarizeNight } from "../src/features/statistics/statistics-core.js";
import { availableLineupPlayers, duplicateLineupPlayers, validateLineupUnique } from "../src/features/agenda/lineup-core.js";

const roster = [
  { id: "oben", display_name: "OBEN", positions: ["GOL"], is_active: true },
  { id: "nunes", display_name: "NUNES", positions: ["ATA"], is_active: true },
  { id: "dudu", display_name: "DUDU", positions: ["ATA"], is_active: true },
  { id: "mc", display_name: "MEIO", positions: ["MC"], is_active: true },
];

test("classificação de qualidade não transforma zeros sem evidência em atleta inválido", () => {
  assert.equal(classifyPlayerData({ secondsPlayed: 0, vproattr: "", rating: 3, goals: 0, assists: 0, passesMade: 0, passesAttempts: 0 }), "DID_NOT_PLAY");
  assert.equal(classifyPlayerData({ secondsPlayed: 0, vproattr: "", rating: 3, goals: 0, assists: 0, passes: "0/0" }), "DID_NOT_PLAY");
  assert.equal(classifyPlayerData({ secondsPlayed: 0, vproattr: "", rating: 3, goals: 0 }), "PARTIAL", "zero isolado não é evidência suficiente de não participação");
  assert.equal(classifyPlayerData({ rating: 7.4, goals: 0, passesMade: 0 }), "PARTIAL");
  assert.equal(classifyPlayerData({}), "NO_STATS");
  assert.equal(classifyPlayerData(null), "UNKNOWN");
  assert.equal(classifyPlayerData({ secondsPlayed: 0, rating: 8, goals: 1, saves: 2 }), "PARTIAL");
});

test("jogador explicitamente não utilizado não distorce a média EA", () => {
  const matches = [
    { played_at: "2026-09-02T20:00:00-03:00", performance: { players: [{ eaPlayerId: "p1", eaName: "Nunes", secondsPlayed: 0, vproattr: "", rating: 3, goals: 0, assists: 0, passesMade: 0, passesAttempts: 0, shots: 0, tackles: 0, saves: 0 }] } },
    { played_at: "2026-09-01T20:00:00-03:00", performance: { players: [{ eaPlayerId: "p1", eaName: "Nunes", secondsPlayed: 900, rating: 8, goals: 1, assists: 0, passesMade: 20, passesAttempts: 25 }] } },
  ];
  const [player] = aggregatePlayerStatistics(matches);
  assert.equal(player.averageRating, 8);
  assert.equal(player.validGames, 1);
  assert.equal(player.qualityCounts.DID_NOT_PLAY, 1);
});

test("profile mostra forma real, precisão em pp e recorde com partida de referência", () => {
  const matches = [
    { id: "latest", played_at: "2026-09-04T22:00:00-03:00", opponent_name: "A", performance: { players: [{ eaPlayerId: "p1", eaName: "Nunes", rating: 9, goals: 2, assists: 1, passesMade: 9, passesAttempts: 10, tackles: 2 }] } },
    { id: "older", played_at: "2026-09-03T22:00:00-03:00", opponent_name: "B", performance: { players: [{ eaPlayerId: "p1", eaName: "Nunes", rating: 7, goals: 0, assists: 0, passesMade: 80, passesAttempts: 100, tackles: 0 }] } },
  ];
  const players = aggregatePlayerStatistics(matches, { players: roster, aliases: [{ ea_name: "Nunes", player_id: "nunes" }] });
  const player = players.find((item) => item.playerId === "nunes");
  const profile = buildPlayerProfile(player, matches, { aliases: [{ ea_name: "Nunes", player_id: "nunes" }] });
  assert.equal(profile.recent.length, 2);
  assert.equal(profile.comparisons.passAccuracy.suffix, "pp");
  assert.equal(profile.comparisons.passAccuracy.recent, 80.9);
  assert.equal(profile.records.find((item) => item.label === "MAIOR NOTA EA").match.id, "latest");
});

test("recordes de goleiro usam total oficial e clean sheets consecutivos observados", () => {
  const matches = [
    { played_at: "2026-09-03T22:00:00-03:00", opponent_name: "A", performance: { players: [{ eaPlayerId: "gk1", eaName: "Keeper", position: "GK", rating: 8, saves: 4, cleansheetsgk: 1, reflexSaves: 3 }] } },
    { played_at: "2026-09-02T22:00:00-03:00", opponent_name: "B", performance: { players: [{ eaPlayerId: "gk1", eaName: "Keeper", position: "GK", rating: 7, saves: 5, cleansheetsgk: 1, reflexSaves: 2 }] } },
    { played_at: "2026-09-01T22:00:00-03:00", opponent_name: "C", performance: { players: [{ eaPlayerId: "gk1", eaName: "Keeper", position: "GK", rating: 7, saves: 2, cleansheetsgk: 0, reflexSaves: 1 }] } },
  ];
  const [player] = aggregatePlayerStatistics(matches);
  const profile = buildPlayerProfile(player, matches);
  assert.equal(profile.records.find((item) => item.label === "MAIS DEFESAS").value, 5);
  assert.equal(profile.records.find((item) => item.label === "MAIOR SEQUÊNCIA CLEAN SHEETS").value, 2);
  assert.equal(player.saves, 11, "subtipos de defesa não são somados ao total oficial");
});

test("contexto compara a mesma posição e marca amostra curta como insuficiente", () => {
  const players = [
    { handle: "nunes", playerId: "nunes", positions: ["ATA"], validGames: 4, averageRating: 8.4 },
    { handle: "dudu", playerId: "dudu", positions: ["ATA"], validGames: 3, averageRating: 8.1 },
    { handle: "oben", playerId: "oben", positions: ["GOL"], goalkeeper: true, validGames: 4, averageRating: 9 },
  ];
  assert.deepEqual(buildPositionContext(players[0], players, "averageRating"), { group: "ATA", insufficient: false, rank: 1, total: 2 });
  assert.equal(buildPositionContext(players[2], players, "averageRating").group, "GOL");
});

test("resumo local da noite agrupa virada de data de São Paulo e preserva empate nos líderes", () => {
  const matches = [
    { id: "one", played_at: "2026-09-03T02:30:00.000Z", strix_score: 2, opponent_score: 0, performance: { players: [{ eaPlayerId: "n1", eaName: "Nunes", rating: 8, goals: 2, assists: 0 }] } },
    { id: "two", played_at: "2026-09-03T02:45:00.000Z", strix_score: 2, opponent_score: 1, performance: { players: [{ eaPlayerId: "d1", eaName: "Dudu", rating: 8, goals: 2, assists: 0 }] } },
    { id: "other-day", played_at: "2026-09-04T03:30:00.000Z", strix_score: 0, opponent_score: 1, performance: { players: [] } },
  ];
  assert.equal(saoPauloDay(matches[0].played_at), "2026-09-02");
  const summary = summarizeNight(matches, "2026-09-02");
  assert.equal(summary.games, 2);
  assert.equal(summary.wins, 2);
  assert.deepEqual(summary.leaders.goals.names.sort(), ["Dudu", "Nunes"]);
  assert.equal(summary.leaders.goals.value, 2);
});

test("resumo noturno tolera linha parcial contendo somente rating", () => {
  const summary = summarizeNight([
    { id: "partial", played_at: "2026-09-03T02:30:00.000Z", strix_score: 1, opponent_score: 1, performance: { players: [{ eaPlayerId: "p1", eaName: "Nunes", rating: 7.5 }] } },
  ], "2026-09-02");
  assert.equal(summary.games, 1);
  assert.deepEqual(summary.leaders.rating.names, ["Nunes"]);
  assert.equal(summary.leaders.goals, null);
});

test("escalação deriva disponibilidade por id, permite manter slot atual e bloqueia legado duplicado", () => {
  const lineup = ["OBEN", "NUNES", "", "", "", "", "", "", "", "", ""];
  assert.deepEqual(availableLineupPlayers(lineup, roster, 0).map((player) => player.id), ["oben", "dudu", "mc"]);
  assert.deepEqual(availableLineupPlayers(lineup, roster, 2).map((player) => player.id), ["dudu", "mc"]);
  assert.deepEqual(availableLineupPlayers(["", "", "", "", "", "", "", "", "", "", ""], roster, 0).map((player) => player.id), roster.map((player) => player.id));
  const invalid = validateLineupUnique(["Nunes", "NUNES"], roster);
  assert.equal(invalid.valid, false);
  assert.equal(duplicateLineupPlayers(["Nunes", "NUNES"], roster).length, 1);
  assert.equal(validateLineupUnique(["Nunes", "Dudu"], roster).valid, true);
  const reloaded = JSON.parse(JSON.stringify(lineup));
  assert.deepEqual(availableLineupPlayers(reloaded, roster, 2).map((player) => player.id), ["dudu", "mc"]);
});

test("salvamento da Agenda repete a validação fora do componente visual", async () => {
  const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  const start = main.indexOf("const saveAgenda = async");
  const end = main.indexOf("const setAgendaStatus", start);
  const saveBody = main.slice(start, end);
  assert.match(saveBody, /validateLineupUnique\(item\.lineup, state\.players\)/);
  assert.match(saveBody, /Um jogador não pode ocupar mais de uma posição/);
});

test("vínculo EA ID do elenco tem prioridade sobre nome semelhante", () => {
  const players = [
    { id: "first", display_name: "NUNES A", ea_player_id: "ea-01", positions: ["ATA"], is_active: true },
    { id: "second", display_name: "NUNES B", ea_player_id: "ea-02", positions: ["ATA"], is_active: true },
  ];
  const matches = [{ played_at: "2026-09-01T23:00:00-03:00", performance: { players: [{ eaPlayerId: "ea-02", eaName: "NUNES A", rating: 8, goals: 1 }] } }];
  const result = aggregatePlayerStatistics(matches, { players, aliases: [{ ea_name: "NUNES A", player_id: "first" }] });
  assert.equal(result.length, 1);
  assert.equal(result[0].playerId, "second");
  assert.equal(result[0].name, "NUNES B");
});

test("seletor individual inclui todo elenco ativo mesmo sem amostra e preserva identidade EA/alias", () => {
  const rosterWithNoSample = [
    ...roster,
    { id: "sem-jogos", display_name: "SEM JOGOS", positions: ["DEF"], is_active: true },
    { id: "arquivado", display_name: "ARQUIVADO", positions: ["ATA"], is_active: false },
  ];
  const stats = [{ playerId: null, eaPlayerIds: ["ea-nunes"], handle: "nunes-old", name: "Nunes antigo", games: 1, active: true, positions: [], goals: 1 }];
  const choices = buildPlayerProfileChoices(stats, rosterWithNoSample, [{ ea_name: "nunes-old", player_id: "nunes" }]);
  assert.deepEqual(choices.map((player) => player.playerId), ["nunes", "oben", "dudu", "mc", "sem-jogos"]);
  const linked = choices.find((player) => player.playerId === "nunes");
  assert.equal(linked.name, "NUNES");
  assert.equal(linked.goals, 1);
  const noSample = choices.find((player) => player.playerId === "sem-jogos");
  assert.equal(noSample.noSample, true);
  assert.equal(noSample.games, 0);
  assert.equal(noSample.averageRating, null);
  assert.deepEqual(noSample.metricSamples, {});
  assert.equal(choices.some((player) => player.name === "ARQUIVADO"), false);
});
