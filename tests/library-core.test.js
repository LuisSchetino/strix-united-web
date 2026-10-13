import test from "node:test";
import assert from "node:assert/strict";
import { createPlayMeter, librarySource, libraryThumbnail, memberTracking, progressStatus, watchPatch, canTrackLibrary } from "../src/features/library/library-core.js";

test("Biblioteca reconhece YouTube, Drive e mídia direta sem inventar tracking", () => {
  assert.equal(librarySource("https://youtu.be/abc123").type, "youtube");
  assert.equal(librarySource("https://www.youtube.com/watch?v=abc123").id, "abc123");
  assert.equal(librarySource("https://drive.google.com/file/d/drive-id/view").trackable, false);
  assert.equal(librarySource("https://cdn.example.com/review.mp4").type, "direct");
});

test("progresso conclui em 90% do que foi realmente assistido e nunca regride", () => {
  const now = new Date("2026-10-04T01:00:00Z");
  // 3 min 40 s played from the start of a 2-hour video: measured, in progress.
  const first = watchPatch({}, { position: 220, duration: 7200, played: 220 }, now);
  assert.equal(first.watched_seconds, 220);
  assert.equal(first.last_position_seconds, 220);
  assert.equal(first.progress_percent, 3.06);
  assert.equal(first.completed_at, null);
  assert.ok(first.started_at);
  // Dragging the bar to the end and playing ten seconds does not complete it.
  const skipped = watchPatch(first, { position: 7190, duration: 7200, played: 10 }, now);
  assert.equal(skipped.watched_seconds, 230);
  assert.equal(skipped.progress_percent, 3.19, "vale o que foi assistido, não a posição");
  assert.equal(skipped.completed_at, null);
  // Going back to rewatch never lowers what was reached.
  const back = watchPatch(skipped, { position: 30, duration: 7200, played: 30 }, now);
  assert.equal(back.progress_percent, 3.19);
  assert.equal(back.watched_seconds, 260);
  assert.equal(back.last_position_seconds, 30);
  // Watching through completes at 90%, once.
  const done = watchPatch({ watched_seconds: 80, progress_percent: 80, started_at: "2026-08-01T00:00:00Z" }, { position: 91, duration: 100, played: 11 }, now);
  assert.equal(done.progress_percent, 91);
  assert.equal(done.completed_at, now.toISOString());
  assert.equal(done.started_at, "2026-08-01T00:00:00Z");
  assert.equal(watchPatch({ ...done }, { position: 5, duration: 100, played: 5 }, new Date("2026-10-05T00:00:00Z")).completed_at, now.toISOString());
  assert.equal(canTrackLibrary("conselho"), true);
  assert.equal(canTrackLibrary("player"), false);
});

test("o medidor conta só o tempo reproduzido: pular, pausar e dormir não contam", () => {
  const meter = createPlayMeter();
  let wall = 1000;
  // Four samples a second for ten seconds of normal playback.
  for (let step = 0; step <= 40; step += 1) { meter.sample(step * 0.25, { playing: true, wall }); wall += 250; }
  assert.equal(meter.take(), 10);
  // A jump forward of ten minutes adds nothing; the seconds after it count.
  meter.sample(610, { playing: true, wall }); wall += 250;
  for (let step = 1; step <= 8; step += 1) { meter.sample(610 + step * 0.25, { playing: true, wall }); wall += 250; }
  assert.equal(meter.take(), 2);
  // Paused: the clock runs, the video does not.
  for (let step = 0; step < 20; step += 1) { meter.sample(612, { playing: false, wall }); wall += 250; }
  assert.equal(meter.take(), 0);
  // A background tab wakes the timer once a minute: the minute that played is still counted.
  meter.sample(612, { playing: true, wall }); wall += 60000;
  meter.sample(672, { playing: true, wall });
  assert.equal(meter.take(), 60);
  // 2x speed: content seconds, as the position reports them.
  wall += 1000; meter.sample(674, { playing: true, rate: 2, wall });
  assert.equal(meter.take(), 2);
  // A failed save gives its seconds back.
  meter.giveBack(7);
  assert.equal(meter.take(), 7);
});

test("Drive: conta o tempo com o player aberto depois do play, nunca um percentual", () => {
  const meter = createPlayMeter();
  let wall = 5000;
  meter.tick(wall, { counting: false });
  for (let second = 0; second < 30; second += 1) { wall += 1000; meter.tick(wall, { counting: false }); }
  assert.equal(meter.take(), 0, "antes do play nada conta");
  for (let second = 0; second < 220; second += 1) { wall += 1000; meter.tick(wall, { counting: true }); }
  wall += 8 * 3600 * 1000; meter.tick(wall, { counting: true });
  assert.equal(meter.take(), 220, "o computador dormindo não vira tempo assistido");
  const row = watchPatch({ opened_at: "2026-10-03T22:14:00Z" }, { position: 0, duration: 0, played: 220 });
  assert.equal(row.watched_seconds, 220);
  assert.equal(row.progress_percent, 0);
  assert.equal(row.completed_at, null);
  const drive = { source_url: "https://drive.google.com/file/d/z/view" };
  assert.equal(progressStatus(row, drive), "timed");
  assert.equal(progressStatus({ watched_seconds: 0 }, drive), "opened");
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
