import {
  canAddManualMatch,
  canCreatePlayer,
  canManageAgenda,
  canManageCompetitions,
  canManageLibrary,
  canSearchEa,
  canUseDeveloperTools,
  canViewMedia,
  visibleNavItems,
} from "./access.js";

const activePlayers = (workspace) =>
  (workspace?.players || []).filter((player) => player.is_active !== false);

export function commandItems({ profile, workspace = {}, navigate }) {
  const go = (id) => () => navigate?.(id);
  const pages = [
    { id: "page-central", label: "Central do time", meta: "Página", icon: "live", run: go("central") },
    ...visibleNavItems(profile).map(([id, label, icon]) => ({
      id: `page-${id}`,
      label,
      meta: "Página",
      icon,
      run: go(id),
    })),
  ];
  const players = activePlayers(workspace).map((player) => ({
    id: `player-${player.id}`,
    label: player.display_name,
    meta: "Elenco",
    icon: "squad",
    run: go("elenco"),
  }));
  const matches = (workspace.matches || []).map((match) => ({
    id: `match-${match.id}`,
    label: match.opponent_name,
    meta: match.competition_name || "Partida",
    icon: "game",
    run: go("partidas"),
  }));
  const agenda = (workspace.agenda || []).map((item) => ({
    id: `agenda-${item.id}`,
    label: item.opponent_name,
    meta: item.competition_name || "Agenda",
    icon: "calendar",
    run: go("agenda"),
  }));
  const competitions = (workspace.competitions || []).map((item) => ({
    id: `competition-${item.id}`,
    label: item.name,
    meta: item.organization || "Competição",
    icon: "trophy",
    run: go("campeonatos"),
  }));
  const actions = [];
  if (canManageAgenda(profile)) {
    actions.push({ id: "action-agenda", kind: "action", label: "Novo jogo", meta: "Ação", icon: "plus", run: go("agenda") });
  }
  if (canCreatePlayer(profile)) {
    actions.push({ id: "action-player", kind: "action", label: "Adicionar jogador", meta: "Ação", icon: "squad", run: go("elenco") });
  }
  if (canSearchEa(profile)) {
    actions.push({ id: "action-ea", kind: "action", label: "Buscar na EA", meta: "Ação", icon: "search", run: go("partidas") });
  }
  if (canAddManualMatch(profile)) {
    actions.push({ id: "action-manual", kind: "action", label: "Adicionar partida manual", meta: "Ação", icon: "plus", run: go("partidas") });
  }
  if (canManageLibrary(profile)) {
    actions.push({ id: "action-library", kind: "action", label: "Adicionar material", meta: "Ação", icon: "library", run: go("biblioteca") });
  }
  if (canManageCompetitions(profile)) {
    actions.push({ id: "action-competition", kind: "action", label: "Adicionar campeonato", meta: "Ação Dev", icon: "trophy", run: go("campeonatos") });
  }
  if (canViewMedia(profile)) {
    actions.push({ id: "action-media", kind: "action", label: "Abrir Mídia", meta: "Ação Dev", icon: "media", run: go("midia") });
  }
  if (canUseDeveloperTools(profile)) {
    actions.push({ id: "action-dev", kind: "action", label: "Abrir Desenvolvedor", meta: "Ação Dev", icon: "details", run: go("desenvolvedor") });
  }
  return [...actions, ...pages, ...players, ...matches, ...agenda, ...competitions];
}

export function filterCommandItems(items, query) {
  const normalized = String(query || "").trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return items;
  return items.filter((item) =>
    `${item.label} ${item.meta}`.toLocaleLowerCase("pt-BR").includes(normalized),
  );
}
