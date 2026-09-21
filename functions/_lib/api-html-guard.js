import { json } from "./auth.js";
import { apiRouteName, stampApiResponse } from "./api-sentinel.js";

export { apiRouteName, stampApiResponse };

export function looksLikeHtml(text = "", contentType = "") {
  const type = String(contentType || "").toLowerCase();
  const body = String(text || "").trimStart();
  return type.includes("text/html") || /^<!doctype html/i.test(body) || /^<html[\s>]/i.test(body);
}

export async function guardApiHtml(context) {
  const url = String(context.request?.url || "");
  const route = apiRouteName(url);
  try {
    const response = await context.next();
    const contentType = response.headers.get("content-type") || "";
    const maybeHtml = /text\/html/i.test(contentType)
      || (!/json/i.test(contentType) && response.status >= 500);
    if (!maybeHtml) {
      return stampApiResponse(response, context.request, { route });
    }
    const text = await response.text();
    if (!looksLikeHtml(text, contentType)) {
      return stampApiResponse(new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }), context.request, { route });
    }
    const ea = /\/api\/ea\//.test(url);
    return json({
      error: ea ? "ea_sync_upstream_error" : "html_instead_of_json",
      layer: "pages",
      upstreamStatus: response.status,
      contentType: String(contentType).split(";")[0] || "text/html",
      message: ea
        ? "A Function executou, mas a resposta interna ainda era HTML."
        : "A rota interna devolveu HTML em vez de JSON.",
    }, response.status >= 400 ? response.status : 502, { route, request: context.request });
  } catch (error) {
    const ea = /\/api\/ea\//.test(url);
    return json({
      error: ea ? "ea_sync_upstream_error" : "pages_failed",
      layer: "pages",
      upstreamStatus: 502,
      contentType: "application/json",
      message: String(error?.message || "Pages falhou ao completar a consulta.").slice(0, 180),
    }, 502, { route, request: context.request });
  }
}
