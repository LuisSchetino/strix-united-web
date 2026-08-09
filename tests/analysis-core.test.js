import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalysis, comparePeriods, selectAnalysisPeriod } from "../src/features/analysis/analysis-core.js";

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
