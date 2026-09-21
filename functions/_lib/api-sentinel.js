export function apiRouteName(url = "") {
  const path = String(url || "").split("?")[0];
  if (/\/api\/ea\/matches\/?$/.test(path)) return "ea-matches";
  if (/\/api\/internal\/ea-sync-health\/?$/.test(path)) return "ea-sync-health";
  if (/\/api\/internal\/health\/?$/.test(path)) return "health";
  if (/\/api\//.test(path)) return "api";
  return "api";
}

export function stampApiResponse(response, request, extra = {}) {
  const route = extra.route || apiRouteName(request?.url || extra.url || "");
  const requestId = extra.requestId
    || response?.headers?.get?.("X-Strix-Request-Id")
    || crypto.randomUUID();
  const headers = new Headers(response.headers);
  headers.set("X-Strix-Api-Layer", "pages-function");
  headers.set("X-Strix-Api-Route", route);
  headers.set("X-Strix-Request-Id", requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
