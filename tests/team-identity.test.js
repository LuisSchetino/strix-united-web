import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTeamIdentityName,
  resolveAgendaTeamIdentity,
  resolveTeamIdentity,
} from "../src/features/teams/team-identity.js";

test("team identity prefers the canonical team id and provider logo", () => {
  const teams = [{ id: "machine", edition_id: "vpr", name: "Máquina Esports", logo_url: "https://provider/machine.png" }];
  const identity = resolveTeamIdentity({ teamId: "machine", name: "MAQUINA", teams });
  assert.equal(identity.name, "Máquina Esports");
  assert.equal(identity.logo, "https://provider/machine.png");
  assert.equal(identity.source, "team_id");
});

test("agenda resolves old automatic entries dynamically through source fixture", () => {
  const teams = [
    { id: "strix", edition_id: "vpr", name: "STRIX UNITED", is_strix: true },
    { id: "machine", edition_id: "vpr", name: "Máquina Esports", logo_url: "https://provider/machine.png" },
  ];
  const fixtures = [{ id: "fixture", edition_id: "vpr", home_team_id: "strix", away_team_id: "machine", home_team_name: "STRIX UNITED", away_team_name: "Máquina Esports" }];
  const identity = resolveAgendaTeamIdentity({ source_fixture_id: "fixture", opponent_name: "Maquina" }, { fixtures, teams });
  assert.equal(identity.id, "machine");
  assert.equal(identity.logo, "https://provider/machine.png");
});

test("normalization removes only known sports suffixes", () => {
  assert.equal(normalizeTeamIdentityName("  POA City FC  "), "poa city");
  assert.equal(normalizeTeamIdentityName("Sport Club Recife"), "sport club recife");
  assert.equal(normalizeTeamIdentityName("GLASGOW FC17"), "glasgow");
  assert.equal(normalizeTeamIdentityName("BODO ES"), "bodo");
  assert.equal(normalizeTeamIdentityName("Nexus SAF"), "nexus");
  assert.equal(normalizeTeamIdentityName("SMG"), "smg");
});

test("in-game suffix still finds the provider crest", () => {
  const teams = [{ id: "glasgow", edition_id: "ccb", name: "Glasgow FC", logo_url: "https://ccb.test/glasgow.png" }];
  const identity = resolveTeamIdentity({ name: "GLASGOW FC17", teams });
  assert.equal(identity.logo, "https://ccb.test/glasgow.png");
});

test("safe global CCB identity reuses a logo shared across editions", () => {
  const teams = [
    { id: "genius-a", edition_id: "a", name: "Genius Esports", logo_url: "https://ccb.test/genius.png", metadata: {} },
    { id: "genius-b", edition_id: "b", name: "GENIUS ESPORTS", logo_url: "https://ccb.test/genius.png", metadata: {} },
  ];
  const identity = resolveTeamIdentity({ name: "Genius Esports", teams });
  assert.equal(identity.logo, "https://ccb.test/genius.png");
  assert.equal(identity.source, "global_name");
});

test("global name fallback refuses conflicting crests", () => {
  const teams = [
    { id: "same-a", edition_id: "a", name: "United FC", logo_url: "https://ccb.test/a.png", metadata: {} },
    { id: "same-b", edition_id: "b", name: "United FC", logo_url: "https://ccb.test/b.png", metadata: {} },
  ];
  const identity = resolveTeamIdentity({ name: "United FC", teams });
  assert.equal(identity.logo, "");
  assert.equal(identity.source, "fallback");
});

test("history logo is used only when previous records agree", () => {
  const identity = resolveTeamIdentity({
    name: "Time Histórico",
    history: [
      { name: "TIME HISTORICO", logo: "https://assets.test/history.png" },
      { name: "Time Histórico FC", logo: "https://assets.test/history.png" },
    ],
  });
  assert.equal(identity.logo, "https://assets.test/history.png");
  assert.equal(identity.source, "history");
});
