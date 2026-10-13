// The songs a director keeps for the generated videos. They live in THIS browser only
// (IndexedDB): the site never uploads or serves them.

const DB_NAME = "strix-fc27-music";
const STORE = "songs";
const CHOICE_KEY = "strix:media:music";
export const MUSIC_MAX_BYTES = 40 * 1024 * 1024;
export const MUSIC_MAX_SONGS = 12;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB indisponível."));
  });
}

const run = async (mode, work) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/** The name shown for a file: without the extension, in one line. */
export function songName(fileName) {
  const clean = String(fileName || "").trim().replace(/\.[a-z0-9]{2,5}$/i, "").replace(/\s+/g, " ").trim();
  return (clean || "Música").slice(0, 80);
}

/** Why a file cannot be kept, or "" when it can. */
export function songProblem(file, count = 0) {
  if (!file) return "Nenhum arquivo escolhido.";
  if (!/^audio\//.test(file.type || "") && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name || "")) return "Esse arquivo não é de áudio. Use MP3, M4A ou WAV.";
  if (file.size > MUSIC_MAX_BYTES) return "Música grande demais (o limite é 40 MB).";
  if (count >= MUSIC_MAX_SONGS) return `A lista já tem ${MUSIC_MAX_SONGS} músicas. Tire uma antes de guardar outra.`;
  return "";
}

/** The songs kept here: `[{ id, name, size, addedAt }]`, by name. */
export async function listSongs() {
  try {
    const rows = await run("readonly", (store) => store.getAll());
    return (rows || []).map(({ id, name, size, addedAt }) => ({ id, name, size, addedAt })).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  } catch {
    return [];
  }
}

export async function addSong(file) {
  const problem = songProblem(file, (await listSongs()).length);
  if (problem) throw new Error(problem);
  const song = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name: songName(file.name), size: file.size, addedAt: new Date().toISOString(), blob: file };
  await run("readwrite", (store) => store.put(song));
  return { id: song.id, name: song.name, size: song.size, addedAt: song.addedAt };
}

export async function removeSong(id) {
  await run("readwrite", (store) => store.delete(id));
}

/** The song's file, ready to be read: `{ id, name, bytes }`, or null when it is not here. */
export async function readSong(id) {
  try {
    const row = await run("readonly", (store) => store.get(id));
    return row?.blob ? { id: row.id, name: row.name, bytes: await row.blob.arrayBuffer() } : null;
  } catch {
    return null;
  }
}

/** The song chosen for the videos on this device ("" = none). */
export function readSongChoice() {
  try { return localStorage.getItem(CHOICE_KEY) || ""; } catch { return ""; }
}

export function writeSongChoice(id) {
  try { if (id) localStorage.setItem(CHOICE_KEY, id); else localStorage.removeItem(CHOICE_KEY); } catch { /* a convenience only */ }
}
