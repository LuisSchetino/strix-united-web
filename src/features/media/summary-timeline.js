import { MEDIA_FORMATS } from "./agenda-media-core.js";
import { safeArea } from "./agenda-timeline.js";
import {
  SUMMARY_FPS,
  summaryDurationSeconds,
  summaryFinaleDuration,
  summaryIntroDuration,
  summaryResultBeat,
  summaryStatsDuration,
} from "./summary-core.js";

export function buildSummaryTimeline(period = {}, { format = "story" } = {}) {
  const spec = MEDIA_FORMATS[format] || MEDIA_FORMATS.story;
  const matches = period.matches || [];
  const count = matches.length;
  const duration = summaryDurationSeconds(count);
  const introEnd = summaryIntroDuration();
  const statsEnd = introEnd + summaryStatsDuration();
  const beat = summaryResultBeat(count);
  const finale = summaryFinaleDuration();
  const scenes = [];

  if (!count) {
    return {
      format: spec.id,
      width: spec.width,
      height: spec.height,
      fps: SUMMARY_FPS,
      duration: 0,
      totalFrames: 0,
      introEnd: 0,
      statsStart: 0,
      statsEnd: 0,
      finaleStart: 0,
      beat,
      safe: safeArea(spec.id),
      scenes: [],
      matches: [],
      period,
    };
  }

  scenes.push({ id: "intro", type: "intro", start: 0, end: introEnd });
  scenes.push({ id: "stats", type: "stats", start: introEnd, end: statsEnd });
  matches.forEach((match, index) => {
    const start = statsEnd + index * beat;
    scenes.push({
      id: `result-${match.id || index}`,
      type: "result",
      index,
      start,
      end: start + beat,
      match,
    });
  });
  const finaleStart = statsEnd + count * beat;
  scenes.push({
    id: "finale",
    type: "finale",
    start: finaleStart,
    end: duration,
    hold: finale,
  });

  return {
    format: spec.id,
    width: spec.width,
    height: spec.height,
    fps: SUMMARY_FPS,
    duration,
    totalFrames: Math.max(1, Math.round(duration * SUMMARY_FPS)),
    introEnd,
    statsStart: introEnd,
    statsEnd,
    finaleStart,
    beat,
    safe: safeArea(spec.id),
    scenes,
    matches,
    period,
  };
}

export function summarySceneAt(timeline, time) {
  return (timeline?.scenes || []).find((scene) => time >= scene.start && time < scene.end)
    || timeline?.scenes?.at(-1)
    || null;
}
