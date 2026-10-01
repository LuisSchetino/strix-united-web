// JS mirror of the motion tokens in motion.css. Use these when a timer has to
// agree with a CSS transition (for example, unmounting after a leave animation).
export const MOTION = Object.freeze({
  micro: 140,
  control: 200,
  modal: 220,
  section: 320,
  hero: 560,
});

export function prefersReducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/** Duration for a timer that mirrors a CSS transition; collapses under reduced motion. */
export function motionMs(token) {
  return prefersReducedMotion() ? 0 : MOTION[token] ?? MOTION.control;
}
