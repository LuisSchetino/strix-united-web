import {
  AGENDA_FPS,
  MEDIA_FORMATS,
  agendaDurationSeconds,
  beatDuration,
  finaleDuration,
  introDuration,
  lockupDuration,
} from "./agenda-media-core.js";

export const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function easeOutExpo(t) {
  const x = clamp01(t);
  return x >= 1 ? 1 : 1 - 2 ** (-10 * x);
}

export function easeOutQuart(t) {
  const x = clamp01(t);
  return 1 - (1 - x) ** 4;
}

export function easeInOutCubic(t) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}

export function remap(time, start, end) {
  if (end <= start) return time >= end ? 1 : 0;
  return clamp01((time - start) / (end - start));
}

export function reveal(time, start, duration, ease = easeOutExpo) {
  return ease(remap(time, start, start + duration));
}

export function safeArea(format) {
  if (format === "feed") {
    return { top: 110, bottom: 130, side: 72 };
  }
  return { top: 210, bottom: 320, side: 72 };
}

export function buildAgendaTimeline(matches = [], { format = "story" } = {}) {
  const spec = MEDIA_FORMATS[format] || MEDIA_FORMATS.story;
  const count = matches.length;
  const duration = agendaDurationSeconds(count);
  const fps = AGENDA_FPS;
  const introEnd = introDuration(count);
  const beat = beatDuration(count);
  const finale = finaleDuration(count);
  const lockup = lockupDuration(count);
  const scenes = [];

  if (!count) {
    return {
      format: spec.id,
      width: spec.width,
      height: spec.height,
      fps,
      duration,
      totalFrames: 0,
      introEnd: 0,
      finaleStart: 0,
      lockupStart: 0,
      safe: safeArea(spec.id),
      scenes: [],
      matches: [],
    };
  }

  scenes.push({
    id: "intro",
    type: "intro",
    start: 0,
    end: introEnd,
  });

  const matchScenes = matches.map((match, index) => {
    const start = introEnd + index * beat;
    return {
      id: `match-${match.id || index}`,
      type: "match",
      index,
      start,
      end: start + beat,
      match,
    };
  });
  scenes.push(...matchScenes);

  const finaleStart = introEnd + count * beat;
  const lockupStart = finaleStart + finale;
  scenes.push({
    id: "finale",
    type: "finale",
    start: finaleStart,
    end: lockupStart,
    hold: finale,
    lockupStart,
  });
  scenes.push({
    id: "lockup",
    type: "lockup",
    start: lockupStart,
    end: duration,
  });

  return {
    format: spec.id,
    width: spec.width,
    height: spec.height,
    fps,
    duration,
    totalFrames: Math.max(1, Math.round(duration * fps)),
    introEnd,
    finaleStart,
    lockupStart,
    safe: safeArea(spec.id),
    scenes,
    matches,
  };
}

export function sceneAt(timeline, time) {
  return (timeline?.scenes || []).find((scene) => time >= scene.start && time < scene.end)
    || timeline?.scenes?.at(-1)
    || null;
}
