// Direct links: a match, a player, a competition and a library material each have an address of
// their own (`/agenda/<id>`, `/elenco/<id>`, `/campeonatos/<id>`, `/partidas/<id>`,
// `/biblioteca/<id>?t=83`). The first segment is still the page (see access.js); this file reads and
// writes the rest. Pure: the browser history lives in ui/useDeepTarget.js.
import { locationForPage, normalizePageId } from "./access.js";

/** Pages whose items can be linked, and the name each one has in a sentence. */
export const LINKABLE_PAGES = Object.freeze({
  agenda: "partida",
  partidas: "resultado",
  elenco: "jogador",
  campeonatos: "campeonato",
  biblioteca: "material",
});

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_SECONDS = 24 * 3600;

/** Seconds from `83`, `1m23s`, `1:23` or `1:02:03`; 0 when it is none of those. */
export function parseTimeParam(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return 0;
  let seconds = 0;
  if (/^\d+$/.test(raw)) seconds = Number(raw);
  else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(raw)) seconds = raw.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  else {
    const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!match || !match[0]) return 0;
    seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
  }
  return Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_SECONDS ? Math.floor(seconds) : 0;
}

/** "1:23" / "1:02:03": the minute a link points at, the way a player shows it. */
export function timeLabel(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = `${String(minutes).padStart(hours ? 2 : 1, "0")}:${String(value % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${rest}` : rest;
}

/**
 * What an address points at: `{ page, id, params }`, or null when it is only a page.
 * Hash addresses (`#/agenda`) never carry an item.
 */
export function parseDeepLink(location = {}) {
  const segments = String(location.pathname || "").split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const page = normalizePageId(segments[0]);
  if (!page || !LINKABLE_PAGES[page]) return null;
  let id = "";
  try { id = decodeURIComponent(segments[1]); } catch { return null; }
  if (!SAFE_ID.test(id)) return null;
  const params = {};
  if (page === "biblioteca") {
    const t = parseTimeParam(new URLSearchParams(String(location.search || "")).get("t"));
    if (t) params.t = t;
  }
  return { page, id, params };
}

/** The address of an item. Without an id it is the page itself. */
export function deepLinkPath(page, id, params = {}) {
  const base = locationForPage(page);
  const key = String(id ?? "");
  const normalized = normalizePageId(page);
  if (!key || !SAFE_ID.test(key) || !LINKABLE_PAGES[normalized]) return base;
  const t = normalized === "biblioteca" ? parseTimeParam(params?.t) : 0;
  return `${base}/${encodeURIComponent(key)}${t ? `?t=${t}` : ""}`;
}

/** The full address to send to someone. */
export function shareUrl(origin, page, id, params) {
  return `${String(origin || "").replace(/\/+$/, "")}${deepLinkPath(page, id, params)}`;
}
