export class ApiJsonError extends Error {
  constructor(message, { code = "invalid_json", status = 0, detail = "" } = {}) {
    super(message);
    this.name = "ApiJsonError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export function looksLikeHtml(text = "", contentType = "") {
  const type = String(contentType || "").toLowerCase();
  const body = String(text || "").trimStart();
  return type.includes("text/html") || /^<!doctype html/i.test(body) || /^<html[\s>]/i.test(body);
}

export function parseApiJson(text, { status = 0, contentType = "" } = {}) {
  const raw = String(text || "");
  if (looksLikeHtml(raw, contentType)) {
    throw new ApiJsonError("A rota da EA devolveu HTML em vez de JSON.", {
      code: "html_instead_of_json",
      status,
      detail: `HTTP ${status || "?"} · ${String(contentType || "unknown").split(";")[0] || "unknown"}`,
    });
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
  const payload = parseApiJson(text, { status: response.status, contentType });
  if (!response.ok) {
    throw new ApiJsonError(
      payload.message || payload.error || `A fonte respondeu HTTP ${response.status}.`,
      {
        code: payload.error || "http_error",
        status: response.status,
        detail: payload.detail || `HTTP ${response.status}`,
      },
    );
  }
  return payload;
}
