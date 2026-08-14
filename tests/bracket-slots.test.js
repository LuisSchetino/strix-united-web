import test from "node:test";
import assert from "node:assert/strict";
import { bracketSlotKey, expandKnockoutSlots } from "../shared/bracket-slots.js";

const preview = (roundName, teams, rounds = [
  { name: "Quartas de final", scheduledAt: "2026-08-10T23:00:00-03:00" },
  { name: "Semifinais", scheduledAt: "2026-08-11T23:00:00-03:00" },
  { name: "Final", scheduledAt: "2026-08-13T23:00:00-03:00" },
]) => ({
  sourceKind: "knockout",
  provider: "ccb",
  externalCompetitionId: "200",
  externalGroupId: "12",
  knockout: {
    rounds,
    fixtures: teams.map(([homeTeamName, awayTeamName], index) => ({
      roundLabel: roundName,
      homeTeamName,
      awayTeamName,
      bracketPosition: index,
      status: "scheduled",
    })),
  },
});

test("a knockout creates one stable tree and future destination slots", () => {
  const slots = expandKnockoutSlots(preview("Quartas de final", [
    ["A", "B"], ["C", "D"], ["E", "F"], ["G", "STRIX UNITED"],
  ]));
  assert.equal(slots.length, 7);
  assert.deepEqual(slots.map((slot) => slot.bracketSlotKey), [
    "quarterfinal:0", "quarterfinal:1", "quarterfinal:2", "quarterfinal:3",
    "semifinal:0", "semifinal:1", "final:0",
  ]);
  assert.equal(slots[0].winnerToSlotKey, "semifinal:0");
  assert.equal(slots[0].winnerToSlot, 1);
  assert.equal(slots[1].winnerToSlot, 2);
});

test("processing the same bracket twice is idempotent", () => {
  const source = preview("Quartas de final", [["A", "B"], ["C", "D"]], [
    { name: "Quartas de final" }, { name: "Semifinais" },
  ]);
  const once = expandKnockoutSlots(source);
  const twice = expandKnockoutSlots(source);
  assert.deepEqual(twice, once);
  assert.equal(new Set([...once, ...twice].map((slot) => slot.bracketSlotKey)).size, once.length);
});

test("winner correction replaces the existing destination slot", () => {
  const original = { bracketSlotKey: bracketSlotKey("Semifinais", 0), homeTeamName: "Time A", awayTeamName: "Time C" };
  const corrected = expandKnockoutSlots(preview("Semifinais", [["Time B", "Time C"]], [
    { name: "Semifinais" }, { name: "Final" },
  ])).find((slot) => slot.bracketSlotKey === original.bracketSlotKey);
  const persisted = new Map([[original.bracketSlotKey, original]]);
  persisted.set(corrected.bracketSlotKey, corrected);
  assert.equal(persisted.size, 1);
  assert.equal(persisted.get("semifinal:0").homeTeamName, "Time B");
});
