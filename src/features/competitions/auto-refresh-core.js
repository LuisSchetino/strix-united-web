// When a competition is due to be read again. Pure: the hook that runs the reading is in
// auto-refresh.js.

/** A source is read again when its last reading is older than this, and sooner when a game is near. */
export const STALE_MINUTES = 60;
export const STALE_MINUTES_NEAR_GAME = 15;
const NEAR_GAME_HOURS = 36;

const time = (value) => {
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : 0;
};

/**
 * The sources to read now, oldest reading first. One source per active edition (its standings
 * source, the one ATUALIZAR reads; the others come with it). A game of Strix within a day and a
 * half makes the edition "near": it is read every quarter of an hour instead of every hour.
 */
export function dueSources({ sources = [], editions = [], fixtures = [], now = new Date(), attempted = new Map() } = {}) {
  const nowMs = now.getTime();
  return (Array.isArray(editions) ? editions : [])
    .filter((edition) => edition && edition.status !== "historical")
    .map((edition) => {
      const own = sources.filter((source) => source.edition_id === edition.id && /^https?:\/\//i.test(source.source_url || ""));
      const source = own.find((item) => item.source_kind === "standings") || own[0];
      if (!source) return null;
      const near = fixtures.some((fixture) => fixture.edition_id === edition.id
        && /\bstrix\b/i.test(`${fixture.home_team_name} ${fixture.away_team_name}`)
        && !["completed", "cancelled"].includes(fixture.status)
        && time(fixture.scheduled_at) >= nowMs - 3 * 3_600_000
        && time(fixture.scheduled_at) <= nowMs + NEAR_GAME_HOURS * 3_600_000);
      const window = (near ? STALE_MINUTES_NEAR_GAME : STALE_MINUTES) * 60_000;
      // Only a reading that was saved counts. `last_checked_at` is stamped by the server's own
      // attempt before it reads anything, so an attempt that died there would look like a fresh reading.
      const last = Math.max(time(source.last_synced_at), attempted.get(source.id) || 0);
      return nowMs - last >= window ? { source, edition, near, last } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.last - right.last);
}
