import test from "node:test";
import assert from "node:assert/strict";
import { saveRosterPlayer } from "../src/features/squad/player-save.js";
import { createRosterFixtureClient } from "../src/dev/roster-fixture-client.js";

function fixture(seed = []) {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  return { storage, client: createRosterFixtureClient(storage, "test", seed) };
}
const draft = { display_name: "IGOR", positions: ["ZAG"], member_type: "elenco" };

test("regression: old insert-only flow conflicts with a soft-deleted player", async () => {
  const { client } = fixture([{ id: "igor", ...draft, is_active: false }]);
  const result = await client.from("club_players").insert({ ...draft, is_active: true });
  assert.equal(result.error.code, "23505");
});

test("create → edit → archive → same-name reactivation → reload preserves one identity", async () => {
  const { client, storage } = fixture();
  const created = await saveRosterPlayer(client, "qa", draft);
  const id = created.player.id;
  const history = [{ player_id: id, goals: 4 }];
  const aliases = [{ player_id: id, ea_name: "IGOR_EA" }];
  await saveRosterPlayer(client, "qa", { ...draft, id, shirt_number: 8 });
  await client.from("club_players").update({ is_active: false, source_metadata: { legacy: true }, structure_role: "staff", avatar_path: "old.png" }).eq("id", id);
  const restored = await saveRosterPlayer(client, "qa2", { ...draft, display_name: " igor " });
  assert.equal(restored.reactivated, true);
  assert.equal(restored.player.id, id);
  const reloaded = createRosterFixtureClient(storage, "test");
  assert.equal(reloaded.rows().length, 1);
  assert.equal(reloaded.rows()[0].is_active, true);
  assert.equal(reloaded.rows()[0].avatar_path, "old.png");
  assert.equal(reloaded.rows()[0].structure_role, "staff");
  assert.equal(reloaded.rows()[0].created_by, "qa");
  assert.deepEqual(reloaded.rows()[0].source_metadata, { legacy: true });
  assert.deepEqual(history, [{ player_id: id, goals: 4 }]);
  assert.deepEqual(aliases, [{ player_id: id, ea_name: "IGOR_EA" }]);
});

test("active duplicates are refused before uploading; no fuzzy identity matching", async () => {
  const { client } = fixture([{ id: "one", ...draft, is_active: true }]);
  let uploaded = false;
  await assert.rejects(saveRosterPlayer(client, "qa", draft, {}, async () => { uploaded = true; }), /ativo/);
  assert.equal(uploaded, false);
  await saveRosterPlayer(client, "qa", { ...draft, display_name: "YGOR" });
  assert.equal(client.rows().length, 2);
});

test("concurrent re-add cannot create two records or silently overwrite reactivation", async () => {
  const { client } = fixture([{ id: "one", ...draft, is_active: false }]);
  const results = await Promise.allSettled([saveRosterPlayer(client, "qa", draft), saveRosterPlayer(client, "qa", draft)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(client.rows().length, 1);
});

test("ambiguous identities and query failures never insert a replacement", async () => {
  const { client } = fixture([{ id: "one", ...draft, is_active: false }, { id: "two", ...draft, is_active: false }]);
  await assert.rejects(saveRosterPlayer(client, "qa", draft), /Mais de um/);
  assert.equal(client.rows().length, 2);
  const denied = { from: () => ({ select: async () => ({ error: new Error("Access denied") }) }) };
  await assert.rejects(saveRosterPlayer(denied, "qa", draft), /Access denied/);
});
