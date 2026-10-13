// The "night vision" model of the generated pieces (Agenda do dia, Relacionados da noite, Resumo
// do dia e da semana, Anúncios FC27): when everything happens. A plan is made on a clock: the
// song's own (film-sound.js `scoreTrack`, every instant on a real hit) or, with no song, a plain
// metronome. The painters are night-paint.js, night-summary-paint.js and
// night-announce-paint.js; this file is arithmetic only, so it is tested in Node.
import { MEDIA_FORMATS } from "./agenda-media-core.js";

export const NIGHT_FPS = 30;
export const NIGHT_PAGE = 3;

/**
 * A clock that just counts: `bpm` beats a minute, the first `lead` beats before "the entry".
 * Same shape as the song's clock: `beat`, `drop`, `at(n)`, `pick(base, offsets, count, gap)`,
 * `punchAt(t)`.
 */
export function metronome({ bpm = 128, lead = 4, pre = 0.15 } = {}) {
  const beat = 60 / bpm, drop = lead * beat + pre;
  return {
    beat, drop,
    at: (n) => ({ at: drop + n * beat, strength: 0, off: 0, missed: true }),
    // With nothing to listen to, the whole beats are taken first.
    pick: (base, offsets, count, gap = 1) => {
      const chosen = [];
      for (const offset of [...offsets].sort((a, b) => (a % 1 !== 0) - (b % 1 !== 0) || a - b)) {
        if (chosen.length < count && chosen.every((taken) => Math.abs(taken - offset) >= gap)) chosen.push(offset);
      }
      for (const offset of offsets) if (chosen.length < count && !chosen.includes(offset)) chosen.push(offset);
      return chosen.sort((a, b) => a - b);
    },
    punchAt: (t) => { const since = ((t - drop) % beat + beat) % beat; return t < drop ? 0 : 0.55 * Math.exp(-since / 0.14); },
  };
}

/** The games in pages of at most three, balanced (four games are 2 + 2, not 3 + 1). */
export function nightPages(count) {
  if (count <= 0) return [];
  const pages = Math.ceil(count / NIGHT_PAGE), size = Math.ceil(count / pages), out = [];
  for (let index = 0; index < count; index += size) out.push(Array.from({ length: Math.min(size, count - index) }, (unused, i) => index + i));
  return out;
}

const frameOf = (fps) => (time) => Math.max(0, Math.floor((time + 0.006) * fps) / fps);

/**
 * Pages of rows from beat `base`: each page takes two bars, every row comes in on a hit and
 * then has its "turn". Returns the pages and the beat after the last one.
 */
function pagesOn(count, clock, at, base) {
  const pages = nightPages(count).map((indexes) => {
    const later = clock.pick(base, [1, 1.5, 2, 2.5, 3], Math.max(0, indexes.length - 1));
    const turns = clock.pick(base, [4, 4.5, 5, 5.5, 6, 6.5], indexes.length);
    const start = at(base);
    const rows = indexes.map((index, i) => ({ index, at: i ? at(base + later[i - 1]) : start, lit: at(base + turns[i]) }));
    rows.forEach((row, i) => { row.until = rows[i + 1]?.lit ?? row.lit + clock.beat; });
    const page = { start, exit: at(base + 7.5), rows };
    base += 8;
    return page;
  });
  return { pages, base };
}
const pageBlinks = (pages) => pages.flatMap((page) => [[page.start, 1], ...page.rows.flatMap((row, i) => [[row.at, i ? 0.65 : 0], [row.lit, 0.3]])]);

/** What every plan carries: the frame rate, the ending (`off` → `end`, the light going out) and the blinks. */
const finish = (clock, fps, frame, parts, offBeat, blinks) => {
  const off = frame(clock.at(offBeat).at), last = clock.at(offBeat + 4).at;
  return {
    fps, beat: clock.beat, ...parts, off, end: frame(last), endSound: last,
    duration: Math.ceil((last + 0.55) * fps) / fps, blinks: [...blinks, [off, 1]], punchAt: clock.punchAt,
  };
};

