// "Avisos": what changed for the member who is signed in. Every notice is derived from data the
// site already holds (tonight's line-ups, the Agenda, results, the Library, marks,
// the club notice); there is no separate inbox to keep in step. What makes a notice "new" is
// only whether this device has shown it before (see notification-seen below).
import { saoPauloDay } from "../agenda/agenda-time.js";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const ZONE = "America/Sao_Paulo";
const stamp = (value) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};
const clock = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
const dayMonth = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, day: "2-digit", month: "2-digit" }).format(new Date(value));

/** How long a reschedule stays worth telling. */
export const RESCHEDULE_HOURS = 72;

/**
 * A kick-off that changed recently: `{ before, after }` (ISO), or null. Needs the columns the
 * reschedule migration adds; without them a match simply never reports a change.
 */
export function rescheduleOf(match, now = new Date()) {
  if (!match?.rescheduled_at || !match.previous_scheduled_at) return null;
  if (match.status === "cancelled" || match.status === "completed") return null;
  if (stamp(match.scheduled_at) < now.getTime()) return null;
  if (now.getTime() - stamp(match.rescheduled_at) > RESCHEDULE_HOURS * HOUR) return null;
  if (Math.abs(stamp(match.scheduled_at) - stamp(match.previous_scheduled_at)) < 60_000) return null;
  return { before: match.previous_scheduled_at, after: match.scheduled_at };
}

/** "era 21:10" / "era 05/10 às 21:10": the previous kick-off next to the new one. */
export function rescheduleLabel(change) {
  if (!change) return "";
  const sameDay = saoPauloDay(change.before) === saoPauloDay(change.after);
  return sameDay ? `era ${clock(change.before)}` : `era ${dayMonth(change.before)} às ${clock(change.before)}`;
}

/**
 * The member's notices, newest first: `[{ key, kind, title, text, at, target }]`.
 *   key    — identifies this exact notice (a changed line-up position makes a new one);
 *   target — where pressing it leads: { page, id?, params? }.
 * Inputs are what the shell already has; any of them may be missing.
 */
export function buildNotifications({
  now = new Date(), player = null, mine = null, agenda = [], matches = [],
  library = null, milestones = [], notice = null, endedEditions = [], canArchive = false, problems = [],
} = {}) {
  const out = [...(problems || [])];

  if (notice?.body) {
    out.push({ key: `notice:${notice.id}:${notice.updated_at || notice.created_at}`, kind: "notice", title: "Recado da diretoria", text: notice.body, at: notice.updated_at || notice.created_at, target: { page: "central" } });
  }
  for (const game of mine?.games || []) {
    if (!game.position) continue;
    out.push({ key: `lineup:${game.id}:${game.position}`, kind: "lineup", title: `Escalado contra ${game.opponent}`, text: `${game.position} às ${clock(game.scheduledAt)} · ${game.competition}`, at: (agenda.find((row) => row.id === game.id)?.updated_at) || game.scheduledAt, target: { page: "agenda", id: game.id } });
  }
  for (const match of agenda || []) {
    const change = rescheduleOf(match, now);
    if (!change) continue;
    out.push({ key: `reschedule:${match.id}:${match.rescheduled_at}`, kind: "reschedule", title: `Horário mudou: ${match.opponent_name}`, text: `Agora ${dayMonth(change.after)} às ${clock(change.after)} (${rescheduleLabel(change)}).`, at: match.rescheduled_at, target: { page: "agenda", id: match.id } });
  }
  for (const match of matches || []) {
    if (now.getTime() - stamp(match.played_at) > 24 * HOUR || stamp(match.played_at) > now.getTime()) continue;
    out.push({ key: `result:${match.id}`, kind: "result", title: `Strix ${match.strix_score} × ${match.opponent_score} ${match.opponent_name}`, text: `Resultado importado · ${match.competition_name || "Amistoso"}`, at: match.played_at, target: { page: "partidas", id: match.id } });
  }
  for (const item of library?.fresh || []) {
    out.push({ key: `material:${item.id}`, kind: "material", title: `Material novo: ${item.title}`, text: item.category === "review" ? "Review na Biblioteca" : "Jogada na Biblioteca", at: item.published_at, target: { page: "biblioteca", id: item.id } });
  }
  for (const mark of milestones || []) {
    if (!player || String(mark.playerId) !== String(player.id) || now.getTime() - stamp(mark.at) > 7 * DAY) continue;
    out.push({ key: `milestone:${mark.playerId}:${mark.id}`, kind: "milestone", title: `Novo marco: ${mark.label}`, text: mark.opponent ? `Alcançado contra ${mark.opponent}.` : "Alcançado no último jogo.", at: mark.at, target: { page: "elenco", id: player.id } });
  }
  if (canArchive) {
    for (const edition of endedEditions || []) {
      out.push({ key: `ended:${edition.id}`, kind: "competition", title: `${edition.name} terminou para o Strix`, text: `${edition.outcome || "Participação encerrada"}. Envie a edição ao Histórico.`, at: edition.at || now.toISOString(), target: { page: "campeonatos", id: edition.id } });
    }
  }
  return out.sort((left, right) => stamp(right.at) - stamp(left.at));
}

/* ------------------------------------------------------------ what was seen */

const SEEN_KEY = "strix:notifications:seen";
const SEEN_MAX = 300;

export function readSeen(storage) {
  try {
    const value = JSON.parse(storage.getItem(SEEN_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

/** Marks keys as seen and returns the new set; the oldest keys leave once the list is long. */
export function markSeen(storage, keys = []) {
  const seen = [...readSeen(storage)];
  for (const key of keys) if (!seen.includes(key)) seen.push(key);
  const trimmed = seen.slice(-SEEN_MAX);
  try { storage.setItem(SEEN_KEY, JSON.stringify(trimmed)); } catch { /* storage blocked: notices just stay unread */ }
  return new Set(trimmed);
}

/** "agora", "há 12 min", "há 3 h", "ontem", "04/10" — when a notice happened. */
export function agoLabel(value, now = new Date()) {
  const minutes = Math.round((now.getTime() - stamp(value)) / 60_000);
  if (minutes < 0) return `${dayMonth(value)} às ${clock(value)}`;
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60 && saoPauloDay(value) === saoPauloDay(now)) return `há ${Math.floor(minutes / 60)} h`;
  const days = Math.round((Date.parse(`${saoPauloDay(now)}T00:00:00Z`) - Date.parse(`${saoPauloDay(value)}T00:00:00Z`)) / DAY);
  return days === 1 ? "ontem" : dayMonth(value);
}
