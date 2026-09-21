import { guardApiHtml } from "./_lib/api-html-guard.js";

export async function onRequest(context) {
  return guardApiHtml(context);
}
