import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { PING_GAP_LIMIT, completionSeconds, creditPing, isDay, isRequiredExempt, requiredDays } from "../../../shared/night-required.js";
import { CONTRACT_SEASON, PLAYER_LINK_NONE, hasSignedContract, readPlayerLink } from "../../../src/features/onboarding/contract-core.js";
import { saoPauloDay } from "../../../src/features/agenda/agenda-time.js";

/**
 * "Obrigatório da noite" (see shared/night-required.js).
 *
 * GET  → the day's plays, what the member has watched of them, and (Conselho and above, with
 *        `?team=1`) the same for every member. Asking also records that the member opened
 *        the site today.
 * POST → one report from the player: "still playing". The time it is worth is counted here,
 *        on the server's clock, and written with the service role: members have no write
 *        access to what they watched.
 */
const ROUTE = "night-required";
const MISSING = new Set(["42P01", "PGRST205", "PGRST204"]);

function rest(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

/** Rows of a read; `missing` when the tables of this feature were not created yet. */
async function rows(env, path) {
  const response = await rest(env, path);
  if (response.ok) return { data: await response.json(), missing: false };
  const body = await response.json().catch(() => ({}));
  if (MISSING.has(body?.code) || response.status === 404) return { data: [], missing: true };
  throw new Error(`night_required_read_${response.status}`);
}

const itemOf = (row) => ({ item_id: row.item_id, position: row.position || 0, duration_seconds: Number(row.duration_seconds) || 0 });
const progressOf = (row) => ({ item_id: row.item_id, watched_seconds: Number(row.watched_seconds) || 0, completed_at: row.completed_at || null });

/** The live day: the first of today / last night that has plays marked; today when none has. */
async function liveDay(env, now) {
  const days = requiredDays(now);
  for (const day of days) {
    const read = await rows(env, `night_required_items?day=eq.${day}&select=item_id,position,duration_seconds&order=position.asc`);
    if (read.missing) return { day: days[0], items: [], missing: true };
    if (read.data.length) {
      // A play that was removed from the Library is no longer asked of anyone.
      let kept = read.data;
      try {
        const alive = await rows(env, `library_items?id=in.(${read.data.map((row) => row.item_id).join(",")})&status=eq.active&select=id`);
        if (!alive.missing) { const ids = new Set(alive.data.map((row) => row.id)); kept = read.data.filter((row) => ids.has(row.item_id)); }
      } catch { kept = read.data; }
      if (kept.length) return { day, items: kept.map(itemOf), missing: false };
    }
  }
  return { day: days[0], items: [], missing: false };
}

function ready(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function onRequestGet({ request, env }) {
  const session = await authenticateDiscordMember(request, env, { reuseMs: 60_000 });
  if (session.error) return session.error;
  if (!ready(env)) return json({ error: "backend_configuration_missing" }, 503, { route: ROUTE, request });
  const now = new Date();
  const userId = session.user.id;
  try {
    const live = await liveDay(env, now);
    const base = { day: live.day, ready: !live.missing, exempt: isRequiredExempt(session.tier), items: live.items, progress: [] };
    if (live.missing) return json(base, 200, { route: ROUTE, request });
    // The visit: one row per member and day; the first time stays, the last one moves.
    await rest(env, "member_visits?on_conflict=user_id,day", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: userId, day: saoPauloDay(now), last_at: now.toISOString() }),
    }).catch(() => null);
    if (live.items.length) {
      const own = await rows(env, `night_required_progress?day=eq.${live.day}&user_id=eq.${userId}&select=item_id,watched_seconds,completed_at`);
      base.progress = own.data.map(progressOf);
    }
    const team = new URL(request.url).searchParams.get("team") === "1";
    if (!team || !requireTier(session, "conselho")) return json(base, 200, { route: ROUTE, request });

    const [members, visits, progress, accounts] = await Promise.all([
      rows(env, "team_members?is_active=eq.true&select=user_id,display_name,discord_username,access_tier"),
      rows(env, `member_visits?day=in.(${[...new Set([live.day, saoPauloDay(now)])].join(",")})&select=user_id,last_at`),
      live.items.length ? rows(env, `night_required_progress?day=eq.${live.day}&select=user_id,item_id,watched_seconds,completed_at`) : { data: [] },
      fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
        cache: "no-store",
      }).then((response) => (response.ok ? response.json() : {})).catch(() => ({})),
    ]);
    const users = Array.isArray(accounts?.users) ? accounts.users : Array.isArray(accounts) ? accounts : [];
    const linkOf = new Map(users.map((user) => [user.id, readPlayerLink(user)]));
    // An account that stopped at the contract screen never got into the site.
    const signedOf = new Map(users.map((user) => [user.id, hasSignedContract(user, CONTRACT_SEASON)]));
    const seen = new Map();
    for (const visit of visits.data) if (!seen.has(visit.user_id) || visit.last_at > seen.get(visit.user_id)) seen.set(visit.user_id, visit.last_at);
    base.team = members.data
      .filter((member) => member.access_tier !== "teste")
      .map((member) => ({
        userId: member.user_id,
        name: member.display_name || "Membro",
        names: [member.discord_username].filter(Boolean),
        tier: member.access_tier,
        playerId: linkOf.get(member.user_id) === PLAYER_LINK_NONE ? "none" : linkOf.get(member.user_id) || "",
        signed: signedOf.has(member.user_id) ? Boolean(signedOf.get(member.user_id)) : true,
        visitedAt: seen.get(member.user_id) || "",
        progress: progress.data.filter((row) => row.user_id === member.user_id).map(progressOf),
      }));
    return json(base, 200, { route: ROUTE, request });
  } catch {
    return json({ error: "night_required_unavailable" }, 502, { route: ROUTE, request });
  }
}

