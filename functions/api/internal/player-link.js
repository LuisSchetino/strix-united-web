import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { CONTRACT_SEASON, PLAYER_LINK_KEY, hasSignedContract, readPlayerLink } from "../../../src/features/onboarding/contract-core.js";

/**
 * The board ties a site account to a roster entry when the member got it wrong himself
 * (signed in under another name, or declared the wrong player). The link is the same one
 * "Este sou eu" writes: `fc27_player` in the account's metadata; the signed contract and the
 * watched videos follow it, because both are read through that link.
 * GET  → the accounts, with the entry each one is tied to.
 * POST → { userId, playerId } ties (an empty playerId unties). Diretoria and above.
 */
const ROUTE = "player-link";
const admin = (env, path, init = {}) => fetch(`${env.SUPABASE_URL}/auth/v1/admin/${path}`, {
  ...init,
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" },
  cache: "no-store",
});

async function guard(request, env) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return { error: session.error };
  if (!requireTier(session, "diretoria")) return { error: json({ error: "insufficient_permission" }, 403, { route: ROUTE, request }) };
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { error: json({ error: "backend_configuration_missing" }, 503, { route: ROUTE, request }) };
  return { session };
}

export async function onRequestGet({ request, env }) {
  const access = await guard(request, env);
  if (access.error) return access.error;
  const [users, members] = await Promise.all([
    admin(env, "users?per_page=200").then((response) => (response.ok ? response.json() : null)),
    fetch(`${env.SUPABASE_URL}/rest/v1/team_members?is_active=eq.true&select=user_id,display_name,access_tier`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }, cache: "no-store",
    }).then((response) => (response.ok ? response.json() : [])),
  ]);
  if (!users) return json({ error: "accounts_unavailable" }, 502, { route: ROUTE, request });
  const list = Array.isArray(users.users) ? users.users : Array.isArray(users) ? users : [];
  const linkOf = new Map(list.map((user) => [user.id, readPlayerLink(user)]));
  const signedOf = new Map(list.map((user) => [user.id, hasSignedContract(user, CONTRACT_SEASON)]));
  const accounts = members.map((member) => ({ userId: member.user_id, name: member.display_name || "Membro", tier: member.access_tier, playerId: linkOf.get(member.user_id) || "", signed: Boolean(signedOf.get(member.user_id)) }));
  return json({ accounts }, 200, { route: ROUTE, request });
}

export async function onRequestPost({ request, env }) {
  const access = await guard(request, env);
  if (access.error) return access.error;
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const userId = String(body?.userId || "");
  const playerId = String(body?.playerId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(userId) || playerId.length > 64) return json({ error: "invalid_link" }, 400, { route: ROUTE, request });
  // Read the account first: only this one key changes, everything else it holds (the contract) stays.
  const current = await admin(env, `users/${userId}`);
  if (!current.ok) return json({ error: "account_not_found" }, 404, { route: ROUTE, request });
  const user = await current.json();
  const saved = await admin(env, `users/${userId}`, { method: "PUT", body: JSON.stringify({ user_metadata: { ...(user.user_metadata || {}), [PLAYER_LINK_KEY]: playerId } }) });
  if (!saved.ok) return json({ error: "link_not_saved" }, 502, { route: ROUTE, request });
  return json({ userId, playerId }, 200, { route: ROUTE, request });
}
