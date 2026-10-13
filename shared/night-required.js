// "Obrigatório da noite": the plays the board marks for one day. A player only sees that
// day's line-ups after watching them, in the site, at normal speed, with the tab in front.
//
// What counts as watched is decided here and applied by the server (functions/api/night/
// required.js): the browser only says "still playing" every few seconds and the server adds
// the time that passed on ITS clock since the previous report. So no report can be worth more
// than real time, a jump ahead adds nothing, and a paused or hidden player earns nothing.
// Shared by the Pages Function, the app and the tests.
import { saoPauloDay } from "../src/features/agenda/agenda-time.js";
import { nightDays } from "./night-link.js";

/** How many plays a day can ask for. */
export const REQUIRED_MAX = 3;
/** Seconds between two reports from the player. */
export const PING_SECONDS = 6;
/** The most one report can add, whatever the browser claims. */
export const PING_MAX_CREDIT = 10;
/** A silence longer than this ends the stretch: the next report starts a new one, worth nothing. */
export const PING_GAP_LIMIT = 16;

const WEIGHT = Object.freeze({ teste: 10, player: 20, conselho: 30, diretoria: 40, dev: 50 });
const text = (value) => String(value ?? "").trim();
const seconds = (value) => Math.max(0, Number(value) || 0);

export const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value));

/** Conselho, Diretoria and Desenvolvimento are not asked to watch. */
export const isRequiredExempt = (tier) => (WEIGHT[text(tier)] || 0) >= WEIGHT.conselho;

/** The days a requirement can be watched for right now: today, and last night until it ends. */
export const requiredDays = (now = new Date()) => nightDays(now);

/** The day a game belongs to. */
export const matchDay = (match) => (match?.scheduled_at ? saoPauloDay(new Date(match.scheduled_at)) : "");

/** Seconds of real play that complete a video of `duration` seconds: nearly all of it. */
export function completionSeconds(duration) {
  const length = seconds(duration);
  return length ? Math.max(1, Math.max(length * 0.92, length - 4)) : Number.POSITIVE_INFINITY;
}

/**
 * The stored row after one report. `playing` is the browser saying the video is running in
 * front of the member; the time it is worth comes from `now` (the server's clock) and the
 * previous report, never from the browser. `busyElsewhere` is the member having another play
 * running at this moment: two at once count as none, so three cannot be watched in the time of one.
 */
export function creditPing(row = {}, { playing = false, duration = 0, now = new Date(), busyElsewhere = false } = {}) {
  const at = new Date(now);
  const stamp = at.toISOString();
  const watched = seconds(row?.watched_seconds);
  const last = row?.last_ping_at ? new Date(row.last_ping_at).getTime() : 0;
  const gap = last ? (at.getTime() - last) / 1000 : Number.POSITIVE_INFINITY;
  // A report that says "stopped" still closes the stretch it ends: the seconds since the last
  // report were played. What it cannot do is start one.
  const credit = !busyElsewhere && gap > 0 && gap <= PING_GAP_LIMIT ? Math.min(gap, PING_MAX_CREDIT) : 0;
  const length = seconds(duration);
  const total = Number((length ? Math.min(length, watched + credit) : watched).toFixed(2));
  return {
    watched_seconds: total,
    last_ping_at: playing ? stamp : null,
    completed_at: row?.completed_at || (total >= completionSeconds(length) ? stamp : null),
    opened_at: row?.opened_at || stamp,
    updated_at: stamp,
  };
}

/**
 * Where one member stands: how many of the day's plays are done and whether the line-up is
 * still closed to him. `items` are the day's requirements, `progress` his own rows.
 */
