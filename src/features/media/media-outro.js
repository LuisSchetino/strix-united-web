// Every generated video ends the way the Agenda do dia does: the Strix crest grows until it
// covers the frame, the frame darkens, and the partners' marks build themselves. A piece's own
// timeline is left exactly as it is; these seconds are added after it (`outroStart` is where
// they begin). A still (one frame) has no ending.
export const OUTRO_SECONDS = 5;

export function withOutro(timeline) {
  if (!timeline || !(timeline.duration > 0.5) || !(timeline.totalFrames > 1)) return timeline;
  const fps = timeline.fps || Math.round(timeline.totalFrames / timeline.duration) || 30;
  const duration = Number((timeline.duration + OUTRO_SECONDS).toFixed(3));
  return { ...timeline, outroStart: timeline.duration, duration, totalFrames: Math.max(1, Math.round(duration * fps)) };
}
