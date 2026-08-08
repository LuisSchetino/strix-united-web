import test from "node:test";
import assert from "node:assert/strict";
import { agendaMutationForFixture, competitionFingerprint, nextSyncAt, saoPauloDay } from "../functions/_lib/competition-sync.js";

const context = {
  competition: { id: "competition", name: "VPR ELITE" },
  edition: { id: "edition" },
  actorUserId: "actor",
  now: new Date("2026-08-10T15:00:00Z"),
};

test("fingerprint ignores fetch-only metadata but detects sports changes", async () => {
  const base = { fetchedAt: "2026-08-08T10:00:00Z", groups: [{ standings: [{ team: "STRIX", points: 10 }] }] };
  assert.equal(await competitionFingerprint(base), await competitionFingerprint({ ...base, fetchedAt: "2026-08-08T10:15:00Z" }));
  assert.notEqual(await competitionFingerprint(base), await competitionFingerprint({ ...base, groups: [{ standings: [{ team: "STRIX", points: 13 }] }] }));
});

test("provider Agenda creates once and updates only official fields", () => {
  const fixture = { id: "fixture", home_team_name: "STRIX UNITED", away_team_name: "POA CITY", scheduled_at: "2026-08-10T22:10:00-03:00", status: "scheduled" };
  const first = agendaMutationForFixture(null, fixture, context);
  assert.equal(first.action, "insert");
  assert.equal(first.payload.source_fixture_id, "fixture");
  const current = { id: "agenda", ...first.payload, lineup: [{ player: "Obeen" }], scheduled_at: fixture.scheduled_at };
  assert.equal(agendaMutationForFixture(current, fixture, context).action, "unchanged");
  const moved = agendaMutationForFixture(current, { ...fixture, scheduled_at: "2026-08-10T22:40:00-03:00" }, context);
  assert.equal(moved.action, "update");
  assert.equal(moved.payload.scheduled_at, "2026-08-10T22:40:00-03:00");
  assert.equal("lineup" in moved.payload, false);
  const completed = agendaMutationForFixture(null, { ...fixture, status: "completed" }, context);
  assert.equal(completed.payload.status, "completed");
});

test("timezone and cadence prefer game day without browser polling", () => {
  assert.equal(saoPauloDay("2026-08-11T02:30:00Z"), "2026-08-10");
  const next = nextSyncAt([{ home_team_name: "STRIX", away_team_name: "POA", scheduled_at: "2026-08-10T18:00:00Z", status: "scheduled" }], new Date("2026-08-10T17:00:00Z"));
  assert.equal(next, "2026-08-10T17:15:00.000Z");
});
