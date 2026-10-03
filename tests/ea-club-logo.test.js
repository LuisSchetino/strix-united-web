import test from "node:test";
import assert from "node:assert/strict";
import { buildEaClubLogoIndex, eaClubLogoFor, readOpponentClubId } from "../src/features/teams/ea-club-logo.js";
import { resolveTeamIdentity } from "../src/features/teams/team-identity.js";

const raw = {
  clubs: {
    30428: { clubId: "30428", name: "Strix United", goals: 3 },
    88001: { clubId: "88001", name: "SMG", goals: 1 },
  },
};

const catalog = {
  competitions: [{ id: "ccb", organization: "CCB Clubs" }, { id: "other", organization: "VPR" }],
  editions: [{ id: "ed-ccb", competition_id: "ccb" }, { id: "ed-vpr", competition_id: "other" }],
  teams: [
    { id: "smg", edition_id: "ed-ccb", name: "SMG", logo_url: "https://ccb.test/smg.png", is_strix: false },
    { id: "other-crest", edition_id: "ed-vpr", name: "SMG", logo_url: "https://vpr.test/smg.png", is_strix: false },
  ],
};

test("reads the opponent club id and ignores Strix", () => {
  assert.equal(readOpponentClubId(raw), "88001");
  assert.equal(readOpponentClubId({ clubs: { 30428: { name: "Strix" } } }), "");
});

test("an EA club id reuses the CCB crest after the in-game name matches once", () => {
  const index = buildEaClubLogoIndex({
    matches: [{ opponent_name: "SMG", raw_ea: raw }],
    ...catalog,
  });
  assert.equal(eaClubLogoFor(index, { clubId: "88001" }), "https://ccb.test/smg.png");
  assert.equal(eaClubLogoFor(index, { name: "SMG" }), "https://ccb.test/smg.png");
  const later = resolveTeamIdentity({
    name: "Santos Mil Grau",
    eaClubLogo: eaClubLogoFor(index, { clubId: "88001", name: "Santos Mil Grau" }),
  });
  assert.equal(later.logo, "https://ccb.test/smg.png");
  assert.equal(later.source, "ea_club");
});

test("a manual crest stays ahead of the provider link", () => {
  const identity = resolveTeamIdentity({
    name: "SMG",
    directLogo: "https://assets.test/manual.png",
    eaClubLogo: "https://ccb.test/smg.png",
  });
  assert.equal(identity.logo, "https://assets.test/manual.png");
  assert.equal(identity.source, "direct");
});

test("conflicting CCB crests do not bind the club id", () => {
  const index = buildEaClubLogoIndex({
    matches: [{ opponent_name: "SMG", raw_ea: raw }],
    competitions: catalog.competitions,
    editions: catalog.editions,
    teams: [
      ...catalog.teams,
      { id: "smg-2", edition_id: "ed-ccb", name: "SMG", logo_url: "https://ccb.test/other.png", is_strix: false },
    ],
  });
  assert.equal(eaClubLogoFor(index, { clubId: "88001" }), "");
});
