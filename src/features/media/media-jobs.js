import { AGENDA_TEMPLATE_ID, agendaFileName, fingerprintAgendaRender } from "./agenda-media-core.js";
import { encodeAgendaMp4, encodeStillPng } from "./encode-mp4.js";
import { loadAgendaAssets, loadAnnounceAssets, loadRelatedNightAssets, loadSummaryAssets } from "./media-assets.js";
import { preloadCollageAssets } from "../../assets/collage/index.js";
import { CUTOUT_TEMPLATE_SEEDS, preloadCutoutText } from "./cutout-text.js";
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

function collageMotionOf(timeline, motion = "chaos") {
  if (timeline?.still || timeline?.format === "feed") return "static";
  return motion;
}

async function prepareCollageLook(timeline, text = "", { seed = 1, mode = "chaos" } = {}) {
  if (String(timeline?.mediaLook || "").toLowerCase() !== "collage") return;
  await Promise.all([
    preloadCollageAssets(),
    preloadCutoutText(text, { seed, mode: collageMotionOf(timeline, mode) }),
  ]);
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

export async function startAgendaRender({
  matches,
  format,
  day,
  dayLabel,
  timeline,
  force = false,
} = {}) {
  if (job.status === "running") return job;
  const fingerprint = await fingerprintAgendaRender({
    day,
    format,
    matches,
    look: timeline?.mediaLook || "campaign",
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
    await prepareCollageLook(timeline, "AGENDA DO DIA", { seed: CUTOUT_TEMPLATE_SEEDS.agenda, mode: "chaos" });
    const assets = await loadAgendaAssets(matches, {
      onProgress: (progress) => emit({ stage: "preparing", progress }),
    });
    const blob = await encodeAgendaMp4({
      timeline,
      assets,
      dayLabel,
      signal: controller.signal,
      onProgress: (progress) => emit({ stage: progress.stage, progress }),
    });
    const record = {
      id: `${fingerprint}:${format}`,
      fingerprint,
      format,
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
  force = false,
} = {}) {
  if (job.status === "running") return job;
  const fingerprint = await fingerprintRelatedNightRender({
    day,
    format,
    players,
    look: timeline?.mediaLook || "campaign",
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
    await prepareCollageLook(timeline, `RELACIONADOS DA NOITE ${(players || []).map((item) => item.name || "").join(" ")}`, {
      seed: CUTOUT_TEMPLATE_SEEDS.related,
      mode: "match_cut",
    });
    const assets = await loadRelatedNightAssets(players, {
      onProgress: (progress) => emit({ stage: "preparing", progress }),
    });
    const blob = await encodeAgendaMp4({
      timeline,
      assets,
      dayLabel,
      signal: controller.signal,
      onProgress: (progress) => emit({ stage: progress.stage, progress }),
      renderFrame: renderRelatedNightFrame,
      frameTime: relatedNightFrameTime,
    });
    const record = {
      id: `${fingerprint}:${format}`,
      fingerprint,
      format,
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
    await prepareCollageLook(timeline, "RESUMO DO DIA", { seed: CUTOUT_TEMPLATE_SEEDS.summary, mode: "chaos" });
    const assets = await loadSummaryAssets(matches, {
      onProgress: (progress) => emit({ stage: "preparing", progress }),
    });
    const blob = await encodeAgendaMp4({
      timeline,
      assets,
      dayLabel,
      signal: controller.signal,
      onProgress: (progress) => emit({ stage: progress.stage, progress }),
      renderFrame: renderSummaryFrame,
      frameTime: summaryFrameTime,
    });
    const record = {
      id: `${fingerprint}:${format}`,
      fingerprint,
      format,
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
    await prepareCollageLook(timeline, `ELENCO ${(people || []).map((item) => item.name || "").join(" ")}`, {
      seed: CUTOUT_TEMPLATE_SEEDS.announce,
      mode: "chaos",
    });
    const assets = await loadAnnounceAssets(people, {
      onProgress: (progress) => emit({ stage: "preparing", progress }),
    });
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
        timeline,
        assets,
        signal: controller.signal,
        onProgress: (progress) => emit({ stage: progress.stage, progress }),
        renderFrame: renderAnnounceFrame,
        frameTime: announceFrameTime,
      });
    const record = {
      id: `${fingerprint}:${format}`,
      fingerprint,
      format,
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
      ? `Preparando assets ${progress.loaded}/${progress.total}`
      : "Preparando assets";
  }
  if (progress.stage === "rendering") {
    return `Renderizando ${progress.frame}/${progress.totalFrames} frames`;
  }
  if (progress.stage === "encoding") return "Codificando vídeo";
  if (progress.stage === "image") return "Gerando imagem";
  if (progress.stage === "finishing") return "Finalizando";
  if (progress.stage === "cached") return "Render em cache";
  return "";
}
