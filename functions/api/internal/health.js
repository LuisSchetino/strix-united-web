import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  if (!requireTier(session, "dev")) return json({ error: "insufficient_permission" }, 403);

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
    },
    checked_at: new Date().toISOString(),
  });
}
