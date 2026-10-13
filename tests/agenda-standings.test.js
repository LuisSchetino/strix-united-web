import test from "node:test";
import assert from "node:assert/strict";
import { agendaStandingComparison, standingsWindow } from "../src/features/agenda/agenda-standings.js";

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

test("the fixture shows its stretch of the table: leader, both clubs and neighbours", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ team: `CLUBE ${index + 1}`, position: index + 1, points: 30 - index * 2 }));
  const window = standingsWindow(rows, rows[5], rows[9]);
  assert.deepEqual(window.map((row) => row.position), [1, 5, 6, 7, 9, 10, 11]);
  assert.deepEqual(window.filter((row) => row.gap).map((row) => row.position), [5, 9]);
  assert.equal(window.find((row) => row.position === 6).isStrix, true);
  assert.equal(window.find((row) => row.position === 10).isOpponent, true);
  const result = agendaStandingComparison({ competition_edition_id: "edition", opponent_team_id: "ctx", opponent_name: "CTX" }, sources, [{ id: "ctx", name: "CTX GAMINGG" }]);
  assert.equal(result.pointsGap, -1);
  assert.deepEqual(result.table.map((row) => row.team), ["CTX GAMINGG", "STRIX UNITED"]);
});
