import test from "node:test";
import assert from "node:assert/strict";
import { libraryValues } from "../src/features/required/required-client.js";

const now = new Date("2026-10-08T22:00:00-03:00");

test("uma jogada obrigatória concluída aparece concluída na Biblioteca", () => {
  const values = libraryValues(null, { item_id: "i1", watched_seconds: 200, completed_at: "2026-10-08T21:50:00.000Z" }, 215, now);
  assert.equal(values.completed_at, "2026-10-08T21:50:00.000Z");
  assert.equal(values.watched_seconds, 200);
  assert.ok(values.progress_percent >= 90);
  assert.equal(values.last_position_seconds, 200);
  assert.ok(values.started_at && values.last_accessed_at);
});

test("assistindo pela metade, a Biblioteca mostra o que foi medido, sem concluir", () => {
  const values = libraryValues(null, { item_id: "i1", watched_seconds: 60, completed_at: null }, 240, now);
  assert.equal(values.progress_percent, 25);
  assert.equal(values.completed_at, null);
});

test("o registro da Biblioteca só cresce: o que ela já sabe não é diminuído nem regravado", () => {
  const current = { watched_seconds: 300, progress_percent: 100, completed_at: "2026-10-01T00:00:00.000Z", started_at: "2026-10-01T00:00:00.000Z", last_position_seconds: 240 };
  assert.equal(libraryValues(current, { item_id: "i1", watched_seconds: 120, completed_at: null }, 240, now), null);
  const partial = { watched_seconds: 30, progress_percent: 12.5, completed_at: null, started_at: "2026-10-07T00:00:00.000Z", last_position_seconds: 30 };
  const grown = libraryValues(partial, { item_id: "i1", watched_seconds: 230, completed_at: "2026-10-08T21:50:00.000Z" }, 240, now);
  assert.equal(grown.started_at, "2026-10-07T00:00:00.000Z");
  assert.equal(grown.watched_seconds, 230);
  assert.ok(grown.progress_percent >= 90 && grown.completed_at);
});

test("sem duração conhecida, concluir ainda vale como concluído", () => {
  const values = libraryValues(null, { item_id: "i1", watched_seconds: 0, completed_at: "2026-10-08T21:50:00.000Z" }, 0, now);
  assert.equal(values.progress_percent, 90);
  assert.ok(values.completed_at);
});
