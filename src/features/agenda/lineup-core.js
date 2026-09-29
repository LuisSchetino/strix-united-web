const normalize = (value) => String(value || "")
  .trim()
  .toLocaleLowerCase("pt-BR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export function resolveLineupRosterPlayer(entry, roster = []) {
  if (!entry) return null;
  const value = typeof entry === "object" ? entry.playerId ?? entry.player_id ?? entry.id ?? entry.name ?? entry.display_name : entry;
  const byId = roster.find((player) => String(player?.id) === String(value));
  if (byId) return byId;
  const key = normalize(typeof entry === "object" ? entry.name ?? entry.display_name : entry);
  if (!key) return null;
  return roster.find((player) => normalize(player?.display_name) === key) || null;
}

export function duplicateLineupPlayers(lineup = [], roster = []) {
  const used = new Map();
  const duplicates = [];
  (Array.isArray(lineup) ? lineup : []).forEach((entry, index) => {
    if (!entry) return;
    const player = resolveLineupRosterPlayer(entry, roster);
    const key = player?.id ? `id:${player.id}` : `name:${normalize(typeof entry === "object" ? entry.name ?? entry.display_name : entry)}`;
    if (!key || key === "name:") return;
    const first = used.get(key);
    if (first !== undefined) duplicates.push({ key, playerId: player?.id || null, name: player?.display_name || String(entry), firstSlot: first, duplicateSlot: index });
    else used.set(key, index);
  });
  return duplicates;
}

export function validateLineupUnique(lineup = [], roster = []) {
  const duplicates = duplicateLineupPlayers(lineup, roster);
  return {
    valid: duplicates.length === 0,
    duplicates,
    message: duplicates.length ? "Um jogador não pode ocupar mais de uma posição na mesma escalação." : "",
  };
}

export function availableLineupPlayers(lineup = [], roster = [], currentSlot = -1) {
  const used = new Set((Array.isArray(lineup) ? lineup : []).flatMap((entry, index) => {
    if (!entry || index === currentSlot) return [];
    const player = resolveLineupRosterPlayer(entry, roster);
    return player?.id ? [String(player.id)] : [`name:${normalize(typeof entry === "object" ? entry.name ?? entry.display_name : entry)}`];
  }));
  return (Array.isArray(roster) ? roster : []).filter((player) => !used.has(String(player?.id)) && !used.has(`name:${normalize(player?.display_name)}`));
}
