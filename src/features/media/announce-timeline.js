import { MEDIA_FORMATS } from "./agenda-media-core.js";
import { safeArea } from "./agenda-timeline.js";
import {
  ANNOUNCE_FPS,
  ANNOUNCE_SEASON,
  announceTeamTiming,
  individualAnnounceDuration,
} from "./announce-core.js";
import { buildAnnounceLook } from "./announce-look.js";

export function finalePagesFor(people = []) {
  if (!people.length) return [];
  if (people.length <= 8) return [people];
  const size = 8;
  const pages = [];
  for (let index = 0; index < people.length; index += size) {
    pages.push(people.slice(index, index + size));
  }
  return pages;
}

export function buildAnnounceTimeline({
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
    const introEnd = still ? 0 : 1.7;
    const revealEnd = still ? 0 : 3.3;
    const holdEnd = still ? 0 : 7.6;
    const phraseEnd = still ? 0 : 9.2;
    const heroTime = still ? 5.4 : 5.4;
    return {
      ...empty,
      duration,
      totalFrames: still ? 1 : Math.round(duration * ANNOUNCE_FPS),
      introEnd,
      revealEnd,
      holdStart: introEnd,
      finaleStart: phraseEnd,
      heroTime,
      scenes: still
        ? [{ id: "still", type: "still", start: 0, end: duration, person: selected[0], variant: look.variants[0] }]
        : [
            { id: "intro", type: "intro", start: 0, end: introEnd, person: selected[0] },
            { id: "reveal", type: "reveal", start: introEnd, end: revealEnd, person: selected[0] },
            { id: "hold", type: "hold", start: revealEnd, end: holdEnd, person: selected[0] },
            { id: "phrase", type: "phrase", start: holdEnd, end: phraseEnd, person: selected[0] },
            { id: "close", type: "close", start: phraseEnd, end: duration, person: selected[0] },
          ],
      people: selected.slice(0, 1),
      person: selected[0],
      phrase,
      title: "",
    };
  }

  const timing = announceTeamTiming(selected.length);
  const duration = still ? 0.04 : timing.duration;
  const introEnd = still ? 0 : timing.intro;
  const pages = finalePagesFor(selected);
  const scenes = [];
  if (still) {
    scenes.push({ id: "grid", type: "grid", start: 0, end: duration, people: selected, pages });
  } else {
    scenes.push({ id: "intro", type: "intro", start: 0, end: introEnd });
    selected.forEach((person, index) => {
      const start = introEnd + index * (timing.beat - timing.overlap);
      scenes.push({
        id: `person-${person.id || index}`,
        type: "person",
        index,
        start,
        end: start + timing.beat,
        person,
        variant: look.variants[index],
        enter: 0.48,
        hold: timing.readable,
        overlap: timing.overlap,
      });
    });
    const finaleStart = introEnd + timing.beat + Math.max(0, selected.length - 1) * (timing.beat - timing.overlap);
    const pageDur = pages.length > 1 ? timing.finale / pages.length : timing.finale;
    pages.forEach((page, index) => {
      scenes.push({
        id: `finale-${index}`,
        type: "finale",
        start: finaleStart + index * pageDur,
        end: index === pages.length - 1 ? duration : finaleStart + (index + 1) * pageDur,
        people: page,
        pageIndex: index,
        pageCount: pages.length,
      });
    });
  }

  const finaleStart = still ? 0 : introEnd + timing.beat + Math.max(0, selected.length - 1) * (timing.beat - timing.overlap);
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
    people: selected,
    phrase,
    title: title || "ELENCO FC 27",
  };
}

export function announceSceneAt(timeline, timeSec) {
  const time = Number(timeSec) || 0;
  const scenes = timeline?.scenes || [];
  return scenes.find((scene) => time >= scene.start && time < scene.end) || scenes.at(-1) || null;
}
