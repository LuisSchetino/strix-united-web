import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { FC27_CLUB_ID, FC27_PLATFORM } from "../../../shared/fc27-club.js";

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
      ea_sync: Boolean(env.EA_SYNC_API_URL && env.EA_SYNC_API_TOKEN),
    },
    ea_sync: await probeEaSync(env),
    fc27: { clubId: FC27_CLUB_ID, platform: FC27_PLATFORM },
    checked_at: new Date().toISOString(),
  });
}

function sanitizeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

async function probeEaSync(env) {
  if (!env.EA_SYNC_API_URL) {
    return {
      configured: false,
      host: "",
      health: "missing_url",
      clubId: FC27_CLUB_ID,
      platform: FC27_PLATFORM,
      service: "",
    };
  }
  const host = sanitizeHost(env.EA_SYNC_API_URL);
  let healthUrl;
  try {
    healthUrl = new URL("/health", env.EA_SYNC_API_URL);
  } catch {
    return {
      configured: true,
      host,
      health: "invalid_url",
      clubId: FC27_CLUB_ID,
      platform: FC27_PLATFORM,
      service: "",
    };
  }
  const started = Date.now();
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const contentType = String(response.headers.get("content-type") || "").split(";")[0];
    const text = await response.text();
    const html = /text\/html/i.test(contentType) || /^<!doctype html/i.test(text.trimStart());
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    return {
      configured: true,
      host,
      health: html ? "html" : (response.ok && payload?.ok ? "ok" : "error"),
      status: response.status,
      contentType: contentType || "unknown",
      durationMs: Date.now() - started,
      service: payload?.service || "",
      clubId: payload?.club_id || FC27_CLUB_ID,
      platform: payload?.platform || FC27_PLATFORM,
    };
  } catch (error) {
    return {
      configured: true,
      host,
      health: "unreachable",
      status: 0,
      contentType: "unknown",
      durationMs: Date.now() - started,
      clubId: FC27_CLUB_ID,
      platform: FC27_PLATFORM,
      message: String(error?.message || "unreachable").slice(0, 80),
    };
  }
}
