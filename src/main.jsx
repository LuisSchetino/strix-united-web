import React, { StrictMode, Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import "./styles.css";
import "./fc27-polish.css";
import "./interaction-polish.css";
import "./field-polish.css";
import "./partidas.css";
import "./agenda.css";
import "./agenda-polish.css";
import "./formation-picker.css";
import "./agenda-final.css";
import "./agenda-sync.css";
import "./fc27-data.css";
import "./fc27-fixes.css";
import { nextAgendaSlot } from "./features/agenda/agenda-slots.js";
import { activeAgendaMatches, agendaHeroSelection, nextAgendaMatches, todayAgendaMatches } from "./features/agenda/agenda-time.js";
import { agendaStandingComparison } from "./features/agenda/agenda-standings.js";
import { resolveAgendaTeamIdentity, resolveTeamIdentity } from "./features/teams/team-identity.js";
import { notify, RollingLabel, ToastViewport } from "./ui/motion/motion.jsx";
import { ClubLogo } from "./ui/ClubLogo.jsx";
import { preloadClubLogos } from "./ui/provider-assets.js";
import { STRIX_BRAND } from "./brand.js";
import { RastroSignature } from "./ui/RastroBrand.jsx";
import "./features/squad-cards.css";
import "./fc27-brand.css";
import "./round-discovery.css";
import "./performance-polish.css";
import "./quality-polish.css";
import "./ui-bugfix.css";
import { saveRosterPlayer } from "./features/squad/player-save.js";
import { useDialog } from "./ui/useDialog.js";
import { CloseButton } from "./ui/CloseButton.jsx";
import { AccessDenied } from "./ui/AccessDenied.jsx";
import {
  NAV_CATALOG,
  canArchivePlayer,
  canCreatePlayer,
  canEditLineup,
  canEditPlayerNumber,
  canEditPlayerPhoto,
  canManageAgenda,
  canManageClubMatches,
  canManageCompetitions,
  canManageMedia,
  canManagePlayers,
  canUseDeveloperTools,
  canViewMedia,
  canViewPage,
  locationForPage,
  pageFromLocation,
  permissionDenied,
  visibleNavItems,
} from "./access.js";
import { commandItems, filterCommandItems } from "./command-palette.js";

const routeLoaders = {
  partidas: () => import("./features/matches/MatchesPage.jsx").then((module) => ({ default: module.MatchesPage })),
  campeonatos: () => import("./features/competitions/CompetitionsPage.jsx").then((module) => ({ default: module.CompetitionsPage })),
  estatisticas: () => import("./features/statistics/StatisticsPage.jsx"),
  analise: () => import("./features/analysis/AnalysisPage.jsx"),
  biblioteca: () => import("./features/library/LibraryPage.jsx").then((module) => ({ default: module.LibraryPage })),
  desenvolvedor: () => import("./features/developer/DeveloperPage.jsx").then((module) => ({ default: module.DeveloperPage })),
  midia: () => import("./features/media/MediaPage.jsx").then((module) => ({ default: module.MediaPage })),
  elencoTools: () => import("./features/squad/RosterTools.jsx").then((module) => ({ default: module.RosterTools })),
};
const preloadRoute = (id) => routeLoaders[id]?.();
const MediaPage = lazy(routeLoaders.midia);
const MatchesPage = lazy(routeLoaders.partidas);
const CompetitionsPage = lazy(routeLoaders.campeonatos);
const LibraryPage = lazy(routeLoaders.biblioteca);
const DeveloperPage = lazy(routeLoaders.desenvolvedor);
const StatisticsPage = lazy(routeLoaders.estatisticas);
const AnalysisPage = lazy(routeLoaders.analise);
const RosterTools = lazy(routeLoaders.elencoTools);

const icons = {
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "m6 6 12 12M18 6 6 18",
  search: "m20 20-4.2-4.2M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  live: "M4 4v16M8 8a5.7 5.7 0 0 1 0 8M12 5a9.8 9.8 0 0 1 0 14",
  calendar: "M5 4h14v17H5zM8 2v4M16 2v4M5 10h14",
  game: "M7 7h10l4 5-4 5H7l-4-5zM8 12h4M10 10v4",
  squad:
    "M16 20v-1.4a4.6 4.6 0 0 0-4.6-4.6H7.6A4.6 4.6 0 0 0 3 18.6V20M9.5 10.5A3.5 3.5 0 1 0 9.5 3",
  trophy:
    "M8 4h8v4a4 4 0 0 1-8 0zM8 6H5v1a4 4 0 0 0 3 4M16 6h3v1a4 4 0 0 1-3 4M12 12v5M8 21h8",
  stats: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  brain:
    "M9 4a3 3 0 0 0-5 2.5A3.5 3.5 0 0 0 5.5 13 3.5 3.5 0 0 0 9 18h1v-5H8M15 4a3 3 0 0 1 5 2.5A3.5 3.5 0 0 1 18.5 13 3.5 3.5 0 0 1 15 18h-1v-5h2",
  library:
    "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2zM8 8h8M8 12h6",
  media: "M4 6h11v12H4zM15 10l5-3v10l-5-3z",
  bell: "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9",
  logout: "M10 5H5v14h5M14 8l4 4-4 4M18 12H9",
  plus: "M12 5v14M5 12h14",
  arrow: "m9 18 6-6-6-6",
  upload: "M12 16V4m0 0-4 4m4-4 4 4M5 14v5h14v-5",
  edit: "M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 8.5l3 3",
  trash: "M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3",
  details: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",
  goal: "M4 7h16v10H4zM8 7V4h8v3M8 17v3h8v-3M12 10v4M10 12h4",
  assist: "M4 12h4l3-5 3 10 3-5h3",
  pass: "M4 18 20 6M15 6h5v5",
  shield: "M12 3 5 6v5c0 4.7 2.9 8.8 7 10 4.1-1.2 7-5.3 7-10V6z",
};
function Icon({ name, size = 20 }) {
  const path =
    icons[name] ||
    (name === "clock" ? "M12 7v5l3 2M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z" : "");
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

// Dialogs must live at the document root. Several pages animate their content,
// which otherwise turns a fixed backdrop into a clipped child of that page.
function ViewportDialog({ className = "modal-backdrop", children, onClose, ...props }) {
  const dialogRef = useDialog(onClose, { enabled: Boolean(onClose), lockScroll: false });
  useLayoutEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return createPortal(
    <div ref={dialogRef} className={className} {...props}>{children}</div>,
    document.body,
  );
}
const nav = NAV_CATALOG;
const games = [
  ["21:10", "Sinceridade FC", "Amistoso", "SF"],
  ["21:40", "SC Rebirth 2025", "Superliga Yeshua · Rodada 9", "SR"],
  ["22:10", "Old Skull", "Master League · Rodada 6", "OS"],
  ["22:40", "Wraith Gaming", "Amistoso", "WG"],
];
const EA_CLUB_ID = "15686";
const eaImportedKey = "strix-fc27-ea-imported-matches";

function asClubEntries(raw) {
  const clubs = raw?.clubs || raw?.club || raw?.clubData || {};
  return Array.isArray(clubs)
    ? clubs
    : Object.entries(clubs).map(([key, value]) => ({ ...value, _clubKey: key }));
}

function clubName(club, fallback) {
  return (
    club?.name ||
    club?.clubName ||
    club?.clubInfo?.name ||
    club?.details?.name ||
    fallback
  );
}

function clubGoals(club) {
  const value = club?.goals ?? club?.score ?? club?.clubGoals ?? 0;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function eaDate(raw) {
  const candidate = raw?.timestamp ?? raw?.matchTimestamp ?? raw?.date ?? raw?.time ?? raw?.createdAt;
  if (typeof candidate === "number") {
    return new Date(candidate < 1e12 ? candidate * 1000 : candidate);
  }
  const parsed = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

const readEaNumber = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return null;
};

const asEntries = (value) =>
  Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([key, item]) => ({ ...(item || {}), _eaKey: key }))
      : [];

function eaPlayerRows(raw) {
  const team = raw?.players?.[EA_CLUB_ID]
    || raw?.playerStats?.[EA_CLUB_ID]
    || raw?.details?.players?.[EA_CLUB_ID]
    || raw?.details?.[EA_CLUB_ID]?.players
    || raw?.players;
  return asEntries(team)
    .filter((player) => player && typeof player === "object")
    .map((player) => {
      const stats = player.stats || player.matchStats || player;
      // The EA payload uses lowercase names (passesmade, playername, etc.).
      // Keep the newer variants too because the PC bridge can return either shape.
      const made = readEaNumber(stats, ["passesmade", "passesMade", "passSuccess", "passes"]);
      const attempts = readEaNumber(stats, ["passattempts", "passesAttempted", "passAttempts", "passesAttempt"]);
      const goals = readEaNumber(stats, ["goals", "goal"] ) || 0;
      const assists = readEaNumber(stats, ["assists", "assist"]) || 0;
      const name = player.playername || player.name || player.playerName || player.personaName || player._eaKey;
      return {
        id: player.playerId || player.personaId || player._eaKey || name,
        eaName: name,
        name,
        position: player.pos || player.position || player.positionAbbr || "",
        rating: readEaNumber(stats, ["rating", "ratingAverage", "matchRating", "ratingValue"]),
        goals,
        assists,
        goalAssists: goals + assists,
        passesMade: made,
        passesAttempts: attempts,
        passes: made === null ? null : attempts ? `${made}/${attempts}` : made,
        shots: readEaNumber(stats, ["shots", "shotsOnTarget", "shotAttempts"]),
        tackles: readEaNumber(stats, ["tacklesmade", "tacklesMade", "tackles", "tackleSuccess"]),
        saves: readEaNumber(stats, ["saves", "goalkeeperSaves"]),
      };
    })
    .filter((player) => player.eaName && player.eaName !== EA_CLUB_ID);
}

function eaPerformance(raw, strix) {
  const stats = raw?.aggregateStats?.[EA_CLUB_ID]
    || raw?.aggregate?.[EA_CLUB_ID]
    || raw?.stats?.[EA_CLUB_ID]
    || strix?.stats
    || strix?.details
    || {};
  const players = eaPlayerRows(raw);
  const ratings = players.map((player) => player.rating).filter(Number.isFinite);
  const sum = (getter) => {
    const values = players.map(getter).filter(Number.isFinite);
    return values.length ? values.reduce((total, item) => total + item, 0) : null;
  };
  const directPasses = readEaNumber(stats, ["passesmade", "passesMade", "passes", "passSuccess"]);
  const directAttempts = readEaNumber(stats, ["passattempts", "passesAttempted", "passAttempts", "passesAttempt"]);
  const playerPasses = sum((player) => player.passesMade);
  const playerAttempts = sum((player) => player.passesAttempts);
  const passMade = directPasses ?? playerPasses;
  const passAttempts = directAttempts ?? playerAttempts;
  return {
    passes: passMade === null ? null : passAttempts ? `${passMade}/${passAttempts}` : passMade,
    shots: readEaNumber(stats, ["shots", "shotsOnTarget", "shotAttempts"]) ?? sum((player) => player.shots),
    tackles: readEaNumber(stats, ["tacklesmade", "tacklesMade", "tackles", "tackleSuccess"]) ?? sum((player) => player.tackles),
    goalkeeperSaves: readEaNumber(stats, ["goalkeeperSaves", "saves"]) ?? sum((player) => player.saves),
    averageRating: ratings.length ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1)) : null,
    players,
  };
}

// Older imports stored the first (incomplete) EA parsing result. Rebuild the
// display values from raw_ea when it exists, without changing the saved record.
function currentMatchPerformance(match) {
  const saved = match?.performance || match?.raw_ea?.performance || {};
  const raw = match?.raw_ea;
  if (!raw || typeof raw !== "object" || !Object.keys(raw).length) return saved;
  const clubs = asClubEntries(raw);
  const strix = clubs.find((club) => String(club?.clubId || club?.id || club?._clubKey) === EA_CLUB_ID) || clubs[0] || {};
  const fresh = eaPerformance(raw, strix);
  return {
    ...saved,
    ...Object.fromEntries(Object.entries(fresh).filter(([key, value]) => key === "players" ? value.length > 0 : value !== null && value !== undefined)),
  };
}

