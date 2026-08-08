const TIER_WEIGHT = Object.freeze({ teste: 10, player: 20, conselho: 30, diretoria: 40, dev: 50 });

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
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

function roleTier(roleIds, map = {}) {
  const ids = new Set((roleIds || []).map(String));
  return Object.entries(map)
    .filter(([roleId]) => ids.has(String(roleId)))
    .map(([, tier]) => String(tier).toLowerCase())
    .filter((tier) => TIER_WEIGHT[tier])
    .sort((left, right) => TIER_WEIGHT[right] - TIER_WEIGHT[left])[0] || "";
}

export async function authenticateDiscordMember(request, env) {
  const authorization = bearer(request);
  if (!authorization) return { error: json({ error: "authentication_required" }, 401) };
  const supabaseHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization };
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: supabaseHeaders, cache: "no-store" });
  if (!userResponse.ok) return { error: json({ error: "invalid_session" }, 401) };
  const user = await userResponse.json();
  const memberId = discordId(user);
  if (!memberId) return { error: json({ error: "discord_identity_missing" }, 422) };

  const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${memberId}`, {
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, accept: "application/json" },
    cache: "no-store",
  });
  if (memberResponse.status === 404) return { error: json({ error: "not_in_team_server" }, 403) };
  if (!memberResponse.ok) return { error: json({ error: "discord_lookup_unavailable" }, 503) };
  const member = await memberResponse.json();
  let roleMap = {};
  try { roleMap = JSON.parse(env.DISCORD_ROLE_TIER_MAP || "{}"); } catch {}
  const tier = roleTier(member.roles, roleMap);
  if (!tier) return { error: json({ error: "discord_role_unmapped" }, 403) };
  return { user, member, discordId: memberId, tier };
}

export function requireTier(session, minimum) {
  return TIER_WEIGHT[session.tier] >= TIER_WEIGHT[minimum];
}

export { json };
