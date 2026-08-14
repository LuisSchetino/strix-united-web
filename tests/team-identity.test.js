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
});
