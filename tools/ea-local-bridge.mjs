import http from "node:http";

const PORT = 8789;
const EA_MATCHES_URL = "https://proclubs.ea.com/api/fc/clubs/matches?platform=common-gen5&clubIds=15686&matchType=friendlyMatch&maxResultCount=10";

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
    const upstream = await fetch(EA_MATCHES_URL, {
      headers: { accept: "application/json", "accept-language": "pt-BR,pt;q=0.9" },
      cache: "no-store",
    });
    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    if (!upstream.ok || !payload) {
      return respond(response, upstream.status || 502, {
        error: "A EA recusou a consulta no seu computador.",
        message: `EA respondeu HTTP ${upstream.status || 502}. A ponte nao usa proxy, cookies ou tecnicas para burlar bloqueios.`,
      });
    }
    return respond(response, 200, { matches: Array.isArray(payload) ? payload : payload.matches || payload, source: "pc-local" });
  } catch (error) {
    return respond(response, 502, { error: "Falha local ao consultar a EA.", message: error.message || "Erro de rede." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Ponte EA FC27 ativa em http://127.0.0.1:${PORT}`);
  console.log("Deixe esta janela aberta e use BUSCAR PELO MEU PC no site.");
});
