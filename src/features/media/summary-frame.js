import { paintSummaryFrame } from "./summary-paint.js";
import { summarySceneAt } from "./summary-timeline.js";

export function summaryFrameTime(frameIndex, timeline) {
  if (!timeline?.totalFrames) return 0;
  const fps = timeline.fps || 30;
  return Math.min(timeline.duration, Number(frameIndex) / fps);
}

export function renderSummaryFrame(ctx, {
  timeline,
  timeSec,
  time,
  assets,
  dayLabel,
} = {}) {
  const resolved = Number.isFinite(timeSec) ? timeSec : time;
  paintSummaryFrame(ctx, { timeline, time: resolved, assets, dayLabel });
}

export function describeSummaryFrame(timeline, timeSec) {
  const scene = summarySceneAt(timeline, timeSec);
  return {
    timeSec: Number(timeSec) || 0,
    sceneType: scene?.type || "none",
    matchIndex: scene?.type === "result" ? scene.index : null,
    opponent: scene?.match?.opponent || null,
    result: scene?.match?.result || null,
  };
}
