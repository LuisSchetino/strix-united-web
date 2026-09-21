import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { FC27_CLUB_ID, FC27_PLATFORM } from "../../../shared/fc27-club.js";
import { probeEaSyncHealth, probeEaSyncMatches } from "../../_lib/ea-sync-probe.js";

export async function onRequestGet({ request, env }) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  if (!requireTier(session, "dev")) return json({ error: "insufficient_permission" }, 403, { route: "ea-sync-health" });

  const health = await probeEaSyncHealth(env);
  const matches = health.configured ? await probeEaSyncMatches(env) : {
    configured: false,
    host: "",
    reachable: false,
    status: 0,
    contentType: "",
    durationMs: 0,
    error: "missing_url",
  };

  return json({
    configured: health.configured,
    host: health.host,
    reachable: health.reachable,
    status: health.status,
    contentType: health.contentType,
    durationMs: health.durationMs,
    health: health.health,
    error: health.error || "",
    service: health.service || { clubId: FC27_CLUB_ID, platform: FC27_PLATFORM },
    matches: {
      reachable: matches.reachable,
      status: matches.status,
      contentType: matches.contentType,
      durationMs: matches.durationMs,
      html: Boolean(matches.html),
      ok: Boolean(matches.ok),
      matchCount: matches.matchCount || 0,
      error: matches.error || "",
    },
  }, 200, { route: "ea-sync-health" });
}
