import { json } from "../../_lib/auth.js";
import { validateProviderAssetUrl } from "../../../shared/competition-providers.js";

const MAX_BYTES = 5 * 1024 * 1024;

export async function onRequestGet({ request, waitUntil }) {
  let target;
  try { target = validateProviderAssetUrl(new URL(request.url).searchParams.get("url") || ""); }
  catch (error) { return json({ error: "invalid_asset_url", message: error.message }, 422); }
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: "GET" });
  const cached = await cache?.match(cacheKey);
  if (cached) return cached;
  for (let redirect = 0; redirect <= 2; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try { response = await fetch(target, { redirect: "manual", signal: controller.signal, headers: { accept: "image/png,image/jpeg,image/webp,image/gif" } }); }
    catch { clearTimeout(timeout); return json({ error: "asset_unavailable" }, 502); }
    clearTimeout(timeout);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === 2) return json({ error: "asset_redirect_limit" }, 502);
      try { target = validateProviderAssetUrl(new URL(response.headers.get("location"), target).toString()); }
      catch (error) { return json({ error: "invalid_asset_redirect", message: error.message }, 422); }
      continue;
    }
    if (!response.ok) return json({ error: `asset_http_${response.status}` }, 502);
    const type = response.headers.get("content-type") || "";
    const size = Number(response.headers.get("content-length") || 0);
    if (!/^image\/(png|jpeg|webp|gif)/i.test(type) || size > MAX_BYTES) return json({ error: "invalid_asset_response" }, 422);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) return json({ error: "asset_too_large" }, 422);
    const asset = new Response(bytes, { headers: {
      "content-type": type,
      "cache-control": "public, max-age=604800, stale-while-revalidate=86400",
      "cdn-cache-control": "public, max-age=2592000",
      "x-content-type-options": "nosniff",
    } });
    if (cache) waitUntil?.(cache.put(cacheKey, asset.clone()));
    return asset;
  }
  return json({ error: "asset_redirect_limit" }, 502);
}
