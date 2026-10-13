import { canManageLibrary, canTrackLibrary, permissionDenied } from "../../access.js";

export { canManageLibrary, canTrackLibrary };

export const asArray = (value) => Array.isArray(value) ? value : [];

export function librarySource(value) {
  const raw = String(value || "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { type: "direct", embedUrl: raw, id: "", trackable: true };
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || "";
    return {
      type: "youtube",
      id,
      embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&rel=0` : raw,
      trackable: Boolean(id),
    };
  }
  if (host === "drive.google.com") {
    const id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id") || "";
    return {
      type: "drive",
      id,
      embedUrl: id ? `https://drive.google.com/file/d/${id}/preview` : raw,
      trackable: false,
    };
  }
  return { type: "direct", id: "", embedUrl: raw, trackable: true };
}

/**
 * Play time actually spent, between one save and the next.
 *
 * `sample` follows a player that reports its position (YouTube, a video file):
 * only time that advanced at playback pace counts, so dragging the bar forward
 * adds nothing. `tick` follows the wall clock for a player that reports nothing
 * (Google Drive): time with the player open after the member pressed play in
 * it; a long gap (the computer slept) is dropped.
 */
export function createPlayMeter() {
  let pending = 0;
  let lastTime = null;
  let lastWall = 0;
  return {
    sample(time, { playing, rate = 1, wall }) {
      const position = Number(time) || 0;
      if (playing && lastTime !== null) {
        const elapsed = Math.max(0, (wall - lastWall) / 1000);
        const moved = position - lastTime;
        if (moved > 0 && moved <= elapsed * (rate || 1) + 1.5) pending += moved;
      }
      lastTime = position;
      lastWall = wall;
    },
    tick(wall, { counting, maxGap = 65 } = {}) {
      const elapsed = (wall - lastWall) / 1000;
      if (counting && lastWall && elapsed > 0 && elapsed <= maxGap) pending += elapsed;
      lastWall = wall;
    },
    /** Whole seconds ready to be saved; the fraction stays for the next save. */
    take() {
      const whole = Math.floor(pending);
      pending -= whole;
      return whole;
    },
    /** A save that failed hands its seconds back, so they go with the next one. */
    giveBack(seconds) {
      pending += Math.max(0, Number(seconds) || 0);
    },
  };
}

/**
 * The stored row after a stretch of playback. `watched_seconds` is real play
 * time, added up across sessions. The percentage is the furthest point that was
 * both reached and paid for in play time: jumping ahead does not complete a
 * video, and neither does replaying its first minutes. It never goes back.
 */
export function watchPatch(current = {}, { position = 0, duration = 0, played = 0 } = {}, now = new Date()) {
  const stamp = new Date(now).toISOString();
  const safePosition = Math.max(0, Math.round(Number(position) || 0));
  const safeDuration = Math.max(0, Math.round(Number(duration) || 0));
  const watched = Math.max(0, Math.round(Number(current?.watched_seconds) || 0)) + Math.max(0, Math.round(Number(played) || 0));
  const reached = Math.min(safePosition, watched);
  const measured = safeDuration ? Math.min(100, Number(((reached / safeDuration) * 100).toFixed(2))) : 0;
  const percent = Math.max(Number(current?.progress_percent) || 0, measured);
  return {
    started_at: current?.started_at || (watched > 0 ? stamp : null),
    watched_seconds: watched,
    last_position_seconds: safeDuration ? safePosition : Number(current?.last_position_seconds) || 0,
    progress_percent: percent,
    completed_at: current?.completed_at || (percent >= 90 ? stamp : null),
    last_accessed_at: stamp,
  };
}

export async function archiveLibraryItem(client, profile, item) {
  if (!canManageLibrary(profile)) throw permissionDenied("Sem permissão para remover material da Biblioteca.");
  if (!item?.id) throw new Error("Material inválido.");
  const { error } = await client.from("library_items").update({
    status: "archived",
    updated_by: profile.user_id,
  }).eq("id", item.id);
  if (error) throw error;
}


/** Puts an archived material back on the shelves (the way back from "Remover material"). */
export async function restoreLibraryItem(client, profile, item) {
  if (!canManageLibrary(profile)) throw permissionDenied("Sem permissão para restaurar material da Biblioteca.");
  if (!item?.id) throw new Error("Material inválido.");
  const { error } = await client.from("library_items").update({ status: "active", updated_by: profile.user_id }).eq("id", item.id);
  if (error) throw error;
}

