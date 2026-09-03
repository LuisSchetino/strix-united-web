import { saoPauloDay, todayAgendaMatches } from "../agenda/agenda-time.js";
import { formatAgendaDay, MEDIA_FORMATS } from "./agenda-media-core.js";

export const RELATED_NIGHT_TEMPLATE_ID = "related-night";
export const RELATED_NIGHT_TEMPLATE_VERSION = "related-night-v1";
export const RELATED_NIGHT_FPS = 30;

export const LINEUP_SLOT_POSITIONS = Object.freeze([
  "ATA", "ATA", "ALA", "MC", "MC", "ALA", "VOL", "ZAG", "ZAG", "ZAG", "GOL",
]);

export const GROUP_ORDER = Object.freeze(["GOL", "DEF", "MEI", "ATA"]);

export const GROUP_KICKER = Object.freeze({
  GOL: "GOLEIROS",
  DEF: "DEFESA",
  MEI: "MEIO",
  ATA: "ATAQUE",
});

export function normalizePlayerKey(name = "") {
  return String(name || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function positionGroup(position = "") {
  const value = String(position || "").toUpperCase();
  if (["GOL", "GK", "GL"].includes(value)) return "GOL";
  if (["ZAG", "ZAGUEIRO", "LD", "LE", "DEF"].includes(value)) return "DEF";
  if (["ATA", "SA", "PE", "PD", "ST"].includes(value)) return "ATA";
  return "MEI";
}

export function lineupEntryName(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return entry.trim();
  return String(entry.name || entry.display_name || "").trim();
}

export function lineupEntryPosition(entry, index) {
  if (entry && typeof entry === "object" && entry.position) {
    return String(entry.position).toUpperCase();
  }
  return LINEUP_SLOT_POSITIONS[index] || "";
}

export function orderRelated(players = []) {
  const groupRank = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 };
  const posRank = { GOL: 0, ZAG: 1, VOL: 2, MC: 3, MEI: 4, ALA: 5, ATA: 6 };
  return [...players].sort((left, right) => {
    const group = (groupRank[left.group] ?? 9) - (groupRank[right.group] ?? 9);
    if (group) return group;
    const pos = (posRank[left.position] ?? 9) - (posRank[right.position] ?? 9);
    if (pos) return pos;
    return String(left.name).localeCompare(String(right.name), "pt-BR");
  });
}

export function hydrateRelatedPlayers(playerIds = [], workspace = {}, extras = []) {
  const roster = workspace.players || [];
  const assetUrl = workspace.assetUrl || ((value) => value || "");
  const byId = new Map(roster.map((player) => [String(player.id), player]));
  const hydrated = [];
  const seen = new Set();
  for (const rawId of playerIds) {
    const id = String(rawId || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const extra = extras.find((item) => String(item.id) === id) || {};
    const player = byId.get(id);
    const position = String((player?.positions || extra.positions || [])[0] || extra.position || "MC").toUpperCase();
    hydrated.push({
      id,
      name: player?.display_name || extra.name || "",
      photo: player?.avatar_path
        ? assetUrl(player.avatar_path)
        : String(player?.external_avatar_url || extra.photo || ""),
      position,
      group: positionGroup(position),
    });
  }
  return orderRelated(hydrated.filter((player) => player.name));
}

export function suggestRelatedFromLineups(workspace = {}, now = new Date()) {
  const matches = todayAgendaMatches(workspace.agenda || [], now);
  const roster = workspace.players || [];
  const seen = new Map();

  for (const match of matches) {
    const lineup = Array.isArray(match.lineup) ? match.lineup : [];
    lineup.forEach((entry, index) => {
      const name = lineupEntryName(entry);
      const key = normalizePlayerKey(name);
      if (!key || seen.has(key)) return;
      const slotPosition = lineupEntryPosition(entry, index);
      const player = roster.find((item) => normalizePlayerKey(item.display_name) === key);
      if (!player?.id) return;
      const rosterPosition = String((player.positions || [])[0] || "").toUpperCase();
      const position = rosterPosition || slotPosition || "MC";
      seen.set(key, { id: String(player.id), position });
    });
  }

  return hydrateRelatedPlayers([...seen.values()].map((item) => item.id), workspace, [...seen.values()]);
}

export function nightDateKey(value) {
  const raw = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return value ? saoPauloDay(value) : "";
}

export function nightRelatedRecord(workspace = {}, now = new Date()) {
  const day = saoPauloDay(now);
  const rows = Array.isArray(workspace.nightRelated) ? workspace.nightRelated : [];
  return rows.find((row) => nightDateKey(row.night_date) === day) || null;
}

export function describeTonightRelated(workspace = {}, now = new Date()) {
  const saved = nightRelatedRecord(workspace, now);
  const suggestion = suggestRelatedFromLineups(workspace, now);
  const players = saved
    ? hydrateRelatedPlayers(saved.player_ids || [], workspace)
    : [];
  const savedIds = new Set(players.map((player) => player.id));
  const missingFromSaved = suggestion.filter((player) => !savedIds.has(player.id));
  return {
    day: saoPauloDay(now),
    saved: Boolean(saved),
    players,
    suggestion,
    missingFromSaved,
  };
}

export function collectTonightRelated(workspace = {}, now = new Date()) {
  return describeTonightRelated(workspace, now).players;
}

export function relatedNightIdentityPayload({
  day,
  format,
  players = [],
  saved = true,
  templateVersion = RELATED_NIGHT_TEMPLATE_VERSION,
} = {}) {
  return {
    day: String(day || ""),
    format: String(format || "story"),
    template: RELATED_NIGHT_TEMPLATE_ID,
    templateVersion,
    source: "night_related",
    saved: Boolean(saved),
    players: players.map((player) => ({
      id: player.id || "",
      name: player.name || "",
      photo: player.photo || "",
      position: player.position || "",
      group: player.group || "",
    })),
  };
}

export async function fingerprintRelatedNightRender(input = {}) {
  const encoded = new TextEncoder().encode(JSON.stringify(relatedNightIdentityPayload(input)));
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

export function relatedNightFileName({ day, format } = {}) {
  const spec = MEDIA_FORMATS[format] || MEDIA_FORMATS.story;
  const safeDay = String(day || "noite").replace(/[^0-9-]/g, "") || "noite";
  return `strix-relacionados-${safeDay}-${spec.suffix}.mp4`;
}

export function relatedNightIntroDuration(count) {
  if (count <= 0) return 0;
  return 1.85;
}

export function relatedNightBeatDuration(count) {
  if (count <= 0) return 0;
  if (count <= 11) return 1.38;
  if (count <= 13) return 1.24;
  return 1.1;
}

export function relatedNightOverlap(count) {
  if (count <= 11) return 0.16;
  return 0.18;
}

export function relatedNightFinaleDuration(count) {
  if (count <= 0) return 0;
  if (count <= 11) return 2.8;
  if (count <= 13) return 2.7;
  return 2.55;
}

export function relatedNightDurationSeconds(count) {
  if (count <= 0) return 0;
  const intro = relatedNightIntroDuration(count);
  const beat = relatedNightBeatDuration(count);
  const overlap = relatedNightOverlap(count);
  const finale = relatedNightFinaleDuration(count);
  const players = beat + Math.max(0, count - 1) * (beat - overlap);
  return Number((intro + players + finale).toFixed(3));
}

export { formatAgendaDay, MEDIA_FORMATS };
