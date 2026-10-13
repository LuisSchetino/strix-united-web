import { guardApiHtml } from "./_lib/api-html-guard.js";

// The JSON guard belongs to /api only. Direct links (/agenda/<id>…) answer with the app's HTML.
export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);
  if (!pathname.startsWith("/api/")) return context.next();
  return guardApiHtml(context);
}
