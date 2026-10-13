import test from "node:test";
import assert from "node:assert/strict";
import { MUSIC_MAX_BYTES, MUSIC_MAX_SONGS, songName, songProblem } from "../src/features/media/music-library.js";
import { fingerprintAgendaRender } from "../src/features/media/agenda-media-core.js";

test("a song is listed by its file name without the extension", () => {
  assert.equal(songName("MC Hariel - Maçã Verde.mp3"), "MC Hariel - Maçã Verde");
  assert.equal(songName("  faixa   01.M4A "), "faixa 01");
  assert.equal(songName(""), "Música");
});

test("only audio files of a sane size are kept, up to the limit of the list", () => {
  assert.equal(songProblem({ name: "a.mp3", type: "audio/mpeg", size: 1000 }), "");
  assert.equal(songProblem({ name: "a.mp3", type: "", size: 1000 }), "");
  assert.match(songProblem({ name: "a.pdf", type: "application/pdf", size: 1000 }), /não é de áudio/);
  assert.match(songProblem({ name: "a.mp3", type: "audio/mpeg", size: MUSIC_MAX_BYTES + 1 }), /grande demais/);
  assert.match(songProblem({ name: "a.mp3", type: "audio/mpeg", size: 1000 }, MUSIC_MAX_SONGS), /Tire uma/);
  assert.match(songProblem(null), /Nenhum arquivo/);
});

test("a video cut on a song is not the same render as the one without it", async () => {
  const base = { day: "2026-10-08", format: "story", matches: [{ id: "1", scheduled_at: "2026-10-08T21:00:00-03:00", opponent: "Rival" }] };
  const silent = await fingerprintAgendaRender(base);
  assert.equal(await fingerprintAgendaRender({ ...base, music: "" }), silent);
  assert.notEqual(await fingerprintAgendaRender({ ...base, music: "song-a" }), silent);
  assert.notEqual(await fingerprintAgendaRender({ ...base, music: "song-a" }), await fingerprintAgendaRender({ ...base, music: "song-b" }));
});
