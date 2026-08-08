import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../supabase/migrations/20260808014500_fc27_gameday_competitions_and_history.sql", import.meta.url);

test("migration FC27 e aditiva e ativa RLS nos novos dominios", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.doesNotMatch(sql, /\b(drop\s+table|truncate|delete\s+from)\b/i);
  for (const table of ["gameday_projects", "competitions", "competition_editions", "competition_sources", "competition_fixtures"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /private\.has_minimum_tier\('dev'\)/);
  assert.match(sql, /private\.has_minimum_tier\('diretoria'\)/);
  assert.match(sql, /created_by is immutable/);
  assert.doesNotMatch(sql, /grant insert, update, delete on public\.competitions/i);
});
