import { parseDeepLink } from "../../src/deep-link.js";
import { SHARE_BUCKET, describePreview, injectPreview, isPreviewBot, libraryBannerPath, previewQuery } from "../../shared/link-preview.js";

const READ_TIMEOUT_MS = 2500;

async function withTimeout(work, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await work(controller.signal); } finally { clearTimeout(timer); }
}

/** The one row a link names, read with the server key. Null when it cannot be read. */
async function readRow(env, target) {
  const query = previewQuery(target);
  if (!query || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const url = `${env.SUPABASE_URL}/rest/v1/${query.table}?id=eq.${encodeURIComponent(target.id)}&select=${encodeURIComponent(query.select)}&limit=1`;
  const response = await withTimeout((signal) => fetch(url, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, accept: "application/json" },
    signal,
  }), READ_TIMEOUT_MS);
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/** A material's own banner, when one was published for it. */
async function readBanner(env, target, row) {
  if (target.page !== "biblioteca" || !row || !env.SUPABASE_URL) return "";
  // A reserved or unpublished material has no card of its own, so its banner is not looked up either.
  if ((row.status && row.status !== "active") || (row.minimum_access_tier && !["teste", "player"].includes(row.minimum_access_tier))) return "";
  const url = `${env.SUPABASE_URL}/storage/v1/object/public/${SHARE_BUCKET}/${libraryBannerPath(row.id)}`;
  try {
    const response = await withTimeout((signal) => fetch(url, { method: "HEAD", signal }), READ_TIMEOUT_MS);
    return response.ok ? url : "";
  } catch {
    return "";
  }
}

/**
 * Direct links (/agenda/<id>, /biblioteca/<id>…): people get the app exactly as the static site
 * serves it; a chat app that asks for the page to build a card gets the same page with that
 * item's title, text and banner in the head. Any failure falls back to the untouched page.
 */
export async function serveLinkPreview(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return context.next();
  if (!isPreviewBot(request.headers.get("user-agent"))) return context.next();
  try {
    const url = new URL(request.url);
    const target = parseDeepLink({ pathname: url.pathname, search: url.search });
    if (!target) return context.next();
    let page = await context.next();
    if (!page.ok || !/text\/html/i.test(page.headers.get("content-type") || "")) {
      page = await env.ASSETS.fetch(new URL("/", url));
    }
    if (!page.ok) return page;
    const html = await page.text();
    let row = null;
    try { row = await readRow(env, target); } catch { row = null; }
    const banner = await readBanner(env, target, row);
    const preview = describePreview(target, row, { origin: url.origin, banner });
    const headers = new Headers(page.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "public, max-age=300");
    headers.delete("content-length");
    headers.delete("etag");
    return new Response(injectPreview(html, { ...preview, url: `${url.origin}${url.pathname}${url.search}` }), { status: 200, headers });
  } catch {
    return context.next();
  }
}
