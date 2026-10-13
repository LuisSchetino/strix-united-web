import { withOutro } from "./media-outro.js";
import { MEDIA_FORMATS } from "./agenda-media-core.js";
import { safeArea } from "./agenda-timeline.js";
import {
  ANNOUNCE_FPS,
  ANNOUNCE_SEASON,
  announceSections,
  announceTeamTiming,
  individualAnnounceDuration,
} from "./announce-core.js";
import { buildAnnounceLook, finalePageSize } from "./announce-look.js";

export function finalePagesFor(people = []) {
  if (!people.length) return [];
  const size = finalePageSize(people.length);
  if (people.length <= size) return [people];
  const pages = [];
  for (let index = 0; index < people.length; index += size) {
    pages.push(people.slice(index, index + size));
  }
  return pages;
}

function buildAnnounceTimelineBody({
  kind = "individual",
  format = "story",
  people = [],
  phrase = "",
  title = "ELENCO FC 27",
  announceType = "jogador",
} = {}) {
  const spec = MEDIA_FORMATS[format] || MEDIA_FORMATS.story;
  const mode = kind === "team" ? "team" : "individual";
  const selected = people.filter((person) => person?.name);
  const still = spec.id === "feed";
  const look = buildAnnounceLook({
    kind: mode,
    people: selected,
    format: spec.id,
    width: spec.width,
    height: spec.height,
    season: ANNOUNCE_SEASON,
  });

  const empty = {
    kind: mode,
    format: spec.id,
    width: spec.width,
    height: spec.height,
    fps: ANNOUNCE_FPS,
    duration: 0,
    totalFrames: 0,
    introEnd: 0,
    finaleStart: 0,
    safe: safeArea(spec.id),
    scenes: [],
    people: [],
    phrase: "",
    title: title || "ELENCO FC 27",
    announceType,
    season: ANNOUNCE_SEASON,
    still,
    look,
  };

  if (!selected.length) return empty;

  if (mode === "individual") {
    const duration = still ? 0.04 : individualAnnounceDuration();
    const introEnd = still ? 0 : 1.08;
    const revealEnd = still ? 0 : 2.18;
    const heroEnd = still ? 0 : 4.45;
    const reframeEnd = still ? 0 : 6.4;
    const detailEnd = still ? 0 : 8.15;
    const heroTime = still ? 5.2 : 2.9;
    return {
      ...empty,
      duration,
      totalFrames: still ? 1 : Math.round(duration * ANNOUNCE_FPS),
      introEnd,
      revealEnd,
      holdStart: introEnd,
      finaleStart: detailEnd,
      phraseStart: still ? 0 : 2.15,
      heroTime,
      scenes: still
        ? [{ id: "still", type: "still", start: 0, end: duration, person: selected[0], variant: look.variants[0] }]
        : [
            { id: "intro", type: "intro", start: 0, end: introEnd, person: selected[0] },
            { id: "reveal", type: "reveal", start: introEnd, end: revealEnd, person: selected[0] },
            { id: "hero", type: "hero", start: revealEnd, end: heroEnd, person: selected[0] },
            { id: "reframe", type: "reframe", start: heroEnd, end: reframeEnd, person: selected[0] },
            { id: "detail", type: "detail", start: reframeEnd, end: detailEnd, person: selected[0] },
            { id: "close", type: "close", start: detailEnd, end: duration, person: selected[0] },
          ],
      people: selected.slice(0, 1),
      person: selected[0],
      phrase,
      title: "",
    };
  }

  // Team film: chapters (board, council, staff, squad from the back line forward),
  // every name on one closing screen, then the crest.
  const sections = announceSections(selected);
  const ordered = sections.flatMap((section) => section.people);
  const cards = sections.length > 1 ? sections.length : 0;
  const timing = announceTeamTiming(ordered.length, cards);
  const duration = still ? 0.04 : timing.duration;
  const introEnd = still ? 0 : timing.intro;
  const scenes = [];
  let finaleStart = 0;
  if (still) {
    scenes.push({ id: "grid", type: "grid", start: 0, end: duration, people: ordered, pages: [ordered] });
  } else {
    scenes.push({ id: "intro", type: "intro", start: 0, end: introEnd });
    const step = timing.beat - timing.overlap;
    let cursor = introEnd;
    let index = 0;
    for (const section of sections) {
      if (cards) {
        scenes.push({ id: `section-${section.id}`, type: "section", start: cursor, end: cursor + timing.section, section });
        cursor += timing.section;
      }
      for (const person of section.people) {
        scenes.push({
          id: `person-${person.id || index}`,
          type: "person",
          index,
          start: cursor,
          end: cursor + step,
          person,
          section: section.id,
          variant: look.variants[index],
          enter: 0.48,
          hold: timing.readable,
          overlap: 0,
        });
        cursor += step;
        index += 1;
      }
    }
    finaleStart = cursor;
    scenes.push({ id: "finale-0", type: "finale", start: finaleStart, end: finaleStart + timing.finale, people: ordered, pageIndex: 0, pageCount: 1 });
    scenes.push({ id: "crest", type: "crest", start: finaleStart + timing.finale, end: duration });
  }

  return {
    ...empty,
    duration,
    totalFrames: still ? 1 : Math.round(duration * ANNOUNCE_FPS),
    introEnd,
    finaleStart,
    beat: still ? 0 : timing.beat,
    overlap: still ? 0 : timing.overlap,
    readable: still ? 0 : timing.readable,
    scenes,
    sections,
    people: ordered,
    phrase,
    title: title || "ELENCO FC 27",
  };
}

export function announceSceneAt(timeline, timeSec) {
  const time = Number(timeSec) || 0;
  const scenes = timeline?.scenes || [];
  return scenes.find((scene) => time >= scene.start && time < scene.end) || scenes.at(-1) || null;
}

/** The piece's own timeline, followed by the ending every video shares (see media-outro.js). */
export function buildAnnounceTimeline(...args) {
  return withOutro(buildAnnounceTimelineBody(...args));
}
