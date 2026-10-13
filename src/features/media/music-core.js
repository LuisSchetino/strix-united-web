// Reading a song so a generated video can be cut on its beat. Everything here is plain
// arithmetic on samples (mono, -1..1): no browser API, so it is tested in Node.
//
//   onsetEnvelope  how hard the song "hits" at each instant (kick-weighted energy rises)
//   estimateBeat   tempo and where the beats fall, measured on a stretch of the song
//   energyCurve    loudness per half second
//   findEntry      the instant the song comes in for good (chorus, drop)
//   planExcerpt    which stretch of the song a video of a given shape should use
//   warpToBeats    the video's scene changes moved onto beats, and the time map that does it

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** The song's hits over time: one value per frame of `hop` samples (after thinning to ~11 kHz). */
export function onsetEnvelope(samples, sampleRate, { targetRate = 11025, hop = 128 } = {}) {
  const step = Math.max(1, Math.round(sampleRate / targetRate));
  const rate = sampleRate / step;
  const frames = Math.floor(samples.length / step / hop);
  const low = new Float32Array(frames), full = new Float32Array(frames);
  // One-pole low-pass (~170 Hz): the kick drum carries the beat.
  const alpha = 1 - Math.exp(-2 * Math.PI * 170 / rate);
  let state = 0, at = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    let lowSum = 0, fullSum = 0;
    for (let i = 0; i < hop; i += 1) {
      let value = 0;
      for (let k = 0; k < step; k += 1) value += samples[at + k] || 0;
      value /= step; at += step;
      state += alpha * (value - state);
      lowSum += state * state; fullSum += value * value;
    }
    low[frame] = Math.log1p(4000 * lowSum / hop);
    full[frame] = Math.log1p(1000 * fullSum / hop);
  }
  const envelope = new Float32Array(frames);
  for (let frame = 1; frame < frames; frame += 1) envelope[frame] = 0.7 * Math.max(0, low[frame] - low[frame - 1]) + 0.3 * Math.max(0, full[frame] - full[frame - 1]);
  return { envelope, frameRate: rate / hop };
}

const sampleAt = (envelope, position) => {
  const i = Math.floor(position);
  if (i < 0 || i + 1 >= envelope.length) return 0;
  const f = position - i;
  return envelope[i] * (1 - f) + envelope[i + 1] * f;
};

/**
 * The song's tempo, from the whole envelope. A real beat repeats at its own period and also at
 * its half and quarter (hats) and at two and four times it (half bar, bar); a tempo that is
 * only a coincidence (a triplet feel, a dotted rhythm) does not have all of those. So each
 * tempo is judged by how much the envelope repeats at all five, with a mild preference for
 * the middle of the range to settle "the same beat counted twice as fast or as slow".
 */
export function estimateTempo({ envelope, frameRate }, { minBpm = 72, maxBpm = 178 } = {}) {
  const n = envelope.length;
  if (n < frameRate * 8) return null;
  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += envelope[i];
  mean /= n;
  const maxLag = Math.min(n - 2, Math.ceil(frameRate * 60 / minBpm * 4) + 2);
  const acf = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i + lag < n; i += 1) sum += (envelope[i] - mean) * (envelope[i + lag] - mean);
    acf[lag] = sum / (n - lag);
  }
  const at = (lag) => { const i = Math.floor(lag); if (i + 1 > maxLag) return 0; const f = lag - i; return acf[i] * (1 - f) + acf[i + 1] * f; };
  let best = { score: -Infinity, bpm: 120 };
  for (let bpm = minBpm; bpm <= maxBpm; bpm += 0.05) {
    const lag = frameRate * 60 / bpm;
    const repeat = 0.5 * at(lag / 4) + 0.8 * at(lag / 2) + at(lag) + at(lag * 2) + at(lag * 4);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 126) / 0.55) ** 2);
    const score = repeat * (0.65 + 0.35 * prior);
    if (score > best.score) best = { score, bpm };
  }
  return { bpm: best.bpm, strength: acf[0] > 0 ? best.score / acf[0] : 0 };
}

/**
 * The best grid of beats for one tempo (searched a hair around it) on frames [start, end):
 * its exact tempo, where a beat falls, and how much of the hits it catches. The windows around
 * beats and half beats cover a fifth of the time whatever the tempo, so the share caught
 * (0.2 = no better than chance, 1 = every hit on the grid) compares tempos fairly.
 */
