import { saoPauloDay, todayAgendaMatches } from "../agenda/agenda-time.js";

export const AGENDA_TEMPLATE_ID = "agenda-day";
export const AGENDA_TEMPLATE_VERSION = "agenda-day-v6";
export const AGENDA_FPS = 30;

export const MEDIA_FORMATS = Object.freeze({
  story: { id: "story", label: "Story / Reels 9:16", width: 1080, height: 1920, suffix: "story" },
  feed: { id: "feed", label: "Feed 4:5", width: 1080, height: 1350, suffix: "feed" },
});

export const canManageMedia = (profile) => ["diretoria", "dev"].includes(profile?.access_tier);

export function formatKickoff(scheduledAt) {
  if (!scheduledAt) return "";
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function formatAgendaDay(now = new Date()) {
  const date = new Date(now);
  return {
    iso: saoPauloDay(date),
    label: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(date).replace(".", "").toUpperCase(),
  };
}

export function opponentInitials(name = "") {
  const words = String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "FC";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function collectTodayAgenda(workspace = {}, now = new Date()) {
  const matches = todayAgendaMatches(workspace.agenda || [], now);
  const competitions = workspace.competitions || [];
  const fixtures = workspace.competitionFixtures || [];
  return matches.map((entry) => {
    const competition = competitions.find((item) => item.id === entry.competition_id);
    const fixture = entry.source_fixture_id
      ? fixtures.find((item) => item.id === entry.source_fixture_id)
      : null;
    const catalogLogo = entry.opponent_logos?.storage_path && workspace.assetUrl
      ? workspace.assetUrl(entry.opponent_logos.storage_path)
      : "";
    return {
      id: String(entry.id || ""),
      scheduled_at: entry.scheduled_at,
      kickoff: formatKickoff(entry.scheduled_at),
      opponent: String(entry.opponent_name || "").trim(),
      opponent_logo: String(entry.resolved_opponent_logo_url || catalogLogo || "").trim(),
      competition: String(competition?.name || entry.competition_name || "").trim(),
      competition_logo: String(competition?.logo_url || "").trim(),
      round: String(fixture?.round_label || "").trim(),
    };
  });
}

export function renderIdentityPayload({ day, format, matches = [], templateVersion = AGENDA_TEMPLATE_VERSION } = {}) {
  return {
    day: String(day || ""),
    format: String(format || "story"),
    template: AGENDA_TEMPLATE_ID,
    templateVersion,
    matches: matches.map((match) => ({
      id: match.id || "",
      scheduled_at: match.scheduled_at || "",
      opponent: match.opponent || "",
      opponent_logo: match.opponent_logo || "",
      competition: match.competition || "",
      competition_logo: match.competition_logo || "",
      round: match.round || "",
    })),
  };
}

export async function fingerprintAgendaRender(input = {}) {
  const encoded = new TextEncoder().encode(JSON.stringify(renderIdentityPayload(input)));
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const byte of encoded) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function agendaFileName({ day, format } = {}) {
  const spec = MEDIA_FORMATS[format] || MEDIA_FORMATS.story;
  const safeDay = String(day || "agenda").replace(/[^0-9-]/g, "") || "agenda";
  return `strix-agenda-${safeDay}-${spec.suffix}.mp4`;
}

export function introDuration(matchCount) {
  if (matchCount <= 0) return 0;
  if (matchCount <= 3) return 2.5;
  if (matchCount <= 6) return 2.3;
  return 2.2;
}

export function beatDuration(matchCount) {
  if (matchCount <= 0) return 0;
  if (matchCount === 1) return 5.0;
  if (matchCount <= 3) return 3.0;
  if (matchCount <= 6) return 2.55;
  return 2.2;
}

export function finaleDuration(matchCount) {
  if (matchCount <= 0) return 0;
  if (matchCount === 1) return 4.2;
  if (matchCount >= 6) return 4.6;
  return 4.4;
}

export function lockupDuration(matchCount) {
  if (matchCount <= 0) return 0;
  return 0;
}

export function agendaDurationSeconds(matchCount) {
  if (matchCount <= 0) return 0;
  return Number((
    introDuration(matchCount)
    + matchCount * beatDuration(matchCount)
    + finaleDuration(matchCount)
    + lockupDuration(matchCount)
  ).toFixed(3));
}
