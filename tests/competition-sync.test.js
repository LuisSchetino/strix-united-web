import test from "node:test";
import assert from "node:assert/strict";
import { agendaMutationForFixture, competitionFingerprint, nextSyncAt, persistCompetitionSync, saoPauloDay, selectProviderAgendaFixtures } from "../functions/_lib/competition-sync.js";

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

test("provider Agenda imports all upcoming Strix fixtures and preserves linked results", () => {
  const fixtures = [
    { id: "ctx", home_team_name: "CTX", away_team_name: "STRIX UNITED", scheduled_at: "2026-09-02T02:10:00Z", status: "scheduled" },
    { id: "genius", home_team_name: "STRIX UNITED", away_team_name: "GENIUS ESPORTS", scheduled_at: "2026-09-04T00:40:00Z", status: "scheduled" },
    { id: "old", home_team_name: "STRIX UNITED", away_team_name: "OLD", scheduled_at: "2026-08-20T00:40:00Z", status: "scheduled" },
    { id: "linked", agenda_match_id: "agenda", home_team_name: "STRIX UNITED", away_team_name: "LINKED", scheduled_at: "2026-08-20T00:40:00Z", status: "completed" },
    { id: "other", home_team_name: "A", away_team_name: "B", scheduled_at: "2026-09-04T00:40:00Z", status: "scheduled" },
  ];
  assert.deepEqual(selectProviderAgendaFixtures(fixtures, new Date("2026-09-01T20:00:00-03:00")).map((fixture) => fixture.id), ["ctx", "genius", "linked"]);
});

test("automatic sync persists a provider snapshot in bounded bulk requests", async () => {
  const calls = [];
  let teamRows = [];
  const client = {
    from(table) {
      let operation = "select";
      let payload;
      const query = {
        upsert(value) { operation = "upsert"; payload = value; calls.push({ table, operation, payload }); return query; },
        update(value) { operation = "update"; payload = value; calls.push({ table, operation, payload }); return query; },
        select() { return query; },
        eq() { return query; },
        then(resolve) {
          if (table === "competition_sources") {
            if (operation === "select") return resolve({ data: [], error: null });
            return resolve({ data: payload.map((row, index) => ({ ...row, id: `source-${index}` })), error: null });
          }
          if (table === "competition_teams" && operation === "upsert") {
            teamRows = payload.map((row, index) => ({ ...row, id: `team-${index}` }));
            return resolve({ data: null, error: null });
          }
          if (table === "competition_teams") return resolve({ data: teamRows, error: null });
          return resolve({ data: null, error: null });
        },
      };
      return query;
    },
  };
  const preview = {
    provider: "ccb", sourceKind: "standings", source: "https://ccb.test/standings", phase: "league",
    externalCompetitionId: "100", externalGroupId: "1", fetchedAt: "2026-08-08T20:00:00Z",
    organization: "CCB", fixtures: [{ externalMatchId: "match-1", roundLabel: "Rodada 1", scheduledAt: "2026-08-08T22:10:00-03:00", homeTeamName: "STRIX UNITED", awayTeamName: "POA CITY", status: "scheduled" }],
  };
  const result = await persistCompetitionSync(client, {
    competition: { id: "competition", organization: "CCB" },
    edition: { id: "edition", metadata: {} }, actorUserId: "actor", preview,
  });
  assert.equal(result.fixtures, 1);
  assert.equal(calls.filter((call) => call.table === "competition_sources").length, 1);
  assert.equal(calls.find((call) => call.table === "competition_teams").payload.length, 2);
  const fixturePayload = calls.find((call) => call.table === "competition_fixtures").payload[0];
  assert.equal(fixturePayload.external_match_id, "match-1");
  assert.equal("agenda_match_id" in fixturePayload, false);
  assert.ok(calls.length <= 5);
});

test("agenda rows from provider fixtures are inserted and updated, never upserted on the partial index", async () => {
  // agenda_matches(source_fixture_id) is unique only where it is not null; ON CONFLICT
  // cannot target a partial index ("no unique or exclusion constraint matching…").
  const { syncProviderAgenda } = await import("../shared/provider-agenda.js");
  const calls = [];
  const existing = [{ id: "agenda-old", source_fixture_id: "old", opponent_name: "ANTIGO", opponent_team_id: null, competition_id: "competition", scheduled_at: "2026-10-06T22:00:00-03:00", status: "scheduled", created_by: "someone" }];
  const client = {
    from(table) {
      const call = { table, operation: "select", payload: null, filters: [] };
      const query = {
        select() { return query; },
        in() { return query; },
        eq(column, value) { call.filters.push([column, value]); return query; },
        insert(value) { call.operation = "insert"; call.payload = value; calls.push(call); return query; },
        update(value) { call.operation = "update"; call.payload = value; calls.push(call); return query; },
        upsert(value) { call.operation = "upsert"; call.payload = value; calls.push(call); return query; },
        then(resolve) {
          if (table === "agenda_matches" && call.operation === "select") return resolve({ data: existing, error: null });
          if (table === "agenda_matches" && call.operation === "insert") return resolve({ data: call.payload.map((row, index) => ({ id: `agenda-new-${index}`, source_fixture_id: row.source_fixture_id })), error: null });
          return resolve({ data: null, error: null });
        },
      };
      return query;
    },
  };
  const fixtures = [
    { id: "new", home_team_name: "STRIX UNITED", away_team_name: "POA CITY", away_team_id: "team-poa", scheduled_at: "2026-10-05T22:00:00-03:00", status: "scheduled" },
    { id: "old", agenda_match_id: "agenda-old", home_team_name: "SUMMIT FC", home_team_id: "team-summit", away_team_name: "STRIX UNITED", scheduled_at: "2026-10-06T22:00:00-03:00", status: "scheduled" },
    { id: "other", home_team_name: "A", away_team_name: "B", scheduled_at: "2026-10-05T22:00:00-03:00", status: "scheduled" },
  ];
  const result = await syncProviderAgenda(client, { competition: { id: "competition", name: "P11" }, edition: { id: "edition" }, actorUserId: "actor", fixtures, now: new Date("2026-10-03T22:00:00-03:00") });
  assert.deepEqual({ created: result.created, updated: result.updated, eligible: result.eligible }, { created: 1, updated: 1, eligible: 2 });
  assert.equal(calls.some((call) => call.operation === "upsert"), false, "nenhum upsert");
  const insert = calls.find((call) => call.table === "agenda_matches" && call.operation === "insert");
  assert.equal(insert.payload.length, 1);
  assert.equal(insert.payload[0].opponent_name, "POA CITY");
  assert.equal(insert.payload[0].source_fixture_id, "new");
  assert.equal(insert.payload[0].created_by, "actor");
  const update = calls.find((call) => call.table === "agenda_matches" && call.operation === "update");
  assert.equal(update.payload.opponent_name, "SUMMIT FC");
  assert.equal("created_by" in update.payload, false, "quem criou o jogo não muda");
  assert.deepEqual(update.filters, [["id", "agenda-old"]]);
  const links = calls.filter((call) => call.table === "competition_fixtures");
  assert.deepEqual(links.map((call) => [call.operation, call.payload, call.filters]), [["update", { agenda_match_id: "agenda-new-0" }, [["id", "new"]]]]);
});
