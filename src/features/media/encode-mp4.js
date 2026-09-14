import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { agendaFrameTime, renderAgendaFrame } from "./agenda-frame.js";

const CODEC_CANDIDATES = [
  { codec: "avc1.640028", bitrate: 12_000_000 },
  { codec: "avc1.4D4028", bitrate: 10_000_000 },
  { codec: "avc1.42001E", bitrate: 8_000_000 },
];

function waitEncoderDrain(encoder, limit = 4) {
  if (encoder.encodeQueueSize < limit) return Promise.resolve();
  return new Promise((resolve) => {
    const onDequeue = () => {
      if (encoder.encodeQueueSize < limit) {
        encoder.removeEventListener("dequeue", onDequeue);
        resolve();
      }
    };
    encoder.addEventListener("dequeue", onDequeue);
  });
}

async function snapshotCanvas(canvas) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(canvas);
  }
  return canvas;
}

async function pickVideoConfig(width, height, fps) {
  for (const candidate of CODEC_CANDIDATES) {
    const config = {
      codec: candidate.codec,
      width,
      height,
      bitrate: candidate.bitrate,
      framerate: fps,
      avc: { format: "avc" },
      hardwareAcceleration: "prefer-hardware",
      latencyMode: "quality",
    };
    if (typeof VideoEncoder.isConfigSupported === "function") {
      try {
        const { supported } = await VideoEncoder.isConfigSupported(config);
        if (!supported) continue;
      } catch {
        continue;
      }
    }
    return config;
  }
  return null;
}

export function canEncodeMp4() {
  return typeof VideoEncoder === "function" && typeof VideoFrame === "function";
}

export async function encodeAgendaMp4({
  timeline,
  assets,
  dayLabel,
  onProgress,
  signal,
  renderFrame = renderAgendaFrame,
  frameTime = agendaFrameTime,
} = {}) {
  if (!canEncodeMp4()) {
    throw new Error("Este navegador não consegue gerar MP4 H.264. Use Chrome ou Edge atualizado.");
  }
  const { width, height, fps, totalFrames } = timeline;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponível para o render.");

  const config = await pickVideoConfig(width, height, fps);
  if (!config) throw new Error("Nenhum codec H.264 compatível foi encontrado neste dispositivo.");

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, frameRate: fps },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error;
    },
  });
  encoder.configure(config);

  const frameDuration = 1_000_000 / fps;
  const keyInterval = Math.max(15, Math.round(fps / 2));
  for (let index = 0; index < totalFrames; index += 1) {
    if (signal?.aborted) {
      encoder.close();
      throw new DOMException("Render cancelado.", "AbortError");
    }
    if (encoderError) throw encoderError;
    await waitEncoderDrain(encoder);
    const timeSec = frameTime(index, timeline);
    renderFrame(ctx, { timeline, timeSec, assets, dayLabel });
    const bitmap = await snapshotCanvas(canvas);
    const frame = new VideoFrame(bitmap, {
      timestamp: Math.round(index * frameDuration),
      duration: Math.round(frameDuration),
    });
    encoder.encode(frame, { keyFrame: index % keyInterval === 0 });
    frame.close();
    if (bitmap.close) bitmap.close();
    onProgress?.({
      stage: "rendering",
      frame: index + 1,
      totalFrames,
      ratio: (index + 1) / totalFrames,
      timeSec,
    });
    if (index % 12 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  onProgress?.({ stage: "encoding", frame: totalFrames, totalFrames, ratio: 1 });
  await encoder.flush();
  encoder.close();
  if (encoderError) throw encoderError;
  muxer.finalize();
  onProgress?.({ stage: "finishing", frame: totalFrames, totalFrames, ratio: 1 });
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}

export async function encodeStillPng({
  timeline,
  assets,
  dayLabel,
  renderFrame = renderAgendaFrame,
  timeSec,
} = {}) {
  const { width, height } = timeline;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponível para o render.");
  await document.fonts?.ready;
  const resolved = Number.isFinite(timeSec) ? timeSec : (timeline.still ? 0 : timeline.duration);
  renderFrame(ctx, { timeline, timeSec: resolved, assets, dayLabel });
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Não foi possível gerar o PNG."));
    }, "image/png");
  });
  return blob;
}
