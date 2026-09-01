import test from "node:test";
import assert from "node:assert/strict";
import { agendaStandingComparison } from "../src/features/agenda/agenda-standings.js";

const sources = [{ edition_id: "edition", source_kind: "standings", snapshot: { name: "8 * COPA YESHUA", groups: [{ standings: [
  { team: "STRIX UNITED", isStrix: true, position: 3, points: 12, played: 7 },
  { team: "CTX GAMINGG", position: 2, points: 13, played: 7 },
] }] } }];

test("Agenda compares only Strix and the canonical opponent", () => {
  const result = agendaStandingComparison({ competition_edition_id: "edition", opponent_team_id: "ctx", opponent_name: "CTX" }, sources, [{ id: "ctx", name: "CTX GAMINGG" }]);
  assert.equal(result.available, true);
  assert.equal(result.strix.position, 3);
  assert.equal(result.opponent.points, 13);
});

test("Agenda standings returns a safe fallback when the opponent is absent", () => {
  const result = agendaStandingComparison({ competition_edition_id: "edition", opponent_name: "DESCONHECIDO" }, sources);
  assert.equal(result.available, false);
  assert.equal(result.reason, "opponent_missing");
});
