import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { paintAgendaFrame } from "./agenda-paint.js";

const CODEC_CANDIDATES = [
  { codec: "avc1.640028", bitrate: 12_000_000 },
  { codec: "avc1.4D4028", bitrate: 10_000_000 },
  { codec: "avc1.42001E", bitrate: 8_000_000 },
];

function yieldFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
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
} = {}) {
  if (!canEncodeMp4()) {
    throw new Error("Este navegador não consegue gerar MP4 H.264. Use Chrome ou Edge atualizado.");
  }
  const { width, height, fps, totalFrames, duration } = timeline;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
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
  for (let index = 0; index < totalFrames; index += 1) {
    if (signal?.aborted) {
      encoder.close();
      throw new DOMException("Render cancelado.", "AbortError");
    }
    if (encoderError) throw encoderError;
    const time = Math.min(duration, index / fps);
    paintAgendaFrame(ctx, { timeline, time, assets, dayLabel });
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(index * frameDuration),
      duration: Math.round(frameDuration),
    });
    encoder.encode(frame, { keyFrame: index % fps === 0 });
    frame.close();
    onProgress?.({
      stage: "rendering",
      frame: index + 1,
      totalFrames,
      ratio: (index + 1) / totalFrames,
    });
    if (index % 2 === 0) await yieldFrame();
  }

  onProgress?.({ stage: "encoding", frame: totalFrames, totalFrames, ratio: 1 });
  await encoder.flush();
  encoder.close();
  if (encoderError) throw encoderError;
  muxer.finalize();
  onProgress?.({ stage: "finishing", frame: totalFrames, totalFrames, ratio: 1 });
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
