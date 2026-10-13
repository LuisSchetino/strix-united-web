import { paintEditorialAgenda } from "./editorial-media-paint.js";
import { paintNightAgenda } from "./night-paint.js";
import { sceneAt } from "./agenda-timeline.js";

export function agendaFrameTime(frameIndex, timeline) {
  if (!timeline?.totalFrames) return 0;
  const fps = timeline.fps || 30;
  return Math.min(timeline.duration, Number(frameIndex) / fps);
}

export function renderAgendaFrame(ctx, {
  timeline,
  timeSec,
  time,
  assets,
  dayLabel,
} = {}) {
  const resolved = Number.isFinite(timeSec) ? timeSec : time;
  // A timeline of the "night vision" model (night-plan.js) has its own painter.
  if (timeline?.night) paintNightAgenda(ctx, { timeline, time: resolved, assets, dayLabel });
  else paintEditorialAgenda(ctx, { timeline, time: resolved, assets, dayLabel });
}

export function describeAgendaFrame(timeline, timeSec) {
  const scene = sceneAt(timeline, timeSec);
  const firstMatch = scene?.type === "page" ? scene.matches?.[0] : null;
  return {
    timeSec: Number(timeSec) || 0,
    sceneType: scene?.type || "none",
    matchIndex: scene?.type === "page" ? scene.firstMatchIndex : null,
    pageIndex: scene?.type === "page" ? scene.pageIndex : null,
    pageCount: scene?.type === "page" ? scene.pageCount : null,
    matchCount: scene?.type === "page" ? scene.matches?.length || 0 : null,
    opponent: firstMatch?.opponent || null,
    kickoff: firstMatch?.kickoff || null,
    competition: firstMatch?.competition || null,
  };
}

export function sampleFrameSignature(ctx, width, height, grid = 8) {
  if (!ctx?.getImageData) return [];
  const data = ctx.getImageData(0, 0, width, height).data;
  const cells = [];
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const x = Math.min(width - 1, Math.floor(((col + 0.5) / grid) * width));
      const y = Math.min(height - 1, Math.floor(((row + 0.5) / grid) * height));
      const index = (y * width + x) * 4;
      cells.push(data[index] + data[index + 1] + data[index + 2]);
    }
  }
  return cells;
}

export function signatureDistance(left = [], right = []) {
  const size = Math.max(left.length, right.length);
  let total = 0;
  for (let index = 0; index < size; index += 1) {
    total += Math.abs((left[index] || 0) - (right[index] || 0));
  }
  return total;
}
