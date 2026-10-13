// What a direct link looks like when it is pasted in WhatsApp, Discord or any chat: a title, one
// line of text and a banner. Pure: the Pages Function reads the row and calls this; nothing here
// touches the network. A link names its item by an unguessable id, so the preview only ever says
// what that one item is called.

export const SITE_NAME = "Strix United · FC27";
export const SITE_TITLE = "Strix United | FC27";
export const SITE_DESCRIPTION = "Central oficial do Strix United no FC27: agenda da noite, escalações, resultados e campeonatos do clube.";
export const SHARE_BANNER = "/brand/strix/strix-united-fc27-share.jpg";
export const SHARE_BUCKET = "fc27-team-assets";
/**
 * Where the banner of a library material lives in the public bucket (see library-share-banner.js).
 * The folder carries the layout's version: a new layout is a new folder, so every material gets
 * its banner drawn again and no chat app is handed the old one.
 */
export const LIBRARY_BANNER_FOLDER = "library/share/v2";
export const libraryBannerPath = (id) => `${LIBRARY_BANNER_FOLDER}/${id}.jpg`;

const ZONE = "America/Sao_Paulo";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot\b|crawler|spider|whatsapp|facebookexternalhit|facebot|telegram|discord|slack|skype|linkedin|pinterest|vkshare|embedly|preview|iframely|snapchat|viber|line\/|kakaotalk|redditbot|applebot|googlebot|bingbot/i;

/** Chat apps and crawlers fetch a link to build its card; people get the app untouched. */
export function isPreviewBot(userAgent = "") {
  return BOT.test(String(userAgent || ""));
}

export const isRowId = (value) => UUID.test(String(value || ""));

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const clip = (value, max) => {
  const clean = text(value);
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};
const joined = (...parts) => parts.map(text).filter(Boolean).join(" · ");
const dateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, weekday: "short", day: "2-digit", month: "2-digit" }).format(date).replace(".", "").replace(",", "");
  const hour = new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return `${day} às ${hour}`;
};
const minute = (seconds) => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = `${String(minutes).padStart(hours ? 2 : 1, "0")}:${String(value % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${rest}` : rest;
};

export function youtubeId(url = "") {
  const match = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return match ? match[1] : "";
}

/** The REST read that fetches the one row a link names: `{ table, select }`, or null. */
export function previewQuery(target) {
  if (!target || !isRowId(target.id)) return null;
  const queries = {
    biblioteca: { table: "library_items", select: "id,title,category,description,thumbnail_url,source_url,status,minimum_access_tier" },
    agenda: { table: "agenda_matches", select: "id,opponent_name,competition_name,scheduled_at,status" },
    partidas: { table: "club_matches", select: "id,opponent_name,competition_name,strix_score,opponent_score,played_at" },
    elenco: { table: "club_players", select: "id,display_name,positions,shirt_number,is_active" },
    campeonatos: { table: "competition_editions", select: "id,label,status,competitions(name,organization)" },
  };
  return queries[target.page] || null;
}

const GENERIC = {
  biblioteca: ["Biblioteca do Strix United", "Jogadas e reviews do time para assistir no site."],
  agenda: ["Agenda do Strix United", "Os jogos da noite e a escalação de cada um."],
  partidas: ["Resultados do Strix United", "Placar e desempenho de cada partida."],
  elenco: ["Elenco do Strix United", "Os jogadores do clube no FC27."],
  campeonatos: ["Campeonatos do Strix United", "Tabela, jogos e cenários de cada competição."],
};

/**
 * The card for a link: `{ title, description, image, large }`. `row` is what previewQuery read
 * (null when it could not be read: the card then names only the area). `banner` is the address
 * of a material's own banner when one was published; `origin` prefixes the site's default one.
 */
