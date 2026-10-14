// What a scheduled match means right now, in one vocabulary shared by the Home
// and the Agenda. With a fresh signal from the PC watcher (tools/ao-vivo) the match
// is on the pitch with its partial score; without one, only the kickoff time and
// the stored status count.
import { saoPauloDay } from "./agenda-time.js";
import { livePhase } from "../../../shared/live-signal.js";

const MINUTE = 60_000;
const DAY = 86_400_000;
const LINEUP_SIZE = 11;
/** How long a game is taken to be on the pitch after its kick-off. */
export const IN_PLAY_MINUTES = 35;

export function lineupState(match) {
  const filled = (Array.isArray(match?.lineup) ? match.lineup : []).filter((slot) => String(slot ?? "").trim()).length;
  if (!filled) return { kind: "pending", filled, total: LINEUP_SIZE, label: "Escalação ainda não definida", short: "Sem escalação" };
  if (filled >= LINEUP_SIZE) return { kind: "ready", filled, total: LINEUP_SIZE, label: "Escalação definida", short: "Escalação definida" };
  return { kind: "partial", filled, total: LINEUP_SIZE, label: `Escalação em montagem · ${filled}/${LINEUP_SIZE}`, short: `Escalação ${filled}/${LINEUP_SIZE}` };
}

export function minutesUntil(value, now = new Date()) {
  return Math.round((new Date(value).getTime() - now.getTime()) / MINUTE);
}

function dayDistance(value, now) {
  return Math.round((Date.parse(`${saoPauloDay(value)}T00:00:00Z`) - Date.parse(`${saoPauloDay(now)}T00:00:00Z`)) / DAY);
}

export function untilLabel(minutes) {
  if (minutes < 60) return `em ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `em ${hours}h ${String(rest).padStart(2, "0")}min` : `em ${hours}h`;
}

/**
 * The moment of a fixture for a status line ("Hoje · em 50 min", "Amanhã", "Em 3 dias",
 * "Em campo", "Aguardando resultado") with the tone of the card that carries it.
 */
export function matchMoment(match, now = new Date()) {
  const status = agendaStatus(match, now);
  const tone = status.tone === "today" || status.tone === "soon" ? "today"
    : status.tone === "past" || status.tone === "done" ? "past"
      : status.tone === "cancelled" ? "cancelled" : "quiet";
  if (status.live?.phase === "halftime") return { tone, label: "Intervalo", live: status.live };
  if (status.live) return { tone, label: `Ao vivo${Number.isFinite(status.live.minute) ? ` · ${status.live.minute}'` : ""}`, live: status.live };
  if (status.final) return { tone, label: "Fim de jogo", live: status.final };
  return { tone, label: status.tone === "today" ? `Hoje · ${status.label}` : status.label };
}

const ZONE = "America/Sao_Paulo";
/** A kick-off's day as the Central writes it: "DOM · 04 OUT". */
export const kickoffDay = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, weekday: "short", day: "2-digit", month: "short" })
  .format(new Date(value)).replace(/\./g, "").replace(",", " ·").replace(/ de /i, " ").toLocaleUpperCase("pt-BR");
/** A kick-off's time in São Paulo: "21:10". */
export const kickoffClock = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(value));

/** "Em campo · 1×0 · 34'" from the last scoreboard the watcher read. */
export function liveLabel(match) {
  const score = Number.isFinite(match?.live_strix_score) && Number.isFinite(match?.live_opponent_score) ? ` · ${match.live_strix_score}×${match.live_opponent_score}` : "";
  const minute = Number.isFinite(match?.live_minute) ? ` · ${match.live_minute}'` : "";
  return `Em campo${score}${minute}`;
}

/**
 * Status for one agenda row: tone drives the visual, label is the words. On the pitch by the PC
 * watcher it also carries `live` with the score and the minute. `onPitch` says another game of the
 * night is being played right now (by the watcher): a game whose time has come then waits its turn
 * instead of claiming to be on the pitch too.
 */
export function agendaStatus(match, now = new Date(), { onPitch = false } = {}) {
  if (match?.status === "cancelled") return { tone: "cancelled", label: "Cancelado" };
  if (match?.status === "completed") return { tone: "done", label: "Jogado" };
  // the watcher read the scoreboard a moment ago: on the pitch, with the score and the minute
  const phase = livePhase(match, now);
  const live = { strix: match?.live_strix_score ?? 0, opponent: match?.live_opponent_score ?? 0, minute: match?.live_minute, phase };
  if (phase === "live") return { tone: "soon", label: liveLabel(match), live };
  if (phase === "halftime") return { tone: "soon", label: `Intervalo · ${live.strix}×${live.opponent}`, live };
  // the clock went past 85' and the scoreboard left the screen: final whistle, the result is coming
  if (phase === "ended") return { tone: "past", label: `Fim de jogo · ${live.strix}×${live.opponent}`, final: live };
  if (match?.status === "live") return { tone: "soon", label: "Em breve" };
  const minutes = minutesUntil(match?.scheduled_at, now);
  // the watcher saw it and stopped seeing it: the game is over, only the result is missing
  if (match?.live_seen_at && minutes <= 0) return { tone: "past", label: "Aguardando resultado" };
  if (!Number.isFinite(minutes)) return { tone: "scheduled", label: "Agendado" };
  // From the whistle and for the length of a game it is "Em campo"; after that the game was
  // played and only its result is missing here.
  if (minutes <= 0 && onPitch && minutes > -3 * IN_PLAY_MINUTES) return { tone: "today", label: "Na fila" };
  if (minutes <= 0) return minutes > -IN_PLAY_MINUTES ? { tone: "soon", label: "Em campo" } : { tone: "past", label: "Aguardando resultado" };
  const days = dayDistance(match.scheduled_at, now);
  if (days === 0) return { tone: "today", label: untilLabel(minutes) };
  if (days === 1) return { tone: "scheduled", label: "Amanhã" };
  return { tone: "scheduled", label: `Em ${days} dias` };
}