// ------------------------------------------------------------------- focus
// Who a material is mainly for. It never hides the material from anyone.
export const LIBRARY_POSITIONS = Object.freeze(["GOL", "ZAG", "ALA", "VOL", "MC", "MEI", "ATA"]);

/** Positions a material is mainly for, in the roster's order and spelling. */
export function normalizeFocus(value) {
  const wanted = new Set(asArray(value).map((position) => String(position).toUpperCase()));
  return LIBRARY_POSITIONS.filter((position) => wanted.has(position));
}

/**
 * Saves who a material is mainly for and returns the row as stored. The column arrives with a
 * migration; before it the database answers that the column does not exist and that is said
 * as it is.
 */
export async function saveLibraryExtras(client, profile, item, { focus } = {}) {
  if (!canManageLibrary(profile)) throw permissionDenied("Sem permissão para editar material da Biblioteca.");
  if (!item?.id) throw new Error("Material inválido.");
  const patch = { updated_by: profile.user_id };
  if (focus !== undefined) patch.focus_positions = normalizeFocus(focus);
  const { data, error } = await client.from("library_items").update(patch).eq("id", item.id).select("*");
  if (error) {
    if (error.code === "PGRST204" || error.code === "42703" || /column/i.test(error.message || "")) {
      throw new Error("A indicação por posição ainda não foi ativada no banco: falta aplicar a migration mais recente.");
    }
    throw error;
  }
  return asArray(data)[0] || { ...item, ...patch };
}