function normalizeEaMatch(raw, index) {
  const clubs = asClubEntries(raw);
  const strix =
    clubs.find((club) => String(club?.clubId || club?.id || club?._clubKey) === EA_CLUB_ID) ||
    clubs[0] ||
    {};
  const opponent = clubs.find((club) => club !== strix) || {};
  const date = eaDate(raw);
  return {
    id: String(raw?.matchId || raw?.id || raw?.gameId || `${date.getTime()}-${index}`),
    date: date.toISOString(),
    dateLabel: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    timeLabel: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    opponent: clubName(opponent, "Adversario EA"),
    strixScore: clubGoals(strix),
    opponentScore: clubGoals(opponent),
    competition: "AMISTOSO",
    performance: eaPerformance(raw, strix),
  };
}
function makeManualMatch(draft) {
  const date = new Date(`${draft.date}T${draft.time || "00:00"}:00`);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    id: `manual-${safeDate.getTime()}-${draft.opponent.trim().toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`,
    date: safeDate.toISOString(),
    dateLabel: safeDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    timeLabel: safeDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    opponent: draft.opponent.trim(),
    strixScore: Number(draft.strixScore),
    opponentScore: Number(draft.opponentScore),
    competition: draft.competition.trim() || "PARTIDA MANUAL",
  };
}
const legacyExamplePlayers = [
  ["SANTOZZ", "ATA", 86, 35, 11],
  ["SUCK", "ATA", 85, 65, 11],
  ["TAYLOR", "ALA", 81, 19, 36],
  ["OBEEN", "MC", 85, 40, 36],
  ["NUNES", "MC", 83, 60, 36],
  ["KESTOL", "ALA", 84, 81, 36],
  ["JÚLIO", "VOL", 84, 50, 53],
  ["YGO", "ZAG", 85, 27, 70],
  ["SAMPAIO", "ZAG", 85, 50, 74],
  ["CEDRAZ", "ZAG", 85, 73, 70],
  ["JOÃO", "GOL", 91, 50, 89],
];
const players = [];
function Crest({ small = false, priority = false }) {
  return <ClubLogo name="Strix United" url={STRIX_BRAND.logo} priority={priority} sizes={small ? "33px" : "(max-width:580px) 72px, 196px"} className={`crest ${small ? "crest-small" : ""}`}/>;
}
const logoCatalogKey = "strix-fc27-logo-catalog";
let browserSupabase = null;
async function getBrowserSupabase() {
  if (browserSupabase) return browserSupabase;
  const response = await fetch("/api/public-config", { cache: "no-store" });
  const config = await response.json();
  if (!response.ok || !config.url || !config.publishableKey) {
    throw new Error(config.error || "supabase_not_configured");
  }
  browserSupabase = createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserSupabase;
}
const normalizeTeamName = (name) =>
  String(name || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const matchingLogo = (logos, name) => {
  const normalized = normalizeTeamName(name);
  if (!normalized) return null;
  const exact = logos.find((logo) => normalizeTeamName(logo.canonical_name) === normalized);
  if (exact) return exact;
  const candidates = logos.filter((logo) => {
    const candidate = normalizeTeamName(logo.canonical_name);
    return normalized.length >= 3 && (candidate.startsWith(normalized) || normalized.startsWith(candidate));
  });
  return candidates.length === 1 ? candidates[0] : null;
};
function readLogoCatalog() {
  try {
    return JSON.parse(localStorage.getItem(logoCatalogKey) || "{}") || {};
  } catch {
    return {};
  }
}
function catalogLogo(name) {
  return readLogoCatalog()[normalizeTeamName(name)] || "";
}
function rememberLogo(name, logo) {
  if (!name || !logo) return;
  const catalog = readLogoCatalog();
  catalog[normalizeTeamName(name)] = logo;
  localStorage.setItem(logoCatalogKey, JSON.stringify(catalog));
}
function Avatar({ name, logo, kind = "logo", priority = false }) {
  const resolvedLogo = logo || catalogLogo(name);
  return <ClubLogo name={name} url={resolvedLogo} kind={kind} priority={priority} sizes="75px" className="avatar"/>;
}
function tierLabel(tier) {
  return (
    {
      dev: "Desenvolvedor",
      diretoria: "Diretoria",
      conselho: "Conselho",
      player: "Jogador",
      teste: "Teste",
    }[tier] || "Membro"
  );
}
function useTeamAuth() {
  const [state, setState] = useState({
    loading: true,
    client: null,
    session: null,
    profile: null,
    error: "",
    syncWarning: "",
  });
  useEffect(() => {
    let alive = true;
    let subscription;
    const verify = async (session, client) => {
      if (!session) {
        if (alive)
          setState({
            loading: false,
            client,
            session: null,
            profile: null,
            error: "",
            syncWarning: "",
          });
        return;
      }
      if (alive)
        setState((current) => ({ ...current, loading: true, client, session }));
      try {
        const response = await fetch("/api/auth/session", {
          headers: { authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "access_check_failed");
        if (alive)
          setState({
            loading: false,
            client,
            session,
            profile: payload.profile,
            error: "",
            syncWarning: payload.sync_warning || "",
          });
      } catch (error) {
        if (alive)
          setState({
            loading: false,
            client,
            session: null,
            profile: null,
            error: error.message || "access_check_failed",
            syncWarning: "",
          });
      }
    };
    getBrowserSupabase()
      .then(async (client) => {
        const {
          data: { session },
        } = await client.auth.getSession();
        await verify(session, client);
        ({
          data: { subscription },
        } = client.auth.onAuthStateChange((_event, nextSession) => {
          void verify(nextSession, client);
        }));
      })
      .catch((error) => {
        if (alive)
          setState({
            loading: false,
            client: null,
            session: null,
            profile: null,
            error: error.message || "auth_setup_failed",
            syncWarning: "",
          });
      });
    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, []);
  const signIn = async () => {
    const client = state.client || (await getBrowserSupabase());
    const { error } = await client.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
  };
  return {
    ...state,
    signIn,
    signOut: async () => state.client?.auth.signOut(),
  };
}

const toLocalDateTime = (date, time) => {
  const raw = String(date || "").trim();
  const isoDate = /^\d{2}\/\d{2}\/\d{4}$/.test(raw)
    ? raw.split("/").reverse().join("-")
    : raw || new Date().toISOString().slice(0, 10);
  // Time inputs can be rendered as 21:10, 21h10 or 21H10 depending on the
  // browser/locale. Postgres only accepts a real ISO clock here.
  const clock = String(time || "21:10").match(/\d+/g) || [];
  const hour = String(Math.max(0, Math.min(23, Number(clock[0] || 21)))).padStart(2, "0");
  const minute = String(Math.max(0, Math.min(59, Number(clock[1] || 10)))).padStart(2, "0");
  return `${isoDate}T${hour}:${minute}:00-03:00`;
};
const datePart = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
const timePart = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
const initialsOf = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const safeAssetName = (name) =>
  String(name || "asset")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "asset";

function useFc27Workspace(client, profile) {
  const [state, setState] = useState({
    loading: true,
    agenda: [],
    logos: [],
    players: [],
    aliases: [],
    matches: [],
    competitions: [],
    competitionEditions: [],
    competitionSources: [],
    competitionFixtures: [],
    competitionTeams: [],
    systemFlags: [],
    nightRelated: [],
    schemaPending: false,
    error: "",
  });
  const refreshInFlight = useRef(null);
  const refreshQueued = useRef(false);
  const realtimeRefreshTimer = useRef(null);
  const assetUrl = (path) =>
    path ? client?.storage.from("fc27-team-assets").getPublicUrl(path).data.publicUrl || "" : "";
  const refresh = async () => {
    if (!client || !profile?.user_id) return;
    if (refreshInFlight.current) {
      refreshQueued.current = true;
      return refreshInFlight.current;
    }
    const task = (async () => {
    const [agendaResult, logosResult, playersResult, aliasesResult, matchesResult, competitionsResult, editionsResult, sourcesResult, fixturesResult, teamsResult, flagsResult, nightRelatedResult] = await Promise.all([
      client.from("agenda_matches").select("*, opponent_logos!agenda_matches_opponent_logo_id_fkey(*)").order("scheduled_at", { ascending: true }),
      client.from("opponent_logos").select("*").order("canonical_name"),
      client.from("club_players").select("*").order("display_name"),
      client.from("club_player_aliases").select("*, club_players(display_name)").order("ea_name"),
      client.from("club_matches").select("*, opponent_logos(*), agenda_matches(id, opponent_name, scheduled_at)").order("played_at", { ascending: false }),
      client.from("competitions").select("*").order("updated_at", { ascending: false }),
      client.from("competition_editions").select("*").order("updated_at", { ascending: false }),
      client.from("competition_sources").select("*").order("last_synced_at", { ascending: false }),
      client.from("competition_fixtures").select("*").order("scheduled_at", { ascending: true }),
      client.from("competition_teams").select("*").order("name"),
      client.from("system_flags").select("*").order("key"),
      client.from("night_related").select("*").order("night_date", { ascending: false }),
    ]);
    const failure = [agendaResult, logosResult, playersResult, aliasesResult, matchesResult].find((result) => result.error)?.error;
    if (failure) {
      setState((current) => ({
        ...current,
        loading: false,
        error: failure.message || "Não foi possível sincronizar a base FC 27.",
      }));
      return;
    }
    const optionalResults = [competitionsResult, editionsResult, sourcesResult, fixturesResult, teamsResult, flagsResult, nightRelatedResult];
    const isMissingOptionalSchema = (error) => ["42P01", "PGRST205"].includes(error?.code);
    const optionalFailure = optionalResults.find((result) => result.error && !isMissingOptionalSchema(result.error))?.error;
    const publicLogos = (logosResult.data || []).map((logo) => ({
      ...logo,
      public_url: logo.storage_path ? assetUrl(logo.storage_path) : "",
    }));
    const historyIdentities = (matchesResult.data || []).map((match) => ({
      name: match.opponent_name,
      logo: match.opponent_logos?.storage_path ? assetUrl(match.opponent_logos.storage_path) : "",
    }));
    const resolvedMatches = (matchesResult.data || []).map((match) => {
      const identity = resolveTeamIdentity({
        name: match.opponent_name,
        directLogo: match.opponent_logos?.storage_path ? assetUrl(match.opponent_logos.storage_path) : "",
        teams: teamsResult.data || [],
        logos: publicLogos,
        history: historyIdentities,
      });
      return {
        ...match,
        resolved_opponent_logo_url: identity.logo,
        identity_source: identity.source,
      };
    });
    setState({
      loading: false,
      agenda: (agendaResult.data || []).map((match) => {
        const identity = resolveAgendaTeamIdentity(match, {
          fixtures: fixturesResult.data || [],
          teams: teamsResult.data || [],
          logos: publicLogos,
          history: historyIdentities,
        });
        return {
          ...match,
          opponent_team_id: identity.id || match.opponent_team_id || null,
          opponent_name: identity.name || match.opponent_name,
          opponent_abbreviation: identity.abbreviation,
          resolved_opponent_logo_url: identity.logo,
          identity_source: identity.source,
        };
      }),
      logos: logosResult.data || [],
      players: playersResult.data || [],
      aliases: aliasesResult.data || [],
      matches: resolvedMatches,
      competitions: competitionsResult.data || [],
      competitionEditions: editionsResult.data || [],
      competitionSources: sourcesResult.data || [],
      competitionFixtures: fixturesResult.data || [],
      competitionTeams: teamsResult.data || [],
      systemFlags: flagsResult.data || [],
      nightRelated: nightRelatedResult.error && isMissingOptionalSchema(nightRelatedResult.error) ? [] : (nightRelatedResult.data || []),
      schemaPending: optionalResults.some((result) => isMissingOptionalSchema(result.error)),
      error: optionalFailure?.message || "",
    });
    })();
    refreshInFlight.current = task;
    try { await task; }
    finally {
      if (refreshInFlight.current === task) refreshInFlight.current = null;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        void refresh();
      }
    }
  };
  const scheduleRealtimeRefresh = () => {
    clearTimeout(realtimeRefreshTimer.current);
    realtimeRefreshTimer.current = setTimeout(() => { void refresh(); }, 120);
  };
  useEffect(() => {
    if (!client || !profile?.user_id) return undefined;
    void refresh();
    const channel = client
      .channel("fc27-team-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda_matches" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "opponent_logos" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_players" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_player_aliases" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_matches" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competitions" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_editions" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_sources" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_fixtures" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_teams" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "system_flags" }, scheduleRealtimeRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "night_related" }, scheduleRealtimeRefresh)
      .subscribe();
    return () => {
      clearTimeout(realtimeRefreshTimer.current);
      client.removeChannel(channel);
    };
  }, [client, profile?.user_id]);

  const resolveLogo = async (name, file) => {
    const existing = matchingLogo(state.logos, name);
    if (!file) return existing?.id || null;
    const path = `opponents/${profile.user_id}/${crypto.randomUUID()}-${safeAssetName(file.name)}`;
    const { error: uploadError } = await client.storage
      .from("fc27-team-assets")
      .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type || undefined });
    if (uploadError) throw uploadError;
    const result = existing
      ? await client.from("opponent_logos").update({ canonical_name: name.trim(), storage_path: path }).eq("id", existing.id).select("id").single()
      : await client.from("opponent_logos").insert({ canonical_name: name.trim(), storage_path: path, created_by: profile.user_id }).select("id").single();
    const { data, error } = result;
    if (error) throw error;
    return data.id;
  };
  const agendaPayload = async (item, extra = {}) => {
    const competition = state.competitions.find((entry) => normalizeTeamName(entry.name) === normalizeTeamName(item.competition));
    const edition = state.competitionEditions.find((entry) => entry.competition_id === competition?.id && entry.status === "active");
    return {
      opponent_name: item.opponent.trim(),
      opponent_logo_id: await resolveLogo(item.opponent, item.logoFile),
      competition_name: item.competition || "AMISTOSO",
      competition_id: competition?.id || null,
      competition_edition_id: edition?.id || null,
      scheduled_at: toLocalDateTime(item.date, item.time),
      status: item.cancelled ? "cancelled" : item.status === "EM BREVE" ? "live" : "scheduled",
      source: "manual",
      lineup: item.lineup || [],
      updated_by: profile.user_id,
      ...extra,
    };
  };
  const saveAgenda = async (payload, mode, existing) => {
    if (!canManageAgenda(profile)) throw permissionDenied("Sem permissão para alterar a Agenda.");
    const entries = Array.isArray(payload) ? payload : [payload];
    if (existing) {
      const data = await agendaPayload(entries[0], mode === "swap" ? {
        previous_opponent_name: existing.opponent_name,
        previous_opponent_logo_id: existing.opponent_logo_id,
      } : {});
      const { error } = await client.from("agenda_matches").update(data).eq("id", existing.id);
      if (error) throw error;
    } else {
      const rows = await Promise.all(entries.map(async (item) => ({
        ...(await agendaPayload(item)),
        created_by: profile.user_id,
      })));
      const { error } = await client.from("agenda_matches").insert(rows);
      if (error) throw error;
    }
    await refresh();
  };
  const setAgendaStatus = async (id, status) => {
    if (!canManageAgenda(profile)) throw permissionDenied("Sem permissão para alterar a Agenda.");
    const update = { status, updated_by: profile.user_id };
    if (status === "cancelled") update.cancelled_at = new Date().toISOString();
    const { error } = await client.from("agenda_matches").update(update).eq("id", id);
    if (error) throw error;
    await refresh();
  };
  const removeAgenda = async (id) => {
    if (!canManageAgenda(profile)) throw permissionDenied("Sem permissão para alterar a Agenda.");
    const match = state.agenda.find((item) => item.id === id);
    if (match && match.source !== "manual" && !canUseDeveloperTools(profile)) {
      return setAgendaStatus(id, "cancelled");
    }
    const { error } = await client.from("agenda_matches").delete().eq("id", id);
    if (error) throw error;
    await refresh();
  };
  const upsertClubMatch = async (match, source = "manual", shouldRefresh = true) => {
    if (!canManageClubMatches(profile)) throw permissionDenied("A gestão do histórico de partidas é exclusiva de Desenvolvimento.");
    const existing = match.dbId
      ? state.matches.find((item) => item.id === match.dbId)
      : state.matches.find((item) => item.external_match_id && item.external_match_id === String(match.id));
    const payload = {
      external_match_id: source === "manual" ? null : String(match.id),
      source,
      played_at: match.date,
      opponent_name: match.opponent.trim(),
      opponent_logo_id: await resolveLogo(match.opponent, match.logoFile),
      competition_name: match.competition || "AMISTOSO",
      strix_score: Number(match.strixScore) || 0,
      opponent_score: Number(match.opponentScore) || 0,
      agenda_match_id: match.agendaId || null,
      raw_ea: match.raw || {},
      performance: match.performance || {},
      competition_id: match.competitionId || null,
      competition_edition_id: match.competitionEditionId || null,
      updated_by: profile.user_id,
    };
    const result = existing
      ? await client.from("club_matches").update(payload).eq("id", existing.id).select().single()
      : await client.from("club_matches").insert({ ...payload, created_by: profile.user_id }).select().single();
    if (result.error) throw result.error;
    if (match.agendaId) {
      const { error: agendaError } = await client
        .from("agenda_matches")
        .update({ status: "completed", updated_by: profile.user_id })
        .eq("id", match.agendaId);
      if (agendaError) throw agendaError;
    }
    if (shouldRefresh) await refresh();
    return result.data;
  };
  const savePlayerAliases = async (aliases, shouldRefresh = true) => {
    if (!canManagePlayers(profile)) throw permissionDenied("Sem permissão para gerenciar aliases.");
    const rows = aliases
      .filter((item) => item.eaName && item.playerId)
      .map((item) => ({ ea_name: item.eaName.trim(), player_id: item.playerId, updated_by: profile.user_id }));
    if (!rows.length) return;
    const normalizeAlias = (name) => String(name || "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
    const existingByName = new Map(state.aliases.map((item) => [item.normalized_name, item]));
    const inserts = [];
    const updates = [];
    for (const row of rows) {
      const existing = existingByName.get(normalizeAlias(row.ea_name));
      if (existing) updates.push(client.from("club_player_aliases").update(row).eq("id", existing.id));
      else inserts.push({ ...row, created_by: profile.user_id });
    }
    const results = await Promise.all([
      ...(inserts.length ? [client.from("club_player_aliases").insert(inserts)] : []),
      ...updates,
    ]);
    const failure = results.find((result) => result.error)?.error;
    if (failure) throw failure;
    if (shouldRefresh) await refresh();
  };
  const removeClubMatch = async (id) => {
    if (!canManageClubMatches(profile)) throw permissionDenied("A gestão do histórico de partidas é exclusiva de Desenvolvimento.");
    const { error } = await client.from("club_matches").delete().eq("id", id);
    if (error) throw error;
    await refresh();
  };
  const savePlayer = async (player, file) => {
    const existing = player.id ? (state.players || []).find((item) => item.id === player.id) : null;
    const result = await saveRosterPlayer(client, profile.user_id, player, file, async (file) => {
      const path = `players/${profile.user_id}/${crypto.randomUUID()}-${safeAssetName(file.name)}`;
      const { error: uploadError } = await client.storage.from("fc27-team-assets").upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;
      return path;
    }, { profile, existing });
    await refresh();
    return result;
  };
  const removePlayer = async (id) => {
    if (!canArchivePlayer(profile)) throw permissionDenied("Sem permissão para arquivar jogadores.");
    const { error } = await client.from("club_players").update({ is_active: false, updated_by: profile.user_id }).eq("id", id);
    if (error) throw error;
    await refresh();
  };
  const importLegacyRoster = async (entries = []) => {
    if (!canUseDeveloperTools(profile)) throw permissionDenied("A importação técnica de elenco é exclusiva de Desenvolvimento.");
    const normalize = (value) => String(value || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const { data: remotePlayers, error: playersError } = await client.from("club_players").select("*");
    if (playersError) throw playersError;
    const bySource = new Map((remotePlayers || []).filter((player) => player.source_system === "fc26" && player.source_player_id).map((player) => [player.source_player_id, player]));
    const byName = new Map((remotePlayers || []).map((player) => [normalize(player.display_name), player]));
    const aliasTargets = [];
    let created = 0;
    let merged = 0;
    for (const entry of entries) {
      const existing = bySource.get(entry.sourcePlayerId) || byName.get(normalize(entry.displayName));
      const positions = [...new Set([...(existing?.positions || []), ...(entry.positions || [])])];
      const payload = {
        display_name: existing?.display_name || entry.displayName,
        positions,
        member_type: existing?.member_type || entry.memberType || "elenco",
        is_active: true,
        source_system: "fc26",
        source_player_id: entry.sourcePlayerId,
        source_order: entry.sourceOrder,
        external_avatar_url: existing?.external_avatar_url || entry.externalAvatarUrl || null,
        updated_by: profile.user_id,
      };
      const result = existing
        ? await client.from("club_players").update(payload).eq("id", existing.id).select().single()
        : await client.from("club_players").insert({ ...payload, created_by: profile.user_id }).select().single();
      if (result.error) throw result.error;
      existing ? merged += 1 : created += 1;
      bySource.set(entry.sourcePlayerId, result.data);
      byName.set(normalize(result.data.display_name), result.data);
      for (const alias of entry.aliases || []) aliasTargets.push({ eaName: alias, playerId: result.data.id });
    }
    const { data: remoteAliases, error: aliasesError } = await client.from("club_player_aliases").select("*");
    if (aliasesError) throw aliasesError;
    const aliasesByName = new Map((remoteAliases || []).map((alias) => [normalize(alias.ea_name), alias]));
    const inserts = [];
    const conflicts = [];
    for (const target of aliasTargets) {
      const key = normalize(target.eaName);
      const existing = aliasesByName.get(key);
      if (existing && existing.player_id !== target.playerId) {
        conflicts.push(target.eaName);
        continue;
      }
      if (!existing) {
        const row = { ea_name: target.eaName, player_id: target.playerId, created_by: profile.user_id, updated_by: profile.user_id };
        inserts.push(row);
        aliasesByName.set(key, row);
      }
    }
    if (inserts.length) {
      const { error: insertAliasesError } = await client.from("club_player_aliases").insert(inserts);
      if (insertAliasesError) throw insertAliasesError;
    }
    await refresh();
    return { created, merged, aliases: inserts.length, conflicts };
  };
  const removePlayerAlias = async (id) => {
    const { error } = await client.from("club_player_aliases").delete().eq("id", id);
    if (error) throw error;
    await refresh();
  };
  return {
    ...state,
    assetUrl,
    refresh,
    saveAgenda,
    setAgendaStatus,
    removeAgenda,
    upsertClubMatch,
    removeClubMatch,
    savePlayerAliases,
    upsertClubMatches: async (matches, source = "ea_api") => {
      try {
        for (const match of matches) await upsertClubMatch(match, match.importSource || source, false);
      } finally {
        await refresh();
      }
    },
    saveNightRelated: async (nightDate, playerIds) => {
      if (!canManageMedia(profile)) throw permissionDenied("Relacionados da noite são exclusivos de Desenvolvimento.");
      const ids = [...new Set((playerIds || []).map((id) => String(id || "")).filter(Boolean))];
      const existing = (state.nightRelated || []).find((row) => String(row.night_date).slice(0, 10) === nightDate);
      const payload = {
        night_date: nightDate,
        player_ids: ids,
        updated_by: profile.user_id,
      };
      const result = existing
        ? await client.from("night_related").update(payload).eq("night_date", nightDate)
        : await client.from("night_related").insert({ ...payload, created_by: profile.user_id });
      if (result.error) throw result.error;
      await refresh();
    },
    savePlayer,
    saveStructureRole: async (playerId, role) => {
      const nextRole = ["jogador", "staff", "diretoria", "conselho", "manager"].includes(role) ? role : "jogador";
      const { error } = await client.from("club_players").update({
        structure_role: nextRole,
        updated_by: profile.user_id,
      }).eq("id", playerId);
      if (error) throw error;
      setState((current) => ({
        ...current,
        players: (current.players || []).map((player) => (
          String(player.id) === String(playerId) ? { ...player, structure_role: nextRole } : player
        )),
      }));
    },
    removePlayer,
    importLegacyRoster,
    removePlayerAlias,
  };
}
function LoginScreen({ loading, error, onLogin }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const login = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      await onLogin();
    } catch (loginError) {
      setMessage(loginError.message || "Não foi possível iniciar o Discord.");
      setSubmitting(false);
    }
  };
  return (
    <main className="login-screen">
      <div className="login-stadium login-stadium-left" />
      <div className="login-stadium login-stadium-right" />
      <section className="login-card page-enter" aria-busy={loading}>
        <Crest priority />
        <span>STRIX UNITED · FC 27</span>
        <h1>Seu vestiário começa aqui.</h1>
        <p>
          Entre com seu Discord para liberar a experiência certa para o seu
          cargo no time.
        </p>
        <button
          className="discord-login"
          type="button"
          onClick={login}
          disabled={loading || submitting}
        >
          <img className="discord-login-icon" src="/discord-mark.svg" alt="" />
          {loading
            ? "VERIFICANDO SESSÃO"
            : submitting
              ? "ABRINDO DISCORD"
              : "ENTRAR COM DISCORD"}
        </button>
        {(error || message) && (
          <small className="login-error">{message || error}</small>
        )}
        <small className="login-note">
          Seu acesso é conferido com o servidor do Strix em cada entrada.
        </small>
      </section>
    </main>
  );
}
function Sidebar({
  active,
  navigate,
  compact,
  setCompact,
  mobileOpen,
  setMobileOpen,
  profile,
  signOut,
}) {
  const warmRoute = (id) => () => { void preloadRoute(id); };
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width:900px)").matches);
  const collapsed = compact && !mobile;
  const drawerRef = useDialog(() => setMobileOpen(false), { enabled: mobile && mobileOpen });
  useEffect(() => {
    const query = window.matchMedia("(max-width:900px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <aside
      ref={drawerRef}
      className={`sidebar ${collapsed ? "is-compact" : ""} ${mobileOpen ? "mobile-open" : ""}`}
      inert={mobile && !mobileOpen ? true : undefined}
    >
      <div className="brand">
        <Crest small />
        <span>
          STRIX
          <br />
          <b>FC 27</b>
        </span>
        <button
          className="collapse"
          onClick={() => setCompact(!compact)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
        >
          ‹
        </button>
        <button
          className="mobile-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="menu-group">
        <p>Central</p>
        <button
          className={active === "central" ? "active" : ""}
          aria-current={active === "central" ? "page" : undefined}
          aria-label="Central do time"
          data-tooltip={collapsed ? "Central do time" : undefined}
          onClick={() => navigate("central")}
        >
          <Icon name="live" />
          <span>Central do time</span>
        </button>
      </div>
      <div className="menu-group">
        <p>Time</p>
        {visibleNavItems(profile).map(([id, label, icon]) => (
          <button
            key={id}
            className={active === id ? "active" : ""}
            aria-current={active === id ? "page" : undefined}
            aria-label={label}
            data-tooltip={collapsed ? label : undefined}
            onClick={() => navigate(id)}
            onPointerEnter={warmRoute(id)}
            onFocus={warmRoute(id)}
            onTouchStart={warmRoute(id)}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <RastroSignature compact={collapsed} />
      {collapsed ? <div className="sidebar-compact-account"><button type="button" className="sidebar-signout" onClick={signOut} aria-label="Sair da conta" data-tooltip="Sair da conta"><Icon name="logout" size={19}/></button></div> : <div className="sidebar-user">
        <Avatar name={profile.display_name} logo={profile.avatar_url} kind="photo" />
        <span>
          <b>{profile.display_name}</b>
          <small>{tierLabel(profile.access_tier)}</small>
        </span>
        <button type="button" className="sidebar-signout" onClick={signOut} title="Sair da conta" aria-label="Sair da conta">
          <Icon name="logout" size={15} />
        </button>
      </div>}
    </aside>
  );
}
function GameRow({ game, index }) {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem("strix-fc27-agenda") || "[]");
  } catch {}
  const item = saved
    .filter((value) => value.group === "today")
    .sort((left, right) => left.time.localeCompare(right.time))[index];
  const current = item
    ? [item.time, item.opponent, item.competition, item.initials]
    : game;
  return (
    <article className={`match-row ${item?.cancelled ? "is-cancelled" : ""}`}>
      <time>{current[0]}</time>
      <Avatar name={current[3]} logo={item?.logo} />
      <div>
        <span>{item?.cancelled ? "PARTIDA CANCELADA" : "STRIX UNITED VS"}</span>
        <b>{current[1]}</b>
        <small>{current[2]}</small>
      </div>
      <em>
        {item?.cancelled ? "CANCELADO" : index === 0 ? "PRÓXIMO" : "HOJE"}
      </em>
    </article>
  );
}
function Profile({ player, close }) {
  if (!player) return null;
  return (
    <ViewportDialog className="modal-backdrop" onMouseDown={close}>
      <article
        className="profile-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={close}>
          <Icon name="close" />
        </button>
        <div className="profile-show">
          <Avatar name={player[0]} />
          <span>STRIX UNITED · FC 27</span>
          <h2>{player[0]}</h2>
          <p>{player[1]}</p>
          <strong>{player[2]}</strong>
        </div>
        <div className="profile-data">
          <span>PERFIL DO JOGADOR</span>
          <h1>{player[0]}</h1>
          <p>Visão rápida da temporada, função tática e evolução no elenco.</p>
          <div className="stat-grid">
            <b>
              <small>POSIÇÃO</small>
              {player[1]}
            </b>
            <b>
              <small>OVER</small>
              {player[2]}
            </b>
            <b>
              <small>PARTIDAS</small>34
            </b>
            <b>
              <small>NOTA</small>7.8
            </b>
          </div>
          <button className="primary">ABRIR PERFIL COMPLETO</button>
        </div>
      </article>
    </ViewportDialog>
  );
}
function Central({ openPlayer }) {
  return (
    <section className="page-home page-enter">
      <section className="match-hero">
        <div className="stadium-light stadium-left" />
        <div className="stadium-light stadium-right" />
        <div className="smoke smoke-a" />
        <div className="smoke smoke-b" />
        <div className="hero-meta">
          <span>TRANSMISSÃO · NOITE DE JOGO</span>
          <b>30 JUL · 21:10</b>
        </div>
        <div className="hero-teams">
          <div>
            <Crest />
            <strong>STRIX UNITED</strong>
          </div>
          <div className="versus">
            <small>AMISTOSO</small>
            <b>VS</b>
            <i>21:10</i>
          </div>
          <div>
            <Avatar name="Sinceridade FC" />
            <strong>SINCERIDADE FC</strong>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary">
            <Icon name="squad" size={17} />
            ABRIR ESCALAÇÃO
          </button>
          <button className="secondary">
            DETALHES DA PARTIDA <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="stadium-caption">
          <span>ARENA STRIX · SÃO PAULO</span>
          <i>AO VIVO EM BREVE</i>
        </div>
      </section>
      <div className="content-grid central-agenda-grid">
        <section className="panel schedule">
          <header className="panel-heading">
            <div>
              <span>AGENDA DA NOITE</span>
              <h2>Jogos de hoje</h2>
            </div>
            <button>
              Ver agenda <Icon name="arrow" size={15} />
            </button>
          </header>
          {games.map((game, index) => (
            <GameRow key={game[1]} game={game} index={index} />
          ))}
        </section>
      </div>
    </section>
  );
}
const agendaDraftKey = "strix-fc27-agenda-draft";
function CentralLive({ workspace, navigate }) {
  const tonight = useMemo(() => todayAgendaMatches(workspace.agenda), [workspace.agenda]);
  const hero = useMemo(() => agendaHeroSelection(workspace.agenda), [workspace.agenda]);
  const heroMatch = hero.match;
  const nextLogo = heroMatch?.resolved_opponent_logo_url || (heroMatch?.opponent_logos?.storage_path ? workspace.assetUrl(heroMatch.opponent_logos.storage_path) : "");
  return (
    <section className="page-home page-enter">
      <section className="match-hero">
        <div className="stadium-light stadium-left" /><div className="stadium-light stadium-right" /><div className="smoke smoke-a" /><div className="smoke smoke-b" />
        <div className="hero-meta"><span>{heroMatch ? (hero.isToday ? "TRANSMISSÃO · NOITE DE JOGO" : "PRÓXIMA PARTIDA") : "AGENDA LIVRE"}</span><b>{heroMatch ? `${datePart(heroMatch.scheduled_at)} · ${timePart(heroMatch.scheduled_at)}` : "SEM COMPROMISSO"}</b></div>
        <div className="hero-teams">
          <div><Crest /><strong>STRIX UNITED</strong></div>
          <div className="versus"><small>{heroMatch?.competition_name || "SEM PARTIDA"}</small><b>VS</b><i>{heroMatch ? timePart(heroMatch.scheduled_at) : "—"}</i></div>
          <div><Avatar name={heroMatch?.opponent_name || "?"} logo={nextLogo} priority /><strong>{heroMatch?.opponent_name || "AGUARDANDO ADVERSÁRIO"}</strong></div>
        </div>
        <div className="hero-actions"><button className="primary" onClick={() => navigate("agenda")}><Icon name="squad" size={17} />ABRIR ESCALAÇÃO</button><button className="secondary" onClick={() => navigate("agenda")}>DETALHES DA PARTIDA <Icon name="arrow" size={16} /></button></div>
        <div className="stadium-caption"><span>ARENA STRIX · SÃO PAULO</span><i>{heroMatch?.status === "live" && hero.isToday ? "AO VIVO" : hero.isToday ? "HOJE" : heroMatch ? "PRÓXIMO COMPROMISSO" : "AGENDA LIVRE"}</i></div>
      </section>
      <div className="content-grid central-agenda-grid">
        <section className="panel schedule">
          <header className="panel-heading"><div><span>AGENDA DA NOITE</span><h2>Jogos de hoje</h2></div><button onClick={() => navigate("agenda")}>Ver agenda <Icon name="arrow" size={15} /></button></header>
          {tonight.length ? <div className="upcoming-games-track central-night-list">{tonight.map((game, index) => <GameRowLive key={game.id} game={game} index={index} workspace={workspace} />)}</div> : <div className="agenda-empty">Nenhuma partida programada para hoje.</div>}
        </section>
      </div>
    </section>
  );
}
function GameRowLive({ game, index, workspace }) {
  const logo = game.resolved_opponent_logo_url || (game.opponent_logos?.storage_path ? workspace.assetUrl(game.opponent_logos.storage_path) : "");
  const status = game.temporal_status === "overdue" ? "ATRASADO" : game.temporal_status === "today" ? "HOJE" : index === 0 ? "PRÓXIMO" : "AGENDADO";
  return <article className="upcoming-game-card">
    <header><span>{game.round_label || game.competition_name || "PARTIDA"}</span><time>{datePart(game.scheduled_at)} · {timePart(game.scheduled_at)}</time></header>
    <div className="upcoming-game-versus"><div><b>STRIX UNITED</b><Crest /></div><i>×</i><div><Avatar name={game.opponent_name} logo={logo} /><b>{game.opponent_name}</b></div></div>
    <footer><em>{status}</em></footer>
  </article>;
}
const defaultAgendaForm = {
  opponent: "",
  competition: "AMISTOSO",
  date: "30/07/2026",
  time: "21:10",
  logo: "",
  presetId: "",
};
function nextKickoff(time) {
  const [hour, minute] = String(time || "21:10")
    .split(":")
    .map(Number);
  const total = hour * 60 + minute + 30;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
const lineupSlots = [
  "ATA",
  "ATA",
  "ALA",
  "MC",
  "MC",
  "ALA",
  "VOL",
  "ZAG",
  "ZAG",
  "ZAG",
  "GOL",
];
const emptyLineup = () => Array(11).fill("");
function FormationPicker({ lineup, onChange, compact = false, readOnly = false, roster = [], assetUrl = (value) => value || "" }) {
  const [slot, setSlot] = useState(null);
  const choose = (player) => {
    const next = [...lineup];
    next[slot] = player?.display_name || "";
    onChange(next);
    setSlot(null);
  };
  const activeRoster = (Array.isArray(roster) ? roster : []).filter((player) => player?.is_active);
  const desiredPosition = slot === null ? "" : lineupSlots[slot];
  const natural = activeRoster.filter((player) => (player.positions || []).includes(desiredPosition));
  const improvised = activeRoster.filter((player) => !(player.positions || []).includes(desiredPosition));
  const avatarFor = (player) => player?.avatar_path ? assetUrl(player.avatar_path) : player?.external_avatar_url || "";
  const lineupPlayer = (name) => activeRoster.find((player) => normalizeTeamName(player.display_name) === normalizeTeamName(name));
  const playerButton = (player) => (
    <button type="button" key={player.id || player.display_name} onClick={() => choose(player)}>
      <b>{player.member_type === "teste" ? "TESTE" : "ELENCO"}</b>
      <Avatar name={player.display_name} logo={avatarFor(player)} kind="photo" />
      <span>{player.display_name}<small>{(player.positions || []).join(" · ") || "SEM POSIÇÃO"}</small></span>
    </button>
  );
  return (
    <section className={`formation-picker ${compact ? "is-compact" : ""} ${readOnly ? "is-read-only" : ""}`}>
      <div className="formation-picker-field">
        {lineupSlots.map((position, index) => {
          const player = lineupPlayer(lineup[index]);
          return (
          <button
            type="button"
            className={`formation-slot slot-${index}`}
            key={`${position}-${index}`}
            onClick={() => !readOnly && setSlot(index)}
            tabIndex={readOnly ? -1 : 0}
            aria-disabled={readOnly}
          >
            <i className={player ? "has-player-photo" : ""}>{lineup[index] ? <Avatar name={lineup[index]} logo={avatarFor(player)} kind="photo" /> : "+"}</i>
            <b>{lineup[index] || "Livre"}</b>
            <small>{position}</small>
          </button>
          );
        })}
      </div>
      {slot !== null && (
        <div
          className="formation-roster"
          role="dialog"
          aria-label="Escolher jogador"
        >
          <header>
            <span>POSIÇÃO · {lineupSlots[slot]}</span>
            <button type="button" aria-label="Fechar seleção de jogador" onClick={() => setSlot(null)}>
              <Icon name="close" size={16} />
            </button>
          </header>
          <section className="formation-roster-group">
            <h4>NATURAIS · {desiredPosition}</h4>
            {natural.length ? natural.map(playerButton) : <p>Nenhum jogador ativo nesta posição.</p>}
          </section>
          <section className="formation-roster-group is-improvised">
            <h4>IMPROVISADOS</h4>
            {improvised.map(playerButton)}
          </section>
        </div>
      )}
    </section>
  );
}
function StandingTeam({ row, label }) {
  const metrics = [
    ["J", row.played], ["PTS", row.points], ["V", row.wins], ["E", row.draws], ["D", row.losses],
    ["GP", row.goalsFor], ["GC", row.goalsAgainst], ["SG", row.goalDifference],
  ].filter(([, value]) => value !== null && value !== undefined);
  return <article className={`agenda-standing-team ${label === "STRIX" ? "is-strix" : "is-opponent"}`}>
    <strong>{row.position ? `${row.position}º` : "—"}</strong>
    <div><small>{label}</small><b>{row.team}</b><dl>{metrics.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{key === "SG" && Number(value) > 0 ? `+${value}` : value}</dd></div>)}</dl></div>
  </article>;
}
function AgendaModal({ entry, mode = "new", presets, roster = [], assetUrl, standings, onClose, onEdit, onSave, logoForOpponent = catalogLogo, defaultDate = defaultAgendaForm.date, suggestTimeForDate }) {
  const edit = Boolean(entry);
  const [form, setForm] = useState(() => {
    const saved = entry
      ? { ...defaultAgendaForm, ...entry }
      : {
          ...defaultAgendaForm,
          ...JSON.parse(localStorage.getItem(agendaDraftKey) || "{}"),
        };
    const date = entry ? saved.date : defaultDate;
    const time = entry ? saved.time : (suggestTimeForDate?.(date, []) || saved.time);
    return { ...saved, date, time, logo: saved.logo || logoForOpponent(saved.opponent) };
  });
  const [gameNumber, setGameNumber] = useState(1);
  const [lineup, setLineup] = useState(() => entry?.lineup || emptyLineup());
  const [logoFile, setLogoFile] = useState(null);
  const [queuedGames, setQueuedGames] = useState([]);
  const [addFeedback, setAddFeedback] = useState("");
  const swap = mode === "swap";
  const readOnly = mode === "view";
  useEffect(() => {
    if (!edit)
      localStorage.setItem(agendaDraftKey, JSON.stringify({ ...form, lineup }));
  }, [edit, form, lineup]);
  const change = (event) => {
    const { name, value } = event.target;
    if (name === "opponent") {
      const resolved = value.trim() ? logoForOpponent(value) : "";
      setForm((current) => ({
        ...current,
        opponent: value,
        // Clearing the opponent must never leave a stale crest in preview.
        logo: value.trim() ? (resolved || current.logo) : "",
      }));
      if (!value.trim()) setLogoFile(null);
      return;
    }
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(!edit && name === "date" && suggestTimeForDate
        ? { time: suggestTimeForDate(value, queuedGames) }
        : {}),
    }));
    if (name === "presetId") {
      const preset = presets.find((valueItem) => valueItem.id === value);
      if (preset?.lineup) setLineup([...preset.lineup]);
    }
  };
  const pickLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setForm((current) => ({ ...current, logo: URL.createObjectURL(file) }));
  };
  const queueCurrentGame = () => {
    if (!form.opponent.trim()) {
      setAddFeedback("Informe o adversário antes de adicionar outro jogo.");
      return;
    }
    const queuedGame = { ...form, lineup: [...lineup], opponent: form.opponent.trim(), logoFile };
    const nextQueue = [...queuedGames, queuedGame];
    setQueuedGames(nextQueue);
    setGameNumber((value) => value + 1);
    setLineup(emptyLineup());
    setLogoFile(null);
    setForm((current) => ({
      ...defaultAgendaForm,
      date: current.date,
      time: suggestTimeForDate?.(current.date, nextQueue) || nextKickoff(current.time),
    }));
    setAddFeedback("Jogo adicionado ao mesmo envio. Preencha o próximo abaixo.");
  };
  const editQueuedGame = (index) => {
    const game = queuedGames[index];
    setQueuedGames((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setForm({ ...game });
    setLineup([...game.lineup]);
    setGameNumber(index + 1);
    setAddFeedback("Jogo reaberto para edição.");
  };
  const submit = (event) => {
    event?.preventDefault();
    if (!form.opponent.trim()) {
      setAddFeedback("Informe o adversário antes de salvar a Agenda.");
      return;
    }
    const currentGame = { ...entry, ...form, lineup, logoFile, opponent: form.opponent.trim() };
    onSave(edit ? currentGame : [...queuedGames, currentGame], mode);
  };
  return (
    <ViewportDialog className="modal-backdrop">
      <article
        className="agenda-modal agenda-modal-wide"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>
              {String(gameNumber).padStart(2, "0")} ·{" "}
              {readOnly
                ? "VISUALIZAR PARTIDA"
                : swap
                ? "TROCAR ADVERSÁRIO"
                : edit
                  ? "EDITAR PARTIDA"
                  : "NOVA PARTIDA"}
            </span>
            <h2>
              {readOnly
                ? "Escalação da partida"
                : swap
                ? "Substituir confronto"
                : edit
                  ? "Ajustar jogo"
                  : "Adicionar à agenda"}
            </h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <Icon name="close" />
          </button>
        </header>
        <form onSubmit={(event) => submit(event)}>
          <div className="agenda-modal-scroll">
          {!edit && queuedGames.length > 0 && (
            <section className="modal-game-queue" aria-label="Jogos adicionados neste envio">
              {queuedGames.map((game, index) => (
                <article key={`${game.opponent}-${index}`}>
                  <div>
                    <span>JOGO {String(index + 1).padStart(2, "0")} PRONTO</span>
                    <b>{game.opponent}</b>
                    <small>{game.date} · {game.time} · {game.competition}</small>
                  </div>
                  <em>{game.lineup.filter(Boolean).length}/11</em>
                  <button type="button" onClick={() => editQueuedGame(index)}>EDITAR</button>
                </article>
              ))}
            </section>
          )}
          <div className="agenda-modal-body">
            {readOnly ? <section className="agenda-view-matchup" aria-label="Confronto da partida">
              <div className="agenda-view-clubs"><div><Crest /><b>STRIX UNITED</b></div><strong>VS</strong><div><Avatar name={form.opponent || "?"} logo={form.logo} /><b>{form.opponent}</b></div></div>
              <time>{form.date} · {form.time}</time>
              <small>{form.competition}</small>
            </section> : <div className="agenda-form">
              {swap && (
                <div className="swap-origin">
                  <small>CONFRONTO ORIGINAL</small>
                  <s>{entry?.opponent}</s>
                  <span>será preservado no histórico da Agenda</span>
                </div>
              )}
              <label>
                {swap ? "NOVO ADVERSÁRIO" : "ADVERSÁRIO"}
                <input
                  required
                  name="opponent"
                  value={form.opponent}
                  onChange={change}
                  placeholder="Nome do adversário"
                />
              </label>
              <label>
                COMPETIÇÃO
                <select
                  name="competition"
                  value={form.competition}
                  onChange={change}
                >
                  {!["AMISTOSO", "SUPERLIGA YESHUA", "MASTER LEAGUE", "COPA YESHUA"].includes(form.competition) && <option>{form.competition}</option>}
                  <option>AMISTOSO</option>
                  <option>SUPERLIGA YESHUA</option>
                  <option>MASTER LEAGUE</option>
                  <option>COPA YESHUA</option>
                </select>
              </label>
              <div className="form-row">
                <label>
                  DATA
                  <span className="input-icon">
                    <Icon name="calendar" size={16} />
                    <input
                      required
                      name="date"
                      value={form.date}
                      onChange={change}
                    />
                  </span>
                </label>
                <label>
                  HORÁRIO
                  <span className="input-icon">
                    <Icon name="clock" size={16} />
                    <input
                      required
                      name="time"
                      value={form.time}
                      onChange={change}
                    />
                  </span>
                </label>
              </div>
              <label>
                PREDEFINIÇÃO DA ESCALAÇÃO
                <select
                  name="presetId"
                  value={form.presetId || ""}
                  onChange={change}
                >
                  {<option value="">Sem predefinição</option>}
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="logo-drop">
                LOGO DO ADVERSÁRIO
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={pickLogo}
                />
                <span>
                  <Icon name="upload" size={17} />
                  {form.logo
                    ? "Logo pronta para este jogo"
                    : "Enviar do computador"}
                </span>
              </label>
            </div>}
            {readOnly ? <aside className="agenda-standing-compare">
              <header><span>CLASSIFICAÇÃO</span><small>{standings?.competition || form.competition}</small></header>
              {standings?.available ? <div><StandingTeam row={standings.strix} label="STRIX"/><StandingTeam row={standings.opponent} label="ADVERSÁRIO"/></div> : <p>Sem classificação disponível para esta partida.</p>}
            </aside> : <aside className="match-preview">
              <span>PREVIEW DA AGENDA</span><div><Crest /><b>VS</b><Avatar name={form.opponent || "?"} logo={form.logo} /></div><strong>{form.opponent || "ADVERSÁRIO"}</strong><small>{form.date} · {form.time}</small><em>{form.competition}</em>
            </aside>}
          </div>
          <section className="modal-lineup">
            <header>
              <div>
                <span>ESCALAÇÃO DO JOGO</span>
                <h3>
                  3-1-4-2 <small>{lineup.filter(Boolean).length}/11</small>
                </h3>
              </div>
              <p>{readOnly ? "Escalação definida para este jogo." : "Toque em uma posição e escolha o jogador."}</p>
            </header>
            <FormationPicker lineup={lineup} onChange={setLineup} readOnly={readOnly} roster={roster} assetUrl={assetUrl} />
          </section>
          {!edit && (
            <>
              <button
                type="button"
                className="add-game-block"
                onClick={queueCurrentGame}
              >
                <Icon name="plus" size={18} />
                Adicionar mais um jogo
              </button>
              {addFeedback && (
                <p className="add-game-feedback" aria-live="polite">
                  {addFeedback}
                </p>
              )}
            </>
          )}
          </div>
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              {readOnly ? "FECHAR" : "CANCELAR"}
            </button>
            {readOnly && onEdit && <button type="button" className="primary agenda-edit-lineup" onClick={onEdit}><Icon name="squad" size={16} />EDITAR ESCALAÇÃO</button>}
            {!readOnly && <button className="primary">
              <RollingLabel>{swap
                ? "TROCAR ADVERSÁRIO"
                : edit
                  ? "SALVAR ALTERAÇÕES"
                  : "ADICIONAR JOGO"}</RollingLabel>
            </button>}
          </footer>
        </form>
      </article>
    </ViewportDialog>
  );
}
function PresetPanel({ presets, setPresets, roster = [], assetUrl, onClose }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("1");
  const [lineup, setLineup] = useState(emptyLineup());
  const [editingId, setEditingId] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const add = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    const payload = {
        id: crypto.randomUUID(),
        name: name.trim(),
        lineup: [...lineup],
        expiresAt: Date.now() + Number(duration) * 86400000,
      };
    setPresets((current) => editingId
      ? current.map((preset) => preset.id === editingId ? { ...preset, ...payload, id: preset.id } : preset)
      : [...current, payload]);
    setName("");
    setLineup(emptyLineup());
    setEditingId("");
  };
  const editPreset = (preset) => {
    setEditingId(preset.id);
    setName(preset.name);
    setLineup([...(preset.lineup || emptyLineup())]);
    setDuration(String(Math.max(1, Math.ceil((preset.expiresAt - Date.now()) / 86400000))));
  };
  return (
    <ViewportDialog className="modal-backdrop">
      <section className="preset-panel" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>ESCALAÇÃO</span>
            <h2>Predefinições temporárias</h2>
            <p>
              Monte a escalação aqui. Ela some da escolha quando expirar, sem
              alterar jogos já criados.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <Icon name="close" />
          </button>
        </header>
        <FormationPicker compact lineup={lineup} onChange={setLineup} roster={roster} assetUrl={assetUrl} />
        <form onSubmit={add}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Time da noite"
          />
          <select
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          >
            <option value="1">1 dia</option>
            <option value="3">3 dias</option>
            <option value="5">5 dias</option>
          </select>
          <button className="primary">{editingId ? "ATUALIZAR PREDEFINIÇÃO" : "SALVAR PREDEFINIÇÃO"}</button>
        </form>
        <div>
          {presets.length ? (
            presets.map((preset) => (
              <article className="preset-saved-item" key={preset.id}>
                <span><b>{preset.name}</b><small>
                  {preset.lineup?.filter(Boolean).length || 0}/11 · ativa até{" "}
                  {new Date(preset.expiresAt).toLocaleDateString("pt-BR")}
                </small></span>
                <button type="button" onClick={() => editPreset(preset)} aria-label={`Editar ${preset.name}`}><Icon name="edit" size={14}/></button>
                <button type="button" onClick={() => setPendingDelete(preset)} aria-label={`Excluir ${preset.name}`}><Icon name="trash" size={14}/></button>
              </article>
            ))
          ) : (
            <p>Nenhuma predefinição ativa.</p>
          )}
        </div>
        {pendingDelete && <div className="preset-confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar exclusão">
          <p>Excluir a predefinição <b>{pendingDelete.name}</b>? Jogos já criados não serão alterados.</p>
          <div><button type="button" className="secondary" onClick={() => setPendingDelete(null)}>VOLTAR</button><button type="button" className="agenda-confirm-danger" onClick={() => { setPresets((current) => current.filter((preset) => preset.id !== pendingDelete.id)); if (editingId === pendingDelete.id) { setEditingId(""); setName(""); setLineup(emptyLineup()); } setPendingDelete(null); }}>EXCLUIR</button></div>
        </div>}
      </section>
    </ViewportDialog>
  );
}
function Agenda({ navigate }) {
  const starter = () =>
    games.map((game, index) => ({
      id: `seed-${index}`,
      time: game[0],
      opponent: game[1],
      competition: game[2],
      initials: game[3],
      date: "30/07/2026",
      status: index === 0 ? "EM BREVE" : "AGENDADO",
      group: "today",
      logo: "",
    }));
  const [tab, setTab] = useState("today"),
    [items, setItems] = useState(() => {
      try {
        return (
          JSON.parse(localStorage.getItem("strix-fc27-agenda") || "null") ||
          starter()
        );
      } catch {
        return starter();
      }
    }),
    [modal, setModal] = useState(null),
    [actions, setActions] = useState(null),
    [showPresets, setShowPresets] = useState(false),
    [presets, setPresets] = useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem("strix-fc27-presets") || "[]",
        ).filter((preset) => preset.expiresAt > Date.now());
      } catch {
        return [];
      }
    });
  useEffect(() => {
    localStorage.setItem("strix-fc27-agenda", JSON.stringify(items));
    window.dispatchEvent(new Event("strix-agenda-updated"));
  }, [items]);
  useEffect(
    () => localStorage.setItem("strix-fc27-presets", JSON.stringify(presets)),
    [presets],
  );
  const save = (payload, mode) => {
    const batch = Array.isArray(payload) ? payload : [payload];
    batch.forEach((item) => rememberLogo(item.opponent, item.logo));
    setItems((current) =>
      modal?.entry
        ? current.map((value) =>
            value.id === modal.entry.id
              ? {
                  ...value,
                  ...batch[0],
                  initials: batch[0].opponent
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase(),
                  ...(mode === "swap"
                    ? {
                        previousOpponent: modal.entry.opponent,
                        previousLogo: modal.entry.logo,
                        swappedAt: new Date().toISOString(),
                      }
                    : {}),
                }
              : value,
          )
        : [
            ...current,
            ...batch.map((item) => ({
              ...item,
              id: crypto.randomUUID(),
              initials: item.opponent
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              status: "AGENDADO",
              group: "today",
            })),
          ],
    );
    localStorage.removeItem(agendaDraftKey);
    setModal(null);
  };
  const cancel = (id) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status: "CANCELADO", cancelled: true }
          : item,
      ),
    );
    setActions(null);
  };
  const remove = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setActions(null);
  };
  const visible = items
    .filter((item) =>
      tab === "today" ? item.group === "today" : item.group === "next",
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <section className="agenda-page page-enter">
      <header className="agenda-hero">
        <div>
          <span>AGENDA DO TIME</span>
          <h1>A noite começa aqui.</h1>
          <p>
            Organize os jogos e deixe a escalação pronta antes da bola rolar.
          </p>
        </div>
        <div className="agenda-hero-actions">
          <button
            className="secondary preset-trigger"
            onClick={() => setShowPresets(true)}
          >
            PREDEFINIÇÕES
          </button>
          <button className="primary" onClick={() => setModal({ mode: "new" })}>
            <Icon name="plus" size={17} />
            NOVO JOGO
          </button>
        </div>
      </header>
      {showPresets && (
        <PresetPanel
          presets={presets}
          setPresets={setPresets}
          onClose={() => setShowPresets(false)}
        />
      )}
      <nav className="agenda-tabs">
        <button
          className={tab === "today" ? "selected" : ""}
          onClick={() => setTab("today")}
        >
          Hoje <b>{items.filter((item) => item.group === "today").length}</b>
        </button>
        <button
          className={tab === "next" ? "selected" : ""}
          onClick={() => setTab("next")}
        >
          Próximos
        </button>
        <button onClick={() => navigate("partidas")}>
          Concluídos <Icon name="arrow" size={13} />
        </button>
      </nav>
      <section className="agenda-list">
        <div className="agenda-list-heading">
          <span>HORÁRIO</span>
          <span>PARTIDA</span>
          <span>CAMPEONATO</span>
          <span>STATUS</span>
        </div>
        {visible.length ? (
          visible.map((item) => (
            <article
              key={item.id}
              className={`agenda-game ${item.cancelled ? "is-cancelled" : ""}`}
            >
              <time>{item.time}</time>
              <div className="agenda-match">
                <Avatar
                  name={item.opponent || item.initials}
                  logo={item.logo}
                />
                <div>
                  {item.previousOpponent && (
                    <small className="replaced-opponent">
                      <s>{item.previousOpponent}</s> → TROCADO
                    </small>
                  )}
                  <small>STRIX UNITED VS</small>
                  <b>{item.opponent}</b>
                </div>
              </div>
              <span className="game-competition">{item.competition}</span>
              <em className={item.status === "EM BREVE" ? "soon" : ""}>
                {item.status}
              </em>
              <button
                aria-label={`Ações para ${item.opponent}`}
                onClick={() => setActions(actions === item.id ? null : item.id)}
              >
                •••
              </button>
              {actions === item.id && (
                <div className="agenda-actions">
                  <button
                    onClick={() => {
                      setActions(null);
                      setModal({ entry: item, mode: "edit" });
                    }}
                  >
                    Editar partida
                  </button>
                  <button
                    onClick={() => {
                      setActions(null);
                      setModal({ entry: item, mode: "swap" });
                    }}
                  >
                    Trocar adversário
                  </button>
                  <button className="danger" onClick={() => cancel(item.id)}>
                    Cancelar jogo
                  </button>
                  <button
                    className="danger delete"
                    onClick={() => remove(item.id)}
                  >
                    Excluir partida
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="agenda-empty">Nenhuma partida futura programada.</div>
        )}
      </section>
      {modal && (
        <AgendaModal
          entry={modal.entry}
          mode={modal.mode}
          presets={presets}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </section>
  );
}
function AgendaLive({ navigate, workspace, profile }) {
  const [tab, setTab] = useState("today");
  const [modal, setModal] = useState(null);
  const [actions, setActions] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [showPresets, setShowPresets] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [presets, setPresets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("strix-fc27-presets") || "[]").filter((preset) => preset.expiresAt > Date.now());
    } catch { return []; }
  });
  useEffect(() => localStorage.setItem("strix-fc27-presets", JSON.stringify(presets)), [presets]);
  useEffect(() => {
    if (!actions) return undefined;
    const closeMenu = (event) => {
      if (event.key === "Escape" || (event.type === "pointerdown" && !event.target.closest(".agenda-actions,[data-agenda-menu-trigger]"))) setActions(null);
    };
    window.addEventListener("keydown", closeMenu);
    document.addEventListener("pointerdown", closeMenu);
    return () => {
      window.removeEventListener("keydown", closeMenu);
      document.removeEventListener("pointerdown", closeMenu);
    };
  }, [actions]);
  const items = useMemo(() => activeAgendaMatches(workspace.agenda).map((db) => ({
    db,
    id: db.id,
    date: datePart(db.scheduled_at),
    time: timePart(db.scheduled_at),
    opponent: db.opponent_name,
    competition: db.competition_name,
    initials: initialsOf(db.opponent_name),
    logo: db.resolved_opponent_logo_url || (db.opponent_logos?.storage_path ? workspace.assetUrl(db.opponent_logos.storage_path) : ""),
    status: db.status === "cancelled" ? "CANCELADO" : db.status === "live" ? "EM BREVE" : db.status === "completed" ? "JOGADO" : db.temporal_status === "overdue" ? "ATRASADO" : db.temporal_status === "today" ? "HOJE" : "AGENDADO",
    cancelled: db.status === "cancelled",
    previousOpponent: db.previous_opponent_name,
    lineup: db.lineup || [],
  })), [workspace.agenda, workspace.logos]);
  const todayIds = useMemo(
    () => new Set(todayAgendaMatches(workspace.agenda).map((match) => match.id)),
    [workspace.agenda],
  );
  const visible = items.filter((item) => tab === "today"
    ? todayIds.has(item.id)
    : item.db.temporal_status === "upcoming"
  ).sort((left, right) => new Date(left.db.scheduled_at) - new Date(right.db.scheduled_at));
  const defaultNewDate = datePart(new Date());
  const suggestTimeForDate = (date, queued = []) => nextAgendaSlot(
    [...workspace.agenda, ...queued],
    date,
  );
  const run = async (work) => {
    setFeedback("");
    try { await work(); notify("Agenda atualizada."); }
    catch (error) { setFeedback(error.message || "Não foi possível concluir a alteração."); notify("Erro ao atualizar a Agenda.", "error"); }
  };
  return (
    <section className="agenda-page page-enter">
      <header className="agenda-hero">
        <div><span>AGENDA DO TIME</span><h1>A noite começa aqui.</h1><p>Organize os jogos e deixe a escalação pronta antes da bola rolar.</p></div>
        <div className="agenda-hero-actions">
          {canManageAgenda(profile) && <button className="secondary preset-trigger" onClick={() => setShowPresets(true)}>PREDEFINIÇÕES</button>}
          {canManageAgenda(profile) && <button className="primary" onClick={() => setModal({ mode: "new" })}><Icon name="plus" size={17} />NOVO JOGO</button>}
        </div>
      </header>
      <nav className="agenda-tabs">
        <button className={tab === "today" ? "selected" : ""} onClick={() => setTab("today")}>Hoje <b>{todayIds.size}</b></button>
        <button className={tab === "next" ? "selected" : ""} onClick={() => setTab("next")}>Próximos</button>
        <button onClick={() => navigate("partidas")}>Concluídos <Icon name="arrow" size={13} /></button>
      </nav>
      {(workspace.error || feedback) && <p className="matches-error">{feedback || workspace.error}</p>}
      <section className="agenda-list" aria-busy={workspace.loading}>
        <div className="agenda-list-heading"><span>{tab === "next" ? "DATA · HORÁRIO" : "HORÁRIO"}</span><span>PARTIDA</span><span>CAMPEONATO</span><span>STATUS</span></div>
        {visible.length ? visible.map((item) => (
          <article
            key={item.id}
            className={`agenda-game ${item.cancelled ? "is-cancelled" : ""}`}
          >
            <button className="agenda-game-open" type="button" aria-label={`Abrir escalação de ${item.opponent}`} onClick={() => { setActions(null); setModal({ entry: item, mode: "view" }); }}>
              <time className={tab === "next" ? "future-kickoff" : ""}>{tab === "next" && <span>{item.date}</span>}<b>{item.time}</b></time>
              <div className="agenda-match">
                <Avatar name={item.opponent} logo={item.logo} />
                <div>{item.previousOpponent && <small className="replaced-opponent"><s>{item.previousOpponent}</s> → TROCADO</small>}<small>STRIX UNITED VS</small><b>{item.opponent}</b></div>
              </div>
              <span className="game-competition">{item.competition}</span>
              <em className={item.status === "EM BREVE" ? "soon" : ""}>{item.status}</em>
            </button>
            {canManageAgenda(profile) && <button data-agenda-menu-trigger aria-haspopup="menu" aria-expanded={actions === item.id} aria-label={`Ações para ${item.opponent}`} onClick={(event) => { event.stopPropagation(); setActions(actions === item.id ? null : item.id); }}>•••</button>}
            {canManageAgenda(profile) && actions === item.id && <div className="agenda-actions" role="menu" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
              event.preventDefault();
              const buttons = [...event.currentTarget.querySelectorAll("button")];
              const index = buttons.indexOf(document.activeElement);
              buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
            }}>
              <button onClick={() => { setActions(null); setModal({ entry: item, mode: "edit" }); }}><Icon name="edit" size={15} />Editar partida</button>
              <button onClick={() => { setActions(null); setModal({ entry: item, mode: "swap" }); }}><Icon name="game" size={15} />Trocar adversário</button>
              <button className="danger" onClick={() => { setActions(null); setPendingAction({ type:"cancel", item }); }}><Icon name="close" size={15} />Cancelar jogo</button>
              <button className="danger delete" onClick={() => { setActions(null); setPendingAction({ type:"delete", item }); }}><Icon name="trash" size={15} />Excluir partida</button>
            </div>}
          </article>
        )) : <div className="agenda-empty">{workspace.loading ? "Sincronizando agenda..." : "Nenhuma partida programada."}</div>}
      </section>
      {showPresets && <PresetPanel presets={presets} setPresets={setPresets} roster={workspace.players} assetUrl={workspace.assetUrl} onClose={() => setShowPresets(false)} />}
      {modal && <AgendaModal entry={modal.entry} mode={modal.mode} presets={presets} roster={workspace.players} assetUrl={workspace.assetUrl} standings={agendaStandingComparison(modal.entry?.db, workspace.competitionSources, workspace.competitionTeams)} defaultDate={defaultNewDate} suggestTimeForDate={suggestTimeForDate} onClose={() => setModal(null)} onEdit={modal.entry && canEditLineup(profile) ? () => setModal({ entry: modal.entry, mode: "edit" }) : undefined} logoForOpponent={(name) => { const logo = matchingLogo(workspace.logos, name); return logo?.storage_path ? workspace.assetUrl(logo.storage_path) : catalogLogo(name); }} onSave={(payload, mode) => void run(async () => { await workspace.saveAgenda(payload, mode, modal.entry?.db); setModal(null); })} />}
      {pendingAction && <ViewportDialog className="modal-backdrop" onMouseDown={() => setPendingAction(null)}>
        <article className="agenda-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="agenda-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <div><span>CONFIRMAR AÇÃO</span><h2 id="agenda-confirm-title">{pendingAction.type === "delete" ? "Excluir partida?" : "Cancelar jogo?"}</h2></div>
            <CloseButton onClick={() => setPendingAction(null)} />
          </header>
          <p>{pendingAction.type === "delete" ? `A partida contra ${pendingAction.item.opponent} será removida da Agenda.` : `A partida contra ${pendingAction.item.opponent} será marcada como cancelada.`}</p>
          <footer>
            <button type="button" className="secondary" onClick={() => setPendingAction(null)}>VOLTAR</button>
            <button type="button" className="agenda-confirm-danger" onClick={() => void run(async () => {
              if (pendingAction.type === "delete") await workspace.removeAgenda(pendingAction.item.id);
              else await workspace.setAgendaStatus(pendingAction.item.id, "cancelled");
              setPendingAction(null);
            })}>{pendingAction.type === "delete" ? "EXCLUIR PARTIDA" : "CANCELAR JOGO"}</button>
          </footer>
        </article>
      </ViewportDialog>}
    </section>
  );
}
function SquadPage({ workspace, profile }) {
  const canManage = ["diretoria", "dev"].includes(profile?.access_tier);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ display_name: "", positions: [], member_type: "complete", trial_expires_at: "" });
  const [photo, setPhoto] = useState(null);
  const positions = ["GOL", "ZAG", "ALA", "VOL", "MC", "MEI", "ATA"];
  const submit = async (event) => {
    event.preventDefault();
    try { await workspace.savePlayer(draft, photo); setModal(false); setDraft({ display_name:"", positions:[], member_type:"complete", trial_expires_at:"" }); setPhoto(null); }
    catch (saveError) { setError(saveError.message || "Não foi possível salvar o jogador."); }
  };
  return <section className="data-page page-enter"><header className="data-page-header"><div><span>ELENCO DO CLUBE</span><h1>Squad FC 27.</h1><p>Cadastre só jogadores reais. Testes ficam identificados até a data definida.</p></div>{canManage && <button className="primary" onClick={() => setModal(true)}><Icon name="plus" size={16}/>ADICIONAR JOGADOR</button>}</header>{(workspace.error || error) && <p className="matches-error">{error || workspace.error}</p>}<section className="squad-list">{workspace.players.filter((player) => player.is_active).length ? workspace.players.filter((player) => player.is_active).map((player) => <article key={player.id}><Avatar name={player.display_name} logo={player.avatar_path ? workspace.assetUrl(player.avatar_path) : ""}/><div><b>{player.display_name}</b><small>{player.positions?.join(" · ") || "Posição não definida"}</small></div>{player.member_type === "teste" && <em className="test-tag">TESTE{player.trial_expires_at ? ` · até ${datePart(player.trial_expires_at)}` : ""}</em>}{canManage && <button className="icon-button" aria-label={`Remover ${player.display_name}`} onClick={() => void workspace.removePlayer(player.id).catch((removeError) => setError(removeError.message))}><Icon name="trash" size={16}/></button>}</article>) : <div className="matches-empty">O elenco FC 27 começa vazio. Adicione os jogadores oficiais quando estiver pronto.</div>}</section>{modal && <div className="match-manual-backdrop"><form className="match-manual-modal squad-modal" onSubmit={submit}><header><div><span>NOVO JOGADOR</span><h2>Adicionar ao elenco</h2><p>Foto, posições e vínculo ficam guardados no Supabase.</p></div><button type="button" className="icon-button" onClick={() => setModal(false)}><Icon name="close"/></button></header><div className="manual-form-grid"><label className="manual-full">NOME<input autoFocus value={draft.display_name} onChange={(event) => setDraft((current) => ({...current,display_name:event.target.value}))}/></label><label className="manual-full logo-drop">FOTO DO JOGADOR<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)}/><span><Icon name="upload" size={17}/>{photo ? photo.name : "Enviar do computador"}</span></label><fieldset className="position-picker manual-full"><legend>POSIÇÕES</legend>{positions.map((position) => <button type="button" className={draft.positions.includes(position) ? "selected" : ""} key={position} onClick={() => setDraft((current) => ({...current,positions:current.positions.includes(position) ? current.positions.filter((item) => item !== position) : [...current.positions,position]}))}>{position}</button>)}</fieldset><label>VÍNCULO<select value={draft.member_type} onChange={(event) => setDraft((current) => ({...current,member_type:event.target.value}))}><option value="complete">COMPLETE</option><option value="teste">TESTE</option></select></label>{draft.member_type === "teste" && <label>FIM DO TESTE<input type="date" value={draft.trial_expires_at} onChange={(event) => setDraft((current) => ({...current,trial_expires_at:event.target.value}))}/></label>}</div><footer><button type="button" className="secondary" onClick={() => setModal(false)}>CANCELAR</button><button className="primary"><Icon name="upload" size={16}/>SALVAR JOGADOR</button></footer></form></div>}</section>;
}