/**
 * Agenda do dia. Beats count from the entry: the portrait comes up in the bar before it, the
 * headline lands with it, each page of games takes two bars, the cover comes back, and over
 * the last bar the light goes out. Instants are seconds, each on the frame that starts with
 * its hit.
 */
export function planNightAgenda({ count = 0, clock, fps = NIGHT_FPS } = {}) {
  const frame = frameOf(fps), at = (beats) => frame(clock.at(beats).at);
  const second = clock.pick(0, [2, 1.5, 2.5], 1)[0];
  const title = { agenda: at(0), dodia: at(second), fill: at(4), exit: at(7.5) };
  const { pages, base } = pagesOn(count, clock, at, 8);
  const back = { agenda: at(base), dodia: at(base + 1) };
  // The glass overloads for a blink on the hits: the big cuts in full, the rest by their weight.
  const blinks = [[title.agenda, 1], [title.dodia, 0.75], [title.fill, 0.4], [back.agenda, 1], [back.dodia, 0.75], ...pageBlinks(pages)];
  return finish(clock, fps, frame, { intro: [-4, -3, -2].map(at), title, pages, back }, base + 4, blinks);
}

/**
 * Resumo do dia / da semana. Same walk as the Agenda: the headline with the entry, the results
 * in pages of two bars, then the record of the period (wins, draws and defeats, each on a hit,
 * the goals after them) and the light going out.
 */
export function planNightSummary({ count = 0, clock, fps = NIGHT_FPS } = {}) {
  const frame = frameOf(fps), at = (beats) => frame(clock.at(beats).at);
  const second = clock.pick(0, [2, 1.5, 2.5], 1)[0];
  const title = { first: at(0), second: at(second), fill: at(4), exit: at(7.5) };
  const { pages, base } = pagesOn(count, clock, at, 8);
  const marks = clock.pick(base, [1, 1.5, 2, 2.5, 3], 2);
  const totals = { start: at(base), draws: at(base + marks[0]), losses: at(base + marks[1]), line: at(base + 4) };
  const blinks = [[title.first, 1], [title.second, 0.75], [title.fill, 0.4], [totals.start, 1], [totals.draws, 0.5], [totals.losses, 0.5], [totals.line, 0.35], ...pageBlinks(pages)];
  return finish(clock, fps, frame, { intro: [-4, -3, -2].map(at), title, pages, totals }, base + 8, blinks);
}

const spread = (count) => {
  if (count <= 1) return [0.5];
  const inset = count === 2 ? 0.32 : count === 3 ? 0.2 : count === 4 ? 0.11 : 0.08;
  return Array.from({ length: count }, (unused, i) => inset + (1 - inset * 2) * i / (count - 1));
};
const inRows = (list, most = 4) => {
  if (!list.length) return [];
  const rows = Math.ceil(list.length / most), size = Math.ceil(list.length / rows), out = [];
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
  return out;
};
// The line-up's eleven places (related-night-core.js LINEUP_SLOT_POSITIONS), from the goal forward.
const SLOT_ROWS = [[10], [7, 8, 9], [6], [2, 3, 4, 5], [0, 1]];

/**
 * The list on a pitch, from the goal forward: `rows` of `{ player, index, u }` (`u` 0..1 across
 * the pitch). With a line-up tonight the pitch is its eleven, each in his place, and whoever is
 * on the list for the other games is the `bench`; without one, everyone goes on the pitch by
 * sector.
 */
