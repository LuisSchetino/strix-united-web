export async function syncDiscordMember(session, env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { synced: false, reason: "server_role_sync_not_configured" };
  }
  const member = session.member;
  const body = {
    user_id: session.user.id,
    discord_id: session.discordId,
    display_name:
      member.nick ||
      member.user?.global_name ||
      member.user?.username ||
      "Membro",
    discord_username: member.user?.username || null,
    avatar_url: member.user?.avatar
      ? `https://cdn.discordapp.com/avatars/${session.discordId}/${member.user.avatar}.png?size=256`
      : null,
    access_tier: session.tier,
    is_active: true,
    discord_role_ids: member.roles || [],
    last_discord_sync_at: new Date().toISOString(),
  };
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/team_members?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw new Error(`member_sync_${response.status}`);
  return { synced: true };
}
