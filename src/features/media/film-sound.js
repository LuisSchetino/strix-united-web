// Sound for the films (the videos cut on a real song): where the song really hits around the
// stretch a film uses, the film's beats moved onto those hits, and the mix of song and effects.
// The tempo and the entry come from readTrack (media-sound.js); here they are checked against
// the hits themselves, because a cut only looks "on the beat" when it lands on a sound.

const RATE = 48000;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/**
 * The hits of a stretch of sound (mono samples): `hits` are `{ at (seconds), strength, kick }`
 * (strength 1 = a strong hit of this stretch; kick is the low part alone) and `low` the bass
 * loudness per frame. Plain arithmetic, no browser API.
 */
export function readHits(samples, rate, hop = 256) {
  const frames = Math.floor(samples.length / hop);
  const low = new Float32Array(frames), lowLog = new Float32Array(frames), fullLog = new Float32Array(frames);
  const alpha = 1 - Math.exp(-2 * Math.PI * 160 / rate);
  let first = 0, second = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    let lowSum = 0, fullSum = 0;
    for (let i = 0; i < hop; i += 1) {
      const value = samples[frame * hop + i];
      first += alpha * (value - first); second += alpha * (first - second);
      lowSum += second * second; fullSum += value * value;
    }
    low[frame] = Math.sqrt(lowSum / hop);
    lowLog[frame] = Math.log1p(4000 * lowSum / hop); fullLog[frame] = Math.log1p(1000 * fullSum / hop);
  }
  const flux = new Float32Array(frames), kick = new Float32Array(frames);
  for (let frame = 2; frame < frames; frame += 1) {
    kick[frame] = Math.max(0, lowLog[frame] - lowLog[frame - 2]);
    flux[frame] = 0.6 * kick[frame] + 0.4 * Math.max(0, fullLog[frame] - fullLog[frame - 2]);
  }
  let mean = 0;
  for (let frame = 0; frame < frames; frame += 1) mean += flux[frame];
  mean /= frames || 1;
  let spread = 0;
  for (let frame = 0; frame < frames; frame += 1) spread += (flux[frame] - mean) ** 2;
  spread = Math.sqrt(spread / (frames || 1));
  const frameRate = rate / hop, reach = Math.max(2, Math.round(0.03 * frameRate)), floor = mean + 0.8 * spread;
  const found = [];
  for (let frame = reach; frame < frames - reach; frame += 1) {
    if (flux[frame] < floor) continue;
    let top = true;
    for (let d = -reach; d <= reach && top; d += 1) if (flux[frame + d] > flux[frame]) top = false;
    // The rise is measured two frames back, so the sound itself starts a frame before the peak.
    if (top) found.push({ at: (frame - 1) / frameRate, strength: flux[frame], kick: kick[frame] });
  }
  const scale = (key) => { const sorted = found.map((hit) => hit[key]).sort((a, b) => a - b); return sorted[Math.floor(sorted.length * 0.95)] || 1; };
  const strong = scale("strength"), deep = scale("kick") || 1;
  return { hits: found.map((hit) => ({ at: hit.at, strength: Math.min(1.5, hit.strength / strong), kick: Math.min(1.5, hit.kick / deep) })), low, frameRate };
}

/** The strongest hit within `reach` seconds of `time` (nearer counts a little more), or null. */
export function nearestHit(hits, time, reach) {
  let best = null, score = 0;
  for (const hit of hits) {
    const off = Math.abs(hit.at - time);
    if (off > reach) continue;
    const value = hit.strength * (1 - 0.5 * off / reach);
    if (value > score) { best = hit; score = value; }
  }
  return best;
}

/**
 * The film's clock on a song. `track` comes from readTrack. The film starts `lead` beats before
 * the song comes in ("the drop") and counts beats from it: `at(n)` is the instant, in the
 * film's own seconds, of beat n (halves allowed, negatives are the build-up), moved onto the
 * real hit next to it. `report` says how well the beat grid agrees with the hits.
 */