export function nightPitch(players = []) {
  const entries = players.map((player, index) => ({ player: player || {}, index }));
  const lined = entries.some((entry) => entry.player.slot != null);
  let rows = [];
  if (lined) {
    const bySlot = new Map(entries.filter((entry) => entry.player.slot != null).map((entry) => [Number(entry.player.slot), entry]));
    rows = SLOT_ROWS.map((slots) => slots.map((slot) => bySlot.get(slot)).filter(Boolean));
  } else {
    const group = (entry) => (["GOL", "DEF", "ATA"].includes(entry.player.group) ? entry.player.group : "MEI");
    const of = (id) => entries.filter((entry) => group(entry) === id);
    const middle = of("MEI"), holding = middle.filter((entry) => entry.player.position === "VOL");
    rows = [...inRows(of("GOL")), ...inRows(of("DEF")), ...inRows(holding), ...inRows(middle.filter((entry) => entry.player.position !== "VOL")), ...inRows(of("ATA"))];
  }
  rows = rows.filter((row) => row.length).map((row) => { const across = spread(row.length); return row.map((entry, i) => ({ ...entry, u: across[i] })); });
  return { lined, rows, bench: lined ? entries.filter((entry) => entry.player.slot == null) : [] };
}

/**
 * Relacionados da noite. The headline plays over the build-up; with the entry comes the pitch,
 * and each line of the team lands on a strong beat, from the goal forward; then the names for
 * the other games (`bench`), and the light goes out.
 */
export function planNightRelated({ rows = 0, bench = false, clock, fps = NIGHT_FPS } = {}) {
  const frame = frameOf(fps), at = (beats) => frame(clock.at(beats).at);
  const title = { first: at(-4), second: at(-2) };
  const lines = Array.from({ length: rows }, (unused, i) => at(i * 2));
  const strip = bench ? at(rows * 2) : null;
  const settled = rows * 2 + (bench ? 2 : 0);
  const blinks = [[title.first, 0.8], [title.second, 0.6], ...lines.map((time, i) => [time, i ? 0.55 : 1]), ...(bench ? [[strip, 0.4]] : [])];
  return finish(clock, fps, frame, { title, start: at(0), lines, strip }, Math.ceil((settled + 4) / 4) * 4, blinks);
}

// How long a name stays when names come one at a time: two or four beats, whichever is closer
// to a second and a half, so every name falls on a strong beat.
const nameStep = (clock) => (2 * clock.beat >= 1 && Math.abs(2 * clock.beat - 1.5) < Math.abs(4 * clock.beat - 1.5) ? 2 : 4);

/**
 * Anúncio individual. The face comes up in the bar before the entry; the headline lands with
 * it; two bars later the name takes its place, then the sentence; and the light goes out.
 * `still` is the instant a single image of the piece is taken from.
 */
export function planNightAnnounce({ clock, fps = NIGHT_FPS } = {}) {
  const frame = frameOf(fps), at = (beats) => frame(clock.at(beats).at);
  const second = clock.pick(0, [2, 1.5, 2.5], 1)[0];
  const head = { first: at(0), second: at(second), exit: at(7.5) };
  const name = at(8), phrase = at(12);
  const blinks = [[head.first, 1], [head.second, 0.75], [name, 1], [phrase, 0.5]];
  return finish(clock, fps, frame, { intro: [-4, -3, -2].map(at), head, name, phrase, still: phrase + 2 * clock.beat + 1 }, 20, blinks);
}

/**
 * Anúncio do time. `sections` is how many people each chapter has (board, council, staff,
 * squad). The title plays over the build-up; a chapter opens with its card (only when there is
 * more than one), then its people, one at a time; then everyone on one screen, and the light
 * goes out.
 */
export function planNightSquad({ sections = [], clock, fps = NIGHT_FPS } = {}) {
  const frame = frameOf(fps), at = (beats) => frame(clock.at(beats).at);
  const step = nameStep(clock), cards = sections.length > 1;
  const title = { first: at(-4), second: at(-2) };
  const scenes = [];
  let beat = 0, index = 0;
  sections.forEach((count, section) => {
    if (cards) { scenes.push({ type: "section", section, at: at(beat), until: at(beat + 4) }); beat += 4; }
    for (let i = 0; i < count; i += 1) { scenes.push({ type: "person", section, index, at: at(beat), until: at(beat + step) }); beat += step; index += 1; }
  });
  const list = { start: at(beat), second: at(beat + 1) };
  const blinks = [[title.first, 0.8], [title.second, 0.6], ...scenes.map((scene) => [scene.at, 1]), [list.start, 1], [list.second, 0.5]];
  return finish(clock, fps, frame, { step, title, scenes, list, still: list.second + 2 * clock.beat + 1 }, beat + 8, blinks);
}

