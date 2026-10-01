import { paintEditorialRelated } from "./editorial-media-paint.js";
import { relatedNightSceneAt } from "./related-night-timeline.js";

export function relatedNightFrameTime(frameIndex, timeline) {
  if (!timeline?.totalFrames) return 0;
  const fps = timeline.fps || 30;
  return Math.min(timeline.duration, Number(frameIndex) / fps);
}

export function renderRelatedNightFrame(ctx, {
  timeline,
  timeSec,
  time,
  assets,
  dayLabel,
} = {}) {
  const resolved = Number.isFinite(timeSec) ? timeSec : time;
  paintEditorialRelated(ctx, { timeline, time: resolved, assets, dayLabel });
}

export function describeRelatedNightFrame(timeline, timeSec) {
  const scene = relatedNightSceneAt(timeline, timeSec);
  return {
    timeSec: Number(timeSec) || 0,
    sceneType: scene?.type || "none",
    playerIndex: scene?.type === "player" ? scene.index : null,
    playerName: scene?.player?.name || null,
    position: scene?.player?.position || null,
    group: scene?.player?.group || null,
    onField: (timeline?.scenes || [])
      .filter((item) => item.type === "player" && timeSec >= item.start + 0.18)
      .map((item) => item.player.name),
  };
}
