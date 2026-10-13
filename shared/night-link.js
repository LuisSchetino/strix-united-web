// "Link da noite": one public address, without sign-in, that shows today's games and their
// line-ups and nothing else. It is temporary by construction:
//   * the address is derived from the day (a keyed hash of the date), so tomorrow it is another
//     address and today's stops answering by itself;
//   * it only answers while at least one of today's games has a line-up. Clear the line-ups and
//     the link is dead; fill one again and the same link is back.
// Nothing is stored anywhere: no table, no token to revoke. Shared by the Pages Functions and
// the tests; the browser only ever sees the finished address.
import { isAgendaMatchCancelled, saoPauloDay } from "../src/features/agenda/agenda-time.js";

export const NIGHT_PAGE = "noite";
export const NIGHT_ASSET_BUCKET = "fc27-team-assets";
const TOKEN = /^[A-Za-z0-9_-]{24}$/;
// A night runs past midnight: until this hour the link of the day before still answers.
const NIGHT_ENDS_AT_HOUR = 6;
const SLOTS = 11;

const text = (value) => String(value ?? "").trim();
const normalize = (value) => text(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const isNightToken = (value) => TOKEN.test(String(value || ""));
export const nightPath = (token) => `/${NIGHT_PAGE}/${token}`;

/** The token in `/noite/<token>`, or "" when the address is anything else. */
export function parseNightPath(pathname) {
  const segments = String(pathname || "").split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === NIGHT_PAGE && isNightToken(segments[1]) ? segments[1] : "";
}

/** The address of one day's night: a keyed hash of the date, so it cannot be guessed or forged. */
export async function nightToken(secret, day) {
  if (!secret || !/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return "";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`strix-night-link:${day}`)));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 24);
}

/** The days a token may belong to right now: today, and yesterday while its night is still on. */
export function nightDays(now = new Date()) {
  const current = new Date(now);
  const today = saoPauloDay(current);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(current));
  return hour < NIGHT_ENDS_AT_HOUR ? [today, saoPauloDay(new Date(current.getTime() - 86_400_000))] : [today];
}

/** The day `token` opens right now, or "" when it is not a live night's address. */
export async function nightDayOf(secret, token, now = new Date()) {
  if (!isNightToken(token)) return "";
  for (const day of nightDays(now)) {
    if (await nightToken(secret, day) === token) return day;
  }
  return "";
}

/** The instants a day covers in São Paulo (UTC−3, no daylight saving). */
export function nightWindow(day) {
  const from = new Date(`${day}T00:00:00-03:00`);
  return { from: from.toISOString(), to: new Date(from.getTime() + 86_400_000).toISOString() };
}

const lineupOf = (match) => Array.from({ length: SLOTS }, (_, index) => text(Array.isArray(match?.lineup) ? match.lineup[index] : ""));

/**
 * What the public page receives for `day`: the games that were not called off, each with its
 * line-up, and the roster entries that appear in those line-ups (name, photo, positions:
 * nothing else about anyone). Null when no game of the day has a line-up: the link is not live.
 */
export function publicNight({ day, agenda = [], players = [], teams = [], assetUrl = (path) => path } = {}) {
  const games = (Array.isArray(agenda) ? agenda : [])
    .filter((match) => match && saoPauloDay(match.scheduled_at) === day)
    .filter((match) => !isAgendaMatchCancelled(match) && !["deleted", "removed", "archived"].includes(text(match.status).toLowerCase()))
    .sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
  const lineups = games.map(lineupOf);
  if (!lineups.some((lineup) => lineup.some(Boolean))) return null;

  const teamLogo = new Map((Array.isArray(teams) ? teams : []).map((team) => [String(team.id), text(team.logo_url)]));
  const roster = new Map((Array.isArray(players) ? players : []).filter((player) => player?.is_active !== false).map((player) => [normalize(player.display_name), player]));
  const named = new Map();
  for (const lineup of lineups) for (const name of lineup) {
    const player = name ? roster.get(normalize(name)) : null;
    if (player && !named.has(normalize(name))) {
      named.set(normalize(name), {
        display_name: text(player.display_name),
        positions: Array.isArray(player.positions) ? player.positions.filter(Boolean).map(String) : [],
        photo: player.avatar_path ? assetUrl(player.avatar_path) : text(player.external_avatar_url),
        test: player.member_type === "teste",
      });
    }
  }
  return {
    day,
    matches: games.map((match, index) => ({
      id: String(match.id),
      opponent: text(match.opponent_name),
      competition: text(match.competition_name) || "Amistoso",
      scheduledAt: match.scheduled_at,
      status: text(match.status) || "scheduled",
      logo: match.opponent_logos?.storage_path ? assetUrl(match.opponent_logos.storage_path) : teamLogo.get(String(match.opponent_team_id)) || "",
      lineup: lineups[index],
      filled: lineups[index].filter(Boolean).length,
    })),
    players: [...named.values()],
  };
}
