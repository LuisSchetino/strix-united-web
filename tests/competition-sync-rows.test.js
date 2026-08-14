import test from "node:test";
import assert from "node:assert/strict";
import { dedupeCompetitionRows, fixtureConflictKey } from "../shared/competition-sync-rows.js";

test("deduplicates one statement by the exact bracket conflict key", () => {
  const placeholder = {
    edition_id: "edition",
    external_match_id: "old",
    bracket_slot_key: "semifinal:0",
    home_team_name: "Vencedor QF1",
    away_team_name: "Vencedor QF2",
    status: "scheduled",
    metadata: { placeholder: true },
  };
  const current = {
    edition_id: "edition",
    external_match_id: "stable",
    bracket_slot_key: "semifinal:0",
    home_team_id: "team-a",
    away_team_id: "team-b",
    home_team_name: "Vikings Team",
    away_team_name: "XUMBREGA SC",
    home_score: 3,
    away_score: 2,
    status: "completed",
    metadata: { placeholder: false, homeLogo: "vikings.png" },
  };
  const result = dedupeCompetitionRows([placeholder, current], fixtureConflictKey);
  assert.equal(result.rows.length, 1);
  assert.equal(result.collisions.length, 1);
  assert.equal(result.rows[0].home_team_name, "Vikings Team");
  assert.equal(result.rows[0].home_score, 3);
  assert.equal(result.rows[0].metadata.placeholder, false);
});

test("repeated canonical sync produces the same fixture set", () => {
  const rows = [
    { edition_id: "edition", external_match_id: "qf-1", bracket_slot_key: "quarterfinal:0", home_team_name: "A", away_team_name: "B" },
    { edition_id: "edition", external_match_id: "sf-1", bracket_slot_key: "semifinal:0", home_team_name: "A", away_team_name: "C" },
  ];
  const once = dedupeCompetitionRows(rows, fixtureConflictKey).rows;
  const twice = dedupeCompetitionRows([...once, ...rows], fixtureConflictKey).rows;
  assert.deepEqual(twice, once);
});
