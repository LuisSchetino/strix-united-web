const ZONE = "America/Sao_Paulo";
const rows = (value) => Array.isArray(value) ? value : [];

export const saoPauloDay = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(value));

/**
 * The night a played match counts for: its São Paulo day, or the day before when it was played
 * in the small hours (before 06:00). A game set for 23:40 ends after midnight and still belongs
 * to that night's summary and numbers. "" for a value that is not a date.
 */
export const NIGHT_ENDS_AT_HOUR = 6;
export const matchNightDay = (value) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? saoPauloDay(time - NIGHT_ENDS_AT_HOUR * 3600000) : "";
};

const sameName = (value) => String(value || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Which leg a game is: "ida", "volta" or "". Nothing is stored for it: two games of the same
 * night against the same club in the same championship (not a friendly, not cancelled) are the
 * first leg and the return, in the order they are played.
 */
export function agendaLeg(match, matches = []) {
  if (!match?.scheduled_at || !match.opponent_name || /^\s*amistos/i.test(match.competition_name || "amistoso") || match.status === "cancelled") return "";
  const pair = rows(matches)
    .filter((entry) => entry?.scheduled_at && entry.status !== "cancelled"
      && saoPauloDay(entry.scheduled_at) === saoPauloDay(match.scheduled_at)
      && sameName(entry.opponent_name) === sameName(match.opponent_name)
      && sameName(entry.competition_name) === sameName(match.competition_name))
    .sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
  if (pair.length !== 2) return "";
  return String(pair[0].id) === String(match.id) ? "ida" : String(pair[1].id) === String(match.id) ? "volta" : "";
}

export function classifyAgendaMatch(match, now = new Date()) {
  if (["completed", "cancelled"].includes(match?.status)) return match.status;
  const kickoff = new Date(match?.scheduled_at);
  if (Number.isNaN(kickoff.getTime())) return "upcoming";
  if (kickoff.getTime() < now.getTime()) return "overdue";
  return saoPauloDay(kickoff) === saoPauloDay(now) ? "today" : "upcoming";
}

export function isAgendaMatchActive(match = {}) {
  const status = String(match.status || "scheduled").trim().toLocaleLowerCase("pt-BR");
  if (["completed", "cancelled", "canceled", "deleted", "removed", "archived"].includes(status)) return false;
  if (["is_deleted", "deleted", "is_removed", "removed", "is_archived", "archived", "is_cancelled", "cancelled"].some((field) => match[field] === true)) return false;
  if (["deleted_at", "removed_at", "archived_at", "cancelled_at"].some((field) => Boolean(match[field]))) return false;
  return true;
}

export function activeAgendaMatches(matches = [], now = new Date()) {
  return rows(matches)
    .filter(isAgendaMatchActive)
    .map((match) => ({ ...match, temporal_status: classifyAgendaMatch(match, now) }))
    .sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
}

export function nextAgendaMatches(matches = [], now = new Date()) {
  return activeAgendaMatches(matches, now).filter((match) => match.temporal_status !== "overdue");
}

export function todayAgendaMatches(matches = [], now = new Date()) {
  const today = saoPauloDay(now);
  return activeAgendaMatches(matches, now).filter(
    (match) => saoPauloDay(match.scheduled_at) === today,
  );
}

export function agendaHeroSelection(matches = [], now = new Date()) {
  const today = todayAgendaMatches(matches, now);
  const nextToday = today.find((match) => new Date(match.scheduled_at).getTime() >= now.getTime());
  if (nextToday) return { match: nextToday, isToday: true };
  if (today.length) {
    const closest = [...today].sort((left, right) => (
      Math.abs(new Date(left.scheduled_at).getTime() - now.getTime())
      - Math.abs(new Date(right.scheduled_at).getTime() - now.getTime())
    ))[0];
    return { match: closest, isToday: true };
  }
  return { match: nextAgendaMatches(matches, now)[0] || null, isToday: false };
}

/** A game that was on the schedule and was called off (not deleted, not played). */
export function isAgendaMatchCancelled(match = {}) {
  const status = String(match.status || "").trim().toLocaleLowerCase("pt-BR");
  if (["completed", "deleted", "removed", "archived"].includes(status)) return false;
  if (["is_deleted", "deleted", "is_removed", "removed", "is_archived", "archived"].some((field) => match[field] === true)) return false;
  if (["deleted_at", "removed_at", "archived_at"].some((field) => Boolean(match[field]))) return false;
  return ["cancelled", "canceled"].includes(status) || match.is_cancelled === true || match.cancelled === true || Boolean(match.cancelled_at);
}

/**
 * What the Agenda page lists: every active game plus the cancelled ones, which
 * stay in their slot (struck, dimmed) so the night's plan remains honest.
 * Everything else in the product — Home, media, next slot — keeps reading only
 * active games. `list_day` places each row: "today", "upcoming" or "past".
 */
/**
 * Is `result` (an imported match) the result of `game` (an Agenda row)? Only when it was
 * played around that game's own kick-off. Clubs meet twice in a competition: the first leg's
 * result must never stand for the return game.
 */
export function isResultOfGame(game, result, hours = 18) {
  const at = new Date(game?.scheduled_at).getTime();
  const played = new Date(result?.played_at).getTime();
  // A result with no date cannot be checked and is taken as given.
  if (!Number.isFinite(at) || !Number.isFinite(played)) return Boolean(result);
  return Math.abs(played - at) <= hours * 3_600_000;
}

export function agendaListMatches(matches = [], now = new Date()) {
  const today = saoPauloDay(now);
  return rows(matches)
    .filter((match) => isAgendaMatchActive(match) || isAgendaMatchCancelled(match))
    .map((match) => {
      const cancelled = !isAgendaMatchActive(match);
      const day = saoPauloDay(match.scheduled_at);
      return {
        ...match,
        status: cancelled ? "cancelled" : match.status,
        temporal_status: cancelled ? "cancelled" : classifyAgendaMatch(match, now),
        list_day: day === today ? "today" : day > today ? "upcoming" : "past",
      };
    })
    .sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
}
