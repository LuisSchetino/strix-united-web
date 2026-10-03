// Home "Agora": pure model of the club's present moment. Every value comes from
// the workspace (agenda_matches, club_matches); nothing here is inferred or filled in.
import { agendaHeroSelection, nextAgendaMatches, saoPauloDay, todayAgendaMatches } from "../agenda/agenda-time.js";
import { aggregateTeamStatistics, summarizeNight, uniqueMatches } from "../statistics/statistics-core.js";
import { lineupState, untilLabel } from "../agenda/agenda-status.js";

export { lineupState };

const ZONE = "America/Sao_Paulo";
const MINUTE = 60_000;
// After kickoff the agenda only knows the time has passed. Within this window the
// Home says "começou às"; after it, the match is waiting for its imported result.
export const STARTED_WINDOW_MIN = 40;
// A result imported within this window is still "tonight's" story on the Home.
export const RECENT_RESULT_HOURS = 12;

const hourIn = (now) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", hourCycle: "h23" }).format(now));

export function greetingFor(now = new Date()) {
  const hour = hourIn(now);
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export const kickoffTime = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
const weekdayDate = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, weekday: "short", day: "2-digit", month: "2-digit" })
  .format(new Date(value)).replace(".", "").replace(",", "");
export const shortDate = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, day: "2-digit", month: "2-digit" }).format(new Date(value));

function dayOffset(value, now) {
  const a = Date.parse(`${saoPauloDay(value)}T00:00:00Z`);
  const b = Date.parse(`${saoPauloDay(now)}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

/** "em 1h 12min", "em 8 min", "amanhã", "sáb 04/10" — always relative to São Paulo. */
export function relativeKickoff(value, now = new Date()) {
  const minutes = Math.round((new Date(value).getTime() - now.getTime()) / MINUTE);
  const offset = dayOffset(value, now);
  if (offset === 0 && minutes > 0) return untilLabel(minutes);
  if (offset === 1) return "amanhã";
  return weekdayDate(value);
}

const scoreOf = (value) => (value === null || value === undefined || String(value).trim() === "" ? NaN : Number(value));

export function resultOf(match) {
  const ours = scoreOf(match?.strix_score);
  const theirs = scoreOf(match?.opponent_score);
  if (!Number.isFinite(ours) || !Number.isFinite(theirs)) return null;
  return ours > theirs ? "V" : ours < theirs ? "D" : "E";
}

export const RESULT_LABEL = Object.freeze({ V: "Vitória", E: "Empate", D: "Derrota" });

function nowState(match, now) {
  if (!match) return null;
  const minutes = (new Date(match.scheduled_at).getTime() - now.getTime()) / MINUTE;
  if (minutes > 0) return { kind: "upcoming", label: relativeKickoff(match.scheduled_at, now) };
  if (minutes > -STARTED_WINDOW_MIN) return { kind: "started", label: `Começou às ${kickoffTime(match.scheduled_at)}` };
  return { kind: "awaiting", label: "Aguardando resultado" };
}

/**
 * What the club is living right now, in priority order:
 *   next   — a match today that has not finished its window;
 *   recent — a result imported in the last RECENT_RESULT_HOURS;
 *   free   — nothing tonight; the next commitment (if any) is named.
 */
function homeMode(next, latest, now) {
  if (next?.isToday && next.state.kind !== "awaiting") return "next";
  const playedAt = latest ? new Date(latest.played_at).getTime() : NaN;
  if (Number.isFinite(playedAt) && now.getTime() - playedAt >= 0 && now.getTime() - playedAt < RECENT_RESULT_HOURS * 3_600_000) return "recent";
  if (next?.isToday) return "next";
  return "free";
}

export function buildHomeModel({ agenda = [], matches = [], now = new Date(), players, aliases } = {}) {
  const hero = agendaHeroSelection(agenda, now);
  const tonight = todayAgendaMatches(agenda, now);
  const upcoming = nextAgendaMatches(agenda, now);
  const todayKey = saoPauloDay(now);
  const nextDays = upcoming.filter((match) => saoPauloDay(match.scheduled_at) !== todayKey).slice(0, 4);
  const played = uniqueMatches(matches);
  const latest = played.at(-1) || null;
  const team = aggregateTeamStatistics(played);
  const form = played.slice(-5).reverse().map((match) => ({ id: match.id, result: resultOf(match), opponent: match.opponent_name, date: match.played_at })).filter((item) => item.result);
  const next = hero.match ? { match: hero.match, isToday: hero.isToday, state: nowState(hero.match, now), lineup: lineupState(hero.match) } : null;
  const mode = homeMode(next, latest, now);
  let recent = null;
  if (mode === "recent") {
    const day = saoPauloDay(latest.played_at);
    const night = summarizeNight(played, day, { players, aliases });
    const rating = aggregateTeamStatistics([latest]).averageRating;
    recent = {
      match: latest,
      result: resultOf(latest),
      teamRating: rating == null ? null : rating,
      standout: night.leaders.rating || null,
      night: night.games > 1 ? { games: night.games, wins: night.wins, draws: night.draws, losses: night.losses } : null,
    };
  }
  return {
    greeting: greetingFor(now),
    mode,
    next,
    recent,
    upcoming: mode === "free" && hero.match ? hero.match : null,
    tonight,
    nextDays,
    last: latest ? { match: latest, result: resultOf(latest) } : null,
    season: played.length ? {
      games: team.games,
      wins: team.wins,
      draws: team.draws,
      losses: team.losses,
      efficiency: team.efficiency,
      goalsFor: team.goalsFor,
      goalsAgainst: team.goalsAgainst,
      cleanSheets: team.cleanSheets,
      form,
    } : null,
  };
}
