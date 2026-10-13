import { AGENDA_TEMPLATE_ID, agendaFileName, fingerprintAgendaRender } from "./agenda-media-core.js";
import { canEncodeSound, encodeAgendaMp4, encodeStillPng } from "./encode-mp4.js";
import { loadAgendaAssets, loadAnnounceAssets, loadNightAgendaAssets, loadNightRelatedAssets, loadRelatedNightAssets, loadSummaryAssets } from "./media-assets.js";
import { relatedNightFileName, fingerprintRelatedNightRender, RELATED_NIGHT_TEMPLATE_ID } from "./related-night-core.js";
import { relatedNightFrameTime, renderRelatedNightFrame } from "./related-night-frame.js";
import { fingerprintSummaryRender, SUMMARY_TEMPLATE_ID, summaryFileName } from "./summary-core.js";
import { summaryFrameTime, renderSummaryFrame } from "./summary-frame.js";
import {
  ANNOUNCE_CACHE_DAY,
  ANNOUNCE_TEMPLATE_ID,
  announceFileName,
  fingerprintAnnounceRender,
} from "./announce-core.js";
import { announceFrameTime, renderAnnounceFrame } from "./announce-frame.js";
import { rendersToPrune } from "./render-archive.js";

const DB_NAME = "strix-fc27-media";
const STORE = "renders";

const listeners = new Set();
let job = {
  status: "idle",
  stage: "",
  format: "story",
  fingerprint: "",
  progress: null,
  result: null,
  error: "",
};

function emit(patch) {
  job = { ...job, ...patch };
  for (const listener of listeners) listener(job);
}

export function getMediaJob() {
  return job;
}

export function subscribeMediaJob(listener) {
  listeners.add(listener);
  listener(job);
  return () => listeners.delete(listener);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB indisponível."));
  });
}

async function readCached(id) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function writeCached(record) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    /* cache is best-effort */
  }
}

/** Deletes the old pieces of this browser's archive (see render-archive.js). Best-effort, like the cache itself. */
export async function pruneCachedRenders(now = Date.now()) {
  try {
    const db = await openDb();
    const rows = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result || []).map(({ id, template, createdAt }) => ({ id, template, createdAt })));
      request.onerror = () => reject(request.error);
    });
    const ids = rendersToPrune(rows, now);
    if (!ids.length) return 0;
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      for (const id of ids) transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    return ids.length;
  } catch {
    return 0;
  }
}

export async function findCachedRender(fingerprint, format) {
  const record = await readCached(`${fingerprint}:${format}`);
  if (!record?.blob) return null;
  return record;
}

export async function listCachedRenders(day, { template } = {}) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => {
        const rows = (request.result || []).filter((row) => {
          if (day && row.day !== day) return false;
          if (!template) return true;
          const rowTemplate = row.template || AGENDA_TEMPLATE_ID;
          return rowTemplate === template;
        });
        resolve(rows.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))));
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * A piece cut on a song kept on this device (music-library.js): reads the song and places the
 * official timeline on its hits. `score` is the piece's own function in film-sound.js.
 */
async function scoreWithSong(music, timeline, score) {
  if (!canEncodeSound()) throw new Error("Este navegador não grava som no vídeo. Use Chrome ou Edge atualizado, ou gere sem música.");
  const [{ readSong }, { readTrack }, film] = await Promise.all([import("./music-library.js"), import("./media-sound.js"), import("./film-sound.js")]);
  const song = await readSong(music.id);
  if (!song) throw new Error("A música escolhida não está mais neste aparelho. Escolha outra ou gere sem música.");
  let track = null;
  try { track = await readTrack(song.bytes); } catch { throw new Error("Não consegui ler essa música. Tente outro arquivo (MP3, M4A ou WAV)."); }
  // A night timeline is rebuilt on the song's clock; an official one is laid over the song.
  if (timeline?.night) { const scored = await film.scoreNight({ track, build: timeline.build }); return { ...scored, timeline: { ...timeline, ...scored.timeline } }; }
  return film[score]({ timeline, track });
}

/** Progress of a render, with the encoder's note of which sound it wrote kept aside. */
const soundAware = (note) => (progress) => { if (progress.stage === "sound") note.codec = progress.codec; else emit({ stage: progress.stage, progress }); };