function fitGrid(envelope, frameRate, start, end, around, spread = 0.5) {
  let best = { score: -1, bpm: around, phase: start };
  for (let bpm = around - spread; bpm <= around + spread; bpm += 0.01) {
    const period = frameRate * 60 / bpm;
    for (let slot = 0; slot < 48; slot += 1) {
      const phase = start + period * slot / 48;
      let score = 0;
      for (let position = phase; position < end - 1; position += period) score += sampleAt(envelope, position) + 0.4 * sampleAt(envelope, position + period / 2);
      if (score > best.score) best = { score, bpm, phase };
    }
  }
  const period = frameRate * 60 / best.bpm;
  let total = 0, near = 0;
  for (let i = start; i < end; i += 1) total += envelope[i];
  const reach = period / 20;
  for (let position = best.phase; position < end - 1; position += period / 2) for (let i = Math.ceil(position - reach); i <= position + reach; i += 1) near += envelope[i] || 0;
  return { bpm: best.bpm, phase: best.phase, period, confidence: total ? clamp(near / total, 0, 1) : 0 };
}

/**
 * The song's tempo, settled. estimateTempo can land on a relative of the real beat (the same
 * rhythm counted twice as fast, or a triplet feel read as the beat); each relative inside the
 * range gets its best grid on the middle of the song and the one that catches most hits wins.
 * A near tie goes to the tempo closest to the middle of the range.
 */
export function songTempo(song, { minBpm = 84, maxBpm = 176 } = {}) {
  const base = estimateTempo(song);
  if (!base) return null;
  const { envelope, frameRate } = song;
  const seconds = envelope.length / frameRate;
  const from = Math.floor(Math.max(0, seconds * 0.5 - 45) * frameRate), to = Math.ceil(Math.min(seconds, seconds * 0.5 + 45) * frameRate);
  const options = [1, 2, 0.5, 1.5, 2 / 3].map((ratio) => base.bpm * ratio).filter((bpm) => bpm >= minBpm && bpm <= maxBpm);
  if (!options.length) options.push(base.bpm);
  const centre = (bpm) => Math.abs(Math.log2(bpm / 126));
  const fits = options.map((bpm) => fitGrid(envelope, frameRate, from, to, bpm));
  const top = Math.max(...fits.map((fit) => fit.confidence));
  // The measured tempo keeps its place unless a relative is clearly better.
  const own = options[0] === base.bpm ? fits[0] : null;
  const chosen = own && own.confidence >= top - 0.03 ? own : fits.filter((fit) => fit.confidence >= top - 0.02).sort((left, right) => centre(left.bpm) - centre(right.bpm))[0];
  return { bpm: chosen.bpm, strength: base.strength, confidence: chosen.confidence };
}

/**
 * Tempo and beat positions for the stretch [from, to] seconds of an onset envelope:
 * `{ bpm, beat (seconds), first (time of a beat), downbeat (time of a bar's first beat),
 * confidence (how much of the hits fall on the grid: 0.2 is chance, 1 is all) }`. The tempo
 * is the song's (songTempo); where the beats fall is measured on the stretch itself.
 */
export function estimateBeat({ envelope, frameRate }, { from = 0, to = Infinity, tempo = null } = {}) {
  const start = Math.max(0, Math.floor(from * frameRate)), end = Math.min(envelope.length, Math.ceil(Math.min(to, envelope.length / frameRate) * frameRate));
  if (end - start < frameRate * 4) return null;
  const song = tempo || songTempo({ envelope, frameRate });
  if (!song) return null;
  const fit = fitGrid(envelope, frameRate, start, end, song.bpm, 0.3);
  // The bar: of the four possible first beats, the one whose beats hit hardest.
  const bars = [0, 1, 2, 3].map((shift) => { let sum = 0; for (let position = fit.phase + shift * fit.period; position < end - 1; position += 4 * fit.period) sum += sampleAt(envelope, position); return sum; });
  const shift = bars.indexOf(Math.max(...bars));
  return {
    bpm: Number(fit.bpm.toFixed(2)),
    beat: 60 / fit.bpm,
    first: fit.phase / frameRate,
    downbeat: (fit.phase + shift * fit.period) / frameRate,
    confidence: Number(fit.confidence.toFixed(3)),
    strength: Number((song.strength || 0).toFixed(3)),
  };
}