export function describePreview(target, row, { origin = "", banner = "" } = {}) {
  const fallbackImage = `${origin}${SHARE_BANNER}`;
  const base = { image: fallbackImage, large: true };
  if (!target) return { ...base, title: SITE_TITLE, description: SITE_DESCRIPTION };
  const [genericTitle, genericText] = GENERIC[target.page] || [SITE_TITLE, SITE_DESCRIPTION];
  if (!row) return { ...base, title: genericTitle, description: genericText };

  if (target.page === "biblioteca") {
    // The card is read by anyone holding the link, signed in or not: only a published material
    // that every member may open is named. Anything reserved for a higher tier stays generic.
    const open = !row.minimum_access_tier || ["teste", "player"].includes(row.minimum_access_tier);
    if ((row.status && row.status !== "active") || !open) return { ...base, title: genericTitle, description: genericText };
    const kind = row.category === "review" ? "Review" : "Jogada";
    const at = target.params?.t ? `Começa em ${minute(target.params.t)}` : "";
    const video = youtubeId(row.source_url);
    const image = banner || text(row.thumbnail_url) || (video ? `https://i.ytimg.com/vi/${video}/hqdefault.jpg` : "") || fallbackImage;
    return {
      title: clip(row.title, 90) || genericTitle,
      description: clip(joined(kind, at, row.description) || genericText, 180),
      image,
      large: true,
    };
  }
  if (target.page === "agenda") {
    const opponent = text(row.opponent_name);
    if (!opponent) return { ...base, title: genericTitle, description: genericText };
    return {
      ...base,
      title: clip(`Strix United × ${opponent}`, 90),
      description: clip(joined(row.status === "cancelled" ? "Cancelado" : "", dateTime(row.scheduled_at), row.competition_name || "Amistoso"), 180),
    };
  }
  if (target.page === "partidas") {
    const opponent = text(row.opponent_name);
    if (!opponent) return { ...base, title: genericTitle, description: genericText };
    return {
      ...base,
      title: clip(`Strix United ${row.strix_score} × ${row.opponent_score} ${opponent}`, 90),
      description: clip(joined("Resultado", row.competition_name || "Amistoso", dateTime(row.played_at)), 180),
    };
  }
  if (target.page === "elenco") {
    const name = text(row.display_name);
    if (!name || row.is_active === false) return { ...base, title: genericTitle, description: genericText };
    const shirt = row.shirt_number === null || row.shirt_number === undefined ? "" : `#${String(row.shirt_number).padStart(2, "0")}`;
    return {
      ...base,
      title: clip(`${name} · Strix United`, 90),
      description: clip(joined((row.positions || []).join(" · "), shirt, "Elenco FC27"), 180),
    };
  }
  if (target.page === "campeonatos") {
    const competition = Array.isArray(row.competitions) ? row.competitions[0] : row.competitions;
    const name = text(competition?.name);
    if (!name) return { ...base, title: genericTitle, description: genericText };
    return {
      ...base,
      title: clip(name, 90),
      description: clip(joined("Campanha do Strix United", row.label, competition?.organization), 180),
    };
  }
  return { ...base, title: genericTitle, description: genericText };
}

const escapeAttribute = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The head tags of a card. */
export function previewTags({ title, description, image, large = true, url = "" }) {
  const tags = [
    `<title>${escapeAttribute(title)}</title>`,
    `<meta name="description" content="${escapeAttribute(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:site_name" content="${escapeAttribute(SITE_NAME)}" />`,
    `<meta property="og:title" content="${escapeAttribute(title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(description)}" />`,
    url && `<meta property="og:url" content="${escapeAttribute(url)}" />`,
    image && `<meta property="og:image" content="${escapeAttribute(image)}" />`,
    image && `<meta property="og:image:alt" content="${escapeAttribute(title)}" />`,
    `<meta name="twitter:card" content="${large ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeAttribute(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(description)}" />`,
    image && `<meta name="twitter:image" content="${escapeAttribute(image)}" />`,
  ];
  return tags.filter(Boolean).join("\n    ");
}

/**
 * Swaps the page's own card for this link's. Everything the static head says about the card
 * (title, description, og:*, twitter:*, canonical) is removed and written again; the rest of
 * the document is untouched.
 */
export function injectPreview(html, preview) {
  const source = String(html || "");
  const end = source.search(/<\/head>/i);
  if (end === -1) return source;
  const head = source.slice(0, end)
    .replace(/[ \t]*<title>[\s\S]*?<\/title>\s*\n?/i, "")
    .replace(/[ \t]*<meta\s+(?:name|property)="(?:description|og:[^"]+|twitter:[^"]+)"[^>]*>\s*\n?/gi, "")
    .replace(/[ \t]*<link\s+rel="canonical"[^>]*>\s*\n?/gi, "");
  return `${head}    ${previewTags(preview)}\n  ${source.slice(end)}`;
}
