// Deliberately conservative: case/spacing only. Aliases and similar names are
// not sufficient evidence that two people are the same player.
export const playerNameKey = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export async function saveRosterPlayer(client, actorId, player, file, uploadPhoto) {
  const name = String(player.display_name || "").trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Informe o nome do jogador.");
  let archived = null;
  if (!player.id) {
    // Include archived rows: the unique identity is intentionally not removed
    // by soft deletion. A fresh read also avoids relying on stale UI cache.
    const { data, error } = await client.from("club_players").select("id,display_name,is_active,avatar_path");
    if (error) throw error;
    const matches = (data || []).filter(row => playerNameKey(row.display_name) === playerNameKey(name));
    if (matches.length > 1) throw new Error("Mais de um perfil corresponde a esse nome. Revise o elenco antes de continuar.");
    if (matches[0]?.is_active) throw new Error("Já existe um jogador ativo com esse nome. Use Editar no perfil existente.");
    archived = matches[0] || null;
  }
  const avatarPath = file ? await uploadPhoto(file) : player.avatar_path || archived?.avatar_path || null;
  const payload = {
    display_name: name, avatar_path: avatarPath, positions: player.positions || [],
    member_type: player.member_type || "complete",
    shirt_number: player.shirt_number === "" || player.shirt_number == null ? null : Number(player.shirt_number),
    trial_expires_at: player.trial_expires_at || null, is_active: player.is_active !== false,
    updated_by: actorId,
  };
  // Reactivation must not reset staff roles, source metadata, aliases, photos
  // or historical foreign keys. Only fields explicitly edited here are sent.
  if (player.structure_role !== undefined || (!player.id && !archived)) {
    payload.structure_role = ["jogador", "staff", "diretoria", "conselho", "manager"].includes(player.structure_role) ? player.structure_role : "jogador";
  }
  let query;
  if (player.id) query = client.from("club_players").update(payload).eq("id", player.id);
  else if (archived) query = client.from("club_players").update(payload).eq("id", archived.id).eq("is_active", false);
  else query = client.from("club_players").insert({ ...payload, created_by: actorId });
  const { data, error } = await query.select().single();
  if (error?.code === "23505") throw new Error("Esse nome já foi cadastrado. Atualize o elenco e abra o perfil existente.");
  if (error) throw error;
  if (!data) throw new Error("O perfil mudou durante o salvamento. Atualize o elenco e tente novamente.");
  return { player: data, reactivated: Boolean(archived) };
}
