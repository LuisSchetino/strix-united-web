import {
  IconArrowsExchange, IconBallFootball, IconBell, IconBooks, IconBroadcast, IconCalendar, IconChartBar, IconChartRadar,
  IconChevronLeft, IconChevronRight, IconClock, IconDots, IconFileText, IconLayoutGrid, IconLink, IconLogout, IconMenu2, IconPencil,
  IconDeviceMobileDown, IconPlus, IconSearch, IconShield, IconShoe, IconSoccerField, IconTrash, IconTrophy, IconUpload, IconUsers, IconVideo, IconX,
} from "@tabler/icons-react";
import React, { StrictMode, Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import "./design/tokens.css";
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
import { availableLineupPlayers, duplicateLineupPlayers, validateLineupUnique } from "./features/agenda/lineup-core.js";
import { LINEUP_SLOTS, lastLineup, playerRotation, rotationLabel, suggestLineup } from "./features/agenda/lineup-suggest.js";
import { activeAgendaMatches, agendaLeg, agendaListMatches, isResultOfGame, nextAgendaMatches, saoPauloDay, todayAgendaMatches } from "./features/agenda/agenda-time.js";
import { opponentBrief } from "./features/agenda/opponent-brief.js";
import { matchStake } from "./features/competitions/match-stake.js";
import { tonightPlayed } from "./features/home/home-core.js";
import { rescheduleLabel, rescheduleOf } from "./features/notifications/notifications-core.js";
import { agendaStandingComparison } from "./features/agenda/agenda-standings.js";
import { resolveAgendaTeamIdentity, resolveTeamIdentity } from "./features/teams/team-identity.js";
import { buildEaClubLogoIndex, eaClubLogoFor, readOpponentClubId } from "./features/teams/ea-club-logo.js";
import { notify, RollingLabel, ToastViewport } from "./ui/motion/motion.jsx";
import { ClubLogo } from "./ui/ClubLogo.jsx";
import { ActionMenu } from "./ui/ActionMenu.jsx";
import { LaunchGate } from "./features/launch/LaunchGate.jsx";
import { ContractGate, ContractValidating } from "./features/onboarding/ContractGate.jsx";
import { PLAYER_LINK_KEY, PLAYER_LINK_NONE, clearContractOpen, hasSignedContract, readContract, readContractOpen, readPlayerLink, resolveContractIdentity, resolveOwnPlayer } from "./features/onboarding/contract-core.js";
import { HomePage } from "./features/home/HomePage.jsx";
import { PageHeader } from "./ui/PageHeader.jsx";
import { useMinuteClock } from "./ui/useMinuteClock.js";
import { agendaStatus, lineupState } from "./features/agenda/agenda-status.js";
import { isLiveFresh } from "../shared/live-signal.js";
import { LAUNCH_CONFIG, clearLaunchAccessVerification, consumeLaunchReturn, isLaunchUnlocked, launchGateDecision, readLaunchAccessVerification, rememberLaunchAccess } from "./launch.js";
import { preloadClubLogos } from "./ui/provider-assets.js";
import { STRIX_BRAND } from "./brand.js";
import { RastroSignature } from "./ui/RastroBrand.jsx";
import "./features/squad-cards.css";
import "./fc27-brand.css";
import "./round-discovery.css";
import "./performance-polish.css";
import "./quality-polish.css";
import "./ui-bugfix.css";
import "./mobile-safe.css";
import "./ui/strix-polish.css";
import "./design/page.css";
import "./design/data.css";
import "./features/agenda/agenda-list.css";
import "./design/shell.css";
import "./features/agenda/lineup-field.css";
import { MatchStage, MatchStandings, OpponentBrief } from "./features/agenda/MatchView.jsx";
import "./design/legibility.css";
import { saveRosterPlayer } from "./features/squad/player-save.js";
import { FC27_CLUB_ID as EA_CLUB_ID, isStrixClubId, readStrixKeyed } from "../shared/fc27-club.js";
import { useDialog } from "./ui/useDialog.js";
import { CloseButton } from "./ui/CloseButton.jsx";
import { CopyLinkButton } from "./ui/CopyLinkButton.jsx";
import { ErrorNote } from "./ui/ErrorNote.jsx";
import { ActivityList } from "./ui/ActivityList.jsx";
import { useRemembered } from "./ui/useRemembered.js";
import { useLibraryGlance } from "./features/library/useLibraryGlance.js";
import { libraryGlance } from "./features/library/library-glance.js";
import { NotificationCenter } from "./features/notifications/NotificationCenter.jsx";
import { Tour } from "./features/onboarding/Tour.jsx";
import { finishTour, shouldShowTour } from "./features/onboarding/tour-core.js";
import { requestInstall, useInstallMode } from "./ui/install-app.js";
import { SeasonOpening } from "./features/launch/SeasonOpening.jsx";
import { markOpeningLive, markOpeningSeen, shouldShowOpening } from "./features/launch/opening-core.js";
import { useCompetitionAutoRefresh } from "./features/competitions/auto-refresh.js";
import { AccessDenied } from "./ui/AccessDenied.jsx";
import { AppErrorBoundary, SpecialState } from "./ui/special-state/SpecialState.jsx";
import { classifyAuthFailure } from "./ui/special-state/classify-auth-failure.js";
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
  canPublishNotice,
  canUseDeveloperTools,
  canViewActivity,
  canViewMedia,
  canViewPage,
  locationForPage,
  pageFromLocation,
  permissionDenied,
  resolveLocation,
} from "./access.js";
import { commandItems, filterCommandItems } from "./command-palette.js";
import { mobileTabsFor, navGroupsFor } from "./navigation.js";
import { readApiJson, parseApiJson } from "./lib/read-api-json.js";
import { deepLinkPath } from "./deep-link.js";
import { parseNightPath } from "../shared/night-link.js";
import { matchDay } from "../shared/night-required.js";
import { hasMinimumTier } from "./access.js";
import { useNightRequired } from "./features/required/useNightRequired.js";
import { RequiredGate, RequiredPeek } from "./features/required/RequiredGate.jsx";
import { RequiredSheet } from "./features/required/RequiredSheet.jsx";
import { AccountLink } from "./features/required/AccountLink.jsx";
import { RequiredCenter, dayOfFormDate } from "./features/required/RequiredPicker.jsx";
import { readSignInRefusal, withoutSignInRefusal } from "./auth-return.js";
import { shrinkImage } from "./ui/shrink-image.js";
import { freshImport, isStaleBuild, watchForNewDeploy } from "./ui/fresh-deploy.js";
import "./features/night/public-night.css";
import { announceLocation, clearTarget, copyLink, openTarget, useDeepTarget } from "./ui/useDeepTarget.js";

const routeLoaders = {
  partidas: () => import("./features/matches/MatchesPage.jsx").then((module) => ({ default: module.MatchesPage })),
  campeonatos: () => import("./features/competitions/CompetitionsPage.jsx").then((module) => ({ default: module.CompetitionsPage })),
  estatisticas: () => import("./features/statistics/StatisticsPage.jsx"),
  analise: () => import("./features/analysis/AnalysisPage.jsx"),
  biblioteca: () => import("./features/library/LibraryPage.jsx").then((module) => ({ default: module.LibraryPage })),
  desenvolvedor: () => import("./features/developer/DeveloperPage.jsx").then((module) => ({ default: module.DeveloperPage })),
  midia: () => import("./features/media/MediaPage.jsx").then((module) => ({ default: module.MediaPage })),
  elencoTools: () => import("./features/squad/RosterTools.jsx").then((module) => ({ default: module.RosterTools })),
  playerSheet: () => import("./features/players/PlayerSheet.jsx"),
};
const preloadRoute = (id) => routeLoaders[id]?.().catch(() => {});
const MediaPage = lazy(freshImport(routeLoaders.midia));
const MatchesPage = lazy(freshImport(routeLoaders.partidas));
const CompetitionsPage = lazy(freshImport(routeLoaders.campeonatos));
const LibraryPage = lazy(freshImport(routeLoaders.biblioteca));
const DeveloperPage = lazy(freshImport(routeLoaders.desenvolvedor));
const StatisticsPage = lazy(freshImport(routeLoaders.estatisticas));
const AnalysisPage = lazy(freshImport(routeLoaders.analise));
const RosterTools = lazy(freshImport(routeLoaders.elencoTools));
const PlayerSheet = lazy(freshImport(routeLoaders.playerSheet));
// Opened from Elenco only; its document and video downloads load with it.
const SignedContractArchive = lazy(freshImport(() => import("./features/onboarding/SignedContractArchive.jsx").then((module) => ({ default: module.SignedContractArchive }))));

