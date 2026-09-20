import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FC27_CLUB_ID,
  FC27_LEGACY_CLUB_IDS,
  FC27_MATCH_TYPES,
  FC27_PLATFORM,
  eaMatchesUrl,
  isStrixClubId,
  parseEaMatchesPayload,
  readStrixKeyed,
} from "../shared/fc27-club.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("source of truth FC27 é única e o legado 15686 só entra no parse", async () => {
  assert.equal(FC27_CLUB_ID, "30428");
  assert.equal(FC27_PLATFORM, "common-gen5");
  assert.deepEqual([...FC27_MATCH_TYPES], ["friendlyMatch", "leagueMatch", "playoffMatch"]);
  assert.deepEqual([...FC27_LEGACY_CLUB_IDS], ["15686"]);
  assert.equal(isStrixClubId("30428"), true);
  assert.equal(isStrixClubId("15686"), true);
  assert.equal(isStrixClubId("999"), false);
  assert.equal(readStrixKeyed({ 15686: { goals: 2 }, 632: { goals: 1 } }).goals, 2);
  assert.equal(readStrixKeyed({ 30428: { goals: 4 } }).goals, 4);
  assert.deepEqual(parseEaMatchesPayload({ matches: [{ matchId: "a" }] }), [{ matchId: "a" }]);
  const url = eaMatchesUrl();
  assert.match(url, /clubIds=30428/);
  assert.match(url, /platform=common-gen5/);
  assert.match(url, /proclubs\.ea\.com\/api\/fc\/clubs\/matches/);

  const files = [
    "../src/main.jsx",
    "../src/features/matches/import-core.js",
    "../functions/api/ea/matches.js",
    "../services/ea-sync/server.js",
    "../services/ea-sync/ea-client.js",
    "../tools/ea-local-bridge.mjs",
  ];
  for (const file of files) {
    const source = await read(file);
    assert.match(source, /fc27-club\.js/);
    assert.doesNotMatch(source, /EA_CLUB_ID = "15686"|clubId !== "15686"|clubIds=15686/);
  }
  const club = await read("../services/ea-sync/fc27-club.js");
  assert.match(club, /export const FC27_CLUB_ID = "30428"/);
});
