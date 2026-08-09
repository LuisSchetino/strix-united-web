import test from "node:test";
import assert from "node:assert/strict";
import { librarySource, libraryThumbnail, progressPatch, canTrackLibrary } from "../src/features/library/library-core.js";

test("Biblioteca reconhece YouTube, Drive e mídia direta sem inventar tracking", () => {
  assert.equal(librarySource("https://youtu.be/abc123").type, "youtube");
  assert.equal(librarySource("https://www.youtube.com/watch?v=abc123").id, "abc123");
  assert.equal(librarySource("https://drive.google.com/file/d/drive-id/view").trackable, false);
  assert.equal(librarySource("https://cdn.example.com/review.mp4").type, "direct");
});

test("progresso conclui em 90% e nunca regride segundos assistidos", () => {
  const patch = progressPatch(90, 100, { watched_seconds: 95, started_at: "2026-08-01T00:00:00Z" });
  assert.equal(patch.progress_percent, 90);
  assert.equal(patch.watched_seconds, 95);
  assert.ok(patch.completed_at);
  assert.equal(canTrackLibrary("conselho"), true);
  assert.equal(canTrackLibrary("player"), false);
});

test("thumbnail editorial é usada quando não há imagem manual", () => {
  assert.equal(libraryThumbnail({ category: "jogada" }), "/assets/library-jogada.svg");
  assert.equal(libraryThumbnail({ category: "review" }), "/assets/library-review.svg");
  assert.equal(libraryThumbnail({ category: "review", thumbnail_url: "https://cdn.example/custom.webp" }), "https://cdn.example/custom.webp");
});
