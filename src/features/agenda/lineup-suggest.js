// Help for whoever builds the night: who has played how much (rotation), last game's line-up,
// and suggestions the manager adjusts. Everything is read from imported matches and saved
// line-ups; a suggestion never invents a player for a position he does not play.
import { resolveLineupRosterPlayer } from "./lineup-core.js";
import { saoPauloDay } from "./agenda-time.js";
import { rosterAppearances } from "../statistics/statistics-core.js";

/** The 3-1-4-2 the club plays, slot by slot (the order line-ups are stored in). */
export const LINEUP_SLOTS = Object.freeze(["ATA", "ATA", "ALA", "MC", "MC", "ALA", "VOL", "ZAG", "ZAG", "ZAG", "GOL"]);

const DAY = 86_400_000;
const filled = (lineup) => (Array.isArray(lineup) ? lineup : []).filter((slot) => String(slot ?? "").trim()).length;
const time = (value) => {
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : 0;
};

/**
 * The line-up to repeat: the most recent other game (not cancelled) that has one, looking back
 * from `before`. Returns `{ lineup, match }` or null.
 */
export function lastLineup(agenda = [], { before = new Date(), excludeId = "" } = {}) {
  const limit = time(before);
  const candidates = (Array.isArray(agenda) ? agenda : [])
    .filter((match) => match && String(match.id) !== String(excludeId) && match.status !== "cancelled" && filled(match.lineup) > 0 && time(match.scheduled_at) <= limit)
    .sort((left, right) => time(right.scheduled_at) - time(left.scheduled_at));
  const match = candidates[0];
  return match ? { lineup: Array.from({ length: LINEUP_SLOTS.length }, (_, index) => String(match.lineup[index] ?? "")), match } : null;
}

/**
 * How much each roster player has played: games in the last 7 and 30 days, and when he last
 * played. `Map(playerId → { week, month, lastPlayedAt, daysSince })`; a player who never
 * appears in an imported match has zeros and `daysSince: null`.
 */
export function playerRotation({ players = [], aliases = [], matches = [], now = new Date() } = {}) {
  const today = Date.parse(`${saoPauloDay(now)}T00:00:00Z`);
  const rotation = new Map((Array.isArray(players) ? players : []).filter((player) => player?.is_active !== false)
    .map((player) => [player.id, { week: 0, month: 0, lastPlayedAt: "", daysSince: null }]));
  for (const { match, playerIds } of rosterAppearances(matches, { players, aliases })) {
    const playedAt = match.played_at || match.date;
    const day = Date.parse(`${saoPauloDay(playedAt)}T00:00:00Z`);
    if (!Number.isFinite(day) || day > today) continue;
    const age = Math.round((today - day) / DAY);
    for (const id of playerIds) {
      const entry = rotation.get(id);
      if (!entry) continue;
      if (age < 7) entry.week += 1;
      if (age < 30) entry.month += 1;
      if (!entry.lastPlayedAt || time(playedAt) > time(entry.lastPlayedAt)) {
        entry.lastPlayedAt = playedAt;
        entry.daysSince = age;
      }
    }
  }
  return rotation;
}

/** "2 jogos na semana · jogou ontem" — what a rotation entry says next to a name. */
export function rotationLabel(entry) {
  if (!entry || entry.daysSince === null) return "Ainda sem jogo importado";
  const last = entry.daysSince === 0 ? "jogou hoje" : entry.daysSince === 1 ? "jogou ontem" : `último jogo há ${entry.daysSince} dias`;
  const week = entry.week === 0 ? "Nenhum jogo na semana" : `${entry.week} ${entry.week === 1 ? "jogo" : "jogos"} na semana`;
  return `${week} · ${last}`;
}

// Rested first: longest without playing, then fewest games in the month, then by name so the
// order never flips between two renders.
function byRest(rotation) {
  const rest = (player) => {
    const entry = rotation.get(player.id);
    return entry?.daysSince === null || entry?.daysSince === undefined ? Number.POSITIVE_INFINITY : entry.daysSince;
  };
  return (left, right) => rest(right) - rest(left)
    || (rotation.get(left.id)?.month || 0) - (rotation.get(right.id)?.month || 0)
    || String(left.display_name).localeCompare(String(right.display_name), "pt-BR");
}

const plays = (player, position) => (player?.positions || []).map((value) => String(value).toUpperCase()).includes(position);

/**
 * A line-up from a set of available players (the night's list): each slot takes someone who
 * plays that position. Whoever held the same slot in `reference` (the last line-up) keeps it;
 * the rest go to the most rested. A slot nobody on the list plays stays empty.
 */
export function suggestLineup({ candidates = [], rotation = new Map(), reference = [] } = {}) {
  const pool = (Array.isArray(candidates) ? candidates : []).filter((player) => player?.is_active !== false);
  const used = new Set();
  const lineup = Array(LINEUP_SLOTS.length).fill("");
  LINEUP_SLOTS.forEach((position, index) => {
    const previous = resolveLineupRosterPlayer(reference[index], pool);
    if (previous && !used.has(previous.id) && plays(previous, position)) {
      lineup[index] = previous.display_name;
      used.add(previous.id);
    }
  });
  LINEUP_SLOTS.forEach((position, index) => {
    if (lineup[index]) return;
    const pick = pool.filter((player) => !used.has(player.id) && plays(player, position)).sort(byRest(rotation))[0];
    if (!pick) return;
    lineup[index] = pick.display_name;
    used.add(pick.id);
  });
  return lineup;
}
