// "Abertura": the short moment the site plays when it opens. Two cases share it:
//   live   — whoever is on the countdown when it reaches zero sees it right there;
//   member — whoever signs in after the launch sees it once, before anything else.
// It is never a replayed countdown: a countdown shown after the date would be acting out a
// moment that already passed. Pure: timings and the once-only memory.

export const OPENING_VERSION = 1;
/** The whole sequence, from the crest coming into focus to the last pixel of the reveal. */
export const OPENING_TOTAL_MS = 2900;
/** With reduced motion nothing moves: the same composition stands still for this long. */
export const OPENING_STILL_MS = 1500;
/** How long the counter rests on zero before the opening takes over. */
export const ZERO_HOLD_MS = 1200;

const memberKey = (userId) => `strix:opening:v${OPENING_VERSION}:${userId}`;
const LIVE_KEY = `strix:opening:v${OPENING_VERSION}:live`;

/**
 * Whether a member still has the opening to see on this device: only after the launch, once
 * per member, and never on a device that watched the countdown reach zero.
 */
export function shouldShowOpening(storage, userId, { unlocked = false } = {}) {
  if (!userId || !unlocked) return false;
  try {
    return storage.getItem(memberKey(userId)) === null && storage.getItem(LIVE_KEY) === null;
  } catch {
    return false;
  }
}

export function markOpeningSeen(storage, userId) {
  if (!userId) return;
  try { storage.setItem(memberKey(userId), "seen"); } catch { /* storage blocked: it may play again */ }
}

/** The countdown reached zero on this device: its people have had their moment. */
export function markOpeningLive(storage) {
  try { storage.setItem(LIVE_KEY, new Date().toISOString()); } catch { /* storage blocked */ }
}
