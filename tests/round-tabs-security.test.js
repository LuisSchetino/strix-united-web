import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("migration nova mantém RLS, ownership e exclusão Dev", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260809050234_fc27_library_tracking_and_competition_delete.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.library_items enable row level security/i);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /private\.has_minimum_tier\('conselho'\)/i);
  assert.match(sql, /developers delete competition editions/i);
  assert.doesNotMatch(sql, /drop table|truncate table/i);
});

test("logos reais não recebem o fundo visual reservado ao fallback", async () => {
  const css = await readFile(new URL("../src/ui/match-display.css", import.meta.url), "utf8");
  assert.match(css, /has-image:not\(\.is-framed\).*background:transparent/i);
});
