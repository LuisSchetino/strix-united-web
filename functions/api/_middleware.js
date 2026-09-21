import { json } from "../_lib/auth.js";

function looksLikeHtml(text = "", contentType = "") {
  const type = String(contentType || "").toLowerCase();
  const body = String(text || "").trimStart();
  return type.includes("text/html") || /^<!doctype html/i.test(body) || /^<html[\s>]/i.test(body);
}

export async function onRequest(context) {
  try {
    const response = await context.next();
    const contentType = response.headers.get("content-type") || "";
    const maybeHtml = /text\/html/i.test(contentType)
      || (!/json/i.test(contentType) && response.status >= 500);
    if (!maybeHtml) return response;
    const text = await response.text();
    if (!looksLikeHtml(text, contentType)) {
      return new Response(text, {
        status: response.status,
        headers: response.headers,
      });
    }
    const ea = /\/api\/ea\//.test(String(context.request?.url || ""));
    return json({
      error: ea ? "ea_sync_upstream_error" : "html_instead_of_json",
      layer: "pages_edge",
      upstreamStatus: response.status,
      contentType: String(contentType).split(";")[0] || "text/html",
      message: ea
        ? "A borda da Pages devolveu HTML em vez de JSON ao consultar a EA."
        : "A rota interna devolveu HTML em vez de JSON.",
    }, response.status >= 400 ? response.status : 502);
  } catch (error) {
    const ea = /\/api\/ea\//.test(String(context.request?.url || ""));
    return json({
      error: ea ? "ea_sync_upstream_error" : "pages_failed",
      layer: "pages",
      upstreamStatus: 502,
      contentType: "application/json",
      message: String(error?.message || "Pages falhou ao completar a consulta.").slice(0, 180),
    }, 502);
  }
}
