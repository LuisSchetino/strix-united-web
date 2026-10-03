import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../supabase/migrations/20260808014500_fc27_gameday_competitions_and_history.sql", import.meta.url);
const competitionRlsFixUrl = new URL("../supabase/migrations/20260808164217_fix_competition_edition_insert_rls.sql", import.meta.url);
const syncMigrationUrl = new URL("../supabase/migrations/20260808191417_fc27_competition_sync_and_provider_agenda.sql", import.meta.url);
const identityAndBracketUrl = new URL("../supabase/migrations/20260813103000_fc27_team_identity_and_bracket_slots.sql", import.meta.url);
const nightRelatedUrl = new URL("../supabase/migrations/20260902220000_fc27_night_related.sql", import.meta.url);

test("migration FC27 e aditiva e ativa RLS nos novos dominios", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate|delete\s+from)\b/i);
  for (const table of ["competitions", "competition_editions", "competition_sources", "competition_fixtures"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /private\.has_minimum_tier\('dev'\)/);
  assert.match(sql, /private\.has_minimum_tier\('diretoria'\)/);
  assert.match(sql, /created_by is immutable/);
  assert.doesNotMatch(sql, /grant insert, update, delete on public\.competitions/i);
});

test("correcao de RLS permite RETURNING somente para edicoes legiveis", async () => {
  const sql = await readFile(competitionRlsFixUrl, "utf8");
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate|delete\s+from|alter\s+table)\b/i);
  assert.match(sql, /drop policy if exists "members read permitted competition editions"/i);
  assert.match(sql, /for select\s+to authenticated\s+using\s*\(\s*status <> 'historical'/i);
  assert.match(sql, /private\.has_minimum_tier\('conselho'\)/i);
  assert.doesNotMatch(sql, /private\.can_read_competition_edition\s*\(\s*id\s*\)/i);
  assert.doesNotMatch(sql, /for\s+(insert|update|delete)/i);
});

test("competition sync migration is additive, idempotent and keeps internal Agenda data", async () => {
  const sql = await readFile(syncMigrationUrl, "utf8");
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate|delete\s+from)\b/i);
  assert.match(sql, /add column if not exists source_fixture_id uuid/i);
  assert.match(sql, /unique index if not exists agenda_matches_source_fixture_unique_idx/i);
  assert.match(sql, /competition_sync_log enable row level security/i);
  assert.match(sql, /private\.invoke_fc27_competition_sync/i);
  assert.match(sql, /fc27-competition-sync-15m/i);
  assert.doesNotMatch(sql, /SUPABASE_SERVICE_ROLE_KEY/i);
});

test("team identity and bracket migration preserves data and protects stable slots", async () => {
  const sql = await readFile(identityAndBracketUrl, "utf8");
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate|delete\s+from)\b/i);
  assert.match(sql, /add column if not exists opponent_team_id uuid/i);
  assert.match(sql, /add column if not exists bracket_slot_key text/i);
  assert.match(sql, /unique \(edition_id, bracket_slot_key\)/i);
  assert.match(sql, /duplicate_bracket_slot/i);
  assert.match(sql, /opponent_team_id is null/i);
});

test("night related migration is additive and keyed by Sao Paulo date", async () => {
  const sql = await readFile(nightRelatedUrl, "utf8");
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate|delete\s+from)\b/i);
  assert.match(sql, /create table if not exists public\.night_related/i);
  assert.match(sql, /night_date date primary key/i);
  assert.match(sql, /player_ids uuid\[\]/i);
  assert.match(sql, /alter table public\.night_related enable row level security/i);
  assert.match(sql, /private\.has_minimum_tier\('diretoria'\)/);
});

test("ACL local migration locks photo/number and DEV-only match writes without dropping data", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260916093000_fc27_acl_player_identity_and_match_dev.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate|delete\s+from)\b/i);
  assert.match(sql, /guard_club_player_locked_fields/);
  assert.match(sql, /player_photo_or_number_locked/);
  assert.match(sql, /old\.is_active/);
  assert.match(sql, /developers delete FC27 squad/);
  assert.match(sql, /developers create FC27 matches/);
  assert.match(sql, /private\.has_minimum_tier\('dev'\)/);
  assert.match(sql, /developers create night related/);
});

test("structure_role is additive on club_players and covers manager/staff", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260914220000_fc27_club_structure_role.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate|delete\s+from)\b/i);
  assert.match(sql, /add column if not exists structure_role/i);
  assert.match(sql, /jogador.*staff.*diretoria.*conselho.*manager/s);
});