export function scoreTrack(track, { lead = 4, pre = 0.15, span = 44 } = {}) {
  const { buffer } = track, rate = buffer.sampleRate;
  const from = Math.max(0, track.entry - 10), to = Math.min(buffer.duration, track.entry + span);
  const a = Math.floor(from * rate), b = Math.floor(to * rate);
  const mono = new Float32Array(b - a);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < mono.length; i += 1) mono[i] += data[a + i] / buffer.numberOfChannels;
  }
  const read = readHits(mono, rate);
  const hits = read.hits.map((hit) => ({ ...hit, at: hit.at + from }));
  const bass = (start, end) => {
    const x = clamp(Math.round((start - from) * read.frameRate), 0, read.low.length), y = clamp(Math.round((end - from) * read.frameRate), 0, read.low.length);
    let sum = 0;
    for (let i = x; i < y; i += 1) sum += read.low[i];
    return y > x ? sum / (y - x) : 0;
  };

  // The drop: the beat where the bass comes in (louder after than before) on a real hit.
  const overall = bass(from, to) || 1e-6;
  let drop = track.entry, best = -Infinity;
  for (let k = Math.ceil((track.entry - 2.6 - track.first) / track.beat); track.first + k * track.beat <= track.entry + 2.6; k += 1) {
    const time = track.first + k * track.beat;
    const hit = nearestHit(hits, time, 0.05);
    const value = (bass(time, time + 3) - bass(time - 1.6, time)) / overall + 0.5 * (hit ? hit.strength : 0);
    if (value > best) { best = value; drop = time; }
  }

  // The grid, corrected by the hits it is supposed to fall on (beats and half beats).
  let beat = track.beat, matched = 0, total = 0, residual = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    let sw = 0, sn = 0, st = 0, snn = 0, snt = 0;
    const pairs = [];
    for (let n = -lead; n <= 40; n += 0.5) {
      const hit = nearestHit(hits, drop + n * beat, 0.055);
      if (!hit) continue;
      pairs.push([n, hit.at]);
      const w = hit.strength; sw += w; sn += w * n; st += w * hit.at; snn += w * n * n; snt += w * n * hit.at;
    }
    total = (40 + lead) * 2 + 1; matched = pairs.length;
    const spreadN = sw * snn - sn * sn;
    if (pairs.length >= 14 && spreadN > 0) {
      const slope = (sw * snt - sn * st) / spreadN, origin = (st - slope * sn) / sw;
      if (Math.abs(slope / beat - 1) < 0.006) { beat = slope; drop = origin; }
    }
    residual = pairs.length ? Math.sqrt(pairs.reduce((sum, [n, at]) => sum + (at - drop - n * beat) ** 2, 0) / pairs.length) : 0;
  }

  const start = Math.max(0, drop - lead * beat - pre);
  const filmHits = hits.map((hit) => ({ ...hit, at: hit.at - start })).filter((hit) => hit.at > -0.5);
  const origin = drop - start;
  const at = (n, reach = 0.05) => {
    const grid = origin + n * beat, hit = nearestHit(filmHits, grid, reach);
    return hit ? { at: hit.at, strength: hit.strength, off: hit.at - grid } : { at: grid, strength: 0, off: 0, missed: true };
  };
  /** Of the beats `offsets` after `base`, the `count` that hit hardest, at least `gap` beats apart. */
  const pick = (base, offsets, count, gap = 1) => {
    let chosen = offsets.slice(0, count), top = -1;
    const walk = (index, taken) => {
      if (taken.length === count) {
        const value = taken.reduce((sum, offset) => sum + at(base + offset).strength, 0);
        if (value > top) { top = value; chosen = taken; }
        return;
      }
      for (let i = index; i < offsets.length; i += 1) if (!taken.length || offsets[i] - taken.at(-1) >= gap) walk(i + 1, [...taken, offsets[i]]);
    };
    walk(0, []);
    return chosen;
  };
  /** How hard the bass is hitting at film instant t (0..1): what the picture breathes with. */
  const punchAt = (t) => {
    let value = 0;
    for (const hit of filmHits) { const d = t - hit.at; if (d >= 0 && d < 0.7) value = Math.max(value, Math.min(1, hit.kick) * Math.exp(-d / 0.14)); }
    return value;
  };
  return {
    start, beat, drop: origin, hits: filmHits, at, pick, punchAt,
    report: { bars: [0, 1, 2, 3].map((phase) => { let sum = 0; for (let n = phase; n < 40; n += 4) sum += nearestHit(filmHits, origin + n * beat, 0.05)?.kick || 0; return Number(sum.toFixed(1)); }), bpm: Number((60 / beat).toFixed(2)), dropAt: Number(drop.toFixed(3)), entry: track.entry, matched, total, residualMs: Number((residual * 1000).toFixed(1)) },
  };
}

/**
 * The film's sound: the song from `score.start`, and the effects in `cues`
 * (`{ kind, at, size, pitch, length }`, film seconds). The effects live in the middle and high
 * range on purpose: a phone's speaker does not play a low thump. `end` is the last hit: the
 * song stops on it.
 */
