export class ApiJsonError extends Error {
  constructor(message, { code = "invalid_json", status = 0, detail = "", layer = "", contentType = "" } = {}) {
    super(message);
    this.name = "ApiJsonError";
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.layer = layer;
    this.contentType = contentType;
  }
}

export function looksLikeHtml(text = "", contentType = "") {
  const type = String(contentType || "").toLowerCase();
  const body = String(text || "").trimStart();
  return type.includes("text/html") || /^<!doctype html/i.test(body) || /^<html[\s>]/i.test(body);
}

export function parseApiJson(text, { status = 0, contentType = "", apiLayer = "" } = {}) {
  const raw = String(text || "");
  const functionRan = String(apiLayer || "").toLowerCase() === "pages-function";
  if (looksLikeHtml(raw, contentType)) {
    const type = String(contentType || "text/html").split(";")[0] || "text/html";
    const edge = !functionRan && (status === 502 || status === 503 || status === 504);
    throw new ApiJsonError(
      edge
        ? "Falha antes da resposta da API."
        : functionRan
          ? "A API respondeu HTML depois de executar."
          : "A rota da EA devolveu HTML em vez de JSON.",
      {
        code: edge ? "ea_sync_upstream_error" : "html_instead_of_json",
        status,
        layer: edge ? "pages_edge" : (functionRan ? "pages" : "pages"),
        contentType: type,
        detail: `HTTP ${status || "?"} · ${type}${functionRan ? " · function" : " · no-sentinel"}`,
      },
    );
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiJsonError("A resposta da EA não era JSON válido.", {
      code: "invalid_json",
      status,
      detail: raw.slice(0, 80).replace(/\s+/g, " "),
    });
  }
}

export async function readApiJson(response) {
  const text = await response.text();
  const contentType = response.headers?.get?.("content-type") || "";
  const apiLayer = response.headers?.get?.("x-strix-api-layer") || "";
  const payload = parseApiJson(text, { status: response.status, contentType, apiLayer });
  if (!response.ok) {
    throw new ApiJsonError(
      payload.message || payload.error || `A fonte respondeu HTTP ${response.status}.`,
      {
        code: payload.error || "http_error",
        status: response.status,
        layer: payload.layer || "",
        contentType: payload.contentType || payload.upstreamContentType || contentType,
        detail: [
          payload.layer ? String(payload.layer).toUpperCase() : "",
          payload.upstreamStatus ? `HTTP ${payload.upstreamStatus}` : `HTTP ${response.status}`,
          payload.contentType || payload.upstreamContentType || "",
        ].filter(Boolean).join(" · "),
      },
    );
  }
  return payload;
}
