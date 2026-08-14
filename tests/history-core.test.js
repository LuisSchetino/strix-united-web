import test from "node:test";
import assert from "node:assert/strict";
import { aggregateCompetitionHistory, competitionStatsFromFixtures, detectParticipationEnd } from "../src/features/competitions/history-core.js";

test("agrupa quartas, vice e campeão na mesma competição", () => {
  const result = aggregateCompetitionHistory([
    { competition_id: "copa", competition_name: "Copa Exua", label: "Edição 1", outcome: "Eliminado nas quartas de final", stats: { games: 4, wins: 2, draws: 1, losses: 1, goalsFor: 8, goalsAgainst: 5 } },
    { competition_id: "copa", competition_name: "Copa Exua", label: "Edição 2", outcome: "Vice-campeão", stats: { games: 6, wins: 4, draws: 1, losses: 1, goalsFor: 12, goalsAgainst: 6 } },
    { competition_id: "copa", competition_name: "Copa Exua", label: "Edição 3", outcome: "Campeão", stats: { games: 7, wins: 6, draws: 0, losses: 1, goalsFor: 18, goalsAgainst: 7 } },
  ])[0];
  assert.equal(result.editions.length, 3);
  assert.equal(result.titles, 1);
  assert.equal(result.finals, 2);
  assert.equal(result.games, 17);
  assert.deepEqual(result.editions.map((edition) => edition.campaignLevel), [48, 82, 100]);
});

test("detecta derrota eliminatória e vitória na final", () => {
  const eliminated = detectParticipationEnd({ fixtures: [{ status: "completed", round_label: "Quartas de final", home_team_name: "STRIX UNITED", away_team_name: "POA", home_score: 1, away_score: 2 }] });
  assert.equal(eliminated.ended, true);
  assert.match(eliminated.outcome, /quartas/i);
  const champion = detectParticipationEnd({ fixtures: [{ status: "completed", round_label: "Final", home_team_name: "POA", away_team_name: "STRIX UNITED", home_score: 1, away_score: 2 }] });
  assert.equal(champion.outcome, "Campeão");
});

test("calcula o histórico a partir de fixtures reais sem contar slots duas vezes", () => {
  const stats = competitionStatsFromFixtures([
    { external_match_id: "group-1", home_team_name: "STRIX UNITED", away_team_name: "POA", home_score: 2, away_score: 1, status: "completed" },
    { external_match_id: "group-1", home_team_name: "STRIX UNITED", away_team_name: "POA", home_score: 2, away_score: 1, status: "completed" },
    { bracket_slot_key: "quarterfinal:0", home_team_name: "TIME B", away_team_name: "STRIX UNITED", home_score: 0, away_score: 0, status: "completed" },
    { bracket_slot_key: "semifinal:0", home_team_name: "STRIX UNITED", away_team_name: "TIME C", home_score: 1, away_score: 3, status: "completed" },
    { bracket_slot_key: "final:0", home_team_name: "TIME C", away_team_name: "TIME D", home_score: null, away_score: null, status: "scheduled" },
  ]);
  assert.deepEqual(stats, { games: 3, wins: 1, draws: 1, losses: 1, goalsFor: 3, goalsAgainst: 4 });
});