export async function startAgendaRender({
  matches,
  format,
  day,
  dayLabel,
  timeline,
  // A song kept on this device (music-library.js, `{ id }`): the video is cut on its beats.
  music = null,
  force = false,
} = {}) {
  if (job.status === "running") return job;
  const fingerprint = await fingerprintAgendaRender({
    day,
    format,
    matches,
    look: timeline?.mediaLook || "campaign",
    music: music?.id || "",
    model: timeline?.night ? "night" : "",
    face: timeline?.night ? timeline.face?.id || "crest" : "",
  });
  const fileName = agendaFileName({ day, format });
  if (!force) {
    const cached = await findCachedRender(fingerprint, format);
    if (cached) {
      emit({
        status: "ready",
        stage: "cached",
        template: AGENDA_TEMPLATE_ID,
        format,
        fingerprint,
        progress: { stage: "finishing", ratio: 1 },
        result: cached,
        error: "",
      });
      return getMediaJob();
    }
  }

  const controller = new AbortController();
  emit({
    status: "running",
    stage: "preparing",
    template: AGENDA_TEMPLATE_ID,
    format,
    fingerprint,
    progress: { stage: "preparing", loaded: 0, total: 0 },
    result: null,
    error: "",
    controller,
  });

  try {
    const report = { onProgress: (progress) => emit({ stage: "preparing", progress }) };
    const assets = timeline?.night ? await loadNightAgendaAssets(matches, timeline.face, report) : await loadAgendaAssets(matches, report);
    const scored = music?.id ? await scoreWithSong(music, timeline, "scoreAgenda") : null;
    const wrote = { codec: "" };
    const blob = await encodeAgendaMp4({
      timeline: scored?.timeline || timeline,
      assets,
      dayLabel,
      soundtrack: scored?.soundtrack || null,
      signal: controller.signal,
      onProgress: soundAware(wrote),
    });
    const record = {
      id: `${fingerprint}:${format}`,
      fingerprint,
      format,
      // "aac" or "opus" when the file carries the song; "" when it is silent.
      sound: wrote.codec,
      template: AGENDA_TEMPLATE_ID,
      day,
      fileName,
      createdAt: new Date().toISOString(),
      matchCount: matches.length,
      blob,
    };
    await writeCached(record);
    emit({
      status: "ready",
      stage: "ready",
      progress: { stage: "finishing", ratio: 1, totalFrames: timeline.totalFrames, frame: timeline.totalFrames },
      result: record,
      error: "",
      controller: null,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      emit({ status: "idle", stage: "", error: "", controller: null, result: null });
      return getMediaJob();
    }
    emit({
      status: "error",
      stage: "error",
      error: error?.message || "Não foi possível gerar o vídeo.",
      controller: null,
    });
  }
  return getMediaJob();
}

export async function startRelatedNightRender({
  players,
  format = "story",
  day,
  dayLabel,
  timeline,
  // A song kept on this device (`{ id }`): the video is cut on its beats.
  music = null,
  force = false,
} = {}) {
  if (job.status === "running") return job;
  const fingerprint = await fingerprintRelatedNightRender({
    day,
    format,
    players,
    look: timeline?.mediaLook || "campaign",
    music: music?.id || "",
    model: timeline?.night ? "night" : "",
  });
  const fileName = relatedNightFileName({ day, format });
  if (!force) {
    const cached = await findCachedRender(fingerprint, format);
    if (cached) {
      emit({
        status: "ready",
        stage: "cached",
        template: RELATED_NIGHT_TEMPLATE_ID,
        format,
        fingerprint,
        progress: { stage: "finishing", ratio: 1 },
        result: cached,
        error: "",
      });
      return getMediaJob();
    }
  }

  const controller = new AbortController();
  emit({
    status: "running",
    stage: "preparing",
    template: RELATED_NIGHT_TEMPLATE_ID,
    format,
    fingerprint,
    progress: { stage: "preparing", loaded: 0, total: 0 },
    result: null,
    error: "",
    controller,
  });

  try {
    const report = { onProgress: (progress) => emit({ stage: "preparing", progress }) };
    const assets = timeline?.night ? await loadNightRelatedAssets(players, report) : await loadRelatedNightAssets(players, report);
    const scored = music?.id ? await scoreWithSong(music, timeline, "scoreRelated") : null;
    const wrote = { codec: "" };
    const blob = await encodeAgendaMp4({
      timeline: scored?.timeline || timeline,
      assets,
      dayLabel,
      soundtrack: scored?.soundtrack || null,
      signal: controller.signal,
      onProgress: soundAware(wrote),
      renderFrame: renderRelatedNightFrame,
      frameTime: relatedNightFrameTime,
    });
    const record = {
      id: `${fingerprint}:${format}`,
      fingerprint,
      format,
      sound: wrote.codec,
      template: RELATED_NIGHT_TEMPLATE_ID,
      day,
      fileName,
      createdAt: new Date().toISOString(),
      matchCount: players.length,
      blob,
    };
    await writeCached(record);
    emit({
      status: "ready",
      stage: "ready",
      progress: { stage: "finishing", ratio: 1, totalFrames: timeline.totalFrames, frame: timeline.totalFrames },
      result: record,
      error: "",
      controller: null,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      emit({ status: "idle", stage: "", error: "", controller: null, result: null });
      return getMediaJob();
    }
    emit({
      status: "error",
      stage: "error",
      error: error?.message || "Não foi possível gerar o vídeo.",
      controller: null,
    });
  }
  return getMediaJob();
}

export async function startSummaryRender({
  period,
  format = "story",
  day,
  dayLabel,
  timeline,
  // A song kept on this device (`{ id }`): the video is cut on its beats.
  music = null,
  force = false,
} = {}) {
  if (job.status === "running") return job;
  const mode = period?.mode === "week" ? "week" : "day";
  const matches = period?.matches || [];
  const fingerprint = await fingerprintSummaryRender({
    mode,
    day,
    format,
    matches,
    look: timeline?.mediaLook || "campaign",
    music: music?.id || "",
    model: timeline?.night ? "night" : "",
    face: timeline?.night ? timeline.face?.id || "crest" : "",
  });
  const fileName = summaryFileName({ day, mode, format });
  if (!force) {
    const cached = await findCachedRender(fingerprint, format);
    if (cached) {
      emit({
        status: "ready",
        stage: "cached",
        template: SUMMARY_TEMPLATE_ID,
        format,
        fingerprint,
        progress: { stage: "finishing", ratio: 1 },
        result: cached,
        error: "",
      });
      return getMediaJob();
    }
  }

  const controller = new AbortController();
  emit({
    status: "running",
    stage: "preparing",
    template: SUMMARY_TEMPLATE_ID,
    format,
    fingerprint,
    progress: { stage: "preparing", loaded: 0, total: 0 },
    result: null,
    error: "",
    controller,
  });

  try {
    const report = { onProgress: (progress) => emit({ stage: "preparing", progress }) };
    const assets = timeline?.night ? await loadNightAgendaAssets(matches, timeline.face, report) : await loadSummaryAssets(matches, report);
    const scored = music?.id ? await scoreWithSong(music, timeline, "scoreAgenda") : null;
    const wrote = { codec: "" };
    const blob = await encodeAgendaMp4({
      timeline: scored?.timeline || timeline,
      assets,
      dayLabel,
      soundtrack: scored?.soundtrack || null,
      signal: controller.signal,
      onProgress: soundAware(wrote),
      renderFrame: renderSummaryFrame,
      frameTime: summaryFrameTime,
    });
    const record = {
      id: `${fingerprint}:${format}`,
      fingerprint,
      format,
      sound: wrote.codec,
      template: SUMMARY_TEMPLATE_ID,
      day,
      fileName,
      createdAt: new Date().toISOString(),
      matchCount: matches.length,
      blob,
    };
    await writeCached(record);
    emit({
      status: "ready",
      stage: "ready",
      progress: { stage: "finishing", ratio: 1, totalFrames: timeline.totalFrames, frame: timeline.totalFrames },
      result: record,
      error: "",
      controller: null,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      emit({ status: "idle", stage: "", error: "", controller: null, result: null });
      return getMediaJob();
    }
    emit({
      status: "error",
      stage: "error",
      error: error?.message || "Não foi possível gerar o vídeo.",
      controller: null,
    });
  }
  return getMediaJob();
}

export async function startAnnounceRender({
  kind = "individual",
  format = "story",
  people = [],
  phrase = "",
  phraseId = "",
  title = "",
  announceType = "",
  day = ANNOUNCE_CACHE_DAY,
  timeline,
  // A song kept on this device (`{ id }`): the video is cut on its beats (an image has none).
  music = null,
  force = false,
} = {}) {
  if (job.status === "running") return job;
  const fingerprint = await fingerprintAnnounceRender({
    kind,
    format,
    people,
    phrase,
    phraseId,
    title,
    announceType,
    look: timeline?.mediaLook || "campaign",
    music: format === "feed" ? "" : music?.id || "",
    model: timeline?.night ? "night" : "",
  });
  const fileName = announceFileName({
    kind,
    format,
    name: people[0]?.name || "",
    title,
  });
  if (!force) {
    const cached = await findCachedRender(fingerprint, format);
    if (cached) {
      emit({
        status: "ready",
        stage: "cached",
        template: ANNOUNCE_TEMPLATE_ID,
        format,
        fingerprint,
        progress: { stage: "finishing", ratio: 1 },
        result: cached,
        error: "",
      });
      return getMediaJob();
    }
  }

  const controller = new AbortController();
  emit({
    status: "running",
    stage: "preparing",
    template: ANNOUNCE_TEMPLATE_ID,
    format,
    fingerprint,
    progress: { stage: "preparing", loaded: 0, total: 0 },
    result: null,
    error: "",
    controller,
  });

  try {
    const report = { onProgress: (progress) => emit({ stage: "preparing", progress }) };
    const assets = timeline?.night ? await loadNightRelatedAssets(people, report) : await loadAnnounceAssets(people, { loadFx: format === "feed", ...report });
    const scored = music?.id && format !== "feed" ? await scoreWithSong(music, timeline, "scoreAgenda") : null;
    const wrote = { codec: "" };
    if (format === "feed") {
      emit({ stage: "image", progress: { stage: "image", ratio: 0.6 } });
    }
    const blob = format === "feed"
      ? await encodeStillPng({
        timeline,
        assets,
        renderFrame: renderAnnounceFrame,
        timeSec: 0,
      })
      : await encodeAgendaMp4({
        timeline: scored?.timeline || timeline,
        assets,
        soundtrack: scored?.soundtrack || null,
        signal: controller.signal,
        onProgress: soundAware(wrote),
        renderFrame: renderAnnounceFrame,
        frameTime: announceFrameTime,
      });
    const record = {
      id: `${fingerprint}:${format}`,
      fingerprint,
      format,
      sound: wrote.codec,
      template: ANNOUNCE_TEMPLATE_ID,
      day,
      fileName,
      createdAt: new Date().toISOString(),
      matchCount: people.length,
      mime: blob.type,
      blob,
    };
    await writeCached(record);
    emit({
      status: "ready",
      stage: "ready",
      progress: { stage: "finishing", ratio: 1, totalFrames: timeline.totalFrames, frame: timeline.totalFrames },
      result: record,
      error: "",
      controller: null,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      emit({ status: "idle", stage: "", error: "", controller: null, result: null });
      return getMediaJob();
    }
    emit({
      status: "error",
      stage: "error",
      error: error?.message || "Não foi possível gerar o anúncio.",
      controller: null,
    });
  }
  return getMediaJob();
}

export function cancelAgendaRender() {
  job.controller?.abort();
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function progressLabel(progress) {
  if (!progress) return "";
  if (progress.stage === "preparing") {
    return progress.total
      ? `Preparando imagens · ${progress.loaded}/${progress.total}`
      : "Preparando imagens";
  }
  if (progress.stage === "rendering") {
    return `Montando o vídeo · quadro ${progress.frame} de ${progress.totalFrames}`;
  }
  if (progress.stage === "encoding") return "Finalizando o MP4";
  if (progress.stage === "image") return "Gerando imagem";
  if (progress.stage === "finishing") return "Finalizando";
  if (progress.stage === "cached") return "Esta versão já estava pronta";
  return "";
}