function SquadPageV2({ workspace, profile }) {
  const canManage = ["diretoria", "dev"].includes(profile?.access_tier);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ display_name: "", positions: [], member_type: "complete", trial_expires_at: "" });
  const [photo, setPhoto] = useState(null);
  const positions = ["GOL", "ZAG", "ALA", "VOL", "MC", "MEI", "ATA"];
  const previewUrl = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const close = () => { setModal(false); setPhoto(null); setDraft({ display_name: "", positions: [], member_type: "complete", trial_expires_at: "" }); };
  const submit = async (event) => {
    event.preventDefault();
    try {
      if (!draft.display_name.trim()) throw new Error("Informe o nome do jogador.");
      if (!draft.positions.length) throw new Error("Escolha ao menos uma posição.");
      await workspace.savePlayer(draft, photo);
      close();
    } catch (saveError) { setError(saveError.message || "Não foi possível salvar o jogador."); }
  };
  return <section className="data-page page-enter"><header className="data-page-header"><div><span>ELENCO DO CLUBE</span><h1>Squad FC 27.</h1><p>Perfis reais, posições múltiplas e status do vínculo visíveis antes de salvar.</p></div>{canManage && <button className="primary" onClick={() => setModal(true)}><Icon name="plus" size={16}/>ADICIONAR JOGADOR</button>}</header>{(workspace.error || error) && <p className="matches-error">{error || workspace.error}</p>}<section className="squad-list">{workspace.players.filter((player) => player.is_active).length ? workspace.players.filter((player) => player.is_active).map((player) => <article key={player.id}><Avatar name={player.display_name} logo={player.avatar_path ? workspace.assetUrl(player.avatar_path) : ""}/><div><b>{player.display_name}</b><small>{player.positions?.join(" · ") || "Posição não definida"}</small></div>{player.member_type === "teste" && <em className="test-tag">TESTE{player.trial_expires_at ? ` · até ${datePart(player.trial_expires_at)}` : ""}</em>}{canManage && <button className="icon-button" aria-label={`Remover ${player.display_name}`} onClick={() => void workspace.removePlayer(player.id).catch((removeError) => setError(removeError.message))}><Icon name="trash" size={16}/></button>}</article>) : <div className="matches-empty">O elenco FC 27 começa vazio. Adicione os jogadores oficiais quando estiver pronto.</div>}</section>{modal && <div className="match-manual-backdrop"><form className="match-manual-modal squad-modal-v2" onSubmit={submit}><header><div><span>ELENCO · NOVO PERFIL</span><h2>Adicionar jogador</h2><p>O preview acompanha a ficha antes de entrar no elenco.</p></div><button type="button" className="icon-button" onClick={close} aria-label="Fechar"><Icon name="close"/></button></header><div className="squad-editor"><section className="manual-form-grid"><label className="manual-full">NOME DE EXIBIÇÃO<input autoFocus value={draft.display_name} onChange={(event) => setDraft((current) => ({ ...current, display_name:event.target.value }))} placeholder="Como aparece no time"/></label><label className="manual-full logo-drop">FOTO DO JOGADOR<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)}/><span><Icon name="upload" size={17}/>{photo ? photo.name : "Enviar foto do computador"}</span></label><fieldset className="position-picker manual-full"><legend>POSIÇÕES EM QUE JOGA</legend>{positions.map((position) => <button type="button" className={draft.positions.includes(position) ? "selected" : ""} key={position} onClick={() => setDraft((current) => ({ ...current, positions:current.positions.includes(position) ? current.positions.filter((item) => item !== position) : [...current.positions, position] }))}>{position}</button>)}</fieldset><fieldset className="member-picker manual-full"><legend>VÍNCULO COM O TIME</legend><button type="button" className={draft.member_type === "complete" ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, member_type:"complete", trial_expires_at:"" }))}><b>COMPLETE</b><small>Fixo no elenco</small></button><button type="button" className={draft.member_type === "teste" ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, member_type:"teste" }))}><b>TESTE</b><small>Identificado em toda a escalação</small></button></fieldset>{draft.member_type === "teste" && <label className="manual-full">TESTE ATÉ<input type="date" value={draft.trial_expires_at} onChange={(event) => setDraft((current) => ({ ...current, trial_expires_at:event.target.value }))}/></label>}</section><aside className="squad-preview"><span>PREVIEW DO ELENCO</span><Avatar name={draft.display_name || "?"} logo={previewUrl}/><small>{draft.positions[0] || "POSIÇÃO"}</small><h3>{draft.display_name || "NOME DO JOGADOR"}</h3><p>{draft.member_type === "teste" ? "Jogador em teste" : "Jogador completo"}</p></aside></div><footer><button type="button" className="secondary" onClick={close}>CANCELAR</button><button className="primary"><Icon name="upload" size={16}/>SALVAR JOGADOR</button></footer></form></div>}</section>;
}

