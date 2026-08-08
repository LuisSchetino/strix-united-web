import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { validateProviderAssetUrl } from "../../../shared/competition-providers.js";

const MAX_BYTES = 5 * 1024 * 1024;

export async function onRequestGet({ request, env }) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  if (!requireTier(session, "dev")) return json({ error: "insufficient_permission" }, 403);
  let target;
  try { target = validateProviderAssetUrl(new URL(request.url).searchParams.get("url") || ""); }
  catch (error) { return json({ error: "invalid_asset_url", message: error.message }, 422); }
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
    return new Response(bytes, { headers: { "content-type": type, "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
  }
  return json({ error: "asset_redirect_limit" }, 502);
}
