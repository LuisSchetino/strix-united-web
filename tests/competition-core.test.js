import test from "node:test";
import assert from "node:assert/strict";
import { deriveCompetitionView } from "../src/features/competitions/competition-core.js";

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