const sizeOf = (format) => MEDIA_FORMATS[format] || MEDIA_FORMATS.story;
const shell = (format, plan) => {
  const spec = sizeOf(format);
  return { format: spec.id, width: spec.width, height: spec.height, fps: plan.fps, duration: plan.duration, totalFrames: Math.max(1, Math.round(plan.duration * plan.fps)), night: plan };
};
/** A piece that is one image, not a video: one frame, painted at the plan's `still`. */
const stillShell = (format, plan) => ({ ...shell(format, plan), duration: 1 / plan.fps, totalFrames: 1, still: true });

/**
 * The Agenda's timeline in this model. `face` is whose portrait it wears (`{ id, name, photo }`,
 * or null: the crest). `build(clock)` makes the same piece on another clock (the song's).
 */
export function buildNightAgendaTimeline(matches = [], { format = "story", clock = metronome(), face = null } = {}) {
  const plan = planNightAgenda({ count: matches.length, clock });
  return { ...shell(format, plan), kind: "agenda", matches, face, build: (other) => buildNightAgendaTimeline(matches, { format, clock: other, face }) };
}

/** The Relacionados' timeline in this model: `players` as the video shows them (related-night-core.js). */
export function buildNightRelatedTimeline(players = [], { format = "story", clock = metronome() } = {}) {
  const pitch = nightPitch(players);
  const plan = planNightRelated({ rows: pitch.rows.length, bench: pitch.bench.length > 0, clock });
  return { ...shell(format, plan), kind: "related", players, pitch, build: (other) => buildNightRelatedTimeline(players, { format, clock: other }) };
}

/** The Resumo's timeline in this model: `period` as summary-core.js collects it, `face` as in the Agenda. */
export function buildNightSummaryTimeline(period = {}, { format = "story", clock = metronome(), face = null } = {}) {
  const matches = period?.matches || [];
  const plan = planNightSummary({ count: matches.length, clock });
  return { ...shell(format, plan), kind: "summary", period, matches, face, build: (other) => buildNightSummaryTimeline(period, { format, clock: other, face }) };
}

/**
 * The Anúncio's timeline in this model. `kind` is "individual" or "team"; `sections` are the
 * team's chapters (announce-core.js `announceSections`: `[{ id, title, people }]`). The feed
 * format is one image, not a video.
 */
export function buildNightAnnounceTimeline({ kind = "individual", format = "story", people = [], sections = [], phrase = "", title = "", announceType = "jogador", clock = metronome() } = {}) {
  const team = kind === "team", spec = sizeOf(format);
  const cast = team ? sections.flatMap((section) => section.people || []) : people.filter((person) => person?.name).slice(0, 1);
  const plan = team ? planNightSquad({ sections: sections.map((section) => (section.people || []).length), clock }) : planNightAnnounce({ clock });
  const base = spec.id === "feed" ? stillShell(format, plan) : shell(format, plan);
  const empty = !cast.length ? { duration: 0, totalFrames: 0 } : {};
  return {
    ...base, ...empty, kind: team ? "team" : "individual", people: cast, person: team ? null : cast[0] || null, sections: team ? sections : [],
    phrase: team ? "" : phrase, title: team ? title || "ELENCO FC 27" : "", announceType, scenes: [],
    build: (other) => buildNightAnnounceTimeline({ kind, format, people, sections, phrase, title, announceType, clock: other }),
  };
}

/** A pick out of `pool` that stays the same for the same `seed` (a day, plus how many times it was rolled). */
export function seededPick(pool = [], seed = "") {
  if (!pool.length) return null;
  let hash = 2166136261;
  for (const char of String(seed)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return pool[(hash >>> 0) % pool.length];
}
