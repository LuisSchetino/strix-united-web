import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createEaGateway } from "./ea-client.js";
import { FC27_CLUB_ID, FC27_PLATFORM } from "./fc27-club.js";

const PORT = Number(process.env.PORT || 3000);
const API_TOKEN = String(process.env.EA_SYNC_API_TOKEN || "");
const loadClubMatches = createEaGateway();

const json = (response, status, payload) => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(payload));
};

function authorized(request) {
  if (!API_TOKEN) return false;
  const value = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const expected = Buffer.from(API_TOKEN);
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, 200, {
      ok: true,
      service: "strix-fc27-ea-sync",
      club_id: FC27_CLUB_ID,
      platform: FC27_PLATFORM,
      timestamp: new Date().toISOString(),
    });
  }
  if (request.method !== "POST" || url.pathname !== "/v1/matches") {
    return json(response, 404, { error: "not_found" });
  }
  if (!authorized(request)) return json(response, 401, { error: "unauthorized" });

  const clubId = url.searchParams.get("clubId") || FC27_CLUB_ID;
  if (clubId !== FC27_CLUB_ID) return json(response, 400, { error: "unsupported_club", club_id: clubId });
  const startedAt = Date.now();
  try {
    const result = await loadClubMatches({ clubId, platform: FC27_PLATFORM, maxResultCount: 10 });
    console.log(JSON.stringify({ event: "ea_fetch", club_id: clubId, fetched: result.matches.length, cached: result.cached, duration_ms: Date.now() - startedAt }));
    return json(response, 200, {
      ok: true,
      club_id: clubId,
      platform: FC27_PLATFORM,
      fetched_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      cached: result.cached,
      matches: result.matches,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "ea_fetch_error", club_id: clubId, message: error?.message, status: error?.status || 502, duration_ms: Date.now() - startedAt }));
    return json(response, 502, { error: error?.code || "ea_unreachable", message: error?.message || "Não foi possível consultar a EA." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "ea_sync_ready", port: PORT }));
});
