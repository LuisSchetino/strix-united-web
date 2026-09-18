import { MEDIA_FORMATS, opponentInitials } from "./agenda-media-core.js";
import { ANNOUNCE_FX_REVISION } from "./announce-fx.js";
import { positionGroup } from "./related-night-core.js";

export const ANNOUNCE_TEMPLATE_ID = "season-announce";
export const ANNOUNCE_TEMPLATE_VERSION = "season-announce-v3.9";
export const ANNOUNCE_FPS = 30;
export const ANNOUNCE_SEASON = "FC 27";
export const ANNOUNCE_CACHE_DAY = "fc27";
export const ANNOUNCE_ROLES_STORAGE_KEY = "strix-fc27-announce-roles";
export const ANNOUNCE_DRAFT_STORAGE_KEY = "strix-fc27-announce-draft";

export const ANNOUNCE_ROLES = Object.freeze({
  jogador: { id: "jogador", label: "Jogador", badge: "", kind: "player" },
  staff: { id: "staff", label: "Staff", badge: "STAFF", kind: "structure" },
  diretoria: { id: "diretoria", label: "Diretoria", badge: "DIRETORIA", kind: "structure" },
  conselho: { id: "conselho", label: "Conselho", badge: "CONSELHO", kind: "structure" },
  manager: { id: "manager", label: "Manager", badge: "MANAGER", kind: "structure" },
});

export const ANNOUNCE_TITLES = Object.freeze([
  "ELENCO FC 27",
  "ELENCO OFICIAL",
  "PLANTEL FC 27",
  "ESTRUTURA FC 27",
]);

export const ANNOUNCE_PHRASES = Object.freeze([
  { id: "next-season", text: "Pronto para escrever a próxima temporada.", kinds: ["jogador", "retorno", "novo"] },
  { id: "piece", text: "Mais uma peça confirmada para o FC 27.", kinds: ["jogador", "renovacao", "novo"] },
  { id: "takes-shape", text: "O projeto segue ganhando forma.", kinds: ["jogador", "staff", "diretoria"] },
  { id: "colors", text: "Nome confirmado para defender as cores do Strix.", kinds: ["jogador", "novo"] },
  { id: "history", text: "A história continua em mais uma temporada.", kinds: ["jogador", "retorno", "renovacao"] },
  { id: "chapter", text: "Um novo capítulo começa agora.", kinds: ["jogador", "retorno", "novo"] },
  { id: "enters", text: "{nome} entra em campo pelo Strix no {temporada}.", kinds: ["jogador", "novo"] },
  { id: "plantel", text: "Confirmado. {posição} no plantel {temporada}.", kinds: ["jogador"] },
  { id: "back", text: "De volta às cores. A temporada pede {nome}.", kinds: ["retorno"] },
  { id: "renewal", text: "A renovação que o projeto precisava.", kinds: ["renovacao"] },
  { id: "stays", text: "Continua. E continua com Strix.", kinds: ["renovacao", "jogador"] },
  { id: "inside-out", text: "Dentro e fora de campo, peça importante do projeto.", kinds: ["staff", "diretoria", "conselho", "manager"] },
  { id: "structure", text: "A estrutura também veste Strix no {temporada}.", kinds: ["staff", "diretoria", "conselho"] },
  { id: "method", text: "Decisão, método e camisa. {funçãoExtra} confirmado.", kinds: ["diretoria", "conselho", "manager"] },
  { id: "off-field", text: "O projeto se constrói também fora de campo.", kinds: ["staff", "diretoria"] },
  { id: "aligned", text: "Direção alinhada. {funçãoExtra} no {temporada}.", kinds: ["diretoria", "conselho", "manager"] },
  { id: "builds", text: "Quem constrói o clube também entra nesta temporada.", kinds: ["diretoria", "conselho", "staff"] },
  { id: "house", text: "A casa organizada. {nome} segue no comando do projeto.", kinds: ["manager", "diretoria"] },
]);