export async function mixFilm({ track, score, cues = [], duration, end }) {
  const ac = new OfflineAudioContext(2, Math.ceil(duration * RATE), RATE);
  const out = ac.createWaveShaper();
  { const curve = new Float32Array(2049); for (let i = 0; i < curve.length; i += 1) { const x = i / 1024 - 1; curve[i] = Math.tanh(1.5 * x) / Math.tanh(1.5); } out.curve = curve; }
  out.connect(ac.destination);

  const song = ac.createBufferSource(); song.buffer = track.buffer;
  const level = ac.createGain(), duck = ac.createGain();
  level.gain.setValueAtTime(0.0001, 0);
  level.gain.linearRampToValueAtTime(0.72, 0.18);
  level.gain.setValueAtTime(0.72, end + 0.09);
  level.gain.linearRampToValueAtTime(0.0001, end + 0.34);
  duck.gain.setValueAtTime(1, 0);
  // The song gives way for an instant on the big hits, so the effect is heard.
  for (const cue of cues.filter((item) => item.kind === "boom" && item.at > 0.05).sort((x, y) => x.at - y.at)) {
    duck.gain.setValueAtTime(1, cue.at - 0.012); duck.gain.linearRampToValueAtTime(0.6, cue.at + 0.004); duck.gain.linearRampToValueAtTime(1, cue.at + 0.2);
  }
  song.connect(level); level.connect(duck); duck.connect(out);
  song.start(0, score.start);

  const noise = ac.createBuffer(1, RATE * 2, RATE);
  { const data = noise.getChannelData(0); let seed = 11; for (let i = 0; i < data.length; i += 1) { seed = (seed * 16807) % 2147483647; data[i] = seed / 2147483647 * 2 - 1; } }
  const fx = ac.createGain(); fx.gain.value = 0.85; fx.connect(out);
  const ramp = (param, points) => points.forEach(([time, value], index) => (index ? param.exponentialRampToValueAtTime(Math.max(0.0001, value), Math.max(0, time)) : param.setValueAtTime(Math.max(0.0001, value), Math.max(0, time))));
  const hiss = (from, to, type, frequency, gains, q = 1) => {
    const source = ac.createBufferSource(), filter = ac.createBiquadFilter(), gain = ac.createGain();
    source.buffer = noise; source.loop = true; filter.type = type; filter.Q.value = q;
    ramp(filter.frequency, frequency); ramp(gain.gain, gains);
    source.connect(filter); filter.connect(gain); gain.connect(fx); source.start(Math.max(0, from), (from * 0.37) % 1.5); source.stop(to);
  };
  const tone = (from, to, type, frequency, gains) => {
    const source = ac.createOscillator(), gain = ac.createGain();
    source.type = type; ramp(source.frequency, frequency); ramp(gain.gain, gains);
    source.connect(gain); gain.connect(fx); source.start(Math.max(0, from)); source.stop(to);
  };
  const kinds = {
    // The big hit: body, a crack and a tail of air.
    boom: ({ at, size = 1 }) => {
      tone(at, at + 1, "sine", [[at, 120], [at + 0.35, 38]], [[at, 0.0001], [at + 0.005, 0.95 * size], [at + 0.9, 0.0001]]);
      tone(at, at + 0.3, "triangle", [[at, 240], [at + 0.12, 72]], [[at, 0.0001], [at + 0.004, 0.55 * size], [at + 0.24, 0.0001]]);
      hiss(at, at + 0.2, "bandpass", [[at, 1800]], [[at, 0.0001], [at + 0.003, 0.6 * size], [at + 0.14, 0.0001]], 0.7);
      hiss(at, at + 0.9, "highpass", [[at, 6000]], [[at, 0.0001], [at + 0.004, 0.2 * size], [at + 0.8, 0.0001]]);
    },
    // Something lands on the screen.
    slam: ({ at, size = 1, pitch = 1 }) => {
      tone(at, at + 0.22, "triangle", [[at, 300 * pitch], [at + 0.09, 92 * pitch]], [[at, 0.0001], [at + 0.003, 0.7 * size], [at + 0.17, 0.0001]]);
      hiss(at, at + 0.12, "bandpass", [[at, 2600 * pitch]], [[at, 0.0001], [at + 0.002, 0.62 * size], [at + 0.075, 0.0001]], 0.8);
    },
    // Air passing: peaks on `at`.
    whoosh: ({ at, size = 1, length = 0.3 }) => {
      const from = at - length;
      hiss(from, at + length * 0.5, "bandpass", [[from, 480], [at, 3900], [at + length * 0.45, 900]], [[from, 0.0001], [at - 0.012, 0.42 * size], [at + length * 0.45, 0.0001]], 1.3);
    },
    // The build-up: ends exactly on `at`.
    riser: ({ at, size = 1, length = 1.5 }) => {
      const from = at - length;
      hiss(from, at + 0.04, "bandpass", [[from, 300], [at, 7400]], [[from, 0.0001], [at - 0.01, 0.4 * size], [at + 0.03, 0.0001]], 2);
      hiss(at - Math.min(length, 0.6), at + 0.04, "highpass", [[at - 0.6, 5200]], [[at - Math.min(length, 0.6), 0.0001], [at - 0.008, 0.34 * size], [at + 0.03, 0.0001]]);
      tone(from, at + 0.04, "sine", [[from, 190], [at, 940]], [[from, 0.0001], [at - 0.01, 0.16 * size], [at + 0.03, 0.0001]]);
    },
    tick: ({ at, size = 1, pitch = 1 }) => {
      tone(at, at + 0.08, "sine", [[at, 1750 * pitch]], [[at, 0.0001], [at + 0.002, 0.34 * size], [at + 0.06, 0.0001]]);
      hiss(at, at + 0.05, "highpass", [[at, 5200]], [[at, 0.0001], [at + 0.002, 0.24 * size], [at + 0.03, 0.0001]]);
    },
    pop: ({ at, size = 1, pitch = 1 }) => {
      tone(at, at + 0.16, "sine", [[at, 560 * pitch], [at + 0.07, 300 * pitch]], [[at, 0.0001], [at + 0.003, 0.6 * size], [at + 0.13, 0.0001]]);
      hiss(at, at + 0.04, "highpass", [[at, 4200]], [[at, 0.0001], [at + 0.002, 0.3 * size], [at + 0.025, 0.0001]]);
    },
    // A marker pen dragged over paper.
    scribble: ({ at, size = 1, length = 0.2 }) => {
      hiss(at, at + length + 0.03, "bandpass", [[at, 2100], [at + length, 3300]], [[at, 0.0001], [at + 0.015, 0.3 * size], [at + length * 0.7, 0.22 * size], [at + length + 0.02, 0.0001]], 3);
    },
  };
  for (const cue of cues) if (kinds[cue.kind] && cue.at < duration) kinds[cue.kind]({ ...cue, at: Math.max(0.005, cue.at) });

  const audio = await ac.startRendering();
  let peak = 0;
  for (let channel = 0; channel < audio.numberOfChannels; channel += 1) { const data = audio.getChannelData(channel); for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i])); }
  if (peak > 0.97) for (let channel = 0; channel < audio.numberOfChannels; channel += 1) { const data = audio.getChannelData(channel); for (let i = 0; i < data.length; i += 1) data[i] *= 0.97 / peak; }
  return audio;
}