// ---------------------------------------------------------------- categories
// The Library's shelves. "Jogadas" and "Reviews" are the item's own category;
// the tactical themes come from its tags. An item can sit on more than one shelf.
const fold = (value) => String(value || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export const LIBRARY_CATEGORIES = Object.freeze([
  Object.freeze({ id: "jogadas", label: "Jogadas", lead: "Lances do time, desenhados e comentados.", base: "jogada" }),
  Object.freeze({ id: "reviews", label: "Reviews", lead: "Leitura das partidas, do apito ao detalhe.", base: "review" }),
  Object.freeze({ id: "construcao", label: "Saída de bola", lead: "Construção desde a defesa.", tags: ["saida", "saida de bola", "construcao", "construcao de jogo"] }),
  Object.freeze({ id: "pressao", label: "Pressão", lead: "Quando e como o bloco aperta.", tags: ["pressao", "pressao alta", "pressao baixa"] }),
  Object.freeze({ id: "defesa", label: "Defesa", lead: "Linha, cobertura e posicionamento.", tags: ["defesa", "defensivo"] }),
  Object.freeze({ id: "movimentacao", label: "Movimentação", lead: "Corridas sem bola e ocupação de espaço.", tags: ["movimentacao", "movimento"] }),
]);

export function libraryCategoriesOf(item = {}) {
  const tags = asArray(item.tags).map(fold);
  return LIBRARY_CATEGORIES
    .filter((category) => (category.base ? item.category === category.base : category.tags.some((tag) => tags.includes(tag))))
    .map((category) => category.id);
}

/** The shelf whose cover represents the item: its tactical theme first, else its kind. */
export function primaryCategory(item = {}) {
  const ids = libraryCategoriesOf(item);
  return ids.find((id) => id !== "jogadas" && id !== "reviews") || (item.category === "review" ? "reviews" : "jogadas");
}

export const categoryCover = (id) => `/assets/library/${id}.svg`;

// ------------------------------------------------------------------ tracking
// Built only from library_view_progress rows. A missing row means the material
// was never opened by that account; nothing here is estimated.
export function progressStatus(row, item) {
  if (!row) return "none";
  if (row.completed_at) return "completed";
  const trackable = librarySource(item?.source_url).trackable;
  if (trackable && Number(row.progress_percent) > 0) return "in-progress";
  // A source that reports no position (Drive): the time with its player open is what was measured.
  if (!trackable && Number(row.watched_seconds) > 0) return "timed";
  // Opened only outside the site (YouTube / Drive tab): recorded, not measured.
  if (Number(row.external_open_count) > 0) return "external";
  return "opened";
}

export const PROGRESS_LABEL = Object.freeze({
  completed: "Concluído",
  "in-progress": "Em andamento",
  opened: "Aberto",
  timed: "Assistiu no player",
  external: "Abriu em outra aba",
  none: "Sem registro",
});

export function memberTracking(items = [], progress = []) {
  const live = new Map(asArray(items).map((item) => [item.id, item]));
  const members = new Map();
  for (const row of asArray(progress)) {
    if (!live.has(row.item_id) || !row.user_id) continue;
    const member = members.get(row.user_id) || { userId: row.user_id, name: row.viewer_display_name || "Membro", avatar: "", rows: [] };
    if (!member.avatar && row.viewer_avatar_url) member.avatar = row.viewer_avatar_url;
    member.rows.push(row);
    members.set(row.user_id, member);
  }
  return [...members.values()].map((member) => {
    const completed = member.rows.filter((row) => row.completed_at).length;
    const lastAccess = member.rows.map((row) => row.last_accessed_at).filter(Boolean).sort().at(-1) || null;
    const byCategory = LIBRARY_CATEGORIES.map((category) => {
      const pool = asArray(items).filter((item) => libraryCategoriesOf(item).includes(category.id));
      const done = pool.filter((item) => member.rows.some((row) => row.item_id === item.id && row.completed_at)).length;
      const opened = pool.filter((item) => member.rows.some((row) => row.item_id === item.id)).length;
      return { id: category.id, label: category.label, total: pool.length, done, opened };
    }).filter((entry) => entry.total > 0);
    const externalOpens = member.rows.reduce((sum, row) => sum + (Number(row.external_open_count) || 0), 0);
    return { ...member, opened: member.rows.length, completed, total: live.size, lastAccess, externalOpens, byCategory };
  }).sort((left, right) => String(right.lastAccess || "").localeCompare(String(left.lastAccess || "")));
}

/** Manual thumbnail when the material has one; otherwise the cover of its shelf. */
export const libraryThumbnail = (item = {}) => item.thumbnail_url || categoryCover(primaryCategory(item));

// --------------------------------------------------------------- new material
// What the "Adicionar material" sheet needs to know before it saves anything: whether a pasted
// link is a video the Library can play, which themes (shelves) the manager can tick, and the row
// that goes to the database. Pure: the sheet only renders what these return.

/** The tactical shelves a material can be filed under (kept as tags, see LIBRARY_CATEGORIES). */
export const LIBRARY_THEMES = Object.freeze(LIBRARY_CATEGORIES.filter((category) => category.tags).map((category) => Object.freeze({ id: category.id, label: category.label, tag: category.label.toLocaleLowerCase("pt-BR") })));

export const LIBRARY_TIERS = Object.freeze([
  Object.freeze({ id: "player", label: "Todos os jogadores" }),
  Object.freeze({ id: "conselho", label: "Só Conselho e Diretoria" }),
  Object.freeze({ id: "diretoria", label: "Só Diretoria" }),
]);

export const MATERIAL_TITLE_MAX = 120;

/**
 * Reads a pasted link. `{ state: "empty" }`, `{ state: "invalid", message }`, or
 * `{ state: "ok", type, label, id, url, thumbnail, note }` where `note` tells the manager what
 * to expect from that source (what is tracked, what the file needs).
 */
export function describeMaterialLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return { state: "empty" };
  let url;
  try { url = new URL(raw); } catch {
    return { state: "invalid", message: "Isso não parece um link. Cole o endereço completo do vídeo, começando por https://." };
  }
  if (!/^https?:$/.test(url.protocol)) return { state: "invalid", message: "O link precisa começar por https://." };
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const source = librarySource(raw);
  if (source.type === "youtube") {
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(source.id || "")) {
      return { state: "invalid", message: "Não achei o vídeo nesse link do YouTube. Abra o vídeo e copie o link dele (não o de um canal ou de uma playlist)." };
    }
    return {
      state: "ok", type: "youtube", label: "YouTube", id: source.id, url: raw,
      thumbnail: `https://i.ytimg.com/vi/${source.id}/hqdefault.jpg`,
      note: "O site acompanha quanto cada jogador assistiu.",
    };
  }
  if (source.type === "drive" || host === "docs.google.com") {
    if (/\/folders\//.test(url.pathname)) {
      return { state: "invalid", message: "Esse link é de uma pasta do Drive. Abra o vídeo e copie o link do arquivo." };
    }
    if (source.type !== "drive" || !source.id) {
      return { state: "invalid", message: "Não achei o arquivo nesse link do Drive. No Drive, use “Copiar link” no próprio vídeo." };
    }
    return {
      state: "ok", type: "drive", label: "Google Drive", id: source.id, url: raw, thumbnail: "",
      note: "No Drive, deixe o arquivo como “Qualquer pessoa com o link”. O acompanhamento conta o tempo com o player aberto.",
    };
  }
  return {
    state: "ok", type: "direct", label: "Arquivo de vídeo", id: "", url: raw, thumbnail: "",
    note: /\.(mp4|webm|mov|m4v)$/i.test(url.pathname)
      ? "Arquivo de vídeo direto: o site acompanha quanto cada jogador assistiu."
      : "Link direto: só funciona se abrir um arquivo de vídeo (MP4). Para YouTube ou Drive, cole o link do próprio vídeo.",
  };
}