export function requiredStatus({ items = [], progress = [], tier = "" } = {}) {
  const list = [...(items || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
  const exempt = isRequiredExempt(tier);
  const doneIds = new Set((progress || []).filter((row) => row?.completed_at).map((row) => text(row.item_id)));
  const pending = list.filter((item) => !doneIds.has(text(item.item_id)));
  return {
    total: list.length,
    done: list.length - pending.length,
    exempt,
    locked: !exempt && pending.length > 0,
    pending: pending.map((item) => text(item.item_id)),
    next: pending[0] ? text(pending[0].item_id) : "",
  };
}

/** The words beside a name: "Isento", "Não viu o vídeo", "Viu 2 de 3", "Sem acesso ao site"… */
export function requiredLabel({ total = 0, done = 0, exempt = false, account = true } = {}) {
  if (exempt) return "Isento";
  if (!account) return "Sem acesso ao site";
  if (!total) return "";
  if (done >= total) return total === 1 ? "Viu o vídeo" : `Viu os ${total} vídeos`;
  if (done) return `Viu ${done} de ${total}`;
  return total === 1 ? "Não viu o vídeo" : "Não viu nenhum vídeo";
}

const ROLE = Object.freeze({ dev: "Desenvolvimento", diretoria: "Diretoria", conselho: "Conselho" });
const hourOf = (iso) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** The quiet second line: when he opened the site today, or why he has nothing to watch. */
export function requiredDetail({ exempt = false, account = true, trial = false, tier = "", visitedAt = "" } = {}) {
  if (!account) return trial ? "Em teste: vê a escalação pelo link da noite" : "Ainda não criou conta";
  if (exempt) return ROLE[text(tier)] || "";
  return visitedAt ? `Entrou no site às ${hourOf(visitedAt)}` : "Não entrou no site hoje";
}

/**
 * The board for whoever picks the team: one line per person. Every active roster player is
 * there, with an account or not; a member who is not in the roster gets his line too.
 * `members` come from the server (account, level, declared roster entry, today's visit and
 * progress); `players` is the roster. Who owes a video comes first, the exempt last.
 */
export function requiredBoard({ members = [], items = [], players = [] } = {}) {
  const total = (items || []).length;
  const normalize = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const roster = (players || []).filter((player) => player?.is_active !== false);
  const ids = new Set((items || []).map((item) => text(item.item_id)));
  const taken = new Set();
  const rows = (members || []).map((member) => {
    const linked = member.playerId ? roster.find((player) => text(player.id) === text(member.playerId)) : null;
    const names = new Set([member.name, ...(member.names || [])].map(normalize).filter(Boolean));
    const player = linked || (member.playerId === "none" ? null : roster.find((entry) => !taken.has(text(entry.id)) && names.has(normalize(entry.display_name)))) || null;
    if (player) taken.add(text(player.id));
    const exempt = isRequiredExempt(member.tier);
    const done = (member.progress || []).filter((row) => row?.completed_at && ids.has(text(row.item_id))).length;
    // Has an account but never signed the season's contract: he has not been inside the site.
    const unsigned = member.signed === false && !exempt;
    const state = exempt ? "exempt" : unsigned ? "nocontract" : !total ? "none" : done >= total ? "done" : done ? "partial" : "pending";
    return {
      key: text(member.userId),
      userId: text(member.userId),
      name: player?.display_name || member.name || "Membro",
      playerId: player ? text(player.id) : "",
      tier: text(member.tier),
      account: true, exempt, total, done, state,
      visited: Boolean(member.visitedAt),
      visitedAt: member.visitedAt || "",
      label: unsigned ? "Não assinou o contrato" : requiredLabel({ total, done, exempt }),
      detail: unsigned ? "Tem conta, mas parou na tela do contrato" : requiredDetail({ exempt, tier: member.tier, visitedAt: member.visitedAt }),
    };
  });
  // Roster players nobody signed in as: they are on the list too, as "sem acesso".
  for (const player of roster) {
    if (taken.has(text(player.id))) continue;
    const trial = player.member_type === "teste";
    rows.push({
      key: `player:${player.id}`, userId: "", name: player.display_name || "Jogador", playerId: text(player.id), tier: "",
      account: false, trial, exempt: false, total, done: 0, state: "noaccount", visited: false, visitedAt: "",
      label: requiredLabel({ total, account: false }),
      detail: requiredDetail({ account: false, trial }),
    });
  }
  const order = { pending: 0, partial: 1, nocontract: 2, noaccount: 3, done: 4, none: 5, exempt: 6 };
  return rows.sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name, "pt-BR"));
}

/** The head-count above the board. */
export function requiredSummary(rows = []) {
  const count = (states) => rows.filter((row) => states.includes(row.state)).length;
  return { owing: count(["pending", "partial"]), done: count(["done"]), noAccount: count(["noaccount", "nocontract"]), exempt: count(["exempt"]) };
}
