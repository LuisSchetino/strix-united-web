export const ANNOUNCE_FX_REVISION = "fx-video-v1.2";
export const ANNOUNCE_FX_ROOT = "/media/announce-fx";

export const ANNOUNCE_FX_BLENDS = Object.freeze(["source-over", "screen", "lighter", "multiply", "overlay", "destination-in"]);

export const ANNOUNCE_FX_SLOTS = Object.freeze({
  lightSweep01: {
    id: "lightSweep01",
    path: `${ANNOUNCE_FX_ROOT}/light/light-rays-sweep-01.mp4`,
    type: "video",
    role: "overlay",
    usage: ["opening", "reveal", "hero"],
    blendMode: "screen",
    defaultOpacity: 0.5,
    defaultScale: 1.08,
    anchor: "center",
    loop: true,
    duration: 0,
    maxWidth: 540,
    maxFrames: 20,
  },
  flare01: {
    id: "flare01",
    path: `${ANNOUNCE_FX_ROOT}/light/light-leak-warm-01.mp4`,
    type: "video",
    role: "overlay",
    usage: ["opening", "close"],
    blendMode: "screen",
    defaultOpacity: 0.42,
    defaultScale: 1,
    anchor: "center",
    loop: false,
    duration: 0,
    maxWidth: 540,
    maxFrames: 18,
  },
  inkReveal01: {
    id: "inkReveal01",
    path: `${ANNOUNCE_FX_ROOT}/ink/ink-alpha-matte-01.mp4`,
    type: "matte-video",
    role: "matte",
    usage: ["transition", "reveal"],
    blendMode: "destination-in",
    defaultOpacity: 1,
    defaultScale: 1,
    anchor: "center",
    loop: false,
    duration: 0,
    maxWidth: 540,
    maxFrames: 20,
  },
  smoke01: {
    id: "smoke01",
    path: `${ANNOUNCE_FX_ROOT}/smoke/smoke-wisps-01.mp4`,
    type: "video",
    role: "overlay",
    usage: ["hero", "depth"],
    blendMode: "screen",
    defaultOpacity: 0.16,
    defaultScale: 1.15,
    anchor: "center",
    loop: true,
    duration: 0,
    maxWidth: 480,
    maxFrames: 18,
  },
});

export const ANNOUNCE_FX_SKIPPED = Object.freeze([
  { path: `${ANNOUNCE_FX_ROOT}/brush/brush-transition-01.mp4`, reason: "4K 61s full-color (não é overlay black-bg); screen no corte pinta o frame inteiro. Name underline continua regra 3px" },
  { path: `${ANNOUNCE_FX_ROOT}/light/water-caustics-01.mp4`, reason: "caustics de água / leitura azul, fora da campanha preta Strix" },
  { path: `${ANNOUNCE_FX_ROOT}/smoke/smoke-black-mixkit-01.mp4`, reason: "70MB; decode por frame inviável no encode Canvas sem pré-cache gigante" },
  { path: `${ANNOUNCE_FX_ROOT}/smoke/fog-drift-dark-01.mp4`, reason: "adiado; smoke-wisps cobre profundidade nesta rodada" },
  { path: `${ANNOUNCE_FX_ROOT}/particles/embers-drift-01.mp4`, reason: "fora do recorte light/brush/ink/smoke" },
  { path: `${ANNOUNCE_FX_ROOT}/particles/sparks-float-01.mp4`, reason: "fora do recorte light/brush/ink/smoke" },
  { path: `${ANNOUNCE_FX_ROOT}/texture/bokeh-warm-01.mp4`, reason: "fora do recorte light/brush/ink/smoke" },
]);

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function blendMode(value, fallback = "source-over") {
  return ANNOUNCE_FX_BLENDS.includes(value) ? value : fallback;
}

export function listAnnounceFxSlots() {
  return Object.values(ANNOUNCE_FX_SLOTS);
}

export function missingAnnounceFx(library = {}) {
  return listAnnounceFxSlots().filter((slot) => !library[slot.id] || library[slot.id].missing);
}

export function presentAnnounceFxIds(library = {}) {
  return listAnnounceFxSlots()
    .map((slot) => slot.id)
    .filter((id) => library[id] && !library[id].missing)
    .sort();
}

export function fxEnvelope(time, start, duration, hold = 0) {
  const local = Number(time) - Number(start);
  if (local < 0 || duration <= 0) return 0;
  const fade = Math.min(0.18, duration * 0.35);
  if (local < fade) return clamp(local / fade);
  if (local > duration - fade + hold) return clamp((duration + hold - local) / fade);
  return 1;
}

export function fxBitmapAt(fx, time = 0) {
  if (fx?.frames?.length) {
    const fps = fx.fps || (fx.frames.length / Math.max(0.08, fx.duration || 1));
    let index = Math.floor(Math.max(0, Number(time) || 0) * fps);
    if (fx.loop) index %= fx.frames.length;
    else index = Math.min(fx.frames.length - 1, index);
    return fx.frames[index];
  }
  return fx?.bitmap || null;
}

