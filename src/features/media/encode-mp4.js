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

export function canEncodeSound() {
  return typeof AudioEncoder === "function" && typeof AudioData === "function";
}

// What a device can really encode is asked and then checked, never assumed: a phone may have
// the encoder and refuse AAC, or accept it and give nothing back. AAC first (it plays
// everywhere); Opus is the last resort (it plays on this device, some apps may refuse it).
const SOUND_CANDIDATES = [
  { codec: "aac", config: { codec: "mp4a.40.2", bitrate: 192_000 } },
  { codec: "aac", config: { codec: "mp4a.40.2", bitrate: 128_000 } },
  { codec: "opus", config: { codec: "opus", bitrate: 128_000 } },
];

/**
 * The soundtrack, encoded and cut to the video's length: `{ codec, chunks }`, or null when no
 * encoder of this device produced sound.
 */
async function encodeSound(audio, frames) {
  const left = audio.getChannelData(0), right = audio.numberOfChannels > 1 ? audio.getChannelData(1) : left;
  const length = Math.min(left.length, frames), block = audio.sampleRate;
  for (const candidate of SOUND_CANDIDATES) {
    const config = { ...candidate.config, sampleRate: audio.sampleRate, numberOfChannels: 2 };
    try {
      if (typeof AudioEncoder.isConfigSupported === "function" && !(await AudioEncoder.isConfigSupported(config)).supported) continue;
      const chunks = [];
      let failure = null;
      const encoder = new AudioEncoder({ output: (chunk, meta) => chunks.push({ chunk, meta }), error: (error) => { failure = error; } });
      encoder.configure(config);
      for (let offset = 0; offset < length; offset += block) {
        const size = Math.min(block, length - offset), data = new Float32Array(size * 2);
        data.set(left.subarray(offset, offset + size), 0); data.set(right.subarray(offset, offset + size), size);
        const piece = new AudioData({ format: "f32-planar", sampleRate: audio.sampleRate, numberOfFrames: size, numberOfChannels: 2, timestamp: Math.round(offset / audio.sampleRate * 1e6), data });
        encoder.encode(piece); piece.close();
      }
      await encoder.flush();
      if (encoder.state !== "closed") encoder.close();
      if (!failure && chunks.length) return { codec: candidate.codec, chunks };
    } catch {
      /* this encoder does not work here: the next one is tried */
    }
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
  // A soundtrack (see media-sound.js): `audio` is the mixed sound, `duration` the video's
  // length with it and `toSource` which instant of the timeline plays at each instant of it.
  soundtrack = null,
} = {}) {
  if (!canEncodeMp4()) {
    throw new Error("Este navegador não consegue gerar MP4 H.264. Use Chrome ou Edge atualizado.");
  }
  const { width, height, fps } = timeline;
  const totalFrames = soundtrack?.toSource ? Math.max(1, Math.round(soundtrack.duration * fps)) : timeline.totalFrames;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponível para o render.");

  const config = await pickVideoConfig(width, height, fps);
  if (!config) throw new Error("Nenhum codec H.264 compatível foi encontrado neste dispositivo.");

  // A video asked with sound is never handed back silent: without a working encoder it fails, and says why.
  const sound = soundtrack?.audio ? (canEncodeSound() ? await encodeSound(soundtrack.audio, Math.round(totalFrames / fps * soundtrack.audio.sampleRate)) : null) : null;
  if (soundtrack?.audio && !sound) throw new Error("Este aparelho não conseguiu gravar o som no vídeo. Gere no computador (Chrome ou Edge) ou escolha “Sem música”.");
  if (sound) onProgress?.({ stage: "sound", codec: sound.codec });

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, frameRate: fps },
    ...(sound ? { audio: { codec: sound.codec, sampleRate: soundtrack.audio.sampleRate, numberOfChannels: 2 } } : {}),
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  if (sound) for (const { chunk, meta } of sound.chunks) muxer.addAudioChunk(chunk, meta);

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
    const timeSec = soundtrack?.toSource ? Math.min(timeline.duration, soundtrack.toSource(index / fps)) : frameTime(index, timeline);
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
