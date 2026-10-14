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

const ZONE = "America/Sao_Paulo";
const activePlayers = (workspace) =>
  (workspace?.players || []).filter((player) => player.is_active !== false);
const when = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(date).replace(",", " ·");
};
const joined = (...parts) => parts.filter(Boolean).join(" · ");

/** The next match on the Agenda that has not kicked off and was not cancelled. */
export function nextCommandMatch(workspace = {}, now = new Date()) {
  return (workspace.agenda || [])
    .filter((match) => !["cancelled", "completed"].includes(match.status) && new Date(match.scheduled_at).getTime() > now.getTime())
    .sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at))[0] || null;
}

/**
 * Everything the search can open or do. Items open the thing itself (a match, a player,
 * a competition, a material), not just its page. `extras` are things only the shell knows:
 *   ownPlayerId — the roster entry of whoever is signed in;
 *   library     — published materials ({ id, title, category }) and the one to resume ({ id, title, t });
 *   copyLink(page, id) / signOut() / install() — shell actions, offered only when given.
 */
export function commandItems({ profile, workspace = {}, navigate, now = new Date(), extras = {} }) {
  const go = (id, target) => () => navigate?.(id, target ? { id: target } : undefined);
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
    meta: joined("Elenco", (player.positions || []).join(" · ")),
    icon: "squad",
    run: go("elenco", player.id),
  }));
  const matches = (workspace.matches || []).map((match) => ({
    id: `match-${match.id}`,
    label: `Strix ${match.strix_score} × ${match.opponent_score} ${match.opponent_name}`,
    meta: joined("Resultado", match.competition_name, when(match.played_at)),
    icon: "game",
    run: go("partidas", match.id),
  }));
  const agenda = (workspace.agenda || []).filter((item) => item.status !== "completed").map((item) => ({
    id: `agenda-${item.id}`,
    label: item.opponent_name,
    meta: joined("Agenda", item.competition_name, when(item.scheduled_at)),
    icon: "calendar",
    run: go("agenda", item.id),
  }));
  const editions = workspace.competitionEditions || [];
  const competitions = (workspace.competitions || []).map((item) => {
    const edition = editions.find((entry) => entry.competition_id === item.id && entry.status !== "historical")
      || editions.find((entry) => entry.competition_id === item.id);
    return {
      id: `competition-${item.id}`,
      label: item.name,
      meta: joined("Competição", item.organization, edition?.label),
      icon: "trophy",
      run: go("campeonatos", edition?.id),
    };
  });
  const materials = (extras.library?.items || []).map((item) => ({
    id: `material-${item.id}`,
    label: item.title,
    meta: joined("Biblioteca", item.category === "review" ? "Review" : "Jogada"),
    icon: "library",
    run: go("biblioteca", item.id),
  }));

  const actions = [];
  const next = nextCommandMatch(workspace, now);
  if (next) {
    actions.push({ id: "action-next-match", kind: "action", label: "Abrir próximo jogo", meta: joined("Ação", next.opponent_name, when(next.scheduled_at)), icon: "calendar", run: go("agenda", next.id) });
    if (extras.copyLink) {
      actions.push({ id: "action-next-match-link", kind: "action", label: "Copiar link do próximo jogo", meta: joined("Ação", next.opponent_name), icon: "link", run: () => extras.copyLink("agenda", next.id) });
    }
  }
  const latest = [...(workspace.matches || [])].sort((left, right) => new Date(right.played_at) - new Date(left.played_at))[0];
  if (latest) {
    actions.push({ id: "action-last-result", kind: "action", label: "Ver último resultado", meta: joined("Ação", `Strix ${latest.strix_score} × ${latest.opponent_score} ${latest.opponent_name}`), icon: "game", run: go("partidas", latest.id) });
  }
  if (extras.ownPlayerId) {
    actions.push({ id: "action-own-sheet", kind: "action", label: "Minha ficha", meta: "Ação · Elenco", icon: "squad", run: go("elenco", extras.ownPlayerId) });
  }
  const resume = extras.library?.resume;
  if (resume?.id) {
    actions.push({ id: "action-resume", kind: "action", label: "Continuar assistindo", meta: joined("Ação", resume.title), icon: "library", run: () => navigate?.("biblioteca", { id: resume.id, params: resume.t ? { t: resume.t } : undefined }) });
  }
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
  if (extras.tour) {
    actions.push({ id: "action-tour", kind: "action", label: "Ver o tour do site", meta: "Ação", icon: "live", run: extras.tour });
  }
  if (extras.install) {
    actions.push({ id: "action-install", kind: "action", label: "Instalar o Strix neste aparelho", meta: "Ação", icon: "plus", run: extras.install });
  }
  if (extras.report) {
    actions.push({ id: "action-report", kind: "action", label: "Reportar problema", meta: "Ação · algo deu errado no site", icon: "report", run: extras.report });
  }
  if (extras.signOut) {
    actions.push({ id: "action-sign-out", kind: "action", label: "Sair da conta", meta: "Ação", icon: "logout", run: extras.signOut });
  }
  return [...actions, ...pages, ...players, ...agenda, ...matches, ...competitions, ...materials];
}

const fold = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/** Every word typed must appear in the item, accents and case aside. */
export function filterCommandItems(items, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((item) => {
    const text = fold(`${item.label} ${item.meta}`);
    return words.every((word) => text.includes(word));
  });
}
