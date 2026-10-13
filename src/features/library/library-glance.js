// The Library seen from outside its page: what the member can pick up where he stopped, what
// he has not watched yet, and what is new. Read from the same rows the Library page uses
// (library_items the member may see, and his own library_view_progress); nothing is guessed.
import { librarySource } from "./library-core.js";

const DAY = 86_400_000;
const stamp = (value) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};
const upper = (values) => (Array.isArray(values) ? values : []).map((value) => String(value).toUpperCase());

/** A material is done at 90% (the rule library-core uses) or once it was marked complete. */
const isDone = (row) => Boolean(row?.completed_at) || Number(row?.progress_percent) >= 90;

/** Whether a material names one of the player's positions as who it is mainly for. */
export function isForPlayer(item, player) {
  const focus = upper(item?.focus_positions);
  if (!focus.length || !player) return false;
  const own = upper(player.positions);
  return focus.some((position) => own.includes(position));
}

/**
 *   resume  — the material he was in the middle of, most recently touched: { item, position, percent }
 *   pending — materials he has not finished (never opened ones included), those meant for his
 *             position first, then newest: [{ item, forYou, started }]
 *   forYou  — how many of the pending ones name his position
 *   fresh   — published in the last `freshDays` and never opened by him
 */
export function libraryGlance({ items = [], progress = [], userId = "", player = null, now = new Date(), freshDays = 7 } = {}) {
  const active = (Array.isArray(items) ? items : []).filter((item) => item && item.status !== "archived" && item.status !== "draft");
  const own = new Map((Array.isArray(progress) ? progress : []).filter((row) => row && row.user_id === userId).map((row) => [row.item_id, row]));
  const resumeRow = active
    .map((item) => ({ item, row: own.get(item.id) }))
    .filter(({ item, row }) => row && !isDone(row) && librarySource(item.source_url).trackable && Number(row.last_position_seconds) > 0)
    .sort((left, right) => stamp(right.row.last_accessed_at) - stamp(left.row.last_accessed_at))[0];
  const resume = resumeRow ? { item: resumeRow.item, position: Math.floor(Number(resumeRow.row.last_position_seconds) || 0), percent: Math.round(Number(resumeRow.row.progress_percent) || 0) } : null;
  const pending = active
    .filter((item) => !isDone(own.get(item.id)) && item.id !== resume?.item.id)
    .map((item) => ({ item, forYou: isForPlayer(item, player), started: Boolean(own.get(item.id)) }))
    .sort((left, right) => Number(right.forYou) - Number(left.forYou) || stamp(right.item.published_at) - stamp(left.item.published_at));
  const limit = now.getTime() - freshDays * DAY;
  const fresh = active.filter((item) => !own.has(item.id) && stamp(item.published_at) >= limit)
    .sort((left, right) => stamp(right.published_at) - stamp(left.published_at));
  return { resume, pending, forYou: pending.filter((entry) => entry.forYou).length, fresh, total: active.length };
}
