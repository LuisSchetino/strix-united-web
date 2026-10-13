import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { CONTRACT_METADATA_KEY, CONTRACT_SEASON, PLAYER_LINK_NONE, hasSignedContract, readPlayerLink } from "../../../src/features/onboarding/contract-core.js";

function text(value) {
  return String(value ?? "").trim();
}

function identityOf(user) {
  const meta = user?.user_metadata || {};
  const discord = (user?.identities || []).find((item) => String(item?.provider).toLowerCase() === "discord");
  const data = discord?.identity_data || {};
  const handleRaw = text(meta.user_name || meta.preferred_username || data.user_name || data.preferred_username || data.name).split("#")[0];
  const handle = handleRaw ? `@${handleRaw.replace(/^@+/, "").toLocaleLowerCase("pt-BR")}` : "";
  const name = text(meta.custom_claims?.global_name || data.custom_claims?.global_name || meta.full_name || meta.name || data.full_name || data.name || handleRaw);
  const names = [name, handleRaw, handle.replace(/^@/, "")].map((item) => item.toLocaleLowerCase("pt-BR")).filter(Boolean);
  return { name: name.toLocaleUpperCase("pt-BR") || "MEMBRO STRIX", handle, names: [...new Set(names)] };
}

export async function onRequestGet({ request, env }) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  if (!requireTier(session, "diretoria")) return json({ error: "insufficient_permission" }, 403, { route: "contracts", request });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "backend_configuration_missing" }, 503, { route: "contracts", request });

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return json({ error: "contracts_unavailable" }, 502, { route: "contracts", request });
  const payload = await response.json();
  const users = Array.isArray(payload?.users) ? payload.users : Array.isArray(payload) ? payload : [];
  const contracts = users.flatMap((user) => {
    if (!hasSignedContract(user, CONTRACT_SEASON)) return [];
    const stored = user.user_metadata?.[CONTRACT_METADATA_KEY];
    return [{
      userId: user.id,
      // The roster entry the member declared as theirs, when the names alone do not say it.
      playerId: readPlayerLink(user) === PLAYER_LINK_NONE ? "" : readPlayerLink(user),
      identity: identityOf(user),
      contract: {
        season: stored.season,
        signedAt: stored.signedAt,
        version: stored.version,
        signature: stored.signature,
      },
    }];
  });
  // Accounts that have not signed this season: so "no contract" can say whose account it is.
  const unsigned = users.filter((user) => !hasSignedContract(user, CONTRACT_SEASON)).map((user) => ({
    userId: user.id,
    playerId: readPlayerLink(user) === PLAYER_LINK_NONE ? "" : readPlayerLink(user),
    identity: identityOf(user),
  }));
  return json({ contracts, unsigned }, 200, { route: "contracts", request });
}
