import { withOutro } from "./media-outro.js";
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

function buildRelatedNightTimelineBody(players = [], { format = "story" } = {}) {
  const spec = MEDIA_FORMATS[format] || MEDIA_FORMATS.story;
  const count = players.length;
  const duration = relatedNightDurationSeconds(count);
  const introEnd = relatedNightIntroDuration(count);
  const beat = relatedNightBeatDuration(count);
  const overlap = relatedNightOverlap(count);
  const finale = relatedNightFinaleDuration(count);
  const placed = distributeRelatedOnField(players);
  const groupSizes = placed.reduce((acc, player) => {
    acc[player.group] = (acc[player.group] || 0) + 1;
    return acc;
  }, {});

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
      groupSizes: {},
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
    const previous = placed[index - 1];
    return {
      id: `player-${player.id || index}`,
      type: "player",
      index,
      start,
      end: start + beat,
      player,
      groupLead: !previous || previous.group !== player.group,
      groupSize: groupSizes[player.group] || 0,
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
    groupSizes,
  };
}

export function relatedNightSceneAt(timeline, time) {
  return (timeline?.scenes || []).find((scene) => time >= scene.start && time < scene.end)
    || timeline?.scenes?.at(-1)
    || null;
}

/** The piece's own timeline, followed by the ending every video shares (see media-outro.js). */
export function buildRelatedNightTimeline(...args) {
  return withOutro(buildRelatedNightTimelineBody(...args));
}