export function composeAnnounceFx(ctx, fx, {
  x = 0,
  y = 0,
  w = 0,
  h = 0,
  alpha = 1,
  scale = 1,
  rotation = 0,
  time = 0,
} = {}) {
  const bitmap = fxBitmapAt(fx, time);
  if (!ctx || !bitmap || alpha <= 0 || w <= 0 || h <= 0 || fx?.missing) return false;
  const opacity = clamp(alpha * (fx.defaultOpacity ?? 1));
  if (opacity <= 0.01) return false;
  ctx.save();
  ctx.globalCompositeOperation = blendMode(fx.blendMode);
  ctx.globalAlpha = opacity;
  ctx.translate(x + w / 2, y + h / 2);
  if (rotation) ctx.rotate(rotation);
  const drawW = w * (scale || fx.defaultScale || 1);
  const drawH = h * (scale || fx.defaultScale || 1);
  ctx.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
  return true;
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };
    const target = Math.min(Math.max(0.001, time), Math.max(0.001, (video.duration || 0.1) - 0.04));
    video.addEventListener("seeked", finish);
    video.currentTime = target;
    setTimeout(finish, 2500);
  });
}

function lumaToAlpha(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    const luma = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255 - luma;
  }
  ctx.putImageData(image, 0, 0);
}

async function decodeVideoFx(spec) {
  if (typeof document === "undefined" || typeof fetch !== "function") {
    return { ...spec, bitmap: null, frames: [], missing: true };
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.setAttribute("playsinline", "");
  video.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;";
  document.body.appendChild(video);
  const ready = new Promise((resolve, reject) => {
    const fail = () => reject(new Error("fx_video"));
    video.addEventListener("loadedmetadata", resolve, { once: true });
    video.addEventListener("error", fail, { once: true });
    setTimeout(fail, 12000);
  });
  video.src = spec.path;
  try {
    await ready;
  } catch {
    video.remove();
    return { ...spec, bitmap: null, frames: [], missing: true, skipReason: "falha ao abrir o MP4" };
  }
  const duration = Number(video.duration);
  if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth) {
    video.remove();
    return { ...spec, bitmap: null, frames: [], missing: true, skipReason: "duração ou dimensão inválida" };
  }
  const maxWidth = spec.maxWidth || 480;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const width = Math.max(2, Math.round(video.videoWidth * scale));
  const height = Math.max(2, Math.round(video.videoHeight * scale));
  const count = Math.max(6, Math.min(spec.maxFrames || 18, Math.round(duration * 12)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: spec.role === "matte" });
  if (!ctx) {
    video.remove();
    return { ...spec, bitmap: null, frames: [], missing: true, skipReason: "canvas 2d indisponível" };
  }
  const frames = [];
  for (let index = 0; index < count; index += 1) {
    await seekVideo(video, (index / Math.max(1, count - 1)) * (duration - 0.05));
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, width, height);
    if (spec.role === "matte") lumaToAlpha(ctx, width, height);
    if (typeof createImageBitmap === "function") frames.push(await createImageBitmap(canvas));
  }
  const nativeWidth = video.videoWidth;
  const nativeHeight = video.videoHeight;
  video.removeAttribute("src");
  video.load();
  video.remove();
  if (!frames.length) return { ...spec, bitmap: null, frames: [], missing: true, skipReason: "nenhum frame decodificado" };
  return {
    ...spec,
    bitmap: frames[Math.floor(frames.length * 0.45)],
    frames,
    missing: false,
    duration,
    fps: (frames.length - 1) / Math.max(0.08, duration),
    width: nativeWidth,
    height: nativeHeight,
  };
}

async function loadFxAsset(spec) {
  if (spec.type === "video" || spec.type === "matte-video") return decodeVideoFx(spec);
  if (typeof fetch !== "function") return { ...spec, bitmap: null, frames: [], missing: true };
  const response = await fetch(spec.path, { cache: "force-cache" });
  if (!response.ok) return { ...spec, bitmap: null, frames: [], missing: true };
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) return { ...spec, bitmap: null, frames: [], missing: true };
  const bitmap = typeof createImageBitmap === "function" ? await createImageBitmap(blob) : null;
  return { ...spec, bitmap, frames: [], missing: !bitmap };
}

let fxCache = null;
let fxPending = null;

export async function loadAnnounceFxLibrary() {
  if (fxCache) return fxCache;
  if (fxPending) return fxPending;
  fxPending = (async () => {
    const library = {};
    for (const slot of listAnnounceFxSlots()) {
      try {
        library[slot.id] = await loadFxAsset(slot);
      } catch (error) {
        library[slot.id] = {
          ...slot,
          bitmap: null,
          frames: [],
          missing: true,
          skipReason: error?.message || "erro de decode",
        };
      }
    }
    fxCache = library;
    fxPending = null;
    return library;
  })();
  return fxPending;
}

export function resetAnnounceFxLibrary() {
  fxCache = null;
  fxPending = null;
}
