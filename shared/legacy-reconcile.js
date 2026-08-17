export const normalizeLegacyName = (value) => String(value || "")
  .toLocaleLowerCase("pt-BR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export function activeLegacyRoster(rows = [], asOf = new Date()) {
  const timestamp = new Date(asOf).getTime();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const status = String(row?.status || "").toUpperCase();
    if (["ATIVO", "COMPLETE"].includes(status)) return true;
    if (status !== "TESTE" || !row?.expiresAt) return false;
    return new Date(`${row.expiresAt}T23:59:59Z`).getTime() >= timestamp;
  });
}

export function previewLegacyReconciliation(sourceRows = [], currentPlayers = [], asOf = new Date()) {
  const current = Array.isArray(currentPlayers) ? currentPlayers : [];
  const byOrder = new Map(current.filter((player) => player.source_system === "fc26" && player.source_order != null).map((player) => [Number(player.source_order), player]));
  const byName = new Map(current.map((player) => [normalizeLegacyName(player.display_name), player]));
  const active = activeLegacyRoster(sourceRows, asOf).map((row) => {
    const existing = byOrder.get(Number(row.ri)) || byName.get(normalizeLegacyName(row.n));
    return { source: row, existing: existing || null, action: existing ? "merge" : "create" };
  });
  const activeIds = new Set(active.map((item) => item.existing?.id).filter(Boolean));
  const deactivate = current.filter((player) => player.source_system === "fc26" && player.is_active && !activeIds.has(player.id));
  return { active, deactivate };
}
