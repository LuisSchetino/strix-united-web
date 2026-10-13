import { lookAssetFingerprint } from "./media-look.js";
import { CUTOUT_TEMPLATE_SEEDS } from "./cutout-text.js";
import { matchNightDay, saoPauloDay } from "../agenda/agenda-time.js";
import { uniqueMatches, aggregateTeamStatistics } from "../statistics/statistics-core.js";
import { formatAgendaDay, formatKickoff, MEDIA_FORMATS, opponentInitials } from "./agenda-media-core.js";

export const SUMMARY_TEMPLATE_ID = "period-summary";
export const SUMMARY_TEMPLATE_VERSION = "period-summary-studio-v11";
export const SUMMARY_FPS = 30;

const WEEKDAY = Object.freeze({
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
});

function addSaoPauloDays(iso, days) {
  const date = new Date(`${iso}T12:00:00-03:00`);
  date.setTime(date.getTime() + days * 86400000);
  return saoPauloDay(date);
}

export function saoPauloWeekBounds(now = new Date()) {
  const iso = saoPauloDay(now);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${iso}T12:00:00-03:00`));
  const start = addSaoPauloDays(iso, -(WEEKDAY[weekday] ?? 0));
  return { start, end: addSaoPauloDays(start, 6) };
}

export function formatSummaryRange(startIso, endIso) {
  const start = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${startIso}T12:00:00-03:00`)).replace(".", "").toUpperCase();
  const end = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${endIso}T12:00:00-03:00`)).replace(".", "").toUpperCase();
  return `${start} – ${end}`;
}

function completedMatch(match) {
  return Number.isFinite(Number(match?.strix_score)) && Number.isFinite(Number(match?.opponent_score));
}

function decorateMatch(match, workspace = {}) {
  const catalogLogo = match.opponent_logos?.storage_path && workspace.assetUrl
    ? workspace.assetUrl(match.opponent_logos.storage_path)
    : "";
  const strix = Number(match.strix_score);
  const opponent = Number(match.opponent_score);
  return {
    id: String(match.id || ""),
    opponent: String(match.opponent_name || match.opponent || "").trim(),
    opponent_logo: String(match.resolved_opponent_logo_url || catalogLogo || "").trim(),
    competition: String(match.competition_name || "Amistoso").trim(),
    played_at: match.played_at,
    kickoff: formatKickoff(match.played_at),
    dateLabel: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(match.played_at)).replace(".", "").toUpperCase(),
    strix_score: strix,
    opponent_score: opponent,
    result: strix > opponent ? "W" : strix < opponent ? "L" : "D",
    initials: opponentInitials(match.opponent_name || match.opponent),
  };
}

const dayLabel = (iso) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" })
  .format(new Date(`${iso}T12:00:00-03:00`)).replace(".", "").toUpperCase();

/** Noon in São Paulo on a given day: the instant that stands for "that day" when a summary is asked for it. */
export const summaryInstant = (iso) => new Date(`${iso}T12:00:00-03:00`);

/**
 * The periods a summary can be made for: today (or this week) and every earlier
 * day (or week) that has imported results, newest first. Only real results count;
 * a day without games is offered only when it is today.
 */
export function summaryPeriods(workspace = {}, { mode = "day", now = new Date(), limit = 8 } = {}) {
  const today = saoPauloDay(now);
  const thisWeek = saoPauloWeekBounds(now).start;
  const counts = new Map();
  for (const match of uniqueMatches(workspace.matches || []).filter(completedMatch)) {
    if (!match.played_at) continue;
    const day = matchNightDay(match.played_at);
    const key = mode === "week" ? saoPauloWeekBounds(summaryInstant(day)).start : day;
    if (key > (mode === "week" ? thisWeek : today)) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const current = mode === "week" ? thisWeek : today;
  if (!counts.has(current)) counts.set(current, 0);
  return [...counts.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      count,
      isCurrent: key === current,
      label: mode === "week"
        ? (key === current ? "ESTA SEMANA" : `${dayLabel(key)} – ${dayLabel(addSaoPauloDays(key, 6))}`)
        : key === today ? "HOJE" : key === addSaoPauloDays(today, -1) ? "ONTEM" : dayLabel(key),
      detail: mode === "week" ? `${dayLabel(key)} – ${dayLabel(addSaoPauloDays(key, 6))}` : dayLabel(key),
    }));
}

/** The period a summary opens on: the current one when it has results, otherwise the latest that does. */
export function defaultSummaryPeriod(periods = []) {
  return (periods.find((period) => period.isCurrent && period.count) || periods.find((period) => period.count) || periods[0])?.key || "";
}

export function collectPeriodSummary(workspace = {}, { mode = "day", now = new Date() } = {}) {
  const day = saoPauloDay(now);
  const week = saoPauloWeekBounds(now);
  const all = uniqueMatches(workspace.matches || []).filter(completedMatch);
  const matches = all.filter((match) => {
    if (!match.played_at) return false;
    const key = matchNightDay(match.played_at);
    return mode === "week" ? key >= week.start && key <= week.end : key === day;
  }).map((match) => decorateMatch(match, workspace));
  const stats = aggregateTeamStatistics(matches);
  return {
    mode: mode === "week" ? "week" : "day",
    day,
    weekStart: week.start,
    weekEnd: week.end,
    rangeLabel: mode === "week" ? formatSummaryRange(week.start, week.end) : formatAgendaDay(now).label,
    title: mode === "week" ? "RESUMO DA SEMANA" : "RESUMO DO DIA",
    matches,
    stats: {
      games: stats.games,
      wins: stats.wins,
      draws: stats.draws,
      losses: stats.losses,
      goalsFor: stats.goalsFor,
      goalsAgainst: stats.goalsAgainst,
      goalDifference: stats.goalDifference,
      efficiency: stats.efficiency,
    },
  };
}

export function summaryIdentityPayload({
  mode = "day",
  day,
  format = "story",
  matches = [],
  look = "editorial",
  mediaLook = "",
  music = "",
  model = "",
  face = "",
  templateVersion = SUMMARY_TEMPLATE_VERSION,
} = {}) {
  return {
    ...(model ? { model: String(model) } : {}),
    ...(music ? { music: String(music) } : {}),
    ...(face ? { face: String(face) } : {}),
    day: String(day || ""),
    format: String(format || "story"),
    template: SUMMARY_TEMPLATE_ID,
    templateVersion,
    mode: mode === "week" ? "week" : "day",
    look: String(mediaLook || look || "editorial"),
    collageAssets: lookAssetFingerprint(mediaLook || look, {
      seed: CUTOUT_TEMPLATE_SEEDS.summary,
      mode: format === "feed" ? "static" : "chaos",
    }),
    matches: matches.map((match) => ({
      id: match.id || "",
      opponent: match.opponent || "",
      opponent_logo: match.opponent_logo || "",
      competition: match.competition || "",
      played_at: match.played_at || "",
      strix_score: Number(match.strix_score) || 0,
      opponent_score: Number(match.opponent_score) || 0,
    })),
  };
}

export async function fingerprintSummaryRender(input = {}) {
  const encoded = new TextEncoder().encode(JSON.stringify(summaryIdentityPayload(input)));
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const byte of encoded) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function summaryFileName({ day, mode = "day", format = "story" } = {}) {
  const spec = MEDIA_FORMATS[format] || MEDIA_FORMATS.story;
  const safeDay = String(day || "periodo").replace(/[^0-9-]/g, "") || "periodo";
  const kind = mode === "week" ? "semana" : "dia";
  return `strix-resumo-${kind}-${safeDay}-${spec.suffix}.mp4`;
}

export function summaryIntroDuration() {
  return 1.85;
}

export function summaryStatsDuration() {
  return 2.55;
}

export function summaryResultBeat(count) {
  if (count <= 0) return 0;
  if (count <= 3) return 1.75;
  if (count <= 6) return 1.4;
  return 1.15;
}

export function summaryFinaleDuration() {
  return 2.15;
}

export function summaryDurationSeconds(count) {
  if (count <= 0) return 0;
  return Number((
    summaryIntroDuration()
    + summaryStatsDuration()
    + count * summaryResultBeat(count)
    + summaryFinaleDuration()
  ).toFixed(3));
}

export { formatAgendaDay, MEDIA_FORMATS };
