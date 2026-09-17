import { canCreatePlayer, canEditPlayerIdentity, canEditPlayerNumber, canEditPlayerPhoto, permissionDenied } from "../../access.js";

// Deliberately conservative: case/spacing only. Aliases and similar names are
// not sufficient evidence that two people are the same player.
export const playerNameKey = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export function applyRosterWritePolicy(profile, player, { existing = null, file = null } = {}) {
  if (!existing?.id) {
    if (!canCreatePlayer(profile)) throw permissionDenied("Sem permissão para adicionar jogadores.");
    return { player, file };
  }
  if (!canEditPlayerIdentity(profile)) {
    throw permissionDenied("Sem permissão para editar este jogador.");
  }
  const next = { ...player };
  let nextFile = file;
  if (!canEditPlayerPhoto(profile)) {
    next.avatar_path = existing.avatar_path;
    nextFile = null;
  }
  if (!canEditPlayerNumber(profile)) {
    next.shirt_number = existing.shirt_number;
  }
  return { player: next, file: nextFile };
}

export async function saveRosterPlayer(client, actorId, player, file, uploadPhoto, options = {}) {
  let nextPlayer = player;
  let nextFile = file;
  if (options.profile) {
    const applied = applyRosterWritePolicy(options.profile, player, {
      existing: options.existing,
      file,
    });
    nextPlayer = applied.player;
    nextFile = applied.file;
  }
  const name = String(nextPlayer.display_name || "").trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Informe o nome do jogador.");
  let archived = null;
  if (!nextPlayer.id) {
    // Include archived rows: the unique identity is intentionally not removed
    // by soft deletion. A fresh read also avoids relying on stale UI cache.
    const { data, error } = await client.from("club_players").select("id,display_name,is_active,avatar_path,shirt_number");
    if (error) throw error;
    const matches = (data || []).filter(row => playerNameKey(row.display_name) === playerNameKey(name));
    if (matches.length > 1) throw new Error("Mais de um perfil corresponde a esse nome. Revise o elenco antes de continuar.");
    if (matches[0]?.is_active) throw new Error("Já existe um jogador ativo com esse nome. Use Editar no perfil existente.");
    archived = matches[0] || null;
  }
  const avatarPath = nextFile ? await uploadPhoto(nextFile) : nextPlayer.avatar_path || archived?.avatar_path || null;
  const payload = {
    display_name: name, avatar_path: avatarPath, positions: nextPlayer.positions || [],
    member_type: nextPlayer.member_type || "complete",
    shirt_number: nextPlayer.shirt_number === "" || nextPlayer.shirt_number == null ? null : Number(nextPlayer.shirt_number),
    trial_expires_at: nextPlayer.trial_expires_at || null, is_active: nextPlayer.is_active !== false,
    updated_by: actorId,
  };
  // Reactivation must not reset staff roles, source metadata, aliases, photos
  // or historical foreign keys. Only fields explicitly edited here are sent.
  if (nextPlayer.structure_role !== undefined || (!nextPlayer.id && !archived)) {
    payload.structure_role = ["jogador", "staff", "diretoria", "conselho", "manager"].includes(nextPlayer.structure_role) ? nextPlayer.structure_role : "jogador";
  }
  let query;
  if (nextPlayer.id) query = client.from("club_players").update(payload).eq("id", nextPlayer.id);
  else if (archived) query = client.from("club_players").update(payload).eq("id", archived.id).eq("is_active", false);
  else query = client.from("club_players").insert({ ...payload, created_by: actorId });
  const { data, error } = await query.select().single();
  if (error?.code === "23505") throw new Error("Esse nome já foi cadastrado. Atualize o elenco e abra o perfil existente.");
  if (error) throw error;
  if (!data) throw new Error("O perfil mudou durante o salvamento. Atualize o elenco e tente novamente.");
  return { player: data, reactivated: Boolean(archived) };
}
