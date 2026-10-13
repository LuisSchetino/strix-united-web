import { authenticateDiscordMember, json, requireTier } from "../_lib/auth.js";
import { readPublicNight } from "../_lib/night-link.js";
import { nightPath, nightToken } from "../../shared/night-link.js";
import { saoPauloDay } from "../../src/features/agenda/agenda-time.js";

/**
 * Today's public "link da noite", for whoever builds the night (Diretoria and above). The
 * address is derived from the date with the server key: nothing is created or stored, asking
 * again gives the same link, and tomorrow's is another one. `active` says whether it answers
 * right now (it needs at least one line-up for today).
 */
export async function onRequestGet({ request, env }) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  if (!requireTier(session, "diretoria")) return json({ error: "insufficient_permission" }, 403, { route: "night-link", request });
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "backend_configuration_missing" }, 503, { route: "night-link", request });
  const day = saoPauloDay(new Date());
  const token = await nightToken(env.SUPABASE_SERVICE_ROLE_KEY, day);
  let active = false;
  try { active = Boolean(await readPublicNight(env, day)); } catch { active = false; }
  return json({ day, path: nightPath(token), active }, 200, { route: "night-link", request });
}
