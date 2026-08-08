import http from "node:http";
import { createEaMatchLoader } from "../shared/ea-fetch.js";

const PORT = 8789;
const EA_MATCHES_URL = "https://proclubs.ea.com/api/fc/clubs/matches?platform=common-gen5&clubIds=15686&matchType=friendlyMatch&maxResultCount=10";
const loadEaMatches = createEaMatchLoader({ url: EA_MATCHES_URL });

function respond(response, status, body) {
  response.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return respond(response, 204, {});
  if (request.method === "GET" && request.url === "/health") return respond(response, 200, { ok: true });
  if (request.method !== "GET" || request.url !== "/api/ea/matches") {
    return respond(response, 404, { error: "Rota local nao encontrada." });
  }

  try {
    const result = await loadEaMatches();
    return respond(response, 200, { matches: result.matches, source: "pc-local", duration_ms: result.durationMs, cached: result.cached });
  } catch (error) {
    return respond(response, error.status || 502, { error: "Falha local ao consultar a EA.", message: error.name === "AbortError" ? "A EA excedeu 9 segundos para responder." : error.message || "Erro de rede." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Ponte EA FC27 ativa em http://127.0.0.1:${PORT}`);
  console.log("Deixe esta janela aberta e use BUSCAR PELO MEU PC no site.");
});
server.keepAliveTimeout = 10000;
