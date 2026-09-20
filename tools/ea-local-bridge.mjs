import http from "node:http";
import { createEaGateway } from "../services/ea-sync/ea-client.js";
import { FC27_CLUB_ID, FC27_PLATFORM } from "../shared/fc27-club.js";

const PORT = 8789;
const loadClubMatches = createEaGateway();

function respond(response, status, body) {
  response.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-private-network": "true",
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return respond(response, 204, {});
  if (request.method === "GET" && request.url === "/health") return respond(response, 200, { ok: true, club_id: FC27_CLUB_ID });
  if (request.method !== "GET" || request.url !== "/api/ea/matches") {
    return respond(response, 404, { error: "Rota local nao encontrada." });
  }

  try {
    const result = await loadClubMatches({ clubId: FC27_CLUB_ID, platform: FC27_PLATFORM, maxResultCount: 10 });
    return respond(response, 200, {
      matches: result.matches,
      source: "pc-local",
      club_id: FC27_CLUB_ID,
      platform: FC27_PLATFORM,
      duration_ms: result.durationMs,
      cached: result.cached,
    });
  } catch (error) {
    const status = error.status || 502;
    return respond(response, status, {
      error: error.code || "ea_unreachable",
      message: error.name === "AbortError" ? "A EA excedeu o tempo limite para responder." : error.message || "Erro de rede.",
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Ponte EA FC27 ativa em http://127.0.0.1:${PORT}`);
  console.log(`Clube ${FC27_CLUB_ID} · ${FC27_PLATFORM}`);
  console.log("Deixe esta janela aberta e use BUSCAR PELO MEU PC no site.");
});
server.keepAliveTimeout = 10000;
