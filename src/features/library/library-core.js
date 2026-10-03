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

export function progressPatch(position, duration, previous = {}) {
  const safePosition = Math.max(0, Math.round(Number(position) || 0));
  const safeDuration = Math.max(0, Math.round(Number(duration) || 0));
  const percent = safeDuration
    ? Math.min(100, Number(((safePosition / safeDuration) * 100).toFixed(2)))
    : Number(previous.progress_percent || 0);
  const completed = percent >= 90;
  return {
    started_at: previous.started_at || new Date().toISOString(),
    watched_seconds: Math.max(Number(previous.watched_seconds || 0), safePosition),
    last_position_seconds: safePosition,
    progress_percent: percent,
    completed_at: completed ? previous.completed_at || new Date().toISOString() : null,
    last_accessed_at: new Date().toISOString(),
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
  return "opened";
}

export const PROGRESS_LABEL = Object.freeze({
  completed: "Concluído",
  "in-progress": "Em andamento",
  opened: "Aberto",
  none: "Sem registro",
});

export function memberTracking(items = [], progress = []) {
  const live = new Map(asArray(items).map((item) => [item.id, item]));
  const members = new Map();
  for (const row of asArray(progress)) {
    if (!live.has(row.item_id) || !row.user_id) continue;
    const member = members.get(row.user_id) || { userId: row.user_id, name: row.viewer_display_name || "Membro", rows: [] };
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
    return { ...member, opened: member.rows.length, completed, total: live.size, lastAccess, byCategory };
  }).sort((left, right) => String(right.lastAccess || "").localeCompare(String(left.lastAccess || "")));
}

/** Manual thumbnail when the material has one; otherwise the cover of its shelf. */
export const libraryThumbnail = (item = {}) => item.thumbnail_url || categoryCover(primaryCategory(item));
