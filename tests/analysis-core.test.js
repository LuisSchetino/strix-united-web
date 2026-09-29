import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalysis, buildPlayerComparison, comparePeriods, selectAnalysisPeriod, selectComparisonPeriod } from "../src/features/analysis/analysis-core.js";

const games = Array.from({ length: 10 }, (_, index) => ({
  id: String(index), played_at: `2026-08-${String(index + 1).padStart(2, "0")}T22:00:00-03:00`,
  opponent_name: `Time ${index}`, competition_name: index < 5 ? "Liga" : "Copa",
  strix_score: index >= 5 ? 2 : 0, opponent_score: 1,
  performance: { passes: index >= 5 ? "80/100" : "60/100", shots: 5 },
}));

test("recortes de análise respeitam período e competição", () => {
  assert.equal(selectAnalysisPeriod(games, "last5").length, 5);
  assert.equal(selectAnalysisPeriod(games, "competition:Liga").length, 5);
});

test("insights usam apenas relações matemáticas disponíveis", () => {
  const result = buildAnalysis(selectAnalysisPeriod(games, "last5"));
  assert.equal(result.team.passAccuracy, 80);
  assert.ok(result.insights.some((text) => text.includes("80%")));
  assert.equal(comparePeriods(games, "last5").goals, "up");
});

test("Raio-X respeita janela, aliases canônicos e métricas por posição", () => {
  const comparisonGames = games.map((game, index) => ({ ...game, performance: { players: [
    { eaName: "Obenzera", rating: 7 + index / 10, passesMade: 20 + index, passesAttempts: 30 + index, tackles: 2, shots: 1, goals: index % 2, assists: 1 },
    { eaName: "JoaoEA", position: "GOL", rating: 7, saves: 3, passesMade: 12, passesAttempts: 15 },
  ] } }));
  const players = [{ id: "oben", display_name: "OBEN", positions: ["MC"], is_active: true }, { id: "joao", display_name: "JOÃO", positions: ["GOL"], is_active: true }];
  const aliases = [{ ea_name: "Obenzera", player_id: "oben" }, { ea_name: "JoaoEA", player_id: "joao" }];
  assert.equal(selectComparisonPeriod(comparisonGames, "7days", "", new Date("2026-08-10T23:59:00-03:00")).length, 7);
  const line = buildPlayerComparison(comparisonGames, { period: "30days", now: new Date("2026-08-10T23:59:00-03:00"), kind: "line", players, aliases });
  assert.equal(line.players[0].name, "OBEN");
  assert.equal(line.axes.includes("G+A/j"), true);
  const goalkeeper = buildPlayerComparison(comparisonGames, { period: "all", kind: "goalkeeper", players, aliases });
  assert.equal(goalkeeper.players[0].name, "JOÃO");
  assert.equal(goalkeeper.axes.includes("Defesas/j"), true);
  assert.equal(goalkeeper.axes.includes("Finalizações/j"), false);
});

test("Raio-X mantém elenco ativo sem amostra e nunca inventa comparação estatística", () => {
  const players = [
    { id: "with-data", display_name: "Com dados", positions: ["MC"], is_active: true },
    { id: "no-data", display_name: "Sem dados", positions: ["ATA"], is_active: true },
    { id: "inactive", display_name: "Inativo", positions: ["ZAG"], is_active: false },
  ];
  const aliases = [{ ea_name: "Obenzera", player_id: "with-data" }];
  const result = buildPlayerComparison(games.slice(0, 1).map((game) => ({ ...game, performance: { players: [{ eaName: "Obenzera", rating: 8, goals: 1 }] } })), { kind: "line", period: "all", players, aliases, playerIds: ["no-data"] });
  assert.deepEqual(result.roster.map((player) => player.playerId), ["with-data", "no-data"]);
  assert.equal(result.roster.find((player) => player.playerId === "no-data").hasSample, false);
  assert.equal(result.players.length, 0);
});
