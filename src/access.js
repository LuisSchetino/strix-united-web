// Single product ACL. Discord access_tier on team_members is the source of truth.
// Weights match functions/_lib/auth.js and private.has_minimum_tier.

export const TIER_WEIGHT = Object.freeze({
  teste: 10,
  player: 20,
  conselho: 30,
  diretoria: 40,
  dev: 50,
});

export const NAV_CATALOG = Object.freeze([
  ["agenda", "Agenda", "calendar"],
  ["partidas", "Partidas", "game"],
  ["elenco", "Elenco", "squad"],
  ["campeonatos", "Campeonatos", "trophy"],
  ["estatisticas", "Estatísticas", "stats"],
  ["analise", "Análise", "brain"],
  ["biblioteca", "Biblioteca", "library"],
  ["midia", "Mídia", "media"],
  ["desenvolvedor", "Desenvolvedor", "details"],
]);

const PAGE_IDS = new Set(["central", ...NAV_CATALOG.map(([id]) => id)]);
const PAGE_ALIASES = Object.freeze({
  home: "central",
  media: "midia",
  analysis: "analise",
  developer: "desenvolvedor",
  dev: "desenvolvedor",
});

export function accessTier(source) {
  if (!source) return "";
  if (typeof source === "string") return source;
  return source.access_tier || source.tier || "";
}

export function hasMinimumTier(source, required) {
  return (TIER_WEIGHT[accessTier(source)] || 0) >= (TIER_WEIGHT[required] || Number.POSITIVE_INFINITY);
}

export function isDev(source) {
  return accessTier(source) === "dev";
}

export function permissionDenied(message) {
  const error = new Error(message);
  error.code = "insufficient_permission";
  return error;
}

export function assertCan(source, check, message) {
  if (!check(source)) throw permissionDenied(message);
}

export const canViewCentral = () => true;
export const canViewAgenda = () => true;
export const canViewMatches = () => true;
export const canViewRoster = () => true;
export const canViewCompetitions = () => true;
export const canViewStatistics = () => true;
export const canViewLibrary = () => true;

export const canManageAgenda = (source) => hasMinimumTier(source, "diretoria");
export const canEditLineup = (source) => hasMinimumTier(source, "diretoria");
export const canManagePlayers = (source) => hasMinimumTier(source, "diretoria");
export const canCreatePlayer = (source) => hasMinimumTier(source, "diretoria");
export const canEditPlayerIdentity = (source) => hasMinimumTier(source, "diretoria");
export const canArchivePlayer = (source) => hasMinimumTier(source, "diretoria");
export const canEditPlayerPhoto = (source) => isDev(source);
export const canEditPlayerNumber = (source) => isDev(source);
export const canHardDeletePlayer = (source) => isDev(source);
export const canSearchEa = (source) => isDev(source);
export const canAddManualMatch = (source) => isDev(source);
export const canManageClubMatches = (source) => isDev(source);
export const canManageCompetitions = (source) => isDev(source);
export const canViewAnalysis = (source) => hasMinimumTier(source, "conselho");
export const canTrackLibrary = (source) => hasMinimumTier(source, "conselho");
export const canManageLibrary = (source) => hasMinimumTier(source, "diretoria");
export const canViewMedia = (source) => isDev(source);
export const canManageMedia = (source) => isDev(source);
export const canUseDeveloperTools = (source) => isDev(source);
export const canChangeAccessTiers = (source) => isDev(source);

const PAGE_VIEW = {
  central: canViewCentral,
  agenda: canViewAgenda,
  partidas: canViewMatches,
  elenco: canViewRoster,
  campeonatos: canViewCompetitions,
  estatisticas: canViewStatistics,
  analise: canViewAnalysis,
  biblioteca: canViewLibrary,
  midia: canViewMedia,
  desenvolvedor: canUseDeveloperTools,
};

export function normalizePageId(value) {
  const raw = String(value || "").trim().toLowerCase();
  const id = PAGE_ALIASES[raw] || raw;
  return PAGE_IDS.has(id) ? id : "";
}

export function canViewPage(source, id) {
  const page = normalizePageId(id);
  if (!page) return false;
  return (PAGE_VIEW[page] || (() => true))(source);
}

export function visibleNavItems(source) {
  return NAV_CATALOG.filter(([id]) => canViewPage(source, id));
}

const RESTRICTED_SEGMENTS = new Set([
  "functions",
  "internal",
  "auth",
  "cdn-cgi",
  "quality",
  "qa",
  "services",
  "supabase",
  "tools",
]);

export function firstLocationSegment(value = "") {
  return String(value || "")
    .replace(/^#\/?/, "")
    .split(/[/?#]/)
    .filter(Boolean)[0] || "";
}

export function resolveLocation(location = typeof window === "undefined" ? { pathname: "/", hash: "" } : window.location) {
  const hash = firstLocationSegment(location.hash);
  const path = firstLocationSegment(location.pathname);
  const fromHash = normalizePageId(hash);
  if (fromHash) return { kind: "page", page: fromHash, segment: hash };
  if (!path) return { kind: "page", page: "central", segment: "" };
  if (RESTRICTED_SEGMENTS.has(path) || path.startsWith("_")) {
    return { kind: "restricted", page: "", segment: path };
  }
  const fromPath = normalizePageId(path);
  if (fromPath) return { kind: "page", page: fromPath, segment: path };
  return { kind: "not-found", page: "", segment: path };
}

export function pageFromLocation(location = typeof window === "undefined" ? { pathname: "/", hash: "" } : window.location) {
  const resolved = resolveLocation(location);
  return resolved.page || "central";
}

export function locationForPage(id) {
  const page = normalizePageId(id) || "central";
  return page === "central" ? "/" : `/${page}`;
}

export function deniedPageCopy(id) {
  const page = normalizePageId(id);
  if (page === "analise") {
    return { title: "Análise", message: "A leitura estratégica está disponível para Conselho, Diretoria e Desenvolvimento." };
  }
  if (page === "midia") {
    return { title: "Mídia", message: "A central de conteúdo é exclusiva de Desenvolvimento." };
  }
  if (page === "desenvolvedor") {
    return { title: "Desenvolvedor", message: "Esta área é exclusiva para Desenvolvimento." };
  }
  return { title: "Área restrita", message: "Você não tem permissão para abrir esta página." };
}
