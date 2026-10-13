// What changed between two saved line-ups, in the words a manager uses: who came in for whom,
// who came in to an empty place, who left, who stayed but changed position. Read from the two
// line-ups the change history keeps (club_activity_log.details: before / after); nothing here
// is inferred beyond comparing them.
import { LINEUP_SLOTS } from "./lineup-suggest.js";

const text = (value) => String(value ?? "").trim();
const key = (value) => text(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

/**
 * `{ swaps, entered, left, moved, filledBefore, filledAfter, changed }`:
 *   swaps   — `{ position, in, out }`: one player took the place another held;
 *   entered — `{ position, name }`: came in to a place that was empty (or that a team-mate moved out of);
 *   left    — `{ position, name }`: went out and nobody new took that place;
 *   moved   — `{ name, from, to }`: in both line-ups, in a different position.
 * A centre-back who goes from one centre-back place to another has not changed position.
 */
export function lineupDiff(before = [], after = [], slots = LINEUP_SLOTS) {
  const read = (lineup) => slots.map((position, index) => ({ position, name: text(Array.isArray(lineup) ? lineup[index] : "") }));
  const was = read(before);
  const now = read(after);
  const placeBefore = new Map(was.filter((slot) => slot.name).map((slot) => [key(slot.name), slot.position]));
  const placeAfter = new Map(now.filter((slot) => slot.name).map((slot) => [key(slot.name), slot.position]));
  const isNew = (slot) => Boolean(slot.name) && !placeBefore.has(key(slot.name));
  const isGone = (slot) => Boolean(slot.name) && !placeAfter.has(key(slot.name));

  const swaps = [];
  const paired = new Set();
  now.forEach((slot, index) => {
    if (isNew(slot) && isGone(was[index])) {
      swaps.push({ position: slot.position, in: slot.name, out: was[index].name });
      paired.add(key(slot.name));
      paired.add(key(was[index].name));
    }
  });
  const entered = now.filter((slot) => isNew(slot) && !paired.has(key(slot.name))).map((slot) => ({ position: slot.position, name: slot.name }));
  const left = was.filter((slot) => isGone(slot) && !paired.has(key(slot.name))).map((slot) => ({ position: slot.position, name: slot.name }));
  const moved = now
    .filter((slot) => slot.name && placeBefore.has(key(slot.name)) && placeBefore.get(key(slot.name)) !== slot.position)
    .map((slot) => ({ name: slot.name, from: placeBefore.get(key(slot.name)), to: slot.position }));
  return {
    swaps, entered, left, moved,
    filledBefore: was.filter((slot) => slot.name).length,
    filledAfter: now.filter((slot) => slot.name).length,
    changed: swaps.length + entered.length + left.length + moved.length > 0,
  };
}