export async function onRequestPost({ request, env }) {
  const session = await authenticateDiscordMember(request, env, { reuseMs: 60_000 });
  if (session.error) return session.error;
  if (!ready(env)) return json({ error: "backend_configuration_missing" }, 503, { route: ROUTE, request });
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const day = String(body?.day || "");
  const itemId = String(body?.itemId || "");
  const now = new Date();
  if (!isDay(day) || !/^[0-9a-f-]{36}$/i.test(itemId)) return json({ error: "invalid_report" }, 400, { route: ROUTE, request });
  // Only a live night can be watched for: not yesterday's, not tomorrow's.
  if (!requiredDays(now).includes(day)) return json({ error: "night_closed" }, 409, { route: ROUTE, request });
  try {
    const marked = await rows(env, `night_required_items?day=eq.${day}&item_id=eq.${itemId}&select=duration_seconds`);
    if (marked.missing) return json({ error: "night_required_not_ready" }, 503, { route: ROUTE, request });
    if (!marked.data.length) return json({ error: "not_required" }, 404, { route: ROUTE, request });
    const duration = Number(marked.data[0].duration_seconds) || 0;
    const userId = session.user.id;
    const mine = await rows(env, `night_required_progress?day=eq.${day}&user_id=eq.${userId}&select=item_id,watched_seconds,last_ping_at,completed_at,opened_at`);
    // Another play of his still reporting right now: this one earns nothing meanwhile.
    const busyElsewhere = mine.data.some((row) => row.item_id !== itemId && row.last_ping_at && now.getTime() - new Date(row.last_ping_at).getTime() < PING_GAP_LIMIT * 1000);
    const next = creditPing(mine.data.find((row) => row.item_id === itemId) || {}, { playing: body?.playing === true, duration, now, busyElsewhere });
    const saved = await rest(env, "night_required_progress?on_conflict=day,item_id,user_id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ day, item_id: itemId, user_id: userId, ...next }),
    });
    if (!saved.ok) return json({ error: "night_required_unavailable" }, 502, { route: ROUTE, request });
    return json({ item_id: itemId, watched_seconds: next.watched_seconds, completed_at: next.completed_at, duration_seconds: duration, needed_seconds: Number(completionSeconds(duration).toFixed(2)) }, 200, { route: ROUTE, request });
  } catch {
    return json({ error: "night_required_unavailable" }, 502, { route: ROUTE, request });
  }
}