/** What still keeps a draft from being saved ("" when it can be). */
export function materialDraftIssue(draft = {}) {
  const link = describeMaterialLink(draft.source_url);
  if (link.state === "empty") return "Cole o link do vídeo.";
  if (link.state === "invalid") return link.message;
  if (!String(draft.title || "").trim()) return "Dê um título ao material.";
  return "";
}

/** The `library_items` row for a draft that passed `materialDraftIssue`. */
export function materialRow(draft = {}, userId = "") {
  const link = describeMaterialLink(draft.source_url);
  const themes = LIBRARY_THEMES.filter((theme) => asArray(draft.themes).includes(theme.id)).map((theme) => theme.tag);
  const focus = normalizeFocus(draft.focus_positions);
  return {
    title: String(draft.title || "").trim().slice(0, MATERIAL_TITLE_MAX),
    category: draft.category === "review" ? "review" : "jogada",
    description: String(draft.description || "").trim(),
    // A cover of its own wins; a YouTube video brings its own picture; anything else shows the shelf's cover.
    thumbnail_url: String(draft.thumbnail_url || "").trim() || link.thumbnail || null,
    source_type: link.type,
    source_url: link.url,
    tags: themes,
    status: "active",
    minimum_access_tier: LIBRARY_TIERS.some((tier) => tier.id === draft.minimum_access_tier) ? draft.minimum_access_tier : "player",
    // Sent only when chosen: the column arrives with a migration.
    ...(focus.length ? { focus_positions: focus } : {}),
    created_by: userId,
    updated_by: userId,
  };
}

const themeTags = new Set(LIBRARY_THEMES.flatMap((theme) => [fold(theme.tag), ...LIBRARY_CATEGORIES.find((category) => category.id === theme.id).tags]));

/**
 * The sheet's draft for a material that already exists. Its themes are read back from its
 * tags; a cover that is just the video's own picture is left empty (it stays automatic).
 */
export function materialDraftOf(item = {}) {
  const link = describeMaterialLink(item.source_url);
  const shelves = libraryCategoriesOf(item);
  const cover = String(item.thumbnail_url || "").trim();
  return {
    source_url: String(item.source_url || ""),
    title: String(item.title || ""),
    category: item.category === "review" ? "review" : "jogada",
    themes: LIBRARY_THEMES.filter((theme) => shelves.includes(theme.id)).map((theme) => theme.id),
    description: String(item.description || ""),
    focus_positions: normalizeFocus(item.focus_positions),
    minimum_access_tier: LIBRARY_TIERS.some((tier) => tier.id === item.minimum_access_tier) ? item.minimum_access_tier : "player",
    thumbnail_url: cover && cover !== link.thumbnail ? cover : "",
  };
}

/**
 * The cover a draft ends up with. Editing a material without touching its link or its cover
 * keeps the cover it has (a shelf illustration stays a shelf illustration); otherwise a cover
 * of its own wins, then the video's own picture, then none (the shelf's).
 */
export function materialCover(draft = {}, item = null) {
  const typed = String(draft.thumbnail_url || "").trim();
  if (item?.id) {
    const before = materialDraftOf(item);
    const sameLink = String(draft.source_url || "").trim() === before.source_url.trim();
    if (sameLink && typed === before.thumbnail_url) return String(item.thumbnail_url || "").trim();
  }
  return typed || describeMaterialLink(draft.source_url).thumbnail || "";
}

/**
 * What an edit writes over an existing material: the same fields the sheet shows, nothing
 * else. Tags that are not themes (written by hand before the sheet existed) are kept; who
 * created it, when, and whether it is archived are never touched here.
 */
export function materialPatch(draft = {}, item = {}, userId = "") {
  const row = materialRow(draft, userId);
  const kept = asArray(item.tags).filter((tag) => !themeTags.has(fold(tag)));
  row.thumbnail_url = materialCover(draft, item) || null;
  const patch = {
    title: row.title,
    category: row.category,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
    source_type: row.source_type,
    source_url: row.source_url,
    tags: [...new Set([...row.tags, ...kept])],
    minimum_access_tier: row.minimum_access_tier,
    updated_by: userId,
  };
  // Positions are written when the material already has that column or some were chosen now
  // (clearing them all is an edit too). The column arrives with a migration.
  if (Array.isArray(item.focus_positions) || row.focus_positions?.length) patch.focus_positions = row.focus_positions || [];
  return patch;
}
