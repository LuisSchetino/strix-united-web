// What a scheduled match means right now, in one vocabulary shared by the Home
// and the Agenda. The agenda only knows the kickoff time and the stored status;
// it never claims a match is being played.
import { saoPauloDay } from "./agenda-time.js";

const MINUTE = 60_000;
const DAY = 86_400_000;
const LINEUP_SIZE = 11;

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

/** Status for one agenda row: tone drives the visual, label is the words. */
export function agendaStatus(match, now = new Date()) {
  if (match?.status === "cancelled") return { tone: "cancelled", label: "Cancelado" };
  if (match?.status === "completed") return { tone: "done", label: "Jogado" };
  if (match?.status === "live") return { tone: "soon", label: "Em breve" };
  const minutes = minutesUntil(match?.scheduled_at, now);
  if (!Number.isFinite(minutes)) return { tone: "scheduled", label: "Agendado" };
  if (minutes <= 0) return { tone: "past", label: "Horário passou" };
  const days = dayDistance(match.scheduled_at, now);
  if (days === 0) return { tone: "today", label: untilLabel(minutes) };
  if (days === 1) return { tone: "scheduled", label: "Amanhã" };
  return { tone: "scheduled", label: `Em ${days} dias` };
}
