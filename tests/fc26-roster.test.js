import test from "node:test";
import assert from "node:assert/strict";
import { fc26Roster, previewFc26Roster } from "../src/features/squad/fc26-roster.js";

test("snapshot FC26 contém apenas identidades estáveis e sem duplicatas", () => {
  assert.equal(fc26Roster.length, 18);
  assert.equal(new Set(fc26Roster.map((player) => player.sourcePlayerId)).size, fc26Roster.length);
  assert.equal(new Set(fc26Roster.map((player) => player.displayName)).size, fc26Roster.length);
});

test("prévia é idempotente por origem e concilia nomes já existentes", () => {
  const preview = previewFc26Roster([{ id: "current", display_name: "JOÃO", is_active: true }]);
  assert.equal(preview.find((player) => player.displayName === "JOÃO").action, "merge");
  const sourced = previewFc26Roster([{ id: "renamed", display_name: "JOÃO GAMER", source_system: "fc26", source_player_id: fc26Roster[0].sourcePlayerId }]);
  assert.equal(sourced[0].existing.id, "renamed");
  assert.equal(sourced[0].action, "merge");
});