/** Loudness (RMS) per `window` seconds. */
export function energyCurve(samples, sampleRate, window = 0.5) {
  const size = Math.max(1, Math.round(sampleRate * window));
  const values = new Float32Array(Math.floor(samples.length / size));
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    for (let k = 0; k < size; k += 1) { const v = samples[i * size + k]; sum += v * v; }
    values[i] = Math.sqrt(sum / size);
  }
  return { values, window };
}

/**
 * The instant the song comes in for good: where the next `length` seconds are loud and clearly
 * louder than the seconds before. Not before `earliest` (a video needs a few seconds of song
 * in front of it) and with `length` seconds of song left after it.
 */
export function findEntry({ values, window }, { length = 20, lead = 5, earliest = 6 } = {}) {
  const span = Math.max(1, Math.round(length / window)), before = Math.max(1, Math.round(lead / window));
  const prefix = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i += 1) prefix[i + 1] = prefix[i] + values[i];
  const mean = (a, b) => (prefix[Math.min(values.length, b)] - prefix[Math.max(0, a)]) / Math.max(1, Math.min(values.length, b) - Math.max(0, a));
  const overall = mean(0, values.length) || 1;
  let best = { score: -Infinity, at: earliest };
  for (let i = Math.max(before, Math.round(earliest / window)); i + span <= values.length; i += 1) {
    const ahead = mean(i, i + span), behind = mean(i - before, i);
    const score = ahead / overall + 1.4 * (ahead - behind) / overall;
    if (score > best.score) best = { score, at: i * window };
  }
  return best.at;
}

/**
 * Which stretch of the song a video uses. The song's entry lands on the video's first big cut
 * (`cue`, seconds into the video): the build-up plays under the opening and the song comes in
 * with the first scene. Returns `{ start (seconds into the song), cueBeats }`, with the start
 * on a beat so the video's own beats are simply multiples of `beat`.
 */
export function planExcerpt({ entry, beat, downbeat, cue = 0, songLength = Infinity, videoLength = 0 }) {
  // The entry, moved to the nearest bar line.
  const bar = 4 * beat;
  const barred = downbeat + Math.round((entry - downbeat) / bar) * bar;
  let cueBeats = Math.max(0, Math.round(cue / beat));
  let start = barred - cueBeats * beat;
  while (start < 0 && cueBeats > 0) { cueBeats -= 1; start = barred - cueBeats * beat; }
  if (start < 0) start = ((downbeat % beat) + beat) % beat;
  if (start + videoLength > songLength) start = Math.max(0, start - Math.ceil((start + videoLength - songLength) / bar) * bar);
  return { start: Number(start.toFixed(4)), cueBeats };
}

/**
 * The video's scene changes moved onto beats. `boundaries` are the scene changes in the
 * video's own time (ascending, first 0, last the duration); beats are multiples of `beat`.
 * Each change goes to the nearest beat (never closer than one beat to the previous one), and
 * `toSource(t)` says which instant of the original video plays at instant `t` of the new one:
 * scenes stretch or shrink by a fraction of a beat, nothing is cut.
 */
export function warpToBeats(boundaries = [], beat = 0.5, { firstBeats = null } = {}) {
  const source = [...new Set(boundaries.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0))].sort((a, b) => a - b);
  if (source.length < 2 || !(beat > 0)) return { duration: source.at(-1) || 0, targets: source, toSource: (t) => t };
  const targets = [0];
  for (let i = 1; i < source.length; i += 1) {
    const beats = i === 1 && firstBeats != null ? firstBeats : Math.round(source[i] / beat);
    targets.push(Math.max(targets[i - 1] + beat, beats * beat));
  }
  const toSource = (t) => {
    if (t <= 0) return 0;
    if (t >= targets.at(-1)) return source.at(-1);
    let i = 1;
    while (targets[i] < t) i += 1;
    return source[i - 1] + (t - targets[i - 1]) / (targets[i] - targets[i - 1]) * (source[i] - source[i - 1]);
  };
  return { duration: targets.at(-1), targets, toSource };
}