function SquadPageV3({ workspace, profile }) {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const returnFocusRef = useRef(null);
  const canCreate = canCreatePlayer(profile);
  const canEdit = canManagePlayers(profile);
  const canArchive = canArchivePlayer(profile);
  const emptyDraft = { display_name: "", positions: [], member_type: "elenco", shirt_number: "", trial_expires_at: "" };
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [actionMenu, setActionMenu] = useState("");
  const positions = ["GOL", "ZAG", "ALA", "VOL", "MC", "MEI", "ATA"];
  const previewUrl = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  const currentAvatar = previewUrl || (editing?.avatar_path ? workspace.assetUrl(editing.avatar_path) : editing?.external_avatar_url || "");

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const close = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setPhoto(null);
    setError("");
    requestAnimationFrame(() => returnFocusRef.current?.isConnected && returnFocusRef.current.focus({ preventScroll: true }));
  };
  const openCreate = () => {
    returnFocusRef.current = document.activeElement;
    setEditing({});
    setDraft(emptyDraft);
    setPhoto(null);
    setError("");
  };
  const openEdit = (player) => {
    returnFocusRef.current = document.querySelector(`[aria-label="${CSS.escape(`Ações de ${player.display_name}`)}"]`);
    setEditing(player);
    setDraft({
      display_name: player.display_name || "",
      positions: player.positions || [],
      member_type: player.member_type || "elenco",
      shirt_number: player.shirt_number ?? "",
      trial_expires_at: player.trial_expires_at ? String(player.trial_expires_at).slice(0, 10) : "",
    });
    setPhoto(null);
    setError("");
  };
  const togglePosition = (position) => setDraft((current) => ({
    ...current,
    positions: current.positions.includes(position)
      ? current.positions.filter((item) => item !== position)
      : [...current.positions, position],
  }));
  const save = async (event) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!draft.display_name.trim()) throw new Error("Informe o nome do jogador.");
      if (!draft.positions.length) throw new Error("Escolha ao menos uma posição.");
      const result = await workspace.savePlayer({ ...draft, id: editing?.id, avatar_path: editing?.avatar_path || null }, photo);
      notify(result?.reactivated ? "Jogador reativado. Perfil e histórico preservados." : "Jogador salvo. Elenco atualizado.");
      close();
    } catch (saveError) {
      setError(saveError.message || "Não foi possível salvar o jogador.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const classify = (player) => {
    const playerPositions = (player.positions || []).map((position) => String(position).toUpperCase());
    if (playerPositions.includes("GOL")) return "goalkeeper";
    if (playerPositions.includes("ZAG")) return "defenders";
    if (playerPositions.some((position) => ["MC", "VOL", "ALA", "MEI"].includes(position))) return "midfielders";
    return "attackers";
  };
  const groups = [
    ["goalkeeper", "GOLEIRO", "GOL"],
    ["defenders", "DEFENSORES", "ZAG"],
    ["midfielders", "MEIO-CAMPISTAS", "MC · VOL · ALAS"],
    ["attackers", "ATACANTES", "ATA"],
  ];
  const activePlayers = workspace.players.filter((player) => player.is_active);
  const gamesForPlayer = (player) => {
    const names = new Set([
      normalizeTeamName(player.display_name),
      ...workspace.aliases.filter((alias) => alias.player_id === player.id).map((alias) => normalizeTeamName(alias.ea_name)),
    ]);
    return workspace.matches.filter((match) => currentMatchPerformance(match).players?.some((row) => names.has(normalizeTeamName(row.eaName || row.name)))).length;
  };

  return (
    <section className="data-page page-enter squad-page-v3">
      <header className="data-page-header">
        <div><span>ELENCO DO CLUBE</span><h1>Squad FC 27.</h1><p>Posições e vínculos organizados para escalar sem procurar jogador.</p></div>
        {canCreate && <div className="squad-header-actions"><Suspense fallback={<span className="roster-tools-loading">CARREGANDO FERRAMENTAS…</span>}><RosterTools workspace={workspace} /></Suspense><button className="primary" onClick={openCreate}><Icon name="plus" size={16} />ADICIONAR JOGADOR</button></div>}
      </header>
      {(workspace.error || error) && <p className="matches-error">{error || workspace.error}</p>}
      {activePlayers.length ? groups.map(([id, title, description]) => {
        const players = activePlayers.filter((player) => classify(player) === id);
        return (
          <section className={`squad-sector ${players.some((player) => player.id === actionMenu) ? "has-open-menu" : ""}`} key={id}>
            <header><div><span>{title}</span><small>{description}</small></div><b>{players.length}</b></header>
            {players.length ? <div className="squad-list squad-compact-list">{players.map((player) => <article className={`squad-player-card ${actionMenu === player.id ? "has-open-menu" : ""}`} key={player.id}>
              <Avatar name={player.display_name} logo={player.avatar_path ? workspace.assetUrl(player.avatar_path) : player.external_avatar_url || ""} kind="photo" />
              <div className="squad-card-identity"><b>{player.display_name}</b><small>{player.positions?.join(" · ") || "Posição não definida"}</small><span>{gamesForPlayer(player)} jogo(s)</span></div>
              <strong className="squad-shirt-number">{player.shirt_number === null || player.shirt_number === undefined ? "—" : `#${String(player.shirt_number).padStart(2, "0")}`}</strong>
              <em className={`member-tag ${player.member_type || "elenco"}`}>{player.member_type === "teste" ? `TESTE${player.trial_expires_at ? ` · até ${datePart(player.trial_expires_at)}` : ""}` : player.member_type === "complete" ? "COMPLETE" : "ELENCO"}</em>
              {(canEdit || canArchive) && <div className="squad-context"><button className="squad-more" aria-label={`Ações de ${player.display_name}`} aria-expanded={actionMenu === player.id} onClick={() => setActionMenu((current) => current === player.id ? "" : player.id)}>•••</button>{actionMenu === player.id && <div className="squad-context-menu">{canEdit && <button onClick={() => { setActionMenu(""); openEdit(player); }}><Icon name="edit" size={14} />Editar</button>}{canArchive && <button className="danger" onClick={() => { setActionMenu(""); void workspace.removePlayer(player.id).catch((removeError) => setError(removeError.message)); }}><Icon name="trash" size={14} />Arquivar</button>}</div>}</div>}
            </article>)}</div> : <p className="squad-sector-empty">Nenhum jogador nesta faixa.</p>}
          </section>
        );
      }) : <div className="matches-empty">O elenco FC 27 começa vazio. Adicione os jogadores oficiais quando estiver pronto.</div>}
      {editing !== null && <ViewportDialog className="match-manual-backdrop squad-dialog-layer" onClose={() => { if (!savingRef.current) close(); }}><form className="match-manual-modal squad-modal-v2" role="dialog" aria-modal="true" aria-labelledby="squad-editor-title" aria-busy={saving} onSubmit={save}>
        <header><div><span>ELENCO · {editing?.id ? "EDITAR PERFIL" : "NOVO PERFIL"}</span><h2 id="squad-editor-title">{editing?.id ? "Editar jogador" : "Adicionar jogador"}</h2><p>O preview acompanha a ficha antes de entrar no elenco.</p></div><CloseButton onClick={close} disabled={saving} /></header>
        <div className="squad-editor"><section className="manual-form-grid">
          <label className="manual-full">NOME DE EXIBIÇÃO<input autoFocus value={draft.display_name} onChange={(event) => setDraft((current) => ({ ...current, display_name: event.target.value }))} placeholder="Como aparece no time" /></label>
          <label>NÚMERO<input type="number" min="0" max="99" value={draft.shirt_number} onChange={(event) => setDraft((current) => ({ ...current, shirt_number: event.target.value }))} placeholder="10" disabled={Boolean(editing?.id) && !canEditPlayerNumber(profile)} /></label>
          <label className={`manual-full logo-drop${editing?.id && !canEditPlayerPhoto(profile) ? " is-locked" : ""}`}>{editing?.id && !canEditPlayerPhoto(profile)
            ? <><span>FOTO DO JOGADOR</span><span>Somente Desenvolvimento altera a foto depois do cadastro.</span></>
            : <><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /><span><Icon name="upload" size={17} />{photo ? photo.name : editing?.avatar_path ? "Trocar foto do computador" : "Enviar foto do computador"}</span></>}</label>
          <fieldset className="position-picker manual-full"><legend>POSIÇÕES EM QUE JOGA</legend>{positions.map((position) => <button type="button" className={draft.positions.includes(position) ? "selected" : ""} key={position} onClick={() => togglePosition(position)}>{position}</button>)}</fieldset>
          <fieldset className="member-picker member-picker-three manual-full"><legend>VÍNCULO COM O TIME</legend>
            <button type="button" className={draft.member_type === "elenco" ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, member_type: "elenco", trial_expires_at: "" }))}><b>ELENCO</b><small>Jogador do elenco</small></button>
            <button type="button" className={draft.member_type === "teste" ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, member_type: "teste" }))}><b>TESTE</b><small>Em avaliação</small></button>
            <button type="button" className={draft.member_type === "complete" ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, member_type: "complete", trial_expires_at: "" }))}><b>COMPLETE</b><small>Fixo no time</small></button>
          </fieldset>
          {draft.member_type === "teste" && <label className="manual-full">TESTE ATÉ<input type="date" value={draft.trial_expires_at} onChange={(event) => setDraft((current) => ({ ...current, trial_expires_at: event.target.value }))} /></label>}
        </section><aside className="squad-preview"><span>PREVIEW DO ELENCO</span><Avatar name={draft.display_name || "?"} logo={currentAvatar} kind="photo" /><small>{draft.positions[0] || "POSIÇÃO"}</small><h3>{draft.display_name || "NOME DO JOGADOR"}</h3><p>{draft.member_type === "teste" ? "Jogador em teste" : draft.member_type === "complete" ? "Jogador completo" : "Jogador do elenco"}</p></aside></div>
        <footer>{error && <p className="squad-save-error" role="alert">{error}</p>}<div><button type="button" className="secondary" onClick={close} disabled={saving}>CANCELAR</button><button className="primary" disabled={saving}><Icon name="upload" size={16} />{saving ? "SALVANDO…" : editing?.id ? "SALVAR ALTERAÇÕES" : "SALVAR JOGADOR"}</button></div></footer>
      </form></ViewportDialog>}
    </section>
  );
}
function FeatureBoundary({ children, type = "table" }) {
  return <Suspense fallback={<WorkspaceSkeleton type={type}/>}>{children}</Suspense>;
}

