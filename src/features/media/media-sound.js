// Sound for the generated videos: a stretch of a real song with the video's scene changes
// moved onto its beats, and a few effects on those changes. The reading of the song is in
// music-core.js; this file is the browser's part (decoding, mixing).
import { energyCurve, estimateBeat, findEntry, onsetEnvelope, planExcerpt, warpToBeats } from "./music-core.js";

const RATE = 48000;

/**
 * A song file read once: its decoded sound, its tempo and beats, and where it comes in.
 * `bytes` is the file (an ArrayBuffer of MP3, M4A, WAV…).
 */
export async function readTrack(bytes) {
  const decoder = new OfflineAudioContext(2, 2, RATE);
  const buffer = await decoder.decodeAudioData(bytes.slice(0));
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
  }
  const entry = findEntry(energyCurve(mono, buffer.sampleRate), { length: 20 });
  // Tempo and beats are measured around the stretch the videos will use.
  const beat = estimateBeat(onsetEnvelope(mono, buffer.sampleRate), { from: Math.max(0, entry - 12), to: entry + 45 });
  if (!beat) throw new Error("track_too_short");
  return { buffer, duration: buffer.duration, entry, ...beat };
}

/** The instants a video changes scene: 0, every scene start, the shared ending, the end. */
export function timelineBoundaries(timeline) {
  const marks = [0, ...(timeline?.scenes || []).map((scene) => scene.start), timeline?.outroStart, timeline?.duration];
  return [...new Set(marks.filter((value) => Number.isFinite(value) && value >= 0 && value <= timeline.duration).map((value) => Number(value.toFixed(3))))].sort((a, b) => a - b);
}

/**
 * The soundtrack of one video. `track` comes from readTrack; `startAt` (seconds into the song)
 * overrides the stretch chosen automatically. Returns the mixed sound, the video's new length
 * (it ends on a beat) and `toSource`, the map from the new time to the video's own.
 */
export async function buildSoundtrack({ timeline, track, startAt = null, effects = true } = {}) {
  const boundaries = timelineBoundaries(timeline);
  const cue = boundaries[1] ?? 0;
  const plan = startAt != null && Number.isFinite(Number(startAt))
    // A start chosen by hand is moved to the beat next to it.
    ? { start: Math.max(0, track.first + Math.round((Number(startAt) - track.first) / track.beat) * track.beat), cueBeats: Math.max(1, Math.round(cue / track.beat)) }
    : planExcerpt({ entry: track.entry, beat: track.beat, downbeat: track.downbeat, cue, songLength: track.duration, videoLength: timeline.duration + 2 });
  const warp = warpToBeats(boundaries, track.beat, { firstBeats: plan.cueBeats || null });
  const duration = warp.duration;

  const ac = new OfflineAudioContext(2, Math.ceil(duration * RATE), RATE);
  const master = ac.createDynamicsCompressor();
  master.threshold.value = -10; master.knee.value = 6; master.ratio.value = 3; master.attack.value = 0.004; master.release.value = 0.2;
  master.connect(ac.destination);

  const song = ac.createBufferSource(); song.buffer = track.buffer;
  const level = ac.createGain();
  level.gain.setValueAtTime(0.0001, 0);
  level.gain.linearRampToValueAtTime(0.82, 0.3);
  level.gain.setValueAtTime(0.82, Math.max(0.31, duration - 1.3));
  level.gain.linearRampToValueAtTime(0.0001, duration);
  song.connect(level); level.connect(master);
  song.start(0, plan.start);

  if (effects) {
    const noise = ac.createBuffer(1, RATE, RATE);
    { const data = noise.getChannelData(0); let seed = 7; for (let i = 0; i < data.length; i += 1) { seed = (seed * 16807) % 2147483647; data[i] = seed / 2147483647 * 2 - 1; } }
    const fx = ac.createGain(); fx.gain.value = 0.5; fx.connect(master);
    const swell = (at, length, peak) => {
      if (at < 0) return;
      const source = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain();
      source.buffer = noise; source.loop = true; filter.type = "bandpass"; filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(400, at); filter.frequency.exponentialRampToValueAtTime(5200, at + length);
      gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(peak, at + length); gain.gain.exponentialRampToValueAtTime(0.0001, at + length + 0.09);
      source.connect(filter); filter.connect(gain); gain.connect(fx); source.start(at); source.stop(at + length + 0.15);
    };
    const hit = (at, size) => {
      const tone = ac.createOscillator(), gain = ac.createGain();
      tone.frequency.setValueAtTime(96, at); tone.frequency.exponentialRampToValueAtTime(34, at + 0.4);
      gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(0.9 * size, at + 0.006); gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      tone.connect(gain); gain.connect(fx); tone.start(at); tone.stop(at + 1);
    };
    // A swell into each scene change and a low hit on it; the shared ending gets the big one.
    const outro = Number.isFinite(timeline.outroStart) ? warp.targets[boundaries.indexOf(Number(timeline.outroStart.toFixed(3)))] : null;
    warp.targets.slice(1, -1).forEach((at) => { const big = outro != null && Math.abs(at - outro) < 0.001; swell(at - (big ? 0.7 : 0.38), big ? 0.7 : 0.38, big ? 0.32 : 0.16); hit(at, big ? 1 : 0.55); });
  }
  const audio = await ac.startRendering();
  return { audio, duration, toSource: warp.toSource, plan, cuts: warp.targets };
}
