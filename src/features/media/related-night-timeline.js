import { MEDIA_FORMATS } from "./agenda-media-core.js";
import { safeArea } from "./agenda-timeline.js";
import {
  RELATED_NIGHT_FPS,
  relatedNightBeatDuration,
  relatedNightDurationSeconds,
  relatedNightFinaleDuration,
  relatedNightIntroDuration,
  relatedNightOverlap,
} from "./related-night-core.js";
import { distributeRelatedOnField } from "./related-night-layout.js";

export function buildRelatedNightTimeline(players = [], { format = "story" } = {}) {
  const spec = MEDIA_FORMATS[format] || MEDIA_FORMATS.story;
  const count = players.length;
  const duration = relatedNightDurationSeconds(count);
  const introEnd = relatedNightIntroDuration(count);
  const beat = relatedNightBeatDuration(count);
  const overlap = relatedNightOverlap(count);
  const finale = relatedNightFinaleDuration(count);
  const placed = distributeRelatedOnField(players);

  if (!count) {
    return {
      format: spec.id,
      width: spec.width,
      height: spec.height,
      fps: RELATED_NIGHT_FPS,
      duration: 0,
      totalFrames: 0,
      introEnd: 0,
      finaleStart: 0,
      beat,
      overlap,
      safe: safeArea(spec.id),
      scenes: [],
      players: [],
    };
  }

  const scenes = [{
    id: "intro",
    type: "intro",
    start: 0,
    end: introEnd,
  }];

  const playerScenes = placed.map((player, index) => {
    const start = introEnd + index * (beat - overlap);
    return {
      id: `player-${player.id || index}`,
      type: "player",
      index,
      start,
      end: start + beat,
      player,
    };
  });
  scenes.push(...playerScenes);

  const finaleStart = introEnd + beat + Math.max(0, count - 1) * (beat - overlap);
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
    fps: RELATED_NIGHT_FPS,
    duration,
    totalFrames: Math.max(1, Math.round(duration * RELATED_NIGHT_FPS)),
    introEnd,
    finaleStart,
    beat,
    overlap,
    safe: safeArea(spec.id),
    scenes,
    players: placed,
  };
}

export function relatedNightSceneAt(timeline, time) {
  return (timeline?.scenes || []).find((scene) => time >= scene.start && time < scene.end)
    || timeline?.scenes?.at(-1)
    || null;
}
