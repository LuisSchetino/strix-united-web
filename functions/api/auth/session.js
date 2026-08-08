import { authenticateDiscordMember, json } from "../../_lib/auth.js";
import { syncDiscordMember } from "../../_lib/members.js";

export async function onRequestGet({ request, env }) {
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_PUBLISHABLE_KEY ||
    !env.DISCORD_BOT_TOKEN ||
    !env.DISCORD_GUILD_ID
  ) {
    return json({ error: "server_auth_not_configured" }, 503);
  }
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  const profile = {
    user_id: session.user.id,
    discord_id: session.discordId,
    display_name:
      session.member.nick ||
      session.member.user?.global_name ||
      session.member.user?.username ||
      "Membro",
    avatar_url: session.member.user?.avatar
      ? `https://cdn.discordapp.com/avatars/${session.discordId}/${session.member.user.avatar}.png?size=256`
      : null,
    access_tier: session.tier,
    is_active: true,
    last_discord_sync_at: new Date().toISOString(),
  };
  let syncWarning = "";
  try {
    const sync = await syncDiscordMember(session, env);
    syncWarning = sync.synced ? "" : sync.reason;
  } catch (error) {
    syncWarning = error.message || "member_sync_failed";
  }
  // Discord is the source of truth. Browser cache never grants a permission.
  return json({
    profile,
    permissions_checked_at: profile.last_discord_sync_at,
    sync_warning: syncWarning,
  });
}
