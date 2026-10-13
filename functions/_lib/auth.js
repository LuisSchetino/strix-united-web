import { apiRouteName, stampApiResponse } from "./api-sentinel.js";

const TIER_WEIGHT = Object.freeze({ teste: 10, player: 20, conselho: 30, diretoria: 40, dev: 50 });

function json(body, status = 200, meta = {}) {
  const route = meta.route || (meta.request ? apiRouteName(meta.request.url) : "api");
  return stampApiResponse(new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  }), meta.request, { route, requestId: meta.requestId });
}

function bearer(request) {
  const value = request.headers.get("authorization") || "";
  return /^Bearer\s+.+/i.test(value) ? value : "";
}

function discordId(user) {
  for (const identity of user?.identities || []) {
    if (String(identity?.provider).toLowerCase() !== "discord") continue;
    const source = identity.identity_data || identity;
    const value = String(source?.provider_id || source?.sub || identity?.provider_id || "").trim();
    if (/^\d{15,25}$/.test(value)) return value;
  }
  return "";
}

export function roleTier(roleIds, map = {}) {
  const ids = new Set((roleIds || []).map(String));
  return Object.entries(map)
    .filter(([roleId]) => ids.has(String(roleId)))
    .map(([, tier]) => String(tier).toLowerCase())
    .filter((tier) => TIER_WEIGHT[tier])
    .sort((left, right) => TIER_WEIGHT[right] - TIER_WEIGHT[left])[0] || "";
}

/**
 * Closes the member's row in the database when the site refuses them (left the server, lost the
 * role, on trial). The row is what the database trusts for reading and writing: without this a
 * refused account would keep whatever it had. Best effort; the refusal itself never waits on it.
 */
async function closeMemberRow(userId, env) {
  if (!userId || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/team_members?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({ is_active: false }),
    });
  } catch {
    // The refusal stands either way.
  }
}

// A member Discord has just confirmed, kept for a moment per session token. Reading one
// competition asks for a dozen pages within seconds and each request used to ask Discord again:
// enough to be rate-limited, and then the reading failed. Only routes that ask for it reuse the
// answer (never the sign-in itself), only a confirmed member is kept, and only for this long.
const CONFIRMED_FOR_MS = 60_000;
const confirmed = new Map();
function recall(token, reuseMs) {
  const entry = reuseMs > 0 ? confirmed.get(token) : null;
  if (!entry) return null;
  if (Date.now() - entry.at > Math.min(reuseMs, CONFIRMED_FOR_MS)) { confirmed.delete(token); return null; }
  return entry.session;
}
function remember(token, session) {
  if (confirmed.size > 200) confirmed.clear();
  confirmed.set(token, { at: Date.now(), session });
}

// The levels that enter the site. "teste" (a player on trial) is a Discord role and a roster
// status, not a pass: it identifies the player, it does not sign them in.
const ENTRY_TIERS = new Set(["player", "conselho", "diretoria", "dev"]);

export async function authenticateDiscordMember(request, env, { reuseMs = 0 } = {}) {
  const authorization = bearer(request);
  if (!authorization) return { error: json({ error: "authentication_required" }, 401, { request }) };
  const known = recall(authorization, reuseMs);
  if (known) return known;
  const supabaseHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization };
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: supabaseHeaders, cache: "no-store" });
  if (!userResponse.ok) return { error: json({ error: "invalid_session" }, 401, { request }) };
  const user = await userResponse.json();
  const memberId = discordId(user);
  if (!memberId) return { error: json({ error: "discord_identity_missing" }, 422, { request }) };

  const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${memberId}`, {
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, accept: "application/json" },
    cache: "no-store",
  });
  if (memberResponse.status === 404) {
    await closeMemberRow(user.id, env);
    return { error: json({ error: "not_in_team_server" }, 403, { request }) };
  }
  if (!memberResponse.ok) return { error: json({ error: "discord_lookup_unavailable" }, 503, { request }) };
  const member = await memberResponse.json();
  let roleMap = {};
  try { roleMap = JSON.parse(env.DISCORD_ROLE_TIER_MAP || "{}"); } catch {}
  const tier = roleTier(member.roles, roleMap);
  if (!tier) {
    await closeMemberRow(user.id, env);
    return { error: json({ error: "discord_role_unmapped" }, 403, { request }) };
  }
  if (!ENTRY_TIERS.has(tier)) {
    await closeMemberRow(user.id, env);
    return { error: json({ error: "trial_access_closed" }, 403, { request }) };
  }
  const session = { user, member, discordId: memberId, tier };
  remember(authorization, session);
  return session;
}

export function requireTier(session, minimum) {
  return TIER_WEIGHT[session.tier] >= TIER_WEIGHT[minimum];
}

export { json };
