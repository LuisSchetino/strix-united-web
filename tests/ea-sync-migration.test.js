import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20260817120000_fc27_ea_sync_and_legacy_content.sql", import.meta.url), "utf8");

test("EA sync migration is additive, service-role only and idempotent", () => {
  assert.match(migration, /create table if not exists public\.club_match_players/i);
  assert.match(migration, /unique \(club_match_id, external_player_id\)/i);
  assert.match(migration, /on conflict \(external_match_id\) do update/i);
  assert.match(migration, /on conflict \(club_match_id, external_player_id\) do update/i);
  assert.match(migration, /revoke all on function public\.sync_fc27_ea_matches\(jsonb, uuid\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.sync_fc27_ea_matches\(jsonb, uuid\) to service_role/i);
  assert.doesNotMatch(migration, /drop table|truncate table|delete from public\.club_/i);
});