/**
 * What every video cut on a song shares. Nothing is redrawn: the official video keeps its own
 * seconds, and `pin` says which of its instants plays on which beat of the song (moved onto the
 * real hit next to it). `close` pins the ending every video has (paintAgendaClose, in its own
 * seconds: the crest lands, covers the frame at 2.1 s, the partners build from 2.5 s and
 * 2.8 s), ends the film on a hit and mixes the sound.
 */
function scoring(timeline, track, lead) {
  const fps = timeline.fps || 30, score = scoreTrack(track, { lead });
  // The picture changes on the frame that starts with the hit, never after it.
  const frame = (time) => Math.max(0, Math.floor((time + 0.006) * fps) / fps);
  const marks = [], anchors = [[0, 0]];
  const hit = (label, beats) => {
    const found = score.at(beats);
    marks.push({ label, beats, sound: Number(found.at.toFixed(3)), frame: Math.round(frame(found.at) * fps), offMs: Math.round(found.off * 1000), hit: !found.missed });
    return frame(found.at);
  };
  const pin = (label, beats, source) => { const at = hit(label, beats); anchors.push([at, source]); return at; };
  const close = async (base, start) => {
    [[0, 0, "escudo"], [2.1, 4, "escudo cobre a tela"], [2.5, 5, "parceiro 1"], [2.8, 6, "parceiro 2"]].forEach(([seconds, beats, label]) => pin(label, base + beats, start + seconds));
    const last = score.at(base + 12);
    marks.push({ label: "fim", beats: base + 12, sound: Number(last.at.toFixed(3)), frame: Math.round(frame(last.at) * fps), offMs: Math.round(last.off * 1000), hit: !last.missed });
    anchors.push([frame(last.at), timeline.duration]);
    const duration = Math.ceil((last.at + 0.45) * fps) / fps;
    const toSource = (t) => {
      if (t <= 0) return 0;
      if (t >= anchors.at(-1)[0]) return timeline.duration;
      let i = 1;
      while (anchors[i][0] < t) i += 1;
      const [t0, s0] = anchors[i - 1], [t1, s1] = anchors[i];
      return s0 + (t - t0) / Math.max(1e-6, t1 - t0) * (s1 - s0);
    };
    const audio = await mixFilm({ track, score, cues: [], duration, end: last.at });
    return { soundtrack: { audio, duration, toSource }, marks, report: score.report };
  };
  return { fps, score, frame, hit, pin, close };
}

