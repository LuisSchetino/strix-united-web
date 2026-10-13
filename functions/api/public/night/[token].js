import { json } from "../../../_lib/auth.js";
import { readPublicNight } from "../../../_lib/night-link.js";
import { nightDayOf } from "../../../../shared/night-link.js";

/**
 * The public night behind `/noite/<token>`: no session. It answers only for the address of a
 * night that is on (today's, derived from the date with the server key) and only while one of
 * its games has a line-up. Anything else is "not active": a wrong, old or emptied link all
 * look the same from outside.
 */
export async function onRequestGet({ request, env, params }) {
  const meta = { route: "public-night", request };
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "backend_configuration_missing" }, 503, meta);
  const day = await nightDayOf(env.SUPABASE_SERVICE_ROLE_KEY, String(params?.token || ""), new Date());
  if (!day) return json({ error: "night_link_inactive" }, 404, meta);
  let night = null;
  try { night = await readPublicNight(env, day); } catch { return json({ error: "night_unavailable" }, 502, meta); }
  if (!night) return json({ error: "night_link_inactive" }, 404, meta);
  return json(night, 200, meta);
}
