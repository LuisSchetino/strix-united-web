import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { FC27_CLUB_ID, FC27_PLATFORM } from "../../../shared/fc27-club.js";
import { probeEaSyncHealth } from "../../_lib/ea-sync-probe.js";

export async function onRequestGet({ request, env }) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  if (!requireTier(session, "dev")) return json({ error: "insufficient_permission" }, 403, { route: "health" });

  const ea = await probeEaSyncHealth(env);
  return json({
    status: "ok",
    project: "strix-united-fc27",
    environment: env.CF_PAGES_BRANCH === "main" ? "production" : "preview",
    deployment: {
      branch: env.CF_PAGES_BRANCH || null,
      commit_sha: env.CF_PAGES_COMMIT_SHA || null,
      url: env.CF_PAGES_URL || null,
    },
    services: {
      supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
      discord: Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_GUILD_ID && env.DISCORD_ROLE_TIER_MAP),
      service_role: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      competition_sync: Boolean(env.FC27_SYNC_SECRET),
      ea_sync: Boolean(env.EA_SYNC_API_URL && env.EA_SYNC_API_TOKEN),
    },
    ea_sync: {
      configured: ea.configured,
      host: ea.host,
      health: ea.health,
      reachable: ea.reachable,
      status: ea.status,
      contentType: ea.contentType,
      durationMs: ea.durationMs,
      service: ea.service?.name || "",
      clubId: ea.service?.clubId || FC27_CLUB_ID,
      platform: ea.service?.platform || FC27_PLATFORM,
      error: ea.error || "",
    },
    fc27: { clubId: FC27_CLUB_ID, platform: FC27_PLATFORM },
    checked_at: new Date().toISOString(),
  }, 200, { route: "health" });
}
