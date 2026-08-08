import test from "node:test";
import assert from "node:assert/strict";
import { calculateQualificationScenarios } from "../src/features/competitions/scenario-engine.js";

const rules = ["points", "wins", "goal_difference", "goals_for"];

test("calcula cenários de vitória, empate e derrota de forma exaustiva", () => {
  const result = calculateQualificationScenarios({
    standings: [
      { name: "Líder", points: 12, played: 5, wins: 4, goalsFor: 9, goalsAgainst: 3 },
      { name: "STRIX UNITED", points: 9, played: 5, wins: 3, goalsFor: 8, goalsAgainst: 5 },
      { name: "Time X", points: 9, played: 5, wins: 3, goalsFor: 7, goalsAgainst: 5 },
      { name: "Time Y", points: 7, played: 5, wins: 2, goalsFor: 5, goalsAgainst: 5 },
    ],
    fixtures: [
      { home: "STRIX UNITED", away: "Líder" },
      { home: "Time X", away: "Time Y" },
    ],
    qualificationSlots: 2,
    tieBreakRules: rules,
  });
  assert.equal(result.combinations, 9);
  assert.equal(result.scenarios.find((item) => item.result === "V").possible, true);
  assert.equal(result.currentPosition, 2);
  assert.equal(result.pointsAvailable, 3);
});

test("detecta classificação garantida", () => {
  const result = calculateQualificationScenarios({
    standings: [
      { name: "STRIX UNITED", points: 20, played: 7, wins: 6, goalsFor: 20, goalsAgainst: 4 },
      { name: "Time X", points: 10, played: 7, wins: 3, goalsFor: 8, goalsAgainst: 8 },
      { name: "Time Y", points: 8, played: 7, wins: 2, goalsFor: 7, goalsAgainst: 9 },
    ],
    fixtures: [{ home: "Time X", away: "Time Y" }],
    qualificationSlots: 1,
    tieBreakRules: rules,
  });
  assert.equal(result.status, "guaranteed");
});

test("detecta classificação impossível", () => {
  const result = calculateQualificationScenarios({
    standings: [
      { name: "Líder", points: 20, played: 7, wins: 6 },
      { name: "Time X", points: 16, played: 7, wins: 5 },
      { name: "STRIX UNITED", points: 8, played: 7, wins: 2 },
    ],
    fixtures: [{ home: "STRIX UNITED", away: "Líder" }],
    qualificationSlots: 2,
    tieBreakRules: rules,
  });
  assert.equal(result.status, "impossible");
});

test("não confirma matemática quando o desempate não foi configurado", () => {
  const result = calculateQualificationScenarios({
    standings: [{ name: "STRIX UNITED", points: 3 }, { name: "Time X", points: 3 }],
    fixtures: [], qualificationSlots: 1, tieBreakRules: [],
  });
  assert.equal(result.confirmed, false);
  assert.match(result.tieBreakWarning, /não confirmado/i);
});