/**
 * The official Agenda do dia (agenda-timeline.js, painted as always) cut on a song. The cover
 * plays over the build-up, the first page lands when the song comes in, each page turns on a
 * bar line, each game comes in on a real hit (the pages carry `cues` for their games), and
 * the close is held to the hits too.
 * Returns `{ timeline, soundtrack: { audio, duration, toSource }, marks, report }`.
 */
export async function scoreAgenda({ timeline, track, lead = 6, pageBeats = 8 } = {}) {
  const { fps, score, frame, hit, pin, close } = scoring(timeline, track, lead);
  const pages = timeline.pages.map((page, index) => {
    const base = index * pageBeats, start = pin(`jogos ${index + 1}`, base, page.start), next = frame(score.at(base + pageBeats).at);
    // The page's own seconds run a little faster or slower than the film's: cues are in the page's.
    // A game is first seen one frame after its cue, so its cue is one frame before the hit.
    const rate = (page.end - page.start) / (next - start);
    const later = score.pick(base, page.matches.length > 3 ? [1, 1.5, 2, 2.5, 3] : [1, 1.5, 2, 2.5], Math.max(0, page.matches.length - 1));
    return { ...page, cues: page.matches.map((match, row) => (row ? (hit(`jogo ${page.firstMatchIndex + row + 1}`, base + later[row - 1]) - 1 / fps - start) * rate : 0)) };
  });
  const scenes = timeline.scenes.map((scene) => pages.find((page) => page.id === scene.id) || scene);
  return { timeline: { ...timeline, scenes, pages }, ...(await close(timeline.pages.length * pageBeats, timeline.finaleStart)) };
}

/**
 * The official Relacionados da noite cut on a song. The cover plays over the build-up, the
 * first name lands when the song comes in, each name after it takes the same number of beats
 * (two or four: whichever is closer to the official pace, so every name falls on a strong
 * beat), the full board lands on a hit and the close follows the hits like every video's.
 */
export async function scoreRelated({ timeline, track, lead = 4 } = {}) {
  const { score, pin, close } = scoring(timeline, track, lead);
  const names = timeline.scenes.filter((scene) => scene.type === "player");
  const overlap = timeline.overlap || 0, pace = (timeline.beat || 1.5) - overlap;
  const step = 2 * score.beat >= 1 && Math.abs(2 * score.beat - pace) < Math.abs(4 * score.beat - pace) ? 2 : 4;
  // A name takes the stage when the one before it ends, a little after its own scene starts.
  names.forEach((scene, index) => pin(`nome ${index + 1}`, index * step, index ? scene.start + overlap : scene.start));
  const board = names.length * step, outro = timeline.outroStart ?? timeline.duration;
  pin("quadro completo", board, timeline.finaleStart);
  const hold = Math.max(2, 2 * Math.round((outro - timeline.finaleStart) / score.beat / 2));
  return { timeline, ...(await close(board + hold, outro)) };
}

/**
 * A piece of the "night vision" model (night-plan.js) cut on a song. That model is planned on
 * a clock, so nothing is warped: the piece is simply built again on the song's own clock
 * (`build`, the timeline's own function), and the song is laid under it, stopping on its last hit.
 */
export async function scoreNight({ track, build, lead = 4 } = {}) {
  const score = scoreTrack(track, { lead });
  const timeline = build(score);
  const audio = await mixFilm({ track, score, cues: [], duration: timeline.duration, end: timeline.night.endSound });
  return { timeline, soundtrack: { audio, duration: timeline.duration, toSource: (t) => t }, report: score.report };
}