function normalizeKey(value = "") {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashSeed(seed = "") {
  let hash = 2166136261;
  const encoded = new TextEncoder().encode(String(seed));
  for (const byte of encoded) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function normalizeAnnounceRole(value = "") {
  const id = String(value || "").trim().toLowerCase();
  return ANNOUNCE_ROLES[id] ? id : "jogador";
}

export function announceRoleBadge(role = "jogador") {
  return ANNOUNCE_ROLES[normalizeAnnounceRole(role)]?.badge || "";
}

export function isStructureRole(role = "jogador") {
  return ANNOUNCE_ROLES[normalizeAnnounceRole(role)]?.kind === "structure";
}

export function readStoredAnnounceRoles() {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(ANNOUNCE_ROLES_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([id, role]) => [String(id), normalizeAnnounceRole(role)]),
    );
  } catch {
    return {};
  }
}

export function clearStoredAnnounceRoles() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ANNOUNCE_ROLES_STORAGE_KEY);
}

export function readAnnounceDraft() {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(ANNOUNCE_DRAFT_STORAGE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeAnnounceDraft(draft = {}) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ANNOUNCE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function officialStructureRole(player = {}, fallback = "jogador") {
  return normalizeAnnounceRole(player.structure_role || fallback);
}

function nickForPlayer(player, aliases = []) {
  const id = String(player?.id || "");
  const display = normalizeKey(player?.display_name);
  const match = (aliases || []).find((alias) => {
    if (String(alias.player_id) !== id) return false;
    const name = String(alias.ea_name || "").trim();
    return name && normalizeKey(name) !== display;
  });
  return match ? String(match.ea_name).trim() : "";
}

export function collectAnnouncePeople(workspace = {}, roles = {}) {
  const roster = workspace.players || [];
  const aliases = workspace.aliases || [];
  const assetUrl = workspace.assetUrl || ((value) => value || "");
  return roster
    .filter((player) => player?.is_active !== false && player?.member_type !== "teste")
    .map((player) => {
      const position = String((player.positions || [])[0] || "MC").toUpperCase();
      const role = officialStructureRole(player, roles[player.id] || player.announce_role);
      return {
        id: String(player.id),
        name: String(player.display_name || "").trim(),
        nick: nickForPlayer(player, aliases),
        position,
        group: positionGroup(position),
        photo: player.avatar_path
          ? assetUrl(player.avatar_path)
          : String(player.external_avatar_url || ""),
        extraRole: role,
        extraBadge: announceRoleBadge(role),
        initials: opponentInitials(player.display_name),
        memberType: player.member_type || "elenco",
      };
    })
    .filter((person) => person.id && person.name);
}

export function applyAnnounceRoles(people = [], roles = {}) {
  return people.map((person) => {
    const extraRole = normalizeAnnounceRole(roles[person.id] || person.extraRole);
    return {
      ...person,
      extraRole,
      extraBadge: announceRoleBadge(extraRole),
    };
  });
}

export function orderPeopleByIds(people = [], ids = []) {
  const byId = new Map(people.map((person) => [String(person.id), person]));
  const seen = new Set();
  const ordered = [];
  for (const raw of ids) {
    const id = String(raw || "");
    if (!id || seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    ordered.push(byId.get(id));
  }
  return ordered;
}

export function fillAnnouncePhrase(template = "", person = {}, season = ANNOUNCE_SEASON) {
  const extra = person.extraBadge || ANNOUNCE_ROLES[normalizeAnnounceRole(person.extraRole)]?.label || "";
  return String(template || "")
    .replaceAll("{nome}", person.name || "")
    .replaceAll("{posição}", person.position || "")
    .replaceAll("{posicao}", person.position || "")
    .replaceAll("{temporada}", season)
    .replaceAll("{funçãoExtra}", extra)
    .replaceAll("{funcaoExtra}", extra)
    .trim();
}

export function phrasesForPerson(person = {}, type = "") {
  const kind = String(type || person.announceType || person.extraRole || "jogador").toLowerCase();
  const matched = ANNOUNCE_PHRASES.filter((phrase) => phrase.kinds.includes(kind));
  return matched.length ? matched : ANNOUNCE_PHRASES.filter((phrase) => phrase.kinds.includes("jogador"));
}

export function pickAnnouncePhrase(person = {}, { type = "", usedIds = [], currentId = "" } = {}) {
  const pool = phrasesForPerson(person, type);
  const unused = pool.filter((phrase) => !usedIds.includes(phrase.id) && phrase.id !== currentId);
  const list = unused.length ? unused : pool.filter((phrase) => phrase.id !== currentId);
  const choices = list.length ? list : pool;
  const index = hashSeed(`${person.id}:${type || person.extraRole}:${currentId}`) % choices.length;
  return choices[index];
}

export function resolveAnnouncePhrase(person = {}, { type = "", phraseId = "", custom = "", usedIds = [] } = {}) {
  const trimmed = String(custom || "").trim();
  if (trimmed) {
    return {
      id: "custom",
      source: "custom",
      template: trimmed,
      text: fillAnnouncePhrase(trimmed, person),
    };
  }
  const pool = phrasesForPerson(person, type);
  const selected = pool.find((phrase) => phrase.id === phraseId) || pickAnnouncePhrase(person, { type, usedIds });
  return {
    id: selected.id,
    source: phraseId ? "chosen" : "auto",
    template: selected.text,
    text: fillAnnouncePhrase(selected.text, person),
  };
}

export function individualAnnounceDuration() {
  return 10.6;
}

export function announceTeamTiming(count) {
  if (count <= 0) return { duration: 0, intro: 0, beat: 0, overlap: 0, finale: 0, readable: 0, pages: 0 };
  const intro = 1.45;
  const beat = 3.65;
  const overlap = 0.32;
  const pageSize = count <= 6 ? count : count <= 8 ? 4 : 6;
  const pages = count <= 6 ? 1 : Math.ceil(count / pageSize);
  const finale = pages === 1 ? 4.4 : pages * 2.8;
  const players = beat + Math.max(0, count - 1) * (beat - overlap);
  const duration = intro + players + finale;
  return {
    duration: Number(duration.toFixed(3)),
    intro: Number(intro.toFixed(3)),
    beat: Number(beat.toFixed(3)),
    overlap: Number(overlap.toFixed(3)),
    finale: Number(finale.toFixed(3)),
    readable: Number((beat - 0.5 - overlap).toFixed(3)),
    pages,
  };
}

export function announceDurationSeconds({ kind = "individual", format = "story", count = 1 } = {}) {
  if (format === "feed") return 0.04;
  if (kind === "team") return announceTeamTiming(count).duration;
  return individualAnnounceDuration();
}

export function slugifyAnnounceName(value = "") {
  const slug = normalizeKey(value).replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return slug.slice(0, 28) || "strix";
}

export function announceFileName({
  kind = "individual",
  format = "story",
  name = "",
  title = "",
  people = [],
} = {}) {
  const mode = format === "feed" ? "post" : "reels";
  const ext = format === "feed" ? "png" : "mp4";
  if (kind === "team") {
    const slug = slugifyAnnounceName(title || "elenco");
    return `strix-anuncio-elenco-${slug}-${mode}.${ext}`;
  }
  return `strix-anuncio-individual-${slugifyAnnounceName(name || people[0]?.name)}-${mode}.${ext}`;
}

export function announceIdentityPayload({
  kind = "individual",
  format = "story",
  people = [],
  phrase = "",
  phraseId = "",
  title = "",
  announceType = "",
  templateVersion = ANNOUNCE_TEMPLATE_VERSION,
} = {}) {
  return {
    template: ANNOUNCE_TEMPLATE_ID,
    templateVersion,
    fxRevision: ANNOUNCE_FX_REVISION,
    kind: kind === "team" ? "team" : "individual",
    format: format === "feed" ? "feed" : "story",
    season: ANNOUNCE_SEASON,
    title: kind === "team" ? String(title || "ELENCO FC 27") : "",
    announceType: String(announceType || ""),
    phraseId: String(phraseId || ""),
    phrase: String(phrase || ""),
    people: people.map((person) => ({
      id: person.id || "",
      name: person.name || "",
      nick: person.nick || "",
      photo: person.photo || "",
      position: person.position || "",
      extraRole: normalizeAnnounceRole(person.extraRole),
    })),
  };
}

export async function fingerprintAnnounceRender(input = {}) {
  const encoded = new TextEncoder().encode(JSON.stringify(announceIdentityPayload(input)));
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

export { MEDIA_FORMATS, positionGroup };
