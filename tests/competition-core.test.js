import test from "node:test";
import assert from "node:assert/strict";
import { deriveCompetitionView, qualificationState } from "../src/features/competitions/competition-core.js";

test("classificação preservada e mata-mata define a fase atual", () => {
  const sources = [
    { source_kind: "standings", last_synced_at: "2026-08-08T12:00:00Z", snapshot: { phase: "standings", groups: [{ name: "Grupo 1", standings: [{ team: "STRIX UNITED" }] }] } },
    { source_kind: "knockout", last_synced_at: "2026-08-08T13:00:00Z", snapshot: { knockout: { currentStage: "Quartas de final", fixtures: [{ externalMatchId: "qf-4", roundLabel: "Quartas de final", scheduledAt: "2026-08-10T23:10:00-03:00", homeTeamName: "XUMBREGA SC", awayTeamName: "STRIX UNITED", status: "scheduled" }] } } },
  ];
  const view = deriveCompetitionView(sources, []);
  assert.equal(view.currentStage, "Quartas de final");
  assert.equal(view.standings.groups.length, 1);
  assert.equal(view.strixFixture.home_team_name, "XUMBREGA SC");
});

test("próximo jogo do provider existe sem qualquer item na Agenda", () => {
  const fixtures = [{ external_match_id: "provider-only", round_label: "Quartas de final", scheduled_at: "2026-08-10T23:10:00-03:00", home_team_name: "XUMBREGA SC", away_team_name: "STRIX UNITED", status: "scheduled" }];
  const view = deriveCompetitionView([{ source_kind: "knockout", snapshot: { knockout: { currentStage: "Quartas" } } }], fixtures);
  assert.equal(view.upcoming.length, 1);
  assert.equal(view.strixFixture.away_team_name, "STRIX UNITED");
});

test("main games view keeps only Strix fixtures", () => {
  const fixtures = [
    { external_match_id: "all-a", home_team_name: "A", away_team_name: "B", status: "scheduled" },
    { external_match_id: "strix", home_team_name: "XUMBREGA", away_team_name: "STRIX UNITED", status: "scheduled" },
    { external_match_id: "all-b", home_team_name: "C", away_team_name: "D", status: "completed", home_score: 1, away_score: 0 },
  ];
  const view = deriveCompetitionView([{ source_kind: "standings", snapshot: { phase: "standings", groups: [] } }], fixtures);
  assert.deepEqual(view.upcoming.map((fixture) => fixture.external_match_id), ["strix"]);
  assert.equal(view.providerResults.length, 0);
  assert.equal(view.allUpcoming.length, 2);
});

test("shows waiting for knockout only after a group phase has really ended", () => {
  const source = { source_kind: "standings", snapshot: { phase: "groups", type: "Grupos + Mata-Mata", groups: [] } };
  const view = deriveCompetitionView([source], [{ home_team_name: "STRIX", away_team_name: "A", status: "completed" }]);
  assert.equal(view.awaitingKnockout, true);
  assert.equal(view.currentStage, "Aguardando mata-mata");
});

test("qualification zone keeps positions 1-8 in and 9-12 out", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ position: index + 1 }));
  assert.equal(rows.filter((row) => qualificationState(row, 8).inside).length, 8);
  assert.equal(qualificationState(rows[7], 8).label, "Dentro da zona de classificação");
  assert.equal(qualificationState(rows[8], 8).label, "Fora da zona • a 1 posição");
  assert.equal(qualificationState(rows[9], 8).label, "Fora da zona • a 2 posições");
});

test("provider qualification slots take precedence over the manual fallback", () => {
  const view = deriveCompetitionView([
    {
      source_kind: "standings",
      snapshot: {
        phase: "standings",
        qualificationRule: { slots: 4, source: "provider_visual" },
        groups: [],
      },
    },
  ], [], { qualification_slots: 6 });
  assert.equal(view.qualificationSlots, 4);
});

test("edição histórica não mantém fixture futura como próximo jogo", () => {
  const view = deriveCompetitionView([], [{ external_match_id: "future", status: "scheduled", home_team_name: "STRIX UNITED", away_team_name: "TIME A", scheduled_at: "2026-12-01T22:00:00Z" }], { status: "historical", outcome: "Campeão" });
  assert.equal(view.upcoming.length, 0);
  assert.equal(view.strixFixture, null);
  assert.equal(view.currentStage, "Campeão");
});
