import test from "node:test";
import assert from "node:assert/strict";
import { librarySource, libraryThumbnail, memberTracking, progressPatch, progressStatus, canTrackLibrary } from "../src/features/library/library-core.js";

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

test("cada categoria tem sua capa; a imagem manual vence quando existe", () => {
  assert.equal(libraryThumbnail({ category: "jogada" }), "/assets/library/jogadas.svg");
  assert.equal(libraryThumbnail({ category: "review" }), "/assets/library/reviews.svg");
  assert.equal(libraryThumbnail({ category: "jogada", tags: ["Pressão"] }), "/assets/library/pressao.svg");
  assert.equal(libraryThumbnail({ category: "jogada", tags: ["saída de bola"] }), "/assets/library/construcao.svg");
  assert.equal(libraryThumbnail({ category: "review", thumbnail_url: "https://cdn.example/custom.webp" }), "https://cdn.example/custom.webp");
});

test("acompanhamento por membro sai só das linhas reais de progresso", () => {
  const items = [
    { id: "a", category: "jogada", tags: ["pressao"], source_url: "https://youtu.be/x1" },
    { id: "b", category: "review", tags: [], source_url: "https://youtu.be/x2" },
    { id: "c", category: "review", tags: [], source_url: "https://drive.google.com/file/d/z/view" },
  ];
  const progress = [
    { item_id: "a", user_id: "u1", viewer_display_name: "Nunes", progress_percent: 100, completed_at: "2026-10-02T23:00:00Z", last_accessed_at: "2026-10-02T23:00:00Z" },
    { item_id: "b", user_id: "u1", viewer_display_name: "Nunes", progress_percent: 40, completed_at: null, last_accessed_at: "2026-10-02T22:00:00Z" },
    { item_id: "gone", user_id: "u2", viewer_display_name: "Ex", progress_percent: 100, completed_at: "2026-10-01T00:00:00Z" },
  ];
  const [member, ...rest] = memberTracking(items, progress);
  assert.equal(rest.length, 0, "rows of archived material do not create members");
  assert.equal(member.name, "Nunes");
  assert.equal(member.completed, 1);
  assert.equal(member.opened, 2);
  assert.equal(member.total, 3);
  assert.equal(member.lastAccess, "2026-10-02T23:00:00Z");
  assert.deepEqual(member.byCategory.find((entry) => entry.id === "reviews"), { id: "reviews", label: "Reviews", total: 2, done: 0, opened: 1 });
  assert.equal(progressStatus(progress[1], items[1]), "in-progress");
  assert.equal(progressStatus(null, items[2]), "none");
  assert.equal(progressStatus({ progress_percent: 0 }, items[2]), "opened");
});

test("abertura em outra aba e foto do membro vêm das colunas reais quando existem", () => {
  const items = [{ id: "a", category: "review", tags: [], source_url: "https://youtu.be/x1" }];
  const external = { item_id: "a", user_id: "u1", viewer_display_name: "Obeen", viewer_avatar_url: "https://cdn/obeen.png", progress_percent: 0, external_open_count: 2, last_external_open_at: "2026-10-02T21:43:00Z", last_accessed_at: "2026-10-02T21:43:00Z" };
  assert.equal(progressStatus(external, items[0]), "external");
  const [member] = memberTracking(items, [external]);
  assert.equal(member.avatar, "https://cdn/obeen.png");
  assert.equal(member.externalOpens, 2);
  // Without the new columns (migration not applied) nothing is inferred.
  const plain = { item_id: "a", user_id: "u2", viewer_display_name: "Nunes", progress_percent: 0, last_accessed_at: "2026-10-02T21:00:00Z" };
  assert.equal(progressStatus(plain, items[0]), "opened");
  assert.equal(memberTracking(items, [plain])[0].avatar, "");
  assert.equal(memberTracking(items, [plain])[0].externalOpens, 0);
});
