import { json } from "../_lib/auth.js";

// Catch-all for unmatched /api/* so Cloudflare Pages never SPA-falls those URLs.
export async function onRequest() {
  return json({ error: "not_found" }, 404);
}
