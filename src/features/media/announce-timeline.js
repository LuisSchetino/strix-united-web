import { MEDIA_FORMATS } from "./agenda-media-core.js";
import { safeArea } from "./agenda-timeline.js";
import {
  ANNOUNCE_FPS,
  ANNOUNCE_SEASON,
  announceTeamTiming,
  individualAnnounceDuration,
} from "./announce-core.js";

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

  if (!selected.length) {
    return {
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
    };
  }

  if (mode === "individual") {
    const duration = still ? 0.04 : individualAnnounceDuration();
    const introEnd = still ? 0 : 1.45;
    const finaleStart = still ? 0 : duration - 1.55;
    return {
      kind: mode,
      format: spec.id,
      width: spec.width,
      height: spec.height,
      fps: ANNOUNCE_FPS,
      duration,
      totalFrames: still ? 1 : Math.round(duration * ANNOUNCE_FPS),
      introEnd,
      holdStart: introEnd,
      finaleStart,
      safe: safeArea(spec.id),
      scenes: still
        ? [{ id: "still", type: "still", start: 0, end: duration, person: selected[0] }]
        : [
            { id: "intro", type: "intro", start: 0, end: introEnd, person: selected[0] },
            { id: "hold", type: "hold", start: introEnd, end: finaleStart, person: selected[0] },
            { id: "close", type: "close", start: finaleStart, end: duration, person: selected[0] },
          ],
      people: selected.slice(0, 1),
      person: selected[0],
      phrase,
      title: "",
      announceType,
      season: ANNOUNCE_SEASON,
      still,
    };
  }

  const timing = announceTeamTiming(selected.length);
  const duration = still ? 0.04 : timing.duration;
  const introEnd = still ? 0 : timing.intro;
  const scenes = [];
  if (still) {
    scenes.push({ id: "grid", type: "grid", start: 0, end: duration, people: selected });
  } else {
    scenes.push({ id: "intro", type: "intro", start: 0, end: introEnd });
    selected.forEach((person, index) => {
      const start = introEnd + index * timing.beat;
      const previous = selected[index - 1];
      scenes.push({
        id: `person-${person.id || index}`,
        type: "person",
        index,
        start,
        end: start + timing.beat,
        person,
        groupLead: !previous || previous.group !== person.group || previous.extraRole !== person.extraRole,
      });
    });
    const finaleStart = introEnd + selected.length * timing.beat;
    scenes.push({
      id: "finale",
      type: "finale",
      start: finaleStart,
      end: duration,
      people: selected,
    });
  }

  const finaleStart = still ? 0 : introEnd + selected.length * timing.beat;
  return {
    kind: mode,
    format: spec.id,
    width: spec.width,
    height: spec.height,
    fps: ANNOUNCE_FPS,
    duration,
    totalFrames: still ? 1 : Math.round(duration * ANNOUNCE_FPS),
    introEnd,
    finaleStart,
    beat: still ? 0 : timing.beat,
    safe: safeArea(spec.id),
    scenes,
    people: selected,
    phrase,
    title: title || "ELENCO FC 27",
    announceType,
    season: ANNOUNCE_SEASON,
    still,
  };
}

export function announceSceneAt(timeline, timeSec) {
  const time = Number(timeSec) || 0;
  const scenes = timeline?.scenes || [];
  return scenes.find((scene) => time >= scene.start && time < scene.end) || scenes.at(-1) || null;
}
