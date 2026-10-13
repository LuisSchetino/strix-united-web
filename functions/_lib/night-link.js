import { NIGHT_ASSET_BUCKET, nightWindow, publicNight } from "../../shared/night-link.js";

const READ_TIMEOUT_MS = 4000;

async function read(env, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`night_read_${response.status}`);
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The public night of `day`, read with the server key (the visitor has no session): the day's
 * games, the roster, and the crest of an opponent that only has one through its competition.
 * Null when the day has no line-up. Throws when the database cannot be read.
 */
export async function readPublicNight(env, day) {
  const { from, to } = nightWindow(day);
  const agenda = await read(env, `agenda_matches?select=${encodeURIComponent("*,opponent_logos!agenda_matches_opponent_logo_id_fkey(storage_path)")}&scheduled_at=gte.${encodeURIComponent(from)}&scheduled_at=lt.${encodeURIComponent(to)}&order=scheduled_at.asc`);
  if (!agenda.some((match) => Array.isArray(match.lineup) && match.lineup.some((slot) => String(slot ?? "").trim()))) return null;
  const players = await read(env, "club_players?select=*&is_active=eq.true");
  const teamIds = [...new Set(agenda.filter((match) => !match.opponent_logos?.storage_path && match.opponent_team_id).map((match) => String(match.opponent_team_id)))]
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  let teams = [];
  if (teamIds.length) {
    try { teams = await read(env, `competition_teams?select=id,logo_url&id=in.(${teamIds.join(",")})`); } catch { teams = []; }
  }
  const assetUrl = (path) => `${env.SUPABASE_URL}/storage/v1/object/public/${NIGHT_ASSET_BUCKET}/${String(path).split("/").map(encodeURIComponent).join("/")}`;
  return publicNight({ day, agenda, players, teams, assetUrl });
}