function DataPage({ id, workspace, profile, client }) {
  if (!canViewPage(profile, id)) return <AccessDenied page={id} />;
  const statisticalMatches = (workspace.matches || []).map((match) => ({ ...match, performance: currentMatchPerformance(match) }));
  if (id === "estatisticas") return <FeatureBoundary type="statistics"><StatisticsPage workspace={workspace} matches={statisticalMatches}/></FeatureBoundary>;
  if (id === "analise") return <FeatureBoundary type="analysis"><AnalysisPage workspace={workspace} profile={profile} matches={statisticalMatches}/></FeatureBoundary>;
  if (id === "biblioteca") return <FeatureBoundary type="library"><LibraryPage client={client} profile={profile}/></FeatureBoundary>;
  if (id === "desenvolvedor") return <FeatureBoundary><DeveloperPage client={client} profile={profile} workspace={workspace}/></FeatureBoundary>;
  if (id === "midia") return <FeatureBoundary><MediaPage profile={profile} client={client} workspace={workspace}/></FeatureBoundary>;
  const matches = workspace.matches;
  const agenda = workspace.agenda;
  const completed = matches.length;
  const wins = matches.filter((match) => match.strix_score > match.opponent_score).length;
  const goalsFor = matches.reduce((total, match) => total + match.strix_score, 0);
  const goalsAgainst = matches.reduce((total, match) => total + match.opponent_score, 0);
  const details = {
    campeonatos: ["CAMPEONATOS", "Competições ativas.", "Cada competição é formada pelos jogos reais da Agenda."],
    estatisticas: ["ESTATÍSTICAS", "Leitura da temporada.", "Os indicadores entram conforme as partidas forem importadas."],
    analise: ["ANÁLISE", "Sala de análise.", "Cruze resultados, adversários e desempenho sem preencher dados fictícios."],
    biblioteca: ["BIBLIOTECA", "Jogadas e reviews.", "A biblioteca FC 27 recebe os materiais quando a estrutura de mídia for liberada."],
    midia: ["MÍDIA", "Central social.", "Artes, Gameday e Resumo do Dia entram nesta nova temporada."],
    desenvolvedor: ["DESENVOLVEDOR", "Saúde do sistema.", "Auditoria e diagnósticos ficam disponíveis apenas para Desenvolvimento."],
  };
  const [eyebrow, title, description] = details[id] || ["STRIX FC 27", "Em construção.", ""];
  return <section className="data-page page-enter"><header className="data-page-header"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></header>{id === "campeonatos" ? <section className="data-grid">{agenda.length ? [...new Set(agenda.map((game) => game.competition_name))].map((competition) => <article className="data-card" key={competition}><Icon name="trophy"/><small>COMPETIÇÃO</small><h2>{competition}</h2><p>{agenda.filter((game) => game.competition_name === competition).length} partida(s) na agenda.</p></article>) : <div className="matches-empty">A Agenda ainda não possui campeonatos cadastrados.</div>}</section> : id === "estatisticas" || id === "analise" ? <><section className="data-grid"><article className="data-card"><small>PARTIDAS</small><h2>{completed}</h2><p>Registros no histórico.</p></article><article className="data-card"><small>VITÓRIAS</small><h2>{wins}</h2><p>Resultados positivos.</p></article><article className="data-card"><small>GOLS PRÓ</small><h2>{goalsFor}</h2><p>Produção ofensiva.</p></article><article className="data-card"><small>GOLS CONTRA</small><h2>{goalsAgainst}</h2><p>Leitura defensiva.</p></article></section><section className="analysis-line"><span>LINHA DA TEMPORADA</span><div>{matches.length ? matches.slice(0,10).reverse().map((match) => <i key={match.id} className={match.strix_score > match.opponent_score ? "win" : match.strix_score < match.opponent_score ? "loss" : "draw"}/>) : <p>Importe partidas para montar a leitura.</p>}</div></section></> : <section className="empty-section"><Icon name={id === "biblioteca" ? "library" : id === "midia" ? "media" : "details"} size={28}/><h2>Base pronta para a próxima fase.</h2><p>{description}</p></section>}</section>;
}
function Placeholder({ title }) {
  return (
    <section className="placeholder page-enter">
      <span>STRIX UNITED · FC 27</span>
      <h1>{title}</h1>
      <p>Essa área entra na próxima etapa da nova base.</p>
    </section>
  );
}
function Partidas({ profile }) {
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loadingSource, setLoadingSource] = useState("");
  const [error, setError] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState(() => ({
    opponent: "",
    date: new Date().toISOString().slice(0, 10),
    time: "21:10",
    strixScore: "0",
    opponentScore: "0",
    competition: "Amistoso",
  }));
  const [imported, setImported] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(eaImportedKey) || "[]");
    } catch {
      return [];
    }
  });
  const canImport = ["diretoria", "dev"].includes(profile?.access_tier);
  const loadMatches = async () => {
    if (!canImport) {
      setError("A busca oficial da EA e reservada a Diretoria e Desenvolvimento.");
      return;
    }
    setLoadingSource("cloud");
    setError("");
    try {
      const client = await getBrowserSupabase();
      const { data } = await client.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sua sessao expirou. Entre novamente com o Discord.");
      const response = await fetch("/api/ea/matches", {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || "Nao foi possivel consultar a EA.");
      const normalized = (payload.matches || []).map(normalizeEaMatch);
      setMatches(normalized);
      setSelected(new Set(normalized.map((match) => match.id)));
    } catch (requestError) {
      setError(requestError.message || "Nao foi possivel consultar a EA.");
    } finally {
      setLoadingSource("");
    }
  };
  const loadMatchesFromComputer = async () => {
    if (!canImport) {
      setError("A importacao fica reservada a Diretoria e Desenvolvimento.");
      return;
    }
    setLoadingSource("computer");
    setError("");
    try {
      const response = await fetch("http://127.0.0.1:8789/api/ea/matches", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "A ponte local nao conseguiu consultar a EA.");
      const normalized = (payload.matches || []).map(normalizeEaMatch);
      if (!normalized.length) throw new Error("A EA respondeu, mas nao retornou partidas para este clube.");
      setMatches(normalized);
      setSelected(new Set(normalized.map((match) => match.id)));
    } catch (requestError) {
      const message = requestError.message || "A ponte local nao respondeu.";
      setError(message.includes("fetch") || message.includes("NetworkError")
        ? "Ponte local indisponivel. Abra INICIAR-PONTE-EA-FC27.cmd e tente de novo."
        : message);
    } finally {
      setLoadingSource("");
    }
  };
  const toggleMatch = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const importSelected = () => {
    const chosen = matches.filter((match) => selected.has(match.id));
    if (!chosen.length) return;
    const merged = [...imported];
    chosen.forEach((match) => {
      const position = merged.findIndex((entry) => entry.id === match.id);
      if (position >= 0) merged[position] = match;
      else merged.unshift(match);
    });
    merged.sort((left, right) => new Date(right.date) - new Date(left.date));
    localStorage.setItem(eaImportedKey, JSON.stringify(merged));
    setImported(merged);
  };
  const saveManualMatch = (event) => {
    event.preventDefault();
    if (!manualDraft.opponent.trim()) {
      setError("Informe o adversario para salvar a partida manual.");
      return;
    }
    const match = makeManualMatch(manualDraft);
    const merged = [match, ...imported.filter((entry) => entry.id !== match.id)];
    merged.sort((left, right) => new Date(right.date) - new Date(left.date));
    localStorage.setItem(eaImportedKey, JSON.stringify(merged));
    setImported(merged);
    setMatches([]);
    setError("");
    setManualOpen(false);
  };
  const rows = matches.length ? matches : imported;
  return (
    <section className="matches-page page-enter">
      <header className="matches-hero">
        <div>
          <span>PARTIDAS DO CLUBE</span>
          <h1>Historico de jogo.</h1>
          <p>Busque os resultados oficiais da EA e escolha o que entra no Strix FC 27.</p>
        </div>
        <div className="matches-actions">
          <button className="secondary" onClick={loadMatchesFromComputer} disabled={Boolean(loadingSource)}>
            <Icon name="game" size={16} />
            {loadingSource === "computer" ? "CONSULTANDO SEU PC" : "BUSCAR PELO MEU PC"}
          </button>
          <button className="secondary" onClick={loadMatches} disabled={Boolean(loadingSource)}>
            <Icon name="search" size={16} />
            {loadingSource === "cloud" ? "CONSULTANDO EA" : "BUSCAR NA EA"}
          </button>
          <button className="secondary" onClick={() => { setError(""); setManualOpen(true); }}>
            <Icon name="plus" size={16} />
            ADICIONAR MANUAL
          </button>
          <button className="primary" onClick={importSelected} disabled={!matches.length || !selected.size}>
            <Icon name="upload" size={16} />
            IMPORTAR SELECIONADAS
          </button>
        </div>
      </header>
      {!canImport && (
        <p className="matches-permission">A importacao oficial fica disponivel para Diretoria e Desenvolvimento.</p>
      )}
      {error && <p className="matches-error">{error}</p>}
      <section className="matches-list" aria-label="Partidas importadas da EA">
        <header>
          <span>DATA</span><span>PARTIDA</span><span>PLACAR</span><span>ORIGEM</span>
        </header>
        {rows.length ? rows.map((match) => {
          const result = match.strixScore > match.opponentScore ? "VITORIA" : match.strixScore < match.opponentScore ? "DERROTA" : "EMPATE";
          return (
            <article key={match.id} className={selected.has(match.id) ? "is-selected" : ""}>
              <label className="match-select">
                {matches.length > 0 && <input type="checkbox" checked={selected.has(match.id)} onChange={() => toggleMatch(match.id)} />}
                <span>{match.dateLabel}<small>{match.timeLabel}</small></span>
              </label>
              <div className="match-teams"><Crest small /><b>STRIX</b><strong>{match.strixScore} x {match.opponentScore}</strong><b>{match.opponent}</b><Avatar name={match.opponent} /></div>
              <em className={result.toLowerCase()}>{result}</em>
              <small>{match.competition}</small>
            </article>
          );
        }) : (
          <div className="matches-empty">Use BUSCAR NA EA para consultar os dez ultimos jogos do clube.</div>
        )}
      </section>
      {manualOpen && (
        <div className="match-manual-backdrop" role="presentation">
          <form className="match-manual-modal" onSubmit={saveManualMatch}>
            <header>
              <div>
                <span>FALLBACK DO TIME</span>
                <h2>Adicionar partida manual</h2>
                <p>Use quando a EA estiver indisponivel. O registro entra na mesma lista de Partidas.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setManualOpen(false)}><Icon name="close" /></button>
            </header>
            <div className="manual-form-grid">
              <label className="manual-full">ADVERSARIO<input autoFocus value={manualDraft.opponent} onChange={(event) => setManualDraft((current) => ({ ...current, opponent: event.target.value }))} placeholder="Ex.: Playmaker ES" /></label>
              <label>DATA<input type="date" value={manualDraft.date} onChange={(event) => setManualDraft((current) => ({ ...current, date: event.target.value }))} /></label>
              <label>HORA<input type="time" value={manualDraft.time} onChange={(event) => setManualDraft((current) => ({ ...current, time: event.target.value }))} /></label>
              <label>STRIX<input min="0" type="number" value={manualDraft.strixScore} onChange={(event) => setManualDraft((current) => ({ ...current, strixScore: event.target.value }))} /></label>
              <label>ADVERSARIO<input min="0" type="number" value={manualDraft.opponentScore} onChange={(event) => setManualDraft((current) => ({ ...current, opponentScore: event.target.value }))} /></label>
              <label className="manual-full">COMPETICAO<input value={manualDraft.competition} onChange={(event) => setManualDraft((current) => ({ ...current, competition: event.target.value }))} placeholder="Amistoso, liga ou copa" /></label>
            </div>
            <footer>
              <button type="button" className="secondary" onClick={() => setManualOpen(false)}>CANCELAR</button>
              <button className="primary" type="submit"><Icon name="upload" size={16} />SALVAR PARTIDA</button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
function MatchDetails({ match, close }) {
  if (!match) return null;
  const performance = currentMatchPerformance(match);
  const playerRows = Array.isArray(performance.players) ? performance.players : [];
  const metrics = [
    ["passes", "PASSES", performance.passes],
    ["goal", "CHUTES", performance.shots],
    ["shield", "DESARMES", performance.tackles],
    ["squad", "NOTA MÉDIA", performance.averageRating],
    ["shield", "DEFESAS", performance.goalkeeperSaves],
  ];
  return <div className="match-manual-backdrop"><section className="match-details-modal"><header><div><span>HISTÓRICO DA PARTIDA</span><h2>Strix {match.strix_score} x {match.opponent_score} {match.opponent_name}</h2><p>{datePart(match.played_at)} · {match.competition_name} · {match.source === "ea_api" || match.source === "local_bridge" ? "API EA" : "MANUAL"}</p></div><button className="icon-button" onClick={close} aria-label="Fechar"><Icon name="close" /></button></header><div className="match-metric-grid">{metrics.map(([icon,label,value]) => <article key={label}><Icon name={icon} /><small>{label}</small><b>{value ?? "—"}</b></article>)}</div><section className="match-player-data"><h3>Dados individuais</h3>{playerRows.length ? <div>{playerRows.map((player,index) => <article key={player.id || index}><b>{player.name || "Jogador EA"}</b><span>Nota {player.rating ?? "—"}</span><span>Passes {player.passes ?? "—"}</span><span>G+A {player.goalAssists ?? player.goals ?? "—"}</span></article>)}</div> : <p>A API desta partida não entregou dados individuais. O placar e o registro permanecem salvos.</p>}</section><footer><button className="secondary" onClick={close}>FECHAR</button></footer></section></div>;
}

function MatchDetailsV2({ match, close }) {
  const performance = currentMatchPerformance(match);
  const playerRows = Array.isArray(performance.players) ? performance.players : [];
  const value = (item) => item === null || item === undefined || item === "" ? "—" : item;
  const metrics = [
    ["pass", "PASSES", performance.passes],
    ["goal", "CHUTES", performance.shots],
    ["shield", "DESARMES", performance.tackles],
    ["stats", "NOTA MÉDIA", performance.averageRating],
    ["squad", "DEFESAS", performance.goalkeeperSaves],
  ];
  return <div className="match-manual-backdrop"><section className="match-details-modal match-details-v2"><header><div><span>HISTÓRICO DA PARTIDA</span><h2>Strix {match.strix_score} × {match.opponent_score} {match.opponent_name}</h2><p>{datePart(match.played_at)} · {match.competition_name}</p></div><button className="icon-button" onClick={close} aria-label="Fechar"><Icon name="close" /></button></header><div className="match-metric-grid">{metrics.map(([icon, label, item]) => <article key={label}><Icon name={icon} /><small>{label}</small><b>{value(item)}</b></article>)}</div><section className="match-player-data"><header><div><span>DADOS INDIVIDUAIS</span><h3>Leitura de quem entrou em campo</h3></div><small>{playerRows.length ? `${playerRows.length} jogador(es) importados da EA` : "A API não enviou a ficha individual nesta partida"}</small></header>{playerRows.length ? <div className="match-player-table"><div className="match-player-table-head"><span>JOGADOR</span><span>NOTA</span><span>G+A</span><span>PASSES</span><span>CHUTES</span><span>DESARMES</span><span>DEFESAS</span></div>{playerRows.map((player, index) => <article key={player.id || index}><b>{player.name || player.eaName || "Jogador EA"}<small>{player.position || "EA FC"}</small></b><span>{value(player.rating)}</span><span>{value(player.goalAssists)}</span><span>{value(player.passes)}</span><span>{value(player.shots)}</span><span>{value(player.tackles)}</span><span>{value(player.saves)}</span></article>)}</div> : <p>O placar foi salvo, mas esta resposta da EA não trouxe as estatísticas individuais. Uma nova busca só substitui os dados quando a fonte realmente os entregar.</p>}</section><footer><button className="secondary" onClick={close}>FECHAR</button></footer></section></div>;
}

function PartidasLiveV2({ profile, workspace }) {
  const canManage = ["diretoria", "dev"].includes(profile?.access_tier);
  const [found, setFound] = useState([]);
  const [foundSource, setFoundSource] = useState("ea_api");
  const [selected, setSelected] = useState(() => new Set());
  const [loadingSource, setLoadingSource] = useState("");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [linkPicker, setLinkPicker] = useState("");
  const [aliasPicker, setAliasPicker] = useState("");
  const [aliases, setAliases] = useState({});
  const [manualDraft, setManualDraft] = useState({ opponent: "", date: new Date().toISOString().slice(0, 10), time: "21:10", strixScore: "0", opponentScore: "0", competition: "Amistoso" });
  const activeAgenda = workspace.agenda.filter((item) => !["cancelled", "completed"].includes(item.status));
  const getKnownPlayer = (eaName) => workspace.aliases.find((item) => normalizeTeamName(item.ea_name) === normalizeTeamName(eaName))?.player_id
    || workspace.players.find((item) => normalizeTeamName(item.display_name) === normalizeTeamName(eaName))?.id
    || "";
  const applyFound = (rows, source) => {
    const defaults = {};
    rows.forEach((item) => (item.performance?.players || []).forEach((player) => { if (player.eaName) defaults[normalizeTeamName(player.eaName)] = getKnownPlayer(player.eaName); }));
    setAliases(defaults);
    setFound(rows.map((item) => {
      const sameDay = activeAgenda.filter((agenda) => datePart(agenda.scheduled_at) === item.dateLabel);
      const linked = sameDay.find((agenda) => normalizeTeamName(agenda.opponent_name) === normalizeTeamName(item.opponent));
      return { ...item, agendaId: linked?.id || "", competition: item.competition || "Amistoso" };
    }));
    setSelected(new Set(rows.map((item) => item.id)));
    setFoundSource(source);
  };
  const load = async (source) => {
    if (!canManage) return setError("A importação oficial fica disponível para Diretoria e Desenvolvimento.");
    setError(""); setLoadingSource(source);
    try {
      let response;
      if (source === "computer") response = await fetch("http://127.0.0.1:8789/api/ea/matches", { cache: "no-store" });
      else { const client = await getBrowserSupabase(); const { data } = await client.auth.getSession(); response = await fetch("/api/ea/matches", { headers: { authorization: `Bearer ${data.session?.access_token || ""}` }, cache: "no-store" }); }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || "A fonte não retornou partidas.");
      const normalized = (payload.matches || []).map((match, index) => ({ ...normalizeEaMatch(match, index), raw: match }));
      if (!normalized.length) throw new Error("A fonte respondeu, mas não retornou partidas para este clube.");
      applyFound(normalized, source === "computer" ? "local_bridge" : "ea_api");
    } catch (requestError) { setError(requestError.message || "Não foi possível consultar as partidas."); }
    finally { setLoadingSource(""); }
  };
  const patchFound = (id, patch) => setFound((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const toggle = (id) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const importSelected = async () => {
    const chosen = found.filter((item) => selected.has(item.id));
    if (!chosen.length) return setError("Escolha ao menos uma partida.");
    if (chosen.some((item) => !item.competition.trim())) return setError("Toda partida selecionada precisa de competição.");
    try {
      for (const item of chosen) await workspace.upsertClubMatch(item, foundSource);
      const aliasRows = Object.entries(aliases).map(([normalized, playerId]) => {
        const row = chosen.flatMap((item) => item.performance?.players || []).find((player) => normalizeTeamName(player.eaName) === normalized);
        return row ? { eaName: row.eaName, playerId } : null;
      }).filter(Boolean);
      await workspace.savePlayerAliases(aliasRows);
      setFound([]); setSelected(new Set()); setAliases({});
    } catch (saveError) { setError(saveError.message || "Não foi possível salvar a importação."); }
  };
  const openManual = (match) => { setEditing(match || null); setManualDraft(match ? { opponent:match.opponent_name, date:new Date(match.played_at).toISOString().slice(0, 10), time:timePart(match.played_at), strixScore:String(match.strix_score), opponentScore:String(match.opponent_score), competition:match.competition_name } : { opponent:"", date:new Date().toISOString().slice(0, 10), time:"21:10", strixScore:"0", opponentScore:"0", competition:"Amistoso" }); setManualOpen(true); };
  const saveManual = async (event) => { event.preventDefault(); try { if (!manualDraft.opponent.trim()) throw new Error("Informe o adversário."); const item = makeManualMatch(manualDraft); if (editing) item.dbId = editing.id; await workspace.upsertClubMatch(item, "manual"); setManualOpen(false); setEditing(null); } catch (saveError) { setError(saveError.message || "Não foi possível salvar a partida."); } };
  const resultOf = (match) => match.strix_score > match.opponent_score ? "VITÓRIA" : match.strix_score < match.opponent_score ? "DERROTA" : "EMPATE";
  return <section className="matches-page page-enter"><header className="matches-hero"><div><span>PARTIDAS DO CLUBE</span><h1>Histórico de jogo.</h1><p>Importe, revise o contexto e mantenha a Agenda sincronizada com o resultado real.</p></div><div className="matches-actions"><button className="secondary" onClick={() => void load("computer")} disabled={Boolean(loadingSource)}><Icon name="game" size={16}/>{loadingSource === "computer" ? "CONSULTANDO SEU PC" : "BUSCAR PELO MEU PC"}</button><button className="secondary" onClick={() => void load("cloud")} disabled={Boolean(loadingSource)}><Icon name="search" size={16}/>{loadingSource === "cloud" ? "CONSULTANDO EA" : "BUSCAR NA EA"}</button>{canManage && <button className="secondary" onClick={() => openManual()}><Icon name="plus" size={16}/>ADICIONAR MANUAL</button>}</div></header>{(error || workspace.error) && <p className="matches-error">{error || workspace.error}</p>}<section className="matches-list matches-history"><header><span>DATA</span><span>PARTIDA</span><span>RESULTADO</span><span>COMPETIÇÃO</span><span>GESTÃO</span></header>{workspace.matches.length ? workspace.matches.map((match) => { const logo = match.opponent_logos?.storage_path ? workspace.assetUrl(match.opponent_logos.storage_path) : ""; const result = resultOf(match); return <article key={match.id}><span>{datePart(match.played_at)}<small>{timePart(match.played_at)}</small></span><div className="match-teams"><Crest small/><b>STRIX</b><strong>{match.strix_score} × {match.opponent_score}</strong><Avatar name={match.opponent_name} logo={logo}/><b>{match.opponent_name}</b></div><em className={result.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}>{result}</em><small>{match.competition_name || "AMISTOSO"}</small><div className="match-row-actions"><button title="Ver dados" onClick={() => setDetail(match)}><Icon name="details" size={16}/></button>{canManage && <><button title="Editar" onClick={() => openManual(match)}><Icon name="edit" size={16}/></button><button title="Excluir" onClick={() => void workspace.removeClubMatch(match.id).catch((removeError) => setError(removeError.message))}><Icon name="trash" size={16}/></button></>}</div></article>; }) : <div className="matches-empty">Ainda não há partidas no histórico. Busque a EA ou adicione um resultado manual.</div>}</section>{found.length > 0 && <section className="import-workbench"><header><div><span>IMPORTAÇÃO · REVISÃO</span><h2>Confira antes de salvar</h2><p>{selected.size} de {found.length} partida(s) selecionada(s).</p></div><div className="import-bulk-actions"><button className="secondary" onClick={() => setSelected(new Set(found.map((item) => item.id)))}>SELECIONAR TODAS</button><button className="secondary" onClick={() => setSelected(new Set())}>LIMPAR</button><button className="primary" onClick={() => void importSelected()}><Icon name="upload" size={16}/>CONFIRMAR IMPORTAÇÃO</button></div></header><div className="import-cards">{found.map((item) => { const agenda = activeAgenda.find((row) => row.id === item.agendaId); const itemPlayers = item.performance?.players || []; return <article className={selected.has(item.id) ? "selected" : ""} key={item.id}><button className="import-check" onClick={() => toggle(item.id)} aria-label={`Selecionar ${item.opponent}`}>{selected.has(item.id) ? "✓" : ""}</button><div className="import-match-main"><small>{item.dateLabel} · {item.timeLabel}</small><h3>STRIX {item.strixScore} × {item.opponentScore} {item.opponent}</h3><label>COMPETIÇÃO<input value={item.competition} onChange={(event) => patchFound(item.id, { competition:event.target.value })} placeholder="Amistoso, liga ou copa"/></label></div><div className="import-link"><span>VÍNCULO COM A AGENDA</span><button className="picker-button" onClick={() => setLinkPicker(linkPicker === item.id ? "" : item.id)}>{agenda ? `${agenda.opponent_name} · ${timePart(agenda.scheduled_at)}` : "Sem vínculo"}<Icon name="arrow" size={15}/></button>{linkPicker === item.id && <div className="picker-menu"><button onClick={() => { patchFound(item.id, { agendaId:"" }); setLinkPicker(""); }}>Sem vínculo</button>{activeAgenda.map((row) => <button key={row.id} onClick={() => { patchFound(item.id, { agendaId:row.id }); setLinkPicker(""); }}>{timePart(row.scheduled_at)} · {row.opponent_name}</button>)}</div>}</div>{itemPlayers.length > 0 && <div className="import-players"><span>EA → ELENCO</span>{itemPlayers.map((player) => { const aliasKey = normalizeTeamName(player.eaName); const linkedPlayer = workspace.players.find((row) => row.id === aliases[aliasKey]); return <div key={`${item.id}-${player.id}`}><b>{player.eaName}</b><button className="picker-button" onClick={() => setAliasPicker(aliasPicker === aliasKey ? "" : aliasKey)}>{linkedPlayer?.display_name || "Fora do elenco"}<Icon name="arrow" size={14}/></button>{aliasPicker === aliasKey && <div className="picker-menu player-picker"><button onClick={() => { setAliases((current) => ({ ...current, [aliasKey]:"" })); setAliasPicker(""); }}>Fora do elenco</button>{workspace.players.filter((row) => row.is_active).map((row) => <button key={row.id} onClick={() => { setAliases((current) => ({ ...current, [aliasKey]:row.id })); setAliasPicker(""); }}>{row.display_name}</button>)}</div>}</div>; })}</div>}</article>; })}</div></section>}{manualOpen && <div className="match-manual-backdrop"><form className="match-manual-modal" onSubmit={saveManual}><header><div><span>REGISTRO DO CLUBE</span><h2>{editing ? "Editar partida" : "Adicionar partida manual"}</h2><p>O resultado entra no histórico e sincroniza com a leitura da temporada.</p></div><button type="button" className="icon-button" onClick={() => setManualOpen(false)} aria-label="Fechar"><Icon name="close"/></button></header><div className="manual-form-grid"><label className="manual-full">ADVERSÁRIO<input autoFocus value={manualDraft.opponent} onChange={(event) => setManualDraft((current) => ({ ...current, opponent:event.target.value }))}/></label><label>DATA<input type="date" value={manualDraft.date} onChange={(event) => setManualDraft((current) => ({ ...current, date:event.target.value }))}/></label><label>HORA<input type="time" value={manualDraft.time} onChange={(event) => setManualDraft((current) => ({ ...current, time:event.target.value }))}/></label><label>STRIX<input type="number" min="0" value={manualDraft.strixScore} onChange={(event) => setManualDraft((current) => ({ ...current, strixScore:event.target.value }))}/></label><label>ADVERSÁRIO<input type="number" min="0" value={manualDraft.opponentScore} onChange={(event) => setManualDraft((current) => ({ ...current, opponentScore:event.target.value }))}/></label><label className="manual-full">COMPETIÇÃO<input value={manualDraft.competition} onChange={(event) => setManualDraft((current) => ({ ...current, competition:event.target.value }))} placeholder="Amistoso, liga ou copa"/></label></div><footer><button type="button" className="secondary" onClick={() => setManualOpen(false)}>CANCELAR</button><button className="primary"><Icon name="upload" size={16}/>SALVAR PARTIDA</button></footer></form></div>}{detail && <MatchDetailsV2 match={detail} close={() => setDetail(null)}/>}</section>;
}
function PartidasLive({ profile, workspace }) {
  const [found, setFound] = useState([]);
  const [foundSource, setFoundSource] = useState("ea_api");
  const [selected, setSelected] = useState(() => new Set());
  const [loadingSource, setLoadingSource] = useState("");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [manualDraft, setManualDraft] = useState({ opponent: "", date: new Date().toISOString().slice(0, 10), time: "21:10", strixScore: "0", opponentScore: "0", competition: "Amistoso" });
  const canManage = ["diretoria", "dev"].includes(profile?.access_tier);
  const load = async (source) => {
    if (!canManage) return setError("A importação oficial fica disponível para Diretoria e Desenvolvimento.");
    setError(""); setLoadingSource(source);
    try {
      let response;
      if (source === "computer") response = await fetch("http://127.0.0.1:8789/api/ea/matches", { cache: "no-store" });
      else {
        const client = await getBrowserSupabase(); const { data } = await client.auth.getSession();
        response = await fetch("/api/ea/matches", { headers: { authorization: `Bearer ${data.session?.access_token || ""}` }, cache: "no-store" });
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || payload.error || "A fonte não retornou partidas.");
      const normalized = (payload.matches || []).map((match, index) => ({ ...normalizeEaMatch(match, index), raw: match }));
      if (!normalized.length) throw new Error("A fonte respondeu, mas não retornou partidas para este clube.");
      setFound(normalized); setFoundSource(source === "computer" ? "local_bridge" : "ea_api"); setSelected(new Set(normalized.map((match) => match.id)));
    } catch (requestError) {
      setError(requestError.message || "Não foi possível consultar as partidas.");
    } finally { setLoadingSource(""); }
  };
  const importSelected = async () => {
    try {
      const chosen = found.filter((match) => selected.has(match.id));
      if (!chosen.length) return;
      for (const match of chosen) await workspace.upsertClubMatch(match, foundSource);
      setFound([]); setSelected(new Set());
    } catch (saveError) { setError(saveError.message || "Não foi possível salvar a importação."); }
  };
  const openManual = (match) => {
    setEditing(match || null);
    setManualDraft(match ? { opponent: match.opponent_name, date: new Date(match.played_at).toISOString().slice(0,10), time: timePart(match.played_at), strixScore: String(match.strix_score), opponentScore: String(match.opponent_score), competition: match.competition_name } : { opponent:"", date:new Date().toISOString().slice(0,10), time:"21:10", strixScore:"0", opponentScore:"0", competition:"Amistoso" });
    setManualOpen(true);
  };
  const saveManual = async (event) => {
    event.preventDefault();
    try {
      if (!manualDraft.opponent.trim()) throw new Error("Informe o adversário.");
      const item = makeManualMatch(manualDraft);
      if (editing) item.dbId = editing.id;
      await workspace.upsertClubMatch(item, "manual");
      setManualOpen(false); setEditing(null);
    } catch (saveError) { setError(saveError.message || "Não foi possível salvar a partida."); }
  };
  const rows = workspace.matches;
  return <section className="matches-page page-enter"><header className="matches-hero"><div><span>PARTIDAS DO CLUBE</span><h1>Histórico de jogo.</h1><p>Dados oficiais da EA e registros manuais na mesma linha do tempo.</p></div><div className="matches-actions"><button className="secondary" onClick={() => void load("computer")} disabled={Boolean(loadingSource)}><Icon name="game" size={16}/>{loadingSource === "computer" ? "CONSULTANDO SEU PC" : "BUSCAR PELO MEU PC"}</button><button className="secondary" onClick={() => void load("cloud")} disabled={Boolean(loadingSource)}><Icon name="search" size={16}/>{loadingSource === "cloud" ? "CONSULTANDO EA" : "BUSCAR NA EA"}</button>{canManage && <button className="secondary" onClick={() => openManual()}><Icon name="plus" size={16}/>ADICIONAR MANUAL</button>}{found.length > 0 && <button className="primary" onClick={() => void importSelected()}><Icon name="upload" size={16}/>IMPORTAR SELECIONADAS</button>}</div></header>{(error || workspace.error) && <p className="matches-error">{error || workspace.error}</p>}<section className="matches-list"><header><span>DATA</span><span>PARTIDA</span><span>RESULTADO</span><span>COMPETIÇÃO</span><span>ORIGEM</span></header>{rows.length ? rows.map((match) => { const result = match.strix_score > match.opponent_score ? "VITÓRIA" : match.strix_score < match.opponent_score ? "DERROTA" : "EMPATE"; const logo = match.opponent_logos?.storage_path ? workspace.assetUrl(match.opponent_logos.storage_path) : ""; return <article key={match.id}><span>{datePart(match.played_at)}<small>{timePart(match.played_at)}</small></span><div className="match-teams"><Crest small/><b>STRIX</b><strong>{match.strix_score} x {match.opponent_score}</strong><Avatar name={match.opponent_name} logo={logo}/><b>{match.opponent_name}</b></div><em className={result.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}>{result}</em><small>{match.competition_name}</small><small>{match.source === "manual" ? "MANUAL" : "API EA"}</small><div className="match-row-actions"><button title="Ver dados" onClick={() => setDetail(match)}><Icon name="details" size={16}/></button>{canManage && <><button title="Editar" onClick={() => openManual(match)}><Icon name="edit" size={16}/></button><button title="Excluir" onClick={() => void workspace.removeClubMatch(match.id).catch((removeError) => setError(removeError.message))}><Icon name="trash" size={16}/></button></>}</div></article>; }) : <div className="matches-empty">Ainda não há partidas no histórico. Use a busca da EA ou adicione um resultado manual.</div>}</section>{found.length > 0 && <section className="matches-list import-preview"><header><span>DATA</span><span>PARTIDA</span><span>RESULTADO</span><span>COMPETIÇÃO</span><span>SELEÇÃO</span></header>{found.map((match) => <article key={match.id}><span>{match.dateLabel}<small>{match.timeLabel}</small></span><div className="match-teams"><Crest small/><b>STRIX</b><strong>{match.strixScore} x {match.opponentScore}</strong><b>{match.opponent}</b></div><em>{match.strixScore > match.opponentScore ? "VITÓRIA" : match.strixScore < match.opponentScore ? "DERROTA" : "EMPATE"}</em><small>{match.competition}</small><label className="match-select"><input type="checkbox" checked={selected.has(match.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(match.id) ? next.delete(match.id) : next.add(match.id); return next; })}/></label></article>)}</section>}{manualOpen && <div className="match-manual-backdrop"><form className="match-manual-modal" onSubmit={saveManual}><header><div><span>REGISTRO DO CLUBE</span><h2>{editing ? "Editar partida" : "Adicionar partida manual"}</h2><p>O resultado entra no histórico e sincroniza em todos os dispositivos.</p></div><button type="button" className="icon-button" onClick={() => setManualOpen(false)}><Icon name="close"/></button></header><div className="manual-form-grid"><label className="manual-full">ADVERSÁRIO<input autoFocus value={manualDraft.opponent} onChange={(event) => setManualDraft((current) => ({...current, opponent:event.target.value}))}/></label><label>DATA<input type="date" value={manualDraft.date} onChange={(event) => setManualDraft((current) => ({...current,date:event.target.value}))}/></label><label>HORA<input type="time" value={manualDraft.time} onChange={(event) => setManualDraft((current) => ({...current,time:event.target.value}))}/></label><label>STRIX<input type="number" min="0" value={manualDraft.strixScore} onChange={(event) => setManualDraft((current) => ({...current, strixScore:event.target.value}))}/></label><label>ADVERSÁRIO<input type="number" min="0" value={manualDraft.opponentScore} onChange={(event) => setManualDraft((current) => ({...current,opponentScore:event.target.value}))}/></label><label className="manual-full">COMPETIÇÃO<input value={manualDraft.competition} onChange={(event) => setManualDraft((current) => ({...current,competition:event.target.value}))}/></label></div><footer><button type="button" className="secondary" onClick={() => setManualOpen(false)}>CANCELAR</button><button className="primary"><Icon name="upload" size={16}/>SALVAR PARTIDA</button></footer></form></div>}{detail && <MatchDetails match={detail} close={() => setDetail(null)}/>}</section>;
}
function Command({ close, navigate, workspace, profile }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultsRef = useRef(null);
  const [selection, setSelection] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });
  const list = useMemo(
    () => filterCommandItems(commandItems({ profile, workspace, navigate }), query).slice(0, 18),
    [navigate, profile, query, workspace],
  );
  useEffect(() => setSelectedIndex(0), [query]);
  useLayoutEffect(() => {
    const root = resultsRef.current;
    const button = root?.querySelector(`[data-command-index="${selectedIndex}"]`);
    if (!root || !button) {
      setSelection((current) => ({ ...current, ready: false }));
      return undefined;
    }
    const measure = () => {
      setSelection({
        left: button.offsetLeft,
        top: button.offsetTop,
        width: button.offsetWidth,
        height: button.offsetHeight,
        ready: true,
      });
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(button);
    return () => observer.disconnect();
  }, [list.length, query, selectedIndex]);
  const execute = (item) => {
    if (!item) return;
    item.run();
    close();
  };
  return (
    <div className="command-backdrop" onMouseDown={close} role="presentation">
      <section
        className="command"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((index) => list.length ? (index + 1) % list.length : 0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((index) => list.length ? (index - 1 + list.length) % list.length : 0);
          } else if (event.key === "Enter") {
            event.preventDefault();
            execute(list[selectedIndex]);
          } else if (event.key === "Escape") close();
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar no Strix"
      >
        <div>
          <Icon name="search" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar páginas, partidas, jogadores…" aria-controls="strix-command-results" aria-activedescendant={list[selectedIndex] ? `command-option-${selectedIndex}` : undefined} />
          <kbd>ESC</kbd>
        </div>
        <p>{query ? "RESULTADOS" : "AÇÕES E NAVEGAÇÃO"}</p>
        <div ref={resultsRef} className="command-results" id="strix-command-results" role="listbox">
        <span
          className={`command-selection-indicator${selection.ready ? " is-ready" : ""}`}
          style={{ transform: `translate(${selection.left}px,${selection.top}px)`, width: selection.width, height: selection.height }}
          aria-hidden="true"
        />
        {list.map((item, index) => (
          <button
            className={`${selectedIndex === index ? "selected " : ""}${item.kind === "action" ? "is-action" : ""}`.trim()}
            id={`command-option-${index}`}
            data-command-index={index}
            data-selected={selectedIndex === index}
            role="option"
            aria-selected={selectedIndex === index}
            key={item.id}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => execute(item)}
          >
            <Icon name={item.icon} />
            <span><b>{item.label}</b><small>{item.meta}</small></span>
            <kbd>↵</kbd>
          </button>
        ))}
        {!list.length && <div className="command-empty">Nenhum resultado para “{query}”.</div>}
        </div>
        <footer><span><kbd>↑↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>esc</kbd> fechar</span></footer>
      </section>
    </div>
  );
}
function CurrentGame({ navigate }) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("strix-agenda-updated", refresh);
    return () => window.removeEventListener("strix-agenda-updated", refresh);
  }, []);
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem("strix-fc27-agenda") || "[]");
  } catch {}
  const item =
    items
      .filter(
        (value) =>
          !value.cancelled &&
          value.status !== "CANCELADO" &&
          value.group === "today",
      )
      .sort((left, right) => left.time.localeCompare(right.time))[0] ||
    items
      .filter(
        (value) =>
          !value.cancelled &&
          value.status !== "CANCELADO" &&
          value.group === "next",
      )
      .sort((left, right) => left.time.localeCompare(right.time))[0];
  return (
    <button
      className="now-playing"
      onClick={() => navigate("central")}
      key={revision}
    >
      <Crest small />
      <div>
        <small>{item ? "PRÓXIMA PARTIDA" : "AGENDA LIVRE"}</small>
        <b>
          {item
            ? `Strix United vs ${item.opponent}`
            : "Nenhuma partida programada"}
        </b>
      </div>
      <strong>{item?.time || "—"}</strong>
      <Icon name="arrow" size={17} />
    </button>
  );
}
function CurrentGameLive({ navigate, workspace }) {
  const item = useMemo(() => nextAgendaMatches(workspace.agenda)[0], [workspace.agenda]);
  return <button className="now-playing" onClick={() => navigate("agenda")}><Crest small/><div><small>{item ? "PRÓXIMA PARTIDA" : "AGENDA LIVRE"}</small><b>{item ? `Strix United vs ${item.opponent_name}` : "Nenhuma partida programada"}</b></div><strong>{item ? timePart(item.scheduled_at) : "—"}</strong><Icon name="arrow" size={17}/></button>;
}
function WorkspaceSkeleton({ type = "central" }) {
  const rowCount = type === "table" || type === "competitions" ? 5 : 3;
  return (
    <section className={`workspace-skeleton is-${type}`} aria-label="Carregando conteúdo" aria-busy="true">
      <header className="skeleton-heading"><div className="motion-skeleton skeleton-eyebrow"/><div className="motion-skeleton skeleton-title"/><div className="motion-skeleton skeleton-subtitle"/></header>
      {(type === "central") && <div className="motion-skeleton skeleton-hero"><i/><i/><i/></div>}
      {(type === "statistics" || type === "analysis") && <div className="skeleton-metrics">{Array.from({ length: 4 }, (_, index) => <div className="motion-skeleton" key={index}><i/><b/></div>)}</div>}
      {(type === "statistics" || type === "analysis") && <div className="skeleton-split"><div className="motion-skeleton skeleton-chart"/><div className="skeleton-ranking">{Array.from({ length: 5 }, (_, index) => <div className="motion-skeleton" key={index}/>)}</div></div>}
      {(type === "table" || type === "competitions" || type === "library") && <div className="skeleton-table"><div className="motion-skeleton skeleton-table-head"/>{Array.from({ length: rowCount }, (_, index) => <div className="motion-skeleton skeleton-table-row" key={index}><i/><b/><i/></div>)}</div>}
      {type === "central" && <div className="skeleton-agenda">{Array.from({ length: 3 }, (_, index) => <div className="motion-skeleton" key={index}><i/><b/><i/></div>)}</div>}
    </section>
  );
}
function MaintenanceScreen({ signOut }) {
  return <main className="maintenance-screen"><Crest/><span>STRIX UNITED · FC27</span><h1>Voltamos já.</h1><p>O FC27 está em manutenção programada. Nenhum dado foi perdido.</p><button className="secondary" onClick={signOut}>SAIR DA CONTA</button></main>;
}
function App() {
  const auth = useTeamAuth();
  const workspace = useFc27Workspace(auth.client, auth.profile);
  const [active, setActive] = useState(() => pageFromLocation()),
    [compact, setCompact] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [command, setCommand] = useState(false),
    [createOpen, setCreateOpen] = useState(false),
    [player, setPlayer] = useState(null);
  const navigate = (id) => {
    const page = id || "central";
    setActive(page);
    setMobileOpen(false);
    setCreateOpen(false);
    const next = locationForPage(page);
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      window.history.pushState({ page }, "", next);
    }
  };
  useEffect(() => {
    const sync = () => setActive(pageFromLocation());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);
  useEffect(() => {
    const listener = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommand(true);
      }
      if (event.key === "Escape") {
        setCommand(false);
        setMobileOpen(false);
        setCreateOpen(false);
      }
    };
    const protectImage = (event) => {
      if (event.target instanceof HTMLImageElement) event.preventDefault();
    };
    window.addEventListener("keydown", listener);
    document.addEventListener("dragstart", protectImage);
    document.addEventListener("contextmenu", protectImage);
    return () => {
      window.removeEventListener("keydown", listener);
      document.removeEventListener("dragstart", protectImage);
      document.removeEventListener("contextmenu", protectImage);
    };
  }, []);
  useEffect(() => {
    if (!createOpen) return undefined;
    const closeCreate = (event) => {
      if (!event.target.closest(".create-menu,.create-trigger")) setCreateOpen(false);
    };
    document.addEventListener("pointerdown", closeCreate);
    return () => document.removeEventListener("pointerdown", closeCreate);
  }, [createOpen]);
  useEffect(() => {
    if (workspace.loading || active !== "central") return undefined;
    const warm = () => {
      for (const id of ["estatisticas", "campeonatos", "analise"]) void preloadRoute(id);
    };
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(warm, { timeout: 500 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = setTimeout(warm, 180);
    return () => clearTimeout(timer);
  }, [active, workspace.loading]);
  useEffect(() => {
    if (workspace.loading) return;
    preloadClubLogos(workspace.agenda
      .filter((match) => !["cancelled", "completed"].includes(match.status))
      .slice(0, 12)
      .map((match) => match.resolved_opponent_logo_url || (match.opponent_logos?.storage_path ? workspace.assetUrl(match.opponent_logos.storage_path) : "")));
  }, [workspace.agenda, workspace.loading]);
  if (!auth.profile)
    return (
      <LoginScreen
        loading={auth.loading}
        error={auth.error}
        onLogin={auth.signIn}
      />
    );
  if (!workspace.loading && auth.profile.access_tier !== "dev" && workspace.systemFlags.some((flag) => flag.key === "site_maintenance" && flag.enabled)) {
    return <MaintenanceScreen signOut={auth.signOut}/>;
  }
  const title = [["central", "Central", "live"], ...nav].find((item) => item[0] === active)?.[1] || "Central";
  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar
        active={active}
        navigate={navigate}
        compact={compact}
        setCompact={setCompact}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        profile={auth.profile}
        signOut={auth.signOut}
      />
      <main className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Icon name="menu" />
          </button>
          <button className="crumb" onClick={() => navigate("central")}>
            STRIX / <b>{title}</b>
          </button>
          <button className="search-button" aria-label="Buscar no Strix" onClick={() => setCommand(true)}>
            <Icon name="search" />
            <span>Buscar no Strix...</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="top-actions">
            <button aria-label="Notificações">
              <Icon name="bell" />
            </button>
            {(canManageAgenda(auth.profile) || canCreatePlayer(auth.profile) || canViewMedia(auth.profile) || canManageCompetitions(auth.profile)) && (
            <button className={`add-button create-trigger${createOpen ? " is-open" : ""}`} onClick={() => setCreateOpen((value) => !value)} aria-expanded={createOpen} aria-haspopup="menu">
              <Icon name="plus" size={16} />
              <RollingLabel>NOVO</RollingLabel>
            </button>
            )}
            {createOpen && (
              <div className="create-menu" role="menu">
                {canManageAgenda(auth.profile) && <button role="menuitem" onClick={() => navigate("agenda")}><Icon name="calendar" size={16}/><span><b>Nova partida</b><small>Adicionar à Agenda</small></span></button>}
                {canCreatePlayer(auth.profile) && <button role="menuitem" onClick={() => navigate("elenco")}><Icon name="squad" size={16}/><span><b>Elenco</b><small>Gerenciar jogadores</small></span></button>}
                {canViewMedia(auth.profile) && <button role="menuitem" onClick={() => navigate("midia")}><Icon name="media" size={16}/><span><b>Mídia</b><small>Agenda do Dia e estúdio</small></span></button>}
                {canManageCompetitions(auth.profile) && <button role="menuitem" onClick={() => navigate("campeonatos")}><Icon name="trophy" size={16}/><span><b>Campeonato</b><small>Adicionar ou sincronizar</small></span></button>}
              </div>
            )}
          </div>
        </header>
        {workspace.loading ? <WorkspaceSkeleton /> : active === "central" ? (
          <CentralLive workspace={workspace} navigate={navigate} />
        ) : active === "agenda" ? (
          <AgendaLive navigate={navigate} workspace={workspace} profile={auth.profile} />
        ) : active === "partidas" ? (
          <FeatureBoundary type="table"><MatchesPage profile={auth.profile} workspace={workspace} client={auth.client} /></FeatureBoundary>
        ) : active === "elenco" ? (
          <SquadPageV3 workspace={workspace} profile={auth.profile} />
        ) : active === "campeonatos" ? (
          <FeatureBoundary type="competitions"><CompetitionsPage profile={auth.profile} workspace={workspace} client={auth.client} /></FeatureBoundary>
        ) : (
          <DataPage id={active} workspace={workspace} profile={auth.profile} client={auth.client} />
        )}
      </main>
      <CurrentGameLive navigate={navigate} workspace={workspace} />
      {command && (
        <Command close={() => setCommand(false)} navigate={navigate} workspace={workspace} profile={auth.profile} />
      )}
      <Profile player={player} close={() => setPlayer(null)} />
      <ToastViewport />
    </div>
  );
}
export { Sidebar, CentralLive, AgendaLive, FormationPicker, SquadPageV3, DataPage };

if (document.getElementById("root")) createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
