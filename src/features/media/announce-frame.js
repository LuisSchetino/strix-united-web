import { paintAnnounceFrame } from "./announce-paint.js";
import { paintCollageAnnounce, isCollageLook } from "./collage-paint.js";
import { announceSceneAt } from "./announce-timeline.js";

export function announceFrameTime(frameIndex, timeline) {
  if (!timeline?.totalFrames) return 0;
  const fps = timeline.fps || 30;
  return Math.min(timeline.duration, Number(frameIndex) / fps);
}

export function renderAnnounceFrame(ctx, {
  timeline,
  timeSec,
  time,
  assets,
} = {}) {
  const resolved = Number.isFinite(timeSec) ? timeSec : time;
  if (isCollageLook(timeline)) {
    paintCollageAnnounce(ctx, { timeline, time: resolved, assets });
    return;
  }
  paintAnnounceFrame(ctx, { timeline, time: resolved, assets });
}

export function describeAnnounceFrame(timeline, timeSec) {
  const scene = announceSceneAt(timeline, timeSec);
  return {
    timeSec: Number(timeSec) || 0,
    kind: timeline?.kind || "individual",
    format: timeline?.format || "story",
    sceneType: scene?.type || "none",
    personName: scene?.person?.name || timeline?.person?.name || null,
    personIndex: Number.isInteger(scene?.index) ? scene.index : null,
    count: timeline?.people?.length || 0,
  };
}
