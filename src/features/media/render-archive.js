// What the Media archive keeps. Generated pieces live only in this browser (IndexedDB); the
// archive shows the newest few and old files leave on their own, so the list never piles up.
import { AGENDA_TEMPLATE_ID } from "./agenda-media-core.js";

/** How many pieces an archive lists. */
export const ARCHIVE_VISIBLE = 3;
/** A piece outside the newest ARCHIVE_VISIBLE of its kind is deleted after this many days. */
export const ARCHIVE_KEEP_DAYS = 7;

const templateOf = (row) => row?.template || AGENDA_TEMPLATE_ID;
const createdAt = (row) => {
  const time = Date.parse(row?.createdAt || "");
  return Number.isFinite(time) ? time : 0;
};

/**
 * Ids of the cached renders to delete: every piece that is neither among the newest
 * ARCHIVE_VISIBLE of its template nor younger than ARCHIVE_KEEP_DAYS. A row without a
 * readable date counts as old.
 */
export function rendersToPrune(rows = [], now = Date.now()) {
  const limit = now - ARCHIVE_KEEP_DAYS * 86_400_000;
  const byTemplate = new Map();
  for (const row of rows) {
    if (!row?.id) continue;
    const list = byTemplate.get(templateOf(row)) || [];
    list.push(row);
    byTemplate.set(templateOf(row), list);
  }
  const drop = [];
  for (const list of byTemplate.values()) {
    list.sort((left, right) => createdAt(right) - createdAt(left));
    for (const row of list.slice(ARCHIVE_VISIBLE)) if (createdAt(row) < limit) drop.push(row.id);
  }
  return drop;
}