// The shell's icons come from one drawn set (Tabler), never from hand-made paths.
const icons = {
  menu: IconMenu2, close: IconX, search: IconSearch, live: IconBroadcast, calendar: IconCalendar,
  game: IconSoccerField, squad: IconUsers, trophy: IconTrophy, stats: IconChartBar, brain: IconChartRadar,
  library: IconBooks, media: IconVideo, bell: IconBell, logout: IconLogout, plus: IconPlus,
  arrow: IconChevronRight, upload: IconUpload, edit: IconPencil, trash: IconTrash, details: IconFileText,
  goal: IconBallFootball, assist: IconShoe, pass: IconArrowsExchange, shield: IconShield, link: IconLink,
  chevronLeft: IconChevronLeft, more: IconDots, grid: IconLayoutGrid, clock: IconClock, install: IconDeviceMobileDown,
};
function Icon({ name, size = 20 }) {
  const Glyph = icons[name];
  return Glyph ? <Glyph aria-hidden="true" size={size} stroke={name === "more" ? 2.4 : 1.75} /> : null;
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
  useLayoutEffect(() => {
    const node = dialogRef.current;
    const viewport = window.visualViewport;
    if (!node || !viewport) return undefined;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
      node.style.setProperty("--vv-bottom", `${Math.round(covered)}px`);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
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
  const team = readStrixKeyed(raw?.players)
    || readStrixKeyed(raw?.playerStats)
    || readStrixKeyed(raw?.details?.players)
    || readStrixKeyed(raw?.details)?.players
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
  const stats = readStrixKeyed(raw?.aggregateStats)
    || readStrixKeyed(raw?.aggregate)
    || readStrixKeyed(raw?.stats)
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
  const strix = clubs.find((club) => isStrixClubId(club?.clubId || club?.id || club?._clubKey)) || clubs[0] || {};
  const fresh = eaPerformance(raw, strix);
  return {
    ...saved,
    ...Object.fromEntries(Object.entries(fresh).filter(([key, value]) => key === "players" ? value.length > 0 : value !== null && value !== undefined)),
  };
}

function normalizeEaMatch(raw, index) {
  const clubs = asClubEntries(raw);
  const strix =
    clubs.find((club) => isStrixClubId(club?.clubId || club?.id || club?._clubKey)) ||
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
const AUTH_FETCH_MS = 8000;
async function fetchJson(url, options = {}, timeoutMs = AUTH_FETCH_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: options.cache || "no-store" });
    const text = await response.text();
    let payload = {};
    try {
      payload = parseApiJson(text, {
        status: response.status,
        contentType: response.headers?.get?.("content-type") || "",
      });
    } catch {
      payload = {};
    }
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}
let browserSupabase = null;
async function getBrowserSupabase() {
  if (browserSupabase) return browserSupabase;
  const { response, payload: config } = await fetchJson("/api/public-config");
  if (!response.ok || !config.url || !config.publishableKey) {
    const failed = new Error(config.error || "supabase_not_configured");
    failed.status = response.status;
    throw failed;
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
// The API answers at most 1000 rows per request. The catalog of crests is read whole, page by
// page, so a club late in the alphabet is still found when its crest is looked up or replaced.
async function readAllLogos(client) {
  const rows = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await client.from("opponent_logos").select("*").order("canonical_name").order("id").range(from, from + 999);
    if (error) return { data: rows, error };
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { data: rows, error: null };
}
const matchingLogo = (logos, name) => {
  const normalized = normalizeTeamName(name);
  if (!normalized) return null;
  const exact = logos.find((logo) => normalizeTeamName(logo.canonical_name) === normalized);
  if (exact) return exact;
  const candidates = logos.filter((logo) => {
    const candidate = normalizeTeamName(logo.canonical_name);
    return normalized.length >= 3 && (candidate.startsWith(normalized) || normalized.startsWith(candidate));
  });
  if (candidates.length === 1) return candidates[0];
  // The same club written with other spacing ("MX GAMING" / "M X GAMING") or with another
  // suffix ("ITUANO FC" / "Ituano eSports"): one catalog entry, and only one, may answer.
  const close = logos.filter((logo) => sameClubName(logo.canonical_name, name));
  return close.length === 1 ? close[0] : null;
};
const CLUB_FILLER = new Set(["fc", "sc", "ec", "cf", "ac", "club", "clube", "team", "time", "esports", "esport", "gaming", "united", "city", "de", "do", "da", "os", "the"]);
/** Two spellings of one club: equal without spaces, one inside the other, or the same distinctive word. */
function sameClubName(left, right) {
  const a = normalizeTeamName(left), b = normalizeTeamName(right);
  if (!a || !b) return false;
  const ca = a.replace(/ /g, ""), cb = b.replace(/ /g, "");
  if (ca === cb) return true;
  if (Math.min(ca.length, cb.length) >= 4 && (ca.startsWith(cb) || cb.startsWith(ca))) return true;
  const words = (value) => value.split(" ").filter((word) => word.length >= 4 && !CLUB_FILLER.has(word));
  const wa = words(a), wb = new Set(words(b));
  return wa.length > 0 && wb.size > 0 && wa.some((word) => wb.has(word)) && (wa.every((word) => wb.has(word)) || [...wb].every((word) => wa.includes(word)));
}
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
const AVATAR_PX = { sm: 36, md: 46, lg: 116 };
function Avatar({ name, logo, kind = "logo", priority = false, size }) {
  const resolvedLogo = logo || catalogLogo(name);
  const px = AVATAR_PX[size];
  return <ClubLogo name={name} url={resolvedLogo} kind={kind} priority={priority} size={px} sizes={px ? `${px}px` : "75px"} className={`avatar${size ? ` avatar-${size}` : ""}`}/>;
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
    failureKind: "",
    syncWarning: "",
  });
  // Discord (or the sign-in service) sent the person back with a refusal: it is read once,
  // taken out of the address, and shown on the sign-in screen.
  const refusal = useRef(undefined);
  if (refusal.current === undefined) {
    refusal.current = readSignInRefusal(window.location);
    if (refusal.current) window.history.replaceState(window.history.state, "", withoutSignInRefusal(window.location));
  }
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
            error: refusal.current?.message || "",
            failureKind: "",
            syncWarning: "",
          });
        return;
      }
      if (alive)
        setState((current) => ({ ...current, loading: true, client, session }));
      try {
        const { response, payload } = await fetchJson("/api/auth/session", {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok || !payload?.profile) {
          const failed = new Error(payload.error || "access_check_failed");
          failed.status = response.ok ? 401 : response.status;
          throw failed;
        }
        if (alive)
          setState({
            loading: false,
            client,
            session,
            profile: payload.profile,
            error: "",
            failureKind: "",
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
            failureKind: classifyAuthFailure(error, { hadSession: Boolean(session), status: error.status }),
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
            failureKind: classifyAuthFailure(error, { status: error.status }),
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
    notice: null,
    noticeAvailable: false,
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
    const [agendaResult, logosResult, playersResult, aliasesResult, matchesResult, competitionsResult, editionsResult, sourcesResult, fixturesResult, teamsResult, flagsResult, nightRelatedResult, noticeResult] = await Promise.all([
      client.from("agenda_matches").select("*, opponent_logos!agenda_matches_opponent_logo_id_fkey(*)").order("scheduled_at", { ascending: true }),
      readAllLogos(client),
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
      client.from("club_notices").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(1),
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
    const eaClubLogos = buildEaClubLogoIndex({
      matches: matchesResult.data || [],
      teams: teamsResult.data || [],
      editions: editionsResult.data || [],
      competitions: competitionsResult.data || [],
    });
    const agendaById = new Map((agendaResult.data || []).map((entry) => [entry.id, entry]));
    const resolvedMatches = (matchesResult.data || []).map((match) => {
      const opponentClubId = readOpponentClubId(match.raw_ea);
      // The crest the club saved for this opponent: on the match itself, on the Agenda game it is
      // linked to, or in the catalog under a name that only differs by a suffix (EA writes
      // "MX GAMING" where the Agenda says "MX Gaming ES").
      // A result that was never tied to its Agenda game still finds it: same day, same club.
      const linked = (match.agenda_match_id ? agendaById.get(match.agenda_match_id) : null)
        || (agendaResult.data || []).find((entry) => entry.scheduled_at && match.played_at && datePart(entry.scheduled_at) === datePart(match.played_at) && sameClubName(entry.opponent_name, match.opponent_name))
        || null;
      const saved = match.opponent_logos?.storage_path
        || linked?.opponent_logos?.storage_path
        || matchingLogo(logosResult.data || [], match.opponent_name)?.storage_path
        || (linked ? matchingLogo(logosResult.data || [], linked.opponent_name)?.storage_path : "")
        || "";
      const identity = resolveTeamIdentity({
        name: match.opponent_name,
        editionId: match.competition_edition_id,
        directLogo: saved ? assetUrl(saved) : "",
        eaClubLogo: eaClubLogoFor(eaClubLogos, { clubId: opponentClubId, name: match.opponent_name }),
        teams: teamsResult.data || [],
        logos: publicLogos,
        history: historyIdentities,
      });
      return {
        ...match,
        opponent_ea_club_id: opponentClubId,
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
        const eaClubLogo = eaClubLogoFor(eaClubLogos, { name: match.opponent_name });
        // "Played" needs a result of its own. A game of today or later that is marked played
        // without one (the organiser reused the first leg's entry for the return game) is still
        // to be played: it goes back to the Agenda as a scheduled game.
        const stalePlayed = match.status === "completed"
          && saoPauloDay(match.scheduled_at) >= saoPauloDay(new Date())
          && !(matchesResult.data || []).some((result) => result.agenda_match_id === match.id && isResultOfGame(match, result));
        return {
          ...match,
          ...(stalePlayed ? { status: "scheduled", stale_played: true } : {}),
          opponent_team_id: identity.id || match.opponent_team_id || null,
          opponent_name: identity.name || match.opponent_name,
          opponent_abbreviation: identity.abbreviation,
          resolved_opponent_logo_url: identity.logo || eaClubLogo,
          identity_source: identity.logo ? identity.source : eaClubLogo ? "ea_club" : identity.source,
        };
      }),
      logos: logosResult.data || [],
      players: playersResult.data || [],
      aliases: aliasesResult.data || [],
      matches: resolvedMatches,
      competitions: competitionsResult.data || [],
      competitionEditions: editionsResult.data || [],
      competitionSources: sourcesResult.data || [],
      // "Na Agenda" is only said of a game the Agenda really lists: a link to a game that was
      // removed from it (or is hidden there) does not count.
      competitionFixtures: (() => {
        const listed = new Set(agendaListMatches(agendaResult.data || []).map((entry) => entry.id));
        return (fixturesResult.data || []).map((fixture) => (fixture.agenda_match_id && fixture.status !== "completed" && !listed.has(fixture.agenda_match_id) ? { ...fixture, agenda_match_id: null, agenda_link_lost: true } : fixture));
      })(),
      competitionTeams: teamsResult.data || [],
      systemFlags: flagsResult.data || [],
      nightRelated: nightRelatedResult.error && isMissingOptionalSchema(nightRelatedResult.error) ? [] : (nightRelatedResult.data || []),
      // The club notice is optional: before its migration the Central simply has none and nobody is offered to write one.
      notice: noticeResult.error ? null : (noticeResult.data || [])[0] || null,
      noticeAvailable: !noticeResult.error,
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

  // The phone drops the realtime socket when the screen sleeps or the app goes to the background:
  // coming back always refreshes, and while a game of the night is near its kick-off (or the PC
  // watcher is sending its scoreboard) the agenda is also re-read every 20 s.
  useEffect(() => {
    if (!client || !profile?.user_id) return undefined;
    const back = () => { if (document.visibilityState === "visible") scheduleRealtimeRefresh(); };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const at = Date.now();
      const near = state.agenda.some((match) => {
        if (["cancelled", "completed"].includes(match.status)) return false;
        const kickoff = new Date(match.scheduled_at).getTime();
        return (Number.isFinite(kickoff) && kickoff - at < 30 * 60_000 && at - kickoff < 3 * 3_600_000) || isLiveFresh(match, new Date(at));
      });
      if (near) void refresh();
    }, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
      clearInterval(timer);
    };
  }, [client, profile?.user_id, state.agenda]);

  // The club notice arrives with a later migration. Its listener has a channel of its own, opened
  // only once the table answers, so a database without it keeps every other live update intact.
  useEffect(() => {
    if (!client || !profile?.user_id || !state.noticeAvailable) return undefined;
    const channel = client
      .channel("fc27-club-notice")
      .on("postgres_changes", { event: "*", schema: "public", table: "club_notices" }, scheduleRealtimeRefresh)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [client, profile?.user_id, state.noticeAvailable]);

  const resolveLogo = async (name, file) => {
    const existing = matchingLogo(state.logos, name);
    if (!file) return existing?.id || null;
    const club = name.trim();
    file = await shrinkImage(file, { max: 640 });
    const path = `opponents/${profile.user_id}/${crypto.randomUUID()}-${safeAssetName(file.name)}`;
    const { error: uploadError } = await client.storage
      .from("fc27-team-assets")
      .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type || undefined });
    if (uploadError) throw new Error(`Não foi possível enviar a imagem da logo de ${club} (${uploadError.message}).`);
    // The catalog keeps one crest per club name. The club may already be there without being in
    // this session's copy (saved a moment ago on another device, or written slightly differently),
    // so it is looked up by name before a new entry is created.
    let targetId = existing?.id || null;
    if (!targetId) {
      const { data: found } = await client.from("opponent_logos").select("id,canonical_name").ilike("canonical_name", club.replace(/[\\%_]/g, "\\$&")).limit(5);
      targetId = (found || []).find((row) => normalizeTeamName(row.canonical_name) === normalizeTeamName(club))?.id || null;
    }
    const replace = (values) => client.from("opponent_logos").update(values).eq("id", targetId).select("id").single();
    let result = targetId
      ? await replace({ canonical_name: club, storage_path: path })
      : await client.from("opponent_logos").insert({ canonical_name: club, storage_path: path, created_by: profile.user_id }).select("id").single();
    if (result.error?.code === "23505") {
      // Another entry already carries exactly this name.
      if (targetId) {
        // Renaming this entry would collide with it: the entry keeps its own name, only the picture changes.
        result = await replace({ storage_path: path });
      } else {
        const { data: found } = await client.from("opponent_logos").select("id,canonical_name").ilike("canonical_name", `${club.replace(/[\\%_]/g, "\\$&")}%`).limit(20);
        targetId = (found || []).find((row) => row.canonical_name.trim().toLowerCase() === club.toLowerCase())?.id || null;
        if (targetId) result = await replace({ storage_path: path });
      }
    }
    if (result.error) throw new Error(`A imagem foi enviada, mas a logo de ${club} não pôde ser gravada no catálogo (${result.error.message}).`);
    return result.data.id;
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
    const invalidLineup = entries.find((item) => !validateLineupUnique(item.lineup, state.players).valid);
    if (invalidLineup) throw new Error("Um jogador não pode ocupar mais de uma posição na mesma escalação.");
    if (existing) {
      const data = await agendaPayload(entries[0], mode === "swap" ? {
        previous_opponent_name: existing.opponent_name,
        previous_opponent_logo_id: existing.opponent_logo_id,
      } : {});
      const { error } = await client.from("agenda_matches").update(data).eq("id", existing.id);
      if (error) throw error;
      // "Ida e volta" marked while editing: the return leg goes in as a new game.
      if (entries.length > 1) {
        const added = await Promise.all(entries.slice(1).map(async (item) => ({ ...(await agendaPayload(item)), created_by: profile.user_id })));
        const { error: addError } = await client.from("agenda_matches").insert(added);
        if (addError) throw addError;
      }
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
    // Reactivating clears the cancellation mark, so the game returns to the active schedule.
    update.cancelled_at = status === "cancelled" ? new Date().toISOString() : null;
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
    const result = await saveRosterPlayer(client, profile.user_id, player, file, async (original) => {
      const file = await shrinkImage(original, { max: 1400 });
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
  const restorePlayer = async (id) => {
    if (!canArchivePlayer(profile)) throw permissionDenied("Sem permissão para reativar jogadores.");
    const { error } = await client.from("club_players").update({ is_active: true, updated_by: profile.user_id }).eq("id", id);
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
  // Matches with the performance rebuilt from the raw EA record: what statistics, rotation and milestones read.
  const statMatches = useMemo(() => state.matches.map((match) => ({ ...match, performance: currentMatchPerformance(match) })), [state.matches]);
  return {
    ...state,
    statMatches,
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
    saveNotice: async (body) => {
      if (!canPublishNotice(profile)) throw permissionDenied("O recado da Central é publicado pela Diretoria.");
      const text = String(body || "").trim();
      if (!text) throw new Error("Escreva o recado antes de publicar.");
      const result = state.notice
        ? await client.from("club_notices").update({ body: text, updated_by: profile.user_id }).eq("id", state.notice.id)
        : await client.from("club_notices").insert({ body: text, created_by: profile.user_id, updated_by: profile.user_id });
      if (result.error) throw result.error;
      await refresh();
    },
    removeNotice: async () => {
      if (!canPublishNotice(profile)) throw permissionDenied("O recado da Central é publicado pela Diretoria.");
      if (!state.notice) return;
      const { error } = await client.from("club_notices").update({ is_active: false, updated_by: profile.user_id }).eq("id", state.notice.id);
      if (error) throw error;
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
    restorePlayer,
    importLegacyRoster,
    removePlayerAlias,
  };
}
// Why the server refused an account, in the club's words (the codes come from functions/_lib/auth.js).
const LOGIN_REFUSALS = Object.freeze({
  not_in_team_server: "Essa conta do Discord não está no servidor do Strix.",
  discord_role_unmapped: "Sua conta está no servidor, mas ainda sem um cargo que libere o site. Fale com a diretoria.",
  trial_access_closed: "Jogadores em teste ainda não têm acesso ao site. Ele abre quando você for efetivado no elenco.",
});
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
          <small className="login-error">{message || LOGIN_REFUSALS[error] || error}</small>
        )}
        <small className="login-note">
          Seu acesso é conferido com o servidor do Strix em cada entrada.
        </small>
      </section>
    </main>
  );
}
// "Instalar como app": the browser's own prompt where there is one; on an iPhone, how to do it.
async function installApp() {
  const outcome = await requestInstall();
  if (outcome === "accepted") notify("Strix instalado neste aparelho.");
  else if (outcome === "ios") notify("No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”.", "info");
  else if (outcome === "unavailable") notify("Este navegador não oferece instalação. No Chrome ou no Edge, use o menu “Instalar aplicativo”.", "info");
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
  const installMode = useInstallMode();
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
        <button type="button" className="brand-home" onClick={() => navigate("central")} aria-label="Strix United FC 27 — ir para a Central">
          <Crest small />
          <span>STRIX<b>FC 27</b></span>
        </button>
        <button
          type="button"
          className="collapse"
          onClick={() => setCompact(!compact)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
        >
          <Icon name="chevronLeft" size={18} />
        </button>
        <CloseButton className="mobile-close" onClick={() => setMobileOpen(false)} label="Fechar menu" />
      </div>
      <nav className="sidebar-scroll" aria-label="Navegação principal">
      {navGroupsFor(profile).map((group) => (
        <div className="menu-group" key={group.id} role="group" aria-label={group.label}>
          <p aria-hidden="true">{group.label}</p>
          {group.items.map(([id, label, icon]) => (
            <button
              type="button"
              key={id}
              className={active === id ? "active" : ""}
              aria-current={active === id ? "page" : undefined}
              aria-label={label}
              data-tour={`nav-${id}`}
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
      ))}
      </nav>
      <div className="sidebar-dock">
      {installMode && (
        <button type="button" className="sidebar-install" onClick={() => void installApp()} aria-label="Instalar o Strix neste aparelho" data-tooltip={collapsed ? "Instalar app" : undefined}>
          <Icon name="install" size={18} />
          <span><b>Instalar app</b><small>Abre em tela cheia, com ícone no aparelho</small></span>
        </button>
      )}
      <RastroSignature compact={collapsed} />
      {collapsed ? <div className="sidebar-compact-account"><button type="button" className="sidebar-signout" onClick={signOut} aria-label="Sair da conta" data-tooltip="Sair da conta"><Icon name="logout" size={19}/></button></div> : <div className="sidebar-user">
        <Avatar name={profile.display_name} logo={profile.avatar_url} kind="photo" size="sm" />
        <span>
          <b>{profile.display_name}</b>
          <small>{tierLabel(profile.access_tier)}</small>
        </span>
        <button type="button" className="sidebar-signout" onClick={signOut} title="Sair da conta" aria-label="Sair da conta">
          <Icon name="logout" size={15} />
        </button>
      </div>}
      </div>
    </aside>
  );
}
const agendaDraftKey = "strix-fc27-agenda-draft";
// Home "Agora": the club's present moment. See src/features/home.
function CentralLive({ workspace, navigate, profile, ownPlayer, required = null }) {
  return <HomePage workspace={workspace} profile={profile} navigate={navigate} ownPlayer={ownPlayer} required={required} />;
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
const lineupSlots = LINEUP_SLOTS;
const emptyLineup = () => Array(11).fill("");
function FormationPicker({ lineup, onChange, compact = false, readOnly = false, roster = [], assetUrl = (value) => value || "", rotation = null }) {
  const [slot, setSlot] = useState(null);
  const duplicateSlots = duplicateLineupPlayers(lineup, roster);
  const choose = (player) => {
    if (slot === null) return;
    const next = [...lineup];
    next[slot] = player?.display_name || "";
    onChange(next);
    setSlot(null);
  };
  const clearSlot = () => {
    if (slot === null) return;
    const next = [...lineup];
    next[slot] = "";
    onChange(next);
    setSlot(null);
  };
  const activeRoster = (Array.isArray(roster) ? roster : []).filter((player) => player?.is_active);
  const desiredPosition = slot === null ? "" : lineupSlots[slot];
  const availableRoster = availableLineupPlayers(lineup, activeRoster, slot ?? -1);
  const natural = availableRoster.filter((player) => (player.positions || []).includes(desiredPosition));
  const improvised = availableRoster.filter((player) => !(player.positions || []).includes(desiredPosition));
  const avatarFor = (player) => player?.avatar_path ? assetUrl(player.avatar_path) : player?.external_avatar_url || "";
  const lineupPlayer = (name) => activeRoster.find((player) => normalizeTeamName(player.display_name) === normalizeTeamName(name));
  useEffect(() => {
    preloadClubLogos(activeRoster.slice(0, 24).map(avatarFor));
  }, [activeRoster.length]);
  useEffect(() => {
    if (slot === null) return undefined;
    preloadClubLogos([...natural, ...improvised].map(avatarFor));
    return undefined;
  }, [slot]);
  const playerButton = (player) => (
    <button type="button" key={player.id || player.display_name} onClick={() => choose(player)}>
      <b>{player.member_type === "teste" ? "TESTE" : "ELENCO"}</b>
      <Avatar name={player.display_name} logo={avatarFor(player)} kind="photo" priority />
      <span>{player.display_name}<small>{(player.positions || []).join(" · ") || "SEM POSIÇÃO"}</small>{rotation && <small className="formation-rest">{rotationLabel(rotation.get(player.id))}</small>}</span>
    </button>
  );
  return (
    <section className={`formation-picker ${compact ? "is-compact" : ""} ${readOnly ? "is-read-only" : ""}`}>
      {!readOnly && duplicateSlots.length > 0 && <p className="formation-duplicate-warning" role="alert">Esta escalação contém jogador duplicado. Remova a repetição antes de salvar.</p>}
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
            <i className={player ? "has-player-photo" : ""}>{lineup[index] ? <Avatar name={lineup[index]} logo={avatarFor(player)} kind="photo" priority /> : readOnly ? "–" : "+"}</i>
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
            <CloseButton className="formation-picker-close" label="Fechar seleção de jogador" onClick={() => setSlot(null)} />
          </header>
          {lineup[slot] && <button type="button" className="formation-clear-slot" onClick={clearSlot}>REMOVER DESTA POSIÇÃO</button>}
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
/** The championships the Agenda offers: those registered in Campeonatos that are still running (not only in the history). */
function agendaCompetitionNames(workspace = {}) {
  const editions = workspace.competitionEditions || [];
  return (workspace.competitions || [])
    .filter((competition) => { const own = editions.filter((edition) => edition.competition_id === competition.id); return !own.length || own.some((edition) => edition.status !== "historical"); })
    .map((competition) => String(competition.name || "").trim())
    .filter((name, index, names) => name && names.indexOf(name) === index)
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function AgendaModal({ entry, mode = "new", presets, competitions = [], leg = "", roster = [], assetUrl, standings, onClose, onEdit, onSave, logoForOpponent = catalogLogo, defaultDate = defaultAgendaForm.date, suggestTimeForDate, stake = "", brief = null, tools = null, activity = null, gate = null, board = null, requiredTools = null }) {
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
  // "Ida e volta": the return leg is a second game of the same night, saved with its own hour.
  const [twoLegs, setTwoLegs] = useState(false);
  const [returnTime, setReturnTime] = useState("");
  const canHaveLegs = !leg && !/^\s*amistos/i.test(form.competition || "amistoso");
  const withReturn = canHaveLegs && twoLegs;
  const returnAt = returnTime || nextKickoff(form.time);
  const [lineup, setLineup] = useState(() => entry?.lineup || emptyLineup());
  const [logoFile, setLogoFile] = useState(null);
  const [queuedGames, setQueuedGames] = useState([]);
  const [addFeedback, setAddFeedback] = useState("");
  const scrollRef = useRef(null);
  const [lineupError, setLineupError] = useState("");
  // Line-up tools: each one replaces the line-up in one step, and that step can be taken back.
  const [lineupUndo, setLineupUndo] = useState(null);
  const [toolNote, setToolNote] = useState("");
  const applyLineup = (next, note = "") => {
    setLineupUndo([...lineup]);
    setLineup(next);
    setToolNote(note);
  };
  const listPlayers = tools?.nightPlayers?.(form.date) || [];
  const suggest = () => {
    const fromList = listPlayers.length > 0;
    const next = suggestLineup({ candidates: fromList ? listPlayers : roster, rotation: tools?.rotation, reference: tools?.last?.lineup || [] });
    const open = next.filter((name) => !name).length;
    applyLineup(next, `${fromList ? "Sugestão pela lista da noite" : "Sem lista salva para este dia: sugestão pelo elenco"}, com quem está mais descansado em cada posição.${open ? ` ${open} ${open === 1 ? "posição ficou vazia" : "posições ficaram vazias"}: ninguém disponível joga ${open === 1 ? "nela" : "nelas"}.` : ""}`);
  };
  const swap = mode === "swap";
  const readOnly = mode === "view";
  // A friendly has no table: the stage and the line-up take the whole sheet.
  const hasTable = Boolean(standings) && standings.reason !== "no_competition";
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
    const validation = validateLineupUnique(lineup, roster);
    if (!validation.valid) {
      setLineupError(validation.message);
      return;
    }
    setLineupError("");
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
    setAddFeedback("");
    // The form is now a blank game: bring it back to the top and put the cursor on the opponent.
    requestAnimationFrame(() => {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      scrollRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      scrollRef.current?.querySelector(".agenda-opponent-input")?.focus({ preventScroll: true });
    });
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
    const lineups = [...queuedGames, { ...entry, ...form, lineup }];
    const invalidLineup = lineups.find((game) => !validateLineupUnique(game.lineup, roster).valid);
    if (invalidLineup) {
      setLineupError("Um jogador não pode ocupar mais de uma posição na mesma escalação.");
      return;
    }
    setLineupError("");
    const currentGame = { ...entry, ...form, lineup, logoFile, opponent: form.opponent.trim() };
    if (withReturn && !/^\d{1,2}:\d{2}$/.test(returnAt.trim())) {
      setAddFeedback("Informe o horário do jogo da volta, como 21:40.");
      return;
    }
    // The return leg: the same game at its own hour (a new row; the one being edited stays the first).
    const returnGame = withReturn ? [{ ...form, lineup, logoFile, opponent: form.opponent.trim(), time: returnAt.trim() }] : [];
    onSave(edit ? (returnGame.length ? [currentGame, ...returnGame] : currentGame) : [...queuedGames, currentGame, ...returnGame], mode);
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
          <CloseButton className="modal-close" onClick={onClose} />
        </header>
        <form onSubmit={(event) => submit(event)}>
          <div className="agenda-modal-scroll" ref={scrollRef}>
          {lineupError && <p className="formation-duplicate-warning" role="alert">{lineupError}</p>}
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
          {!edit && queuedGames.length > 0 && (
            <p className="agenda-sequence-note" key={gameNumber} role="status">
              <b>JOGO {String(gameNumber).padStart(2, "0")}</b>
              {queuedGames.length === 1 ? "1 jogo guardado neste envio." : `${queuedGames.length} jogos guardados neste envio.`} Este formulário já é o próximo: preencha e salve tudo de uma vez.
            </p>
          )}
          {readOnly && <MatchStage opponent={form.opponent} logo={form.logo} date={form.date} time={form.time} competition={form.competition} group={standings?.available ? standings.group : ""} scheduledAt={entry?.db?.scheduled_at || ""} status={entry?.db?.status || ""} stake={stake} live={entry?.db || null} />}
          {!readOnly && <div className={`agenda-modal-body${!edit && gameNumber > 1 ? " is-next-game" : ""}`} key={`game-${gameNumber}`}>
            <div className="agenda-form">
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
                  className="agenda-opponent-input"
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
                  {/* Amistoso plus the championships registered in Campeonatos; a game saved under another name keeps it. */}
                  {!["AMISTOSO", ...competitions].some((name) => normalizeTeamName(name) === normalizeTeamName(form.competition)) && <option>{form.competition}</option>}
                  <option>AMISTOSO</option>
                  {competitions.map((name) => <option key={name}>{name}</option>)}
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
              {canHaveLegs && (
                <div className="form-row agenda-legs">
                  <label className="agenda-legs-toggle">
                    <input type="checkbox" checked={twoLegs} onChange={(event) => setTwoLegs(event.target.checked)} />
                    <span>IDA E VOLTA</span>
                  </label>
                  {twoLegs && (
                    <label>
                      HORÁRIO DA VOLTA
                      <span className="input-icon">
                        <Icon name="clock" size={16} />
                        <input value={returnAt} onChange={(event) => setReturnTime(event.target.value)} placeholder="21:40" />
                      </span>
                    </label>
                  )}
                </div>
              )}
              <label>
                PREDEFINIÇÃO DA ESCALAÇÃO
                <select
                  className="agenda-preset-select"
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
            </div>
            <aside className="match-preview">
              <span>PREVIEW DA AGENDA</span>
              <div>
                <span className="match-preview-mark"><Crest /></span>
                <b>VS</b>
                <span className="match-preview-mark"><Avatar name={form.opponent || "?"} logo={form.logo} /></span>
              </div>
              <strong>{form.opponent || "ADVERSÁRIO"}</strong>
              <small>{form.date} · {form.time}{withReturn ? <i className="leg-tag">Jogo de ida</i> : leg ? <i className="leg-tag">{leg === "ida" ? "Jogo de ida" : "Jogo de volta"}</i> : null}</small>
              {withReturn && <small>{form.date} · {returnAt}<i className="leg-tag">Jogo de volta</i></small>}
              <em>{form.competition}</em>
            </aside>
          </div>}
          <div className={readOnly ? `match-view-grid${hasTable ? " has-table" : ""}` : "agenda-lineup-wrap"}>
          <section className="modal-lineup">
            {/* A player who still owes the day's plays sees the gate here instead of the line-up. */}
            {gate || <>
            <header>
              <div>
                <span>ESCALAÇÃO DO JOGO</span>
                <h3>
                  3-1-4-2 <small>{lineup.filter(Boolean).length}/11</small>
                </h3>
              </div>
              <p>{readOnly ? lineupState({ lineup }).label + "." : "Toque em uma posição e escolha o jogador."}</p>
            </header>
            {!readOnly && tools && (
              <div className="lineup-tools">
                {tools.last && <button type="button" title={`${tools.last.match.opponent_name} · ${datePart(tools.last.match.scheduled_at)}`} onClick={() => applyLineup([...tools.last.lineup], `Escalação do jogo contra ${tools.last.match.opponent_name} (${datePart(tools.last.match.scheduled_at)}).`)}>Repetir última escalação</button>}
                <button type="button" onClick={suggest}>Sugerir escalação</button>
                {lineup.some(Boolean) && <button type="button" onClick={() => applyLineup(emptyLineup())}>Limpar</button>}
                {lineupUndo && <button type="button" className="is-undo" onClick={() => { setLineup(lineupUndo); setLineupUndo(null); setToolNote(""); }}>Desfazer</button>}
                {toolNote && <p role="status">{toolNote}</p>}
              </div>
            )}
            <FormationPicker lineup={lineup} onChange={setLineup} readOnly={readOnly} roster={roster} assetUrl={assetUrl} rotation={readOnly ? null : tools?.rotation} />
            </>}
          </section>
          {readOnly && hasTable && <MatchStandings standings={standings} competition={form.competition} />}
          </div>
          {board}
          {readOnly && <OpponentBrief brief={brief} />}
          {readOnly && activity}
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
            {readOnly && <CopyLinkButton page="agenda" id={entry?.id} className="is-leading" />}
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
  const [lineupError, setLineupError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const add = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    const validation = validateLineupUnique(lineup, roster);
    if (!validation.valid) {
      setLineupError(validation.message);
      return;
    }
    setLineupError("");
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
          <CloseButton className="modal-close" onClick={onClose} />
        </header>
        <div className="preset-panel-body">
        <FormationPicker compact lineup={lineup} onChange={setLineup} roster={roster} assetUrl={assetUrl} />
        {lineupError && <p className="formation-duplicate-warning" role="alert">{lineupError}</p>}
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
        </div>
        <form className="preset-panel-footer" onSubmit={add}>
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
          <span aria-hidden="true" />
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
              <span className="game-competition">{item.competition}{item.leg ? <i className="leg-tag">{item.leg === "ida" ? "Jogo de ida" : "Jogo de volta"}</i> : null}</span>
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
function AgendaLive({ navigate, workspace, profile, client = null, required = null, libraryItems = [] }) {
  // Obrigatório da noite, for the board: the centre where the day's plays are chosen and followed.
  const [requiredCenter, setRequiredCenter] = useState(null);
  const [tab, setTab] = useRemembered("agenda-tab", "today", { allowed: ["today", "next"] });
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
  // Cancelled games stay listed in their slot; only this page reads them.
  const items = useMemo(() => agendaListMatches(workspace.agenda).map((db) => ({
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
    leg: agendaLeg(db, workspace.agenda),
  })), [workspace.agenda, workspace.logos]);
  const todayIds = useMemo(
    () => new Set(todayAgendaMatches(workspace.agenda).map((match) => match.id)),
    [workspace.agenda],
  );
  const visible = items.filter((item) => tab === "today"
    ? item.db.list_day === "today"
    : item.db.list_day === "upcoming"
  ).sort((left, right) => new Date(left.db.scheduled_at) - new Date(right.db.scheduled_at));
  // A direct link (/agenda/<id>) opens that match; the address follows the match that is open.
  const target = useDeepTarget("agenda");
  useEffect(() => {
    if (!target?.id || modal || workspace.loading) return;
    const item = items.find((entry) => String(entry.id) === target.id);
    if (!item) {
      // Played games leave the Agenda: the link then leads to the result that was imported for it.
      const game = workspace.agenda.find((entry) => String(entry.id) === target.id);
      const result = workspace.matches.find((match) => String(match.agenda_match_id || match.agenda_matches?.id || "") === target.id && (!game || isResultOfGame(game, match)));
      if (result) { navigate("partidas", { id: result.id }); return; }
      notify("Esta partida não está mais na Agenda.", "error");
      clearTarget("agenda");
      return;
    }
    setTab(item.db.list_day === "today" ? "today" : "next");
    setModal({ entry: item, mode: "view" });
  }, [target?.id, items, workspace.loading]);
  const openMatch = (item) => {
    setActions(null);
    setModal({ entry: item, mode: "view" });
    openTarget("agenda", item.id);
  };
  const closeModal = () => {
    setModal(null);
    clearTarget("agenda");
  };
  const now = useMinuteClock();
  // a game the PC watcher sees on the pitch right now: the others whose time came wait their turn
  const onPitchNow = items.some((item) => isLiveFresh(item.db, now));
  const firstUpcoming = visible.findIndex((item) => !item.cancelled && new Date(item.db.scheduled_at).getTime() > now.getTime());
  const nowLineIndex = firstUpcoming === -1 ? visible.length : firstUpcoming;
  const nextTodayId = tab === "today" && firstUpcoming !== -1 ? visible[firstUpcoming].id : "";
  const defaultNewDate = datePart(new Date());
  // Rotation is read from imported matches (the same rebuilt performance the statistics use).
  const today = saoPauloDay(now);
  const rotation = useMemo(
    () => playerRotation({ players: workspace.players, aliases: workspace.aliases, matches: workspace.statMatches, now }),
    [workspace.players, workspace.aliases, workspace.statMatches, today],
  );
  const nightPlayers = (dateText) => {
    const [day, month, year] = String(dateText || "").split("/");
    const list = (workspace.nightRelated || []).find((row) => String(row.night_date).slice(0, 10) === `${year}-${month}-${day}`);
    const ids = new Set((list?.player_ids || []).map(String));
    return (workspace.players || []).filter((player) => player.is_active && ids.has(String(player.id)));
  };
  // Games already played tonight leave the active list; they stay visible here with their score.
  const playedToday = useMemo(() => tonightPlayed({ agenda: workspace.agenda, matches: workspace.matches, now }), [workspace.agenda, workspace.matches, today]);
  const suggestTimeForDate = (date, queued = []) => nextAgendaSlot(
    [...workspace.agenda, ...queued],
    date,
  );
  const run = async (work) => {
    setFeedback("");
    try { await work(); notify("Agenda atualizada."); }
    catch (error) { setFeedback(error.message || "Não foi possível concluir a alteração."); notify("Erro ao atualizar a Agenda.", "error"); }
  };
  // Link da noite: the public address of today's games and line-ups (see shared/night-link.js).
  const [nightLinkBusy, setNightLinkBusy] = useState(false);
  const copyNightLink = async () => {
    if (!client || nightLinkBusy) return;
    setNightLinkBusy(true);
    try {
      const { data } = await client.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/night-link", { headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {}, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.path) throw new Error(payload.error || "night_link_unavailable");
      const address = `${window.location.origin}${payload.path}`;
      // The link exists even when the browser refuses the clipboard: then it is shown to be copied by hand.
      try { await navigator.clipboard.writeText(address); } catch { notify(`Link da noite: ${address}`, "info"); return; }
      notify(payload.active
        ? "Link da noite copiado. Vale só hoje e para de funcionar se as escalações forem apagadas."
        : "Link da noite copiado. Ele só abre quando um jogo de hoje tiver escalação.", payload.active ? "success" : "info");
    } catch (error) {
      setFeedback(error.message === "insufficient_permission" ? "Só a diretoria gera o link da noite." : "Não foi possível gerar o link da noite. Tente de novo.");
      notify("Link da noite não gerado.", "error");
    } finally {
      setNightLinkBusy(false);
    }
  };
  // On a phone, a sideways swipe over the list changes between Hoje and Próximos.
  const swipeStart = useRef(null);
  const swipeTabs = {
    onTouchStart: (event) => {
      const touch = event.touches[0];
      swipeStart.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (event) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start || modal || actions) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      if (dx < 0 && tab === "today") setTab("next");
      if (dx > 0 && tab === "next") setTab("today");
    },
  };
  // A cancelled game stays on the Agenda and can be reactivated: it is done at once, with the way back in the toast.
  const cancelMatch = async (item) => {
    setFeedback("");
    try {
      await workspace.setAgendaStatus(item.id, "cancelled");
      notify(`Jogo contra ${item.opponent} cancelado.`, "success", {
        label: "Desfazer",
        run: () => { workspace.setAgendaStatus(item.id, "scheduled").then(() => notify("Jogo reativado.")).catch((error) => notify(error.message || "Não foi possível reativar o jogo.", "error")); },
      });
    } catch (error) {
      setFeedback(error.message || "Não foi possível cancelar o jogo.");
      notify("Erro ao atualizar a Agenda.", "error");
    }
  };
  return (
    <section className="agenda-page page-enter">
      <PageHeader
        title="A noite começa aqui."
        description="Organize os jogos e deixe a escalação pronta antes da bola rolar."
        actions={canManageAgenda(profile) && <>
          <button className="secondary" onClick={() => void copyNightLink()} disabled={nightLinkBusy} title="Link público com os jogos e as escalações de hoje: vale só hoje e para de funcionar se as escalações forem apagadas">{nightLinkBusy ? "GERANDO…" : "LINK DA NOITE"}</button>
          {client && required?.ready && hasMinimumTier(profile, "conselho") && <button className="secondary" onClick={() => setRequiredCenter({ day: required.day || dayOfFormDate(datePart(new Date())), intro: "" })} title="As jogadas que o time precisa assistir hoje antes de ver a escalação, e quem já assistiu">JOGADAS DO DIA</button>}
          <button className="secondary preset-trigger" onClick={() => setShowPresets(true)}>PREDEFINIÇÕES</button>
          <button className="primary" onClick={() => setModal({ mode: "new" })}><Icon name="plus" size={17} />NOVO JOGO</button>
        </>}
      />
      <nav className="agenda-tabs">
        <button className={tab === "today" ? "selected" : ""} onClick={() => setTab("today")}>Hoje <b>{todayIds.size}</b></button>
        <button className={tab === "next" ? "selected" : ""} onClick={() => setTab("next")}>Próximos</button>
        <button onClick={() => navigate("partidas")}>Concluídos <Icon name="arrow" size={13} /></button>
      </nav>
      <ErrorNote message={feedback || workspace.error} onRetry={feedback ? undefined : () => workspace.refresh()} />
      <section className="agenda-list" aria-busy={workspace.loading} {...swipeTabs}>
        <div className="agenda-list-heading"><span>{tab === "next" ? "DATA · HORÁRIO" : "HORÁRIO"}</span><span>PARTIDA</span><span>CAMPEONATO</span><span>STATUS</span><span aria-hidden="true" /></div>
        {visible.length ? visible.map((item, index) => {
          const status = agendaStatus(item.db, now, { onPitch: onPitchNow });
          const lineup = lineupState(item.db);
          const showNowLine = tab === "today" && index === nowLineIndex;
          return (
          <React.Fragment key={item.id}>
          {showNowLine && <div className="agenda-now-line" role="separator" aria-label={`Agora, ${timePart(now)}`}><time>{timePart(now)}</time><i /></div>}
          <article
            className={`agenda-game ${item.cancelled ? "is-cancelled" : ""} is-${status.tone}${item.id === nextTodayId ? " is-next" : ""}`}
          >
            <button className="agenda-game-open" type="button" aria-label={`Abrir escalação de ${item.opponent}`} onClick={() => openMatch(item)}>
              <time className={tab === "next" ? "future-kickoff" : ""}>{tab === "next" && <span>{item.date}</span>}<b>{item.time}</b></time>
              <div className="agenda-match">
                <Avatar name={item.opponent} logo={item.logo} />
                <div>{item.previousOpponent && <small className="replaced-opponent"><s>{item.previousOpponent}</s></small>}<b>{item.opponent}</b>{status.live ? <small className="agenda-live-line"><b>{status.live.strix}<i>×</i>{status.live.opponent}</b>{Number.isFinite(status.live.minute) ? <span>{status.live.minute}'</span> : null}</small> : null}<small className={`agenda-lineup is-${lineup.kind}${status.live ? " is-live-hidden" : ""}`}>{item.cancelled ? item.competition : lineup.short}</small>{(() => { const moved = rescheduleOf(item.db, now); return moved ? <small className="agenda-moved-line"><i className="agenda-moved">Horário mudou</i>{rescheduleLabel(moved)}</small> : null; })()}</div>
              </div>
              <span className="game-competition">{item.competition}{item.leg ? <i className="leg-tag">{item.leg === "ida" ? "Jogo de ida" : "Jogo de volta"}</i> : null}</span>
              {status.live ? (
                <em className="agenda-status is-live" aria-label={status.label}>
                  <i className="live-dot" aria-hidden="true" />
                  <span className="live-tag">Ao vivo</span>
                  <b className="live-score">{status.live.strix}<i>×</i>{status.live.opponent}</b>
                  {Number.isFinite(status.live.minute) ? <span className="live-minute">{status.live.minute}'</span> : null}
                </em>
              ) : <em className={`agenda-status is-${status.tone}`}>{status.label}</em>}
            </button>
            {canManageAgenda(profile) && <button className="agenda-more" data-agenda-menu-trigger aria-haspopup="menu" aria-expanded={actions === item.id} aria-label={`Ações para ${item.opponent}`} onClick={(event) => { event.stopPropagation(); setActions(actions === item.id ? null : item.id); }}><Icon name="more" size={20} /></button>}
            {canManageAgenda(profile) && actions === item.id && <div className="agenda-actions" role="menu" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
              event.preventDefault();
              const buttons = [...event.currentTarget.querySelectorAll("button")];
              const index = buttons.indexOf(document.activeElement);
              buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
            }}>
              {item.cancelled ? <button onClick={() => { setActions(null); void run(() => workspace.setAgendaStatus(item.id, "scheduled")); }}><Icon name="calendar" size={15} />Reativar jogo</button> : <>
              <button onClick={() => { setActions(null); setModal({ entry: item, mode: "edit" }); }}><Icon name="edit" size={15} />Editar partida</button>
              <button onClick={() => { setActions(null); setModal({ entry: item, mode: "swap" }); }}><Icon name="game" size={15} />Trocar adversário</button>
              <button className="danger" onClick={() => { setActions(null); void cancelMatch(item); }}><Icon name="close" size={15} />Cancelar jogo</button>
              </>}
              <button className="danger delete" onClick={() => { setActions(null); setPendingAction({ type:"delete", item }); }}><Icon name="trash" size={15} />Excluir partida</button>
            </div>}
          </article>
          {tab === "today" && index === visible.length - 1 && nowLineIndex === visible.length && <div className="agenda-now-line is-end" role="separator" aria-label={`Agora, ${timePart(now)}`}><time>{timePart(now)}</time><i /></div>}
          </React.Fragment>
          );
        }) : <div className="agenda-empty">{workspace.loading ? "Sincronizando a Agenda…" : tab === "today" ? (playedToday.length ? "Os jogos de hoje já foram jogados." : "Nenhum jogo marcado para hoje. Os próximos ficam na aba Próximos.") : "Nenhum jogo marcado depois de hoje."}</div>}
        {tab === "today" && playedToday.map((item) => (
          <article className="agenda-game is-done is-played" key={`played-${item.id}`}>
            <button className="agenda-game-open" type="button" aria-label={`Abrir o resultado contra ${item.opponent_name}`} onClick={() => navigate("partidas", { id: item.matchId })}>
              <time><b>{timePart(item.scheduled_at)}</b></time>
              <div className="agenda-match">
                <Avatar name={item.opponent_name} logo={(() => { const row = workspace.agenda.find((entry) => entry.id === item.id); return row?.resolved_opponent_logo_url || (row?.opponent_logos?.storage_path ? workspace.assetUrl(row.opponent_logos.storage_path) : ""); })()} />
                <div><b>{item.opponent_name}</b><small className="agenda-lineup">Strix {item.strix} × {item.opponent}</small></div>
              </div>
              <span className="game-competition">{item.competition}{item.leg ? <i className="leg-tag">{item.leg === "ida" ? "Jogo de ida" : "Jogo de volta"}</i> : null}</span>
              <em className="agenda-status is-done">{item.result === "V" ? "Vitória" : item.result === "D" ? "Derrota" : item.result === "E" ? "Empate" : "Jogado"}</em>
            </button>
          </article>
        ))}
      </section>
      {showPresets && <PresetPanel presets={presets} setPresets={setPresets} roster={workspace.players} assetUrl={workspace.assetUrl} onClose={() => setShowPresets(false)} />}
      {modal && <AgendaModal entry={modal.entry} mode={modal.mode} presets={presets} competitions={agendaCompetitionNames(workspace)} leg={agendaLeg(modal.entry?.db, workspace.agenda)} roster={workspace.players} assetUrl={workspace.assetUrl} standings={agendaStandingComparison(modal.entry?.db, workspace.competitionSources, workspace.competitionTeams)} defaultDate={defaultNewDate} suggestTimeForDate={suggestTimeForDate} gate={modal.entry && modal.mode === "view" && required?.locks(modal.entry.db) ? <RequiredGate status={required.status} onWatch={required.open} /> : null} board={modal.entry && client && hasMinimumTier(profile, "conselho") && required?.items.length && matchDay(modal.entry.db) === required.day ? <RequiredPeek total={required.items.length} onOpen={() => setRequiredCenter({ day: required.day, intro: "" })} /> : null} activity={modal.entry && client && canViewActivity(profile) && !required?.locks(modal.entry.db) ? <ActivityList client={client} entity="agenda" entityId={modal.entry.id} title="Histórico desta partida" refreshKey={modal.entry.db?.updated_at || ""} /> : null} stake={modal.entry ? matchStake(modal.entry.db, { editions: workspace.competitionEditions, sources: workspace.competitionSources, fixtures: workspace.competitionFixtures })?.text || "" : ""} brief={modal.entry ? opponentBrief(modal.entry.db, { matches: workspace.matches, fixtures: workspace.competitionFixtures }) : null} tools={canEditLineup(profile) ? { last: lastLineup(workspace.agenda, { before: modal.entry?.db?.scheduled_at || new Date(8.64e15), excludeId: modal.entry?.id || "" }), rotation, nightPlayers } : null} onClose={closeModal} onEdit={modal.entry && canEditLineup(profile) ? () => setModal({ entry: modal.entry, mode: "edit" }) : undefined} logoForOpponent={(name) => { const logo = matchingLogo(workspace.logos, name); return logo?.storage_path ? workspace.assetUrl(logo.storage_path) : catalogLogo(name); }} onSave={(payload, mode) => void run(async () => {
        await workspace.saveAgenda(payload, mode, modal.entry?.db);
        closeModal();
        // A new game just went in: the board is asked, once, what the team has to watch that day.
        const first = Array.isArray(payload) ? payload[0] : payload;
        if (!modal.entry && client && required?.ready && canEditLineup(profile) && dayOfFormDate(first?.date)) setRequiredCenter({ day: dayOfFormDate(first.date), intro: "saved" });
      })} />}
      {requiredCenter && <RequiredCenter client={client} day={requiredCenter.day} intro={requiredCenter.intro} items={libraryItems} players={workspace.players} canPick={canEditLineup(profile)} close={() => setRequiredCenter(null)} onChanged={required?.refresh} />}
      {pendingAction && <ViewportDialog className="modal-backdrop is-centered" onMouseDown={() => setPendingAction(null)}>
        <article className="agenda-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="agenda-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <div><span>CONFIRMAR AÇÃO</span><h2 id="agenda-confirm-title">{pendingAction.type === "delete" ? "Excluir partida?" : "Cancelar jogo?"}</h2></div>
            <CloseButton onClick={() => setPendingAction(null)} />
          </header>
          <p>{pendingAction.type === "delete" ? `A partida contra ${pendingAction.item.opponent} será removida da Agenda.` : `A partida contra ${pendingAction.item.opponent} continua na Agenda, marcada como cancelada, e sai da Central, das mídias e da próxima partida. Dá para reativar depois.`}</p>
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

function SquadPageV3({ workspace, profile, contract = null, identity = null, client = null, ownPlayer = null, declaredPlayerId = "" }) {
  const [saving, setSaving] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [viewedContract, setViewedContract] = useState(null);
  const [viewedIdentity, setViewedIdentity] = useState(null);
  const [sheetPlayer, setSheetPlayer] = useState(null);
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
  // A direct link (/elenco/<id>) opens that player's sheet.
  const target = useDeepTarget("elenco");
  useEffect(() => {
    if (!target?.id || sheetPlayer) return;
    const player = activePlayers.find((entry) => String(entry.id) === target.id);
    if (!player) return;
    void preloadRoute("playerSheet");
    setSheetPlayer(player);
  }, [target?.id, activePlayers.length]);
  const openSheet = (player) => {
    setSheetPlayer(player);
    openTarget("elenco", player.id);
  };
  const closeSheet = () => {
    setSheetPlayer(null);
    clearTarget("elenco");
  };
  const personKey = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
  const ownNames = new Set([identity?.name, profile?.display_name].map(personKey).filter(Boolean));
  const isOwn = (player) => (ownPlayer ? player.id === ownPlayer.id : ownNames.has(personKey(player.display_name)));
  const ownsContract = (player) => Boolean(contract?.signature?.d) && isOwn(player);
  // "Este sou eu": a member whose Discord name is not on the roster says which entry is theirs.
  const [linking, setLinking] = useState(false);
  const declarePlayer = async (playerId) => {
    if (!client || linking) return;
    setLinking(true);
    try {
      const { error: linkError } = await client.auth.updateUser({ data: { [PLAYER_LINK_KEY]: playerId } });
      if (linkError) throw linkError;
      notify(playerId ? "Pronto: este é o seu perfil no elenco." : "Vínculo com o perfil desfeito.");
    } catch {
      notify("Não foi possível gravar o vínculo. Tente de novo.", "error");
    } finally {
      setLinking(false);
    }
  };
  const canReadContracts = canManagePlayers(profile);
  // The board can tie a site account to a roster entry when the member got it wrong himself.
  const [linkingPlayer, setLinkingPlayer] = useState(null);
  const openPlayerContract = async (player) => {
    if (ownsContract(player)) {
      setViewedContract(contract);
      setViewedIdentity(identity);
      setContractOpen(true);
      return;
    }
    if (!canReadContracts || !client) {
      setViewedContract(null);
      setViewedIdentity({ name: player.display_name });
      setContractOpen(true);
      return;
    }
    try {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      const response = await fetch("/api/internal/contracts", { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "contracts_unavailable");
      const key = personKey(player.display_name);
      const found = (payload.contracts || []).find((item) => item.playerId && item.playerId === String(player.id))
        || (payload.contracts || []).find((item) => !item.playerId && (item.identity?.names || []).some((name) => personKey(name) === key));
      if (!found) {
        // Say exactly what is missing: an account that has not signed, or no account at all.
        const waiting = (payload.unsigned || []).find((item) => item.playerId && item.playerId === String(player.id))
          || (payload.unsigned || []).find((item) => !item.playerId && (item.identity?.names || []).some((name) => personKey(name) === key));
        notify(waiting
          ? `A conta ${waiting.identity?.handle || waiting.identity?.name || ""} está ligada a ${player.display_name}, mas ainda não assinou o contrato de ${CONTRACT_SEASON}. Ele assina na primeira tela ao entrar no site.`
          : `Nenhuma conta do site está ligada a ${player.display_name}. Use “Vincular conta” no menu dele.`, "info");
      }
      setViewedContract(found?.contract || null);
      setViewedIdentity(found?.identity || { name: player.display_name });
      setContractOpen(true);
    } catch (cause) {
      setError(cause.message === "insufficient_permission" ? "Só a diretoria abre o contrato dos outros." : "Não foi possível abrir os contratos do clube.");
    }
  };
  const gamesForPlayer = (player) => {
    const names = new Set([
      normalizeTeamName(player.display_name),
      ...workspace.aliases.filter((alias) => alias.player_id === player.id).map((alias) => normalizeTeamName(alias.ea_name)),
    ]);
    return workspace.matches.filter((match) => currentMatchPerformance(match).players?.some((row) => names.has(normalizeTeamName(row.eaName || row.name)))).length;
  };

  return (
    <section className="data-page page-enter squad-page-v3">
      <PageHeader
        title="Elenco FC 27."
        description="Posições e vínculos organizados para escalar sem procurar jogador."
        actions={canCreate && <><Suspense fallback={<div className="roster-tools-actions" aria-busy="true"><button type="button" className="secondary" disabled><IconLink size={16} />ALIASES</button></div>}><RosterTools workspace={workspace} /></Suspense><button className="primary" onClick={openCreate}><Icon name="plus" size={16} />ADICIONAR JOGADOR</button></>}
      />
      <ErrorNote message={error || workspace.error} onRetry={error ? undefined : () => workspace.refresh()} />
      {activePlayers.length ? groups.map(([id, title, description]) => {
        const players = activePlayers.filter((player) => classify(player) === id);
        return (
          <section className="squad-sector" key={id}>
            <header><div><span>{title}</span><small>{description}</small></div><b>{players.length}</b></header>
            {players.length ? <div className="squad-list squad-compact-list">{players.map((player) => <article className="squad-player-card" key={player.id}>
              <button type="button" className="squad-card-open" aria-label={`Abrir ficha de ${player.display_name}`} onClick={() => openSheet(player)} onPointerEnter={() => { void preloadRoute("playerSheet"); }} />
              <Avatar name={player.display_name} logo={player.avatar_path ? workspace.assetUrl(player.avatar_path) : player.external_avatar_url || ""} kind="photo" size="md" />
              <div className="squad-card-identity"><b>{player.display_name}</b><small>{player.positions?.join(" · ") || "Posição não definida"}</small><span>{(() => { const games = gamesForPlayer(player); return games ? `${games} ${games === 1 ? "jogo" : "jogos"}` : "Sem jogos importados"; })()}</span></div>
              <strong className="squad-shirt-number">{player.shirt_number === null || player.shirt_number === undefined ? "—" : `#${String(player.shirt_number).padStart(2, "0")}`}</strong>
              {["teste", "complete"].includes(player.member_type) ? <em className={`member-tag ${player.member_type}`}>{player.member_type === "teste" ? `TESTE${player.trial_expires_at ? ` · até ${datePart(player.trial_expires_at)}` : ""}` : "COMPLETE"}</em> : <span className="member-tag-slot" aria-hidden="true" />}
              {(canEdit || canArchive || ownsContract(player)) && <div className="squad-context"><ActionMenu className="squad-more" label={`Ações de ${player.display_name}`} items={[(canReadContracts || ownsContract(player)) && { id: "contract", icon: "file", label: "Contrato", onSelect: () => void openPlayerContract(player) }, canReadContracts && client && { id: "account", icon: "eye", label: "Vincular conta", onSelect: () => setLinkingPlayer(player) }, canEdit && { id: "edit", icon: "edit", label: "Editar", onSelect: () => openEdit(player) }, canArchive && { id: "archive", icon: "trash", label: "Arquivar", tone: "danger", onSelect: () => { void workspace.removePlayer(player.id).then(() => notify(`${player.display_name} arquivado.`, "success", { label: "Desfazer", run: () => { workspace.restorePlayer(player.id).then(() => notify(`${player.display_name} de volta ao elenco.`)).catch((cause) => notify(cause.message || "Não foi possível reativar o jogador.", "error")); } })).catch((removeError) => setError(removeError.message)); } }].filter(Boolean)} /></div>}
            </article>)}</div> : <p className="squad-sector-empty">Nenhum jogador nesta faixa.</p>}
          </section>
        );
      }) : <div className="matches-empty">O elenco FC 27 começa vazio. Adicione os jogadores oficiais quando estiver pronto.</div>}
      {linkingPlayer && <AccountLink client={client} player={linkingPlayer} close={() => setLinkingPlayer(null)} onLinked={(name) => notify(name ? `Conta ${name} vinculada a ${linkingPlayer.display_name}.` : `${linkingPlayer.display_name} ficou sem conta vinculada.`, "success")} />}
      {sheetPlayer && <Suspense fallback={null}><PlayerSheet rosterPlayer={sheetPlayer} workspace={workspace} onClose={closeSheet} actions={<><CopyLinkButton page="elenco" id={sheetPlayer.id} />{client && !ownPlayer && declaredPlayerId !== PLAYER_LINK_NONE && <button type="button" className="secondary" disabled={linking} onClick={() => void declarePlayer(String(sheetPlayer.id))}>ESTE SOU EU</button>}{client && declaredPlayerId && declaredPlayerId === String(sheetPlayer.id) && <button type="button" className="secondary" disabled={linking} onClick={() => void declarePlayer("")}>NÃO SOU EU</button>}{(canReadContracts || ownsContract(sheetPlayer)) && <button type="button" className="secondary" onClick={() => void openPlayerContract(sheetPlayer)}>VER CONTRATO</button>}</>} /></Suspense>}
      {contractOpen && <Suspense fallback={null}><SignedContractArchive contract={viewedContract} identity={viewedIdentity} onClose={() => setContractOpen(false)} /></Suspense>}
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
        </section><aside className="squad-preview"><span>PREVIEW DO ELENCO</span><Avatar name={draft.display_name || "?"} logo={currentAvatar} kind="photo" size="lg" /><small>{draft.positions[0] || "POSIÇÃO"}</small><h3>{draft.display_name || "NOME DO JOGADOR"}</h3><p>{draft.member_type === "teste" ? "Jogador em teste" : draft.member_type === "complete" ? "Jogador completo" : "Jogador do elenco"}</p></aside></div>
        <footer>{error && <p className="squad-save-error" role="alert">{error}</p>}<div><button type="button" className="secondary" onClick={close} disabled={saving}>CANCELAR</button><button className="primary" disabled={saving}><Icon name="upload" size={16} />{saving ? "SALVANDO…" : editing?.id ? "SALVAR ALTERAÇÕES" : "SALVAR JOGADOR"}</button></div></footer>
      </form></ViewportDialog>}
    </section>
  );
}
function FeatureBoundary({ children, type = "table" }) {
  return <Suspense fallback={<WorkspaceSkeleton type={type}/>}>{children}</Suspense>;
}

function DataPage({ id, workspace, profile, client, ownPlayer = null, required = null }) {
  if (!canViewPage(profile, id)) return <AccessDenied page={id} />;
  const statisticalMatches = workspace.statMatches || [];
  if (id === "estatisticas") return <FeatureBoundary type="statistics"><StatisticsPage workspace={workspace} matches={statisticalMatches}/></FeatureBoundary>;
  if (id === "analise") return <FeatureBoundary type="analysis"><AnalysisPage workspace={workspace} profile={profile} matches={statisticalMatches}/></FeatureBoundary>;
  if (id === "biblioteca") return <FeatureBoundary type="library"><LibraryPage client={client} profile={profile} ownPlayer={ownPlayer} required={required}/></FeatureBoundary>;
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
    midia: ["MÍDIA", "Central social.", "Agenda do dia, relacionados, resumos e anúncios da temporada."],
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
      const payload = await readApiJson(response);
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
      const payload = await readApiJson(response);
      const normalized = (payload.matches || []).map(normalizeEaMatch);
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
  const activeAgenda = activeAgendaMatches(workspace.agenda);
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
      const payload = await readApiJson(response);
      const normalized = (payload.matches || []).map((match, index) => ({ ...normalizeEaMatch(match, index), raw: match }));
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
      const payload = await readApiJson(response);
      const normalized = (payload.matches || []).map((match, index) => ({ ...normalizeEaMatch(match, index), raw: match }));
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
function Command({ close, navigate, workspace, profile, extras }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultsRef = useRef(null);
  const [selection, setSelection] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });
  const list = useMemo(
    () => filterCommandItems(commandItems({ profile, workspace, navigate, extras }), query).slice(0, 24),
    [navigate, profile, query, workspace, extras],
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
  return <button className={`now-playing${item ? "" : " is-agenda-free"}`} onClick={() => navigate("agenda")} aria-label={item ? `Próxima partida: Strix United contra ${item.opponent_name}, ${datePart(item.scheduled_at)} às ${timePart(item.scheduled_at)}` : "Agenda: nenhuma partida programada"} title={item ? undefined : "Agenda sem partidas programadas"}>
    {item ? <><Crest small/><div><small>PRÓXIMA PARTIDA</small><b>Strix United vs {item.opponent_name}</b></div><strong>{timePart(item.scheduled_at)}</strong><Icon name="arrow" size={17}/></> : <Crest small priority/>}
  </button>;
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
function MaintenanceScreen({ onRetry, onBack }) {
  return (
    <SpecialState
      kind="unavailable"
      onRetry={onRetry}
      onBack={onBack}
    />
  );
}

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
function currentRoute() {
  return { pathname: window.location.pathname, hash: window.location.hash };
}
/**
 * Link da noite (/noite/<token>): today's games and their line-ups for someone who is not
 * signed in. It reads one public address and nothing else of the site; the server decides
 * whether the link is alive (see shared/night-link.js). It checks again every minute, so a
 * line-up that changes, or a night that ends, shows without a reload.
 */
function PublicNight({ token }) {
  const [state, setState] = useState({ status: "loading", night: null });
  const [openId, setOpenId] = useState("");
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/public/night/${token}`, { cache: "no-store", headers: { accept: "application/json" } });
        const payload = await response.json().catch(() => null);
        if (!alive) return;
        if (response.ok && Array.isArray(payload?.matches) && payload.matches.length) setState({ status: "ready", night: payload });
        else if (response.status === 404) setState({ status: "inactive", night: null });
        else setState((current) => (current.night ? current : { status: "error", night: null }));
      } catch {
        if (alive) setState((current) => (current.night ? current : { status: "error", night: null }));
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [token]);
  useEffect(() => { document.title = "Escalação da noite · Strix United"; }, []);
  const night = state.night;
  const roster = useMemo(() => (night?.players || []).map((player) => ({
    id: player.display_name, display_name: player.display_name, positions: player.positions || [],
    external_avatar_url: player.photo || "", member_type: player.test ? "teste" : "complete", is_active: true,
  })), [night]);
  const dayLabel = night?.matches?.[0]?.scheduledAt
    ? new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(night.matches[0].scheduledAt))
    : "";
  return (
    <main className="public-night">
      <div className="public-night-inner">
        <header className="public-night-head">
          <Avatar name="Strix United" logo={STRIX_BRAND.logo} priority />
          <div><b>STRIX UNITED</b><span>Escalação da noite{dayLabel ? ` · ${dayLabel}` : ""}</span></div>
        </header>
        {state.status === "loading" && <p className="public-night-none" role="status">Carregando a noite…</p>}
        {state.status === "inactive" && <section className="public-night-state">
          <h1>Este link não está mais ativo.</h1>
          <p>A escalação da noite fica pública só no dia dos jogos e enquanto houver escalação montada. Peça o link de hoje para a diretoria.</p>
          <a href="/">Ir para o site</a>
        </section>}
        {state.status === "error" && <section className="public-night-state">
          <h1>Não deu para carregar a noite.</h1>
          <p>Confira a conexão e abra o link de novo em instantes.</p>
          <a href={window.location.pathname}>Tentar de novo</a>
        </section>}
        {state.status === "ready" && <>
          <div>
            <h1>{night.matches.length === 1 ? "O jogo de hoje." : `Os ${night.matches.length} jogos de hoje.`}</h1>
            <p className="public-night-lead">Toque em um jogo para ver quem entra em campo.</p>
          </div>
          <ul className="public-night-list">
            {night.matches.map((match) => {
              const open = openId === match.id;
              return (
                <li className="public-night-game" key={match.id}>
                  <button type="button" className="public-night-row" aria-expanded={open} onClick={() => setOpenId(open ? "" : match.id)}>
                    <time dateTime={match.scheduledAt}>{timePart(match.scheduledAt)}</time>
                    <Avatar name={match.opponent} logo={match.logo} />
                    <span><b>{match.opponent}</b><small>{match.competition}</small></span>
                    <em className={match.filled ? "" : "is-empty"}>{match.filled ? `${match.filled}/11` : "Sem escalação"}</em>
                  </button>
                  {open && <div className="public-night-detail">
                    <MatchStage opponent={match.opponent} logo={match.logo} date={datePart(match.scheduledAt)} time={timePart(match.scheduledAt)} competition={match.competition} scheduledAt={match.scheduledAt} status={match.status} />
                    {match.filled
                      ? <FormationPicker lineup={match.lineup} roster={roster} readOnly />
                      : <p className="public-night-none">A escalação deste jogo ainda não foi montada.</p>}
                  </div>}
                </li>
              );
            })}
          </ul>
          <p className="public-night-foot">Este link vale só para hoje. A página se atualiza sozinha quando a escalação muda.</p>
        </>}
      </div>
    </main>
  );
}

function App() {
  const auth = useTeamAuth();
  const workspace = useFc27Workspace(auth.client, auth.profile);
  const online = useOnline();
  const [route, setRoute] = useState(currentRoute);
  // Competitions read themselves again in the background while someone who manages them is here.
  useCompetitionAutoRefresh({ client: auth.client, profile: auth.profile, workspace });
  // The Library rows the shell needs (Central, search, notices); refreshed as the member moves around.
  const library = useLibraryGlance(auth.client, auth.profile, pageFromLocation(route));
  // Obrigatório da noite: the day's required plays, and whether the line-ups are still closed to this member.
  const nightRequired = useNightRequired(auth.client, auth.profile, pageFromLocation(route));
  const [requiredOpen, setRequiredOpen] = useState(false);
  const required = { ...nightRequired, open: () => setRequiredOpen(true) };
  const locationState = resolveLocation(route);
  const [launchTick, setLaunchTick] = useState(() => Date.now());
  const [launchAccessCache, setLaunchAccessCache] = useState(() =>
    isLaunchUnlocked(Date.now(), LAUNCH_CONFIG) ? null : readLaunchAccessVerification(),
  );
  const launchDecision = launchGateDecision({
    hostname: window.location.hostname,
    now: launchTick,
    profile: auth.profile,
    sessionUserId: auth.session?.user?.id || "",
    authLoading: auth.loading,
    config: LAUNCH_CONFIG,
  });
  const [active, setActive] = useState(() => pageFromLocation()),
    [compact, setCompact] = useRemembered("menu-compact", false, { scope: "device" }),
    [mobileOpen, setMobileOpen] = useState(false),
    [command, setCommand] = useState(false),
    [createOpen, setCreateOpen] = useState(false),
    [contractSignedFor, setContractSignedFor] = useState(""),
    [contractShownFor, setContractShownFor] = useState(readContractOpen),
    // The first-visit walk: "auto" until it is decided for this member, then open or closed.
    [tour, setTour] = useState("auto"),
    // The season's opening: "live" for whoever watched the countdown reach zero, "member" once
    // for whoever signs in after the launch, "" otherwise.
    [opening, setOpening] = useState("");
  const installMode = useInstallMode();
  const syncRoute = () => {
    setActive(pageFromLocation());
    setRoute((current) => {
      const next = currentRoute();
      if (current.pathname === next.pathname && current.hash === next.hash) return current;
      return next;
    });
  };
  // `target` ({ id, params }) opens one item of the page: its address goes to the bar and the page reads it.
  const navigate = (id, target) => {
    const page = id || "central";
    setActive(page);
    setMobileOpen(false);
    setCreateOpen(false);
    const next = target?.id ? deepLinkPath(page, target.id, target.params) : locationForPage(page);
    // The site was updated while this tab was open: the move is a full load of the new build.
    if (isStaleBuild() && `${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      window.location.assign(next);
      return;
    }
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      window.history.pushState({ page }, "", next);
    }
    setRoute(currentRoute());
    announceLocation();
  };
  useEffect(() => {
    const sync = () => syncRoute();
    // Any part of the app may ask to go somewhere (see goTo in ui/useDeepTarget.js).
    const go = (event) => navigate(event.detail?.page, event.detail?.target);
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    window.addEventListener("strix-navigate", go);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("strix-navigate", go);
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
    if (isLaunchUnlocked(launchTick, LAUNCH_CONFIG)) {
      setLaunchAccessCache(null);
      return;
    }
    if (auth.profile?.access_tier === "dev") {
      rememberLaunchAccess(auth.profile);
      setLaunchAccessCache(readLaunchAccessVerification());
      return;
    }
    if (!auth.loading) {
      clearLaunchAccessVerification();
      setLaunchAccessCache(null);
    }
  }, [auth.loading, auth.profile, launchTick]);
  useEffect(() => {
    if (workspace.loading) return;
    preloadClubLogos(workspace.agenda
      .filter((match) => !["cancelled", "completed"].includes(match.status))
      .slice(0, 12)
      .map((match) => match.resolved_opponent_logo_url || (match.opponent_logos?.storage_path ? workspace.assetUrl(match.opponent_logos.storage_path) : "")));
    preloadClubLogos((workspace.players || [])
      .filter((player) => player?.is_active)
      .slice(0, 36)
      .map((player) => player.avatar_path ? workspace.assetUrl(player.avatar_path) : player.external_avatar_url || ""));
  }, [workspace.agenda, workspace.players, workspace.loading]);
  useEffect(() => {
    if (auth.loading) return undefined;
    const next = consumeLaunchReturn();
    if (!next) return undefined;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current === next) return undefined;
    window.history.replaceState(window.history.state, "", next);
    syncRoute();
  }, [auth.loading]);
  // After the launch, a member who has not seen the opening on this device sees it once, as
  // soon as he is signed in. It is remembered when it starts, so a reload never replays it.
  useEffect(() => {
    const userId = auth.profile?.user_id;
    if (opening || !userId) return;
    if (!shouldShowOpening(window.localStorage, userId, { unlocked: isLaunchUnlocked(Date.now(), LAUNCH_CONFIG) })) return;
    markOpeningSeen(window.localStorage, userId);
    setOpening("member");
  }, [auth.profile?.user_id, opening]);
  const openingNode = opening === "live" || opening === "member"
    ? <SeasonOpening live={opening === "live"} onDone={() => setOpening("done")} />
    : null;
  if (!online) {
    return <SpecialState kind="offline" onRetry={() => window.location.reload()} />;
  }
  if (launchDecision !== "app") {
    return <LaunchGate mode={launchDecision} config={LAUNCH_CONFIG} previouslyVerified={Boolean(launchAccessCache)} onUnlock={(detail) => { if (detail?.live) { markOpeningLive(window.localStorage); setOpening("live"); } setLaunchTick(Date.now()); }} onInternalAccess={auth.signIn} />;
  }
  // Link da noite: a public page, shown whether or not a member is signed in.
  const nightToken = parseNightPath(window.location.pathname);
  if (nightToken) return <PublicNight token={nightToken} />;
  if (auth.failureKind === "unavailable") {
    return <SpecialState kind="unavailable" onRetry={() => window.location.reload()} />;
  }
  if (auth.failureKind === "session") {
    return <SpecialState kind="session" onLogin={auth.signIn} />;
  }
  if (!auth.profile)
    return (
      <>
        {openingNode}
        <LoginScreen
          loading={auth.loading}
          error={auth.error}
          onLogin={auth.signIn}
        />
      </>
    );
  if (!workspace.loading && auth.profile.access_tier !== "dev" && workspace.systemFlags.some((flag) => flag.key === "site_maintenance" && flag.enabled)) {
    return <MaintenanceScreen onRetry={() => window.location.reload()} onBack={auth.signOut} />;
  }
  // Primeiro login: contrato de vínculo da temporada, ligado ao usuário autenticado.
  const contractUser = auth.session?.user;
  const signedContract = hasSignedContract(contractUser) ? readContract(contractUser) : null;
  const contractIdentity = resolveContractIdentity({ session: auth.session, profile: auth.profile, players: workspace.players });
  // The gate stays mounted from the moment it opens until the confirmation ends, even though
  // the session refresh that follows `updateUser` already reports the contract as signed.
  const contractPending = Boolean(contractUser) && contractSignedFor !== contractUser.id
    && (!hasSignedContract(contractUser) || contractShownFor === contractUser.id);
  if (contractPending) {
    // The contract only renders once the session, the profile and the roster all
    // belong to the same, fully revalidated user. Anything else is a validation state.
    const identityReady = !auth.loading && !workspace.loading && auth.profile?.user_id === contractUser.id;
    return <>
      {openingNode}
      {identityReady || contractShownFor === contractUser.id
        ? <ContractGate client={auth.client} session={auth.session} profile={auth.profile} players={workspace.players} onShown={() => setContractShownFor(contractUser.id)} onSigned={() => { clearContractOpen(); setContractSignedFor(contractUser.id); }} onSignOut={auth.signOut} />
        : <ContractValidating />}
    </>;
  }
  const ownPlayer = resolveOwnPlayer({ session: auth.session, profile: auth.profile, players: workspace.players });
  // What only the shell knows, handed to the search so it can act (see command-palette.js).
  const libraryNow = libraryGlance({ items: library.items, progress: library.progress, userId: auth.profile.user_id, player: ownPlayer });
  const commandExtras = {
    ownPlayerId: ownPlayer?.id || "",
    copyLink,
    signOut: auth.signOut,
    library: { items: library.items, resume: libraryNow.resume ? { id: libraryNow.resume.item.id, title: libraryNow.resume.item.title } : null },
    tour: () => { navigate("central"); setTour("open"); },
    install: installMode ? () => void installApp() : undefined,
  };
  // The walk waits for the opening to leave: one thing at a time.
  const tourOpen = !openingNode && (tour === "open" || (tour === "auto" && !workspace.loading && active === "central" && shouldShowTour(window.localStorage, auth.profile.user_id)));
  const closeTour = () => {
    finishTour(window.localStorage, auth.profile.user_id);
    setTour("closed");
  };
  const title = locationState.kind === "not-found"
    ? "Não encontrada"
    : locationState.kind === "restricted"
      ? "Área restrita"
      : [["central", "Central", "live"], ...nav].find((item) => item[0] === active)?.[1] || "Central";
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
          <button type="button" className="topbar-home" onClick={() => navigate("central")} aria-label="Ir para a Central">
            <Crest small />
          </button>
          <button type="button" className="crumb" onClick={() => navigate("central")} aria-label={`STRIX / ${title}`}>
            <span aria-hidden="true">STRIX /</span><b>{title}</b>
          </button>
          <button className="search-button" aria-label="Buscar no Strix" data-tour="search" onClick={() => setCommand(true)}>
            <Icon name="search" />
            <span>Buscar páginas, partidas, jogadores…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="top-actions">
            {!workspace.loading && <NotificationCenter workspace={workspace} profile={auth.profile} ownPlayer={ownPlayer} library={library} navigate={navigate} lineupsLocked={Boolean(nightRequired.status.locked)} />}
            {/* Home and Agenda already lead with the next match; the media studio keeps its header quiet. */}
            {!["central", "agenda", "midia"].includes(active) && locationState.kind === "page" && <CurrentGameLive navigate={navigate} workspace={workspace} />}
            {(canManageAgenda(auth.profile) || canCreatePlayer(auth.profile) || canViewMedia(auth.profile) || canManageCompetitions(auth.profile)) && (
            <button className={`add-button create-trigger${createOpen ? " is-open" : ""}`} onClick={() => setCreateOpen((value) => !value)} aria-expanded={createOpen} aria-haspopup="menu" aria-label="Novo">
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
        {workspace.loading ? <WorkspaceSkeleton /> : locationState.kind === "not-found" ? (
          <SpecialState kind="not-found" embedded onHome={() => navigate("central")} />
        ) : locationState.kind === "restricted" ? (
          <SpecialState kind="restricted" embedded onHome={() => navigate("central")} />
        ) : active === "central" ? (
          <CentralLive workspace={workspace} navigate={navigate} profile={auth.profile} ownPlayer={ownPlayer} required={required} />
        ) : active === "agenda" ? (
          <AgendaLive navigate={navigate} workspace={workspace} profile={auth.profile} client={auth.client} required={required} libraryItems={library.items} />
        ) : active === "partidas" ? (
          <FeatureBoundary type="table"><MatchesPage profile={auth.profile} workspace={workspace} client={auth.client} /></FeatureBoundary>
        ) : active === "elenco" ? (
          <SquadPageV3 workspace={workspace} profile={auth.profile} contract={signedContract} identity={contractIdentity} client={auth.client} ownPlayer={ownPlayer} declaredPlayerId={readPlayerLink(auth.session?.user)} />
        ) : active === "campeonatos" ? (
          <FeatureBoundary type="competitions"><CompetitionsPage profile={auth.profile} workspace={workspace} client={auth.client} /></FeatureBoundary>
        ) : (
          <DataPage id={active} workspace={workspace} profile={auth.profile} client={auth.client} ownPlayer={ownPlayer} required={required} />
        )}
      </main>
      {requiredOpen && <RequiredSheet client={auth.client} required={nightRequired} items={library.items} tier={auth.profile?.access_tier} close={() => { setRequiredOpen(false); void nightRequired.refresh(); }} />}
      <nav className="tabbar" aria-label="Navegação rápida">
        {mobileTabsFor(auth.profile).map(([id, label, icon]) => (
          <button type="button" key={id} data-tour={`tab-${id}`} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} onClick={() => navigate(id)} onTouchStart={() => { void preloadRoute(id); }}>
            <Icon name={icon} size={22} />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" className={mobileOpen || !mobileTabsFor(auth.profile).some(([id]) => id === active) ? "active" : ""} data-tour="tab-more" aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
          <Icon name="grid" size={22} />
          <span>Mais</span>
        </button>
      </nav>
      {command && (
        <Command close={() => setCommand(false)} navigate={navigate} workspace={workspace} profile={auth.profile} extras={commandExtras} />
      )}
      {openingNode}
      {tourOpen && !command && <Tour profile={auth.profile} canSeeAnalysis={canViewPage(auth.profile, "analise")} onDone={closeTour} />}
      <ToastViewport />
    </div>
  );
}
export { Sidebar, CentralLive, AgendaLive, FormationPicker, SquadPageV3, DataPage };

watchForNewDeploy();
if (document.getElementById("root")) createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
