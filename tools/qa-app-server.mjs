// Local QA backend for the REAL app. It stands in for Cloudflare Pages Functions,
// Supabase Auth (GoTrue) and PostgREST so the real React app, the real
// supabase-js client and the real ContractGate can be exercised end to end
// without touching production. Nothing here ships: it is a development tool.
//
//   node tools/qa-app-server.mjs        (port 8799)
//   npx vite --config tools/qa-vite.config.mjs --port 5174
//   open http://localhost:5174/qa-login?user=dornellas
//
// What is faithful: supabase-js behaviour (storage, updateUser, signOut, reload),
// the app's own gate logic. What is simulated: GoTrue merging provider data on
// OAuth login (user_metadata keys survive a new login) is ASSUMED, not verified.

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.QA_PORT || 8799);
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const at = (time) => `${today}T${time}:00-03:00`;

const users = new Map([
  ["dornellas", discord("dornellas", "Dornellas", "vinidornellas", "dev")],
  ["nunes", discord("nunes", "Nunes", "nunes_fc", "player")],
]);

function discord(key, globalName, username, tier) {
  const id = randomUUID();
  const providerId = String(100000000000000000n + BigInt(Math.floor(Math.random() * 1e9)));
  const meta = {
    avatar_url: `https://cdn.discordapp.com/avatars/${providerId}/a_0123456789abcdef0123456789abcdef.png`,
    custom_claims: { global_name: globalName },
    email: `${username}@example.com`,
    email_verified: true,
    full_name: username,
    iss: "https://discord.com/api",
    name: username,
    picture: `https://cdn.discordapp.com/avatars/${providerId}/a_0123456789abcdef0123456789abcdef.png`,
    provider_id: providerId,
    sub: providerId,
  };
  return {
    key, tier, globalName,
    user: {
      id, aud: "authenticated", role: "authenticated", email: meta.email,
      app_metadata: { provider: "discord", providers: ["discord"] },
      user_metadata: meta,
      identities: [{ provider: "discord", id: providerId, user_id: id, identity_data: { ...meta } }],
      created_at: new Date().toISOString(),
    },
  };
}

function tokenFor(entry) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "authenticated", exp: now + 3600, iat: now,
    iss: "http://localhost:5174/qa-supabase/auth/v1", sub: entry.user.id,
    email: entry.user.email, phone: "", app_metadata: entry.user.app_metadata,
    user_metadata: entry.user.user_metadata, role: "authenticated", aal: "aal1",
    amr: [{ method: "oauth", timestamp: now }], session_id: randomUUID(), is_anonymous: false,
  };
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.${"s".repeat(43)}`;
}

function sessionFor(entry) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: tokenFor(entry), token_type: "bearer", expires_in: 3600, expires_at: now + 3600,
    refresh_token: `qa-refresh-${entry.key}`, user: entry.user,
  };
}

function entryFromAuth(request) {
  const bearer = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(Buffer.from(bearer.split(".")[1] || "", "base64url").toString());
    return [...users.values()].find((entry) => entry.user.id === payload.sub) || null;
  } catch {
    return null;
  }
}

const roster = [
  { id: "p1", display_name: "DORNELLAS", positions: ["ZAG"], shirt_number: 4, is_active: true, member_type: "elenco", structure_role: "jogador" },
  { id: "p2", display_name: "NUNES", positions: ["MC"], shirt_number: 8, is_active: true, member_type: "elenco", structure_role: "jogador" },
  { id: "p3", display_name: "Santozz", positions: ["ATA"], shirt_number: 9, is_active: true, member_type: "elenco", structure_role: "jogador" },
  { id: "p4", display_name: "Ceni", positions: ["GOL"], shirt_number: 1, is_active: true, member_type: "elenco", structure_role: "staff" },
];
const tables = {
  club_players: roster,
  agenda_matches: [
    { id: "a1", scheduled_at: at("21:10"), opponent_name: "Maquina", status: "scheduled", competition_name: "Amistoso", opponent_logos: null },
    { id: "a2", scheduled_at: at("21:40"), opponent_name: "Sinceridade FC", status: "scheduled", competition_name: "Amistoso", opponent_logos: null },
    { id: "a3", scheduled_at: at("22:10"), opponent_name: "POA City", status: "scheduled", competition_name: "Copa Yeshua", opponent_logos: null },
  ],
  // Synthetic EA-shaped player rows (QA only) so populated fichas and rankings can be reviewed.
  club_matches: [
    { id: "m1", played_at: at("21:10"), opponent_name: "POA City", strix_score: 2, opponent_score: 1, competition_name: "Copa Yeshua", opponent_logos: null, agenda_matches: null, performance: { players: [
      { eaName: "NUNES", rating: 8.1, goals: 1, assists: 1, passesMade: 31, passesAttempts: 36, shots: 3, tackles: 4, saves: 0, secondsPlayed: 5400 },
      { eaName: "Santozz", rating: 7.6, goals: 1, assists: 0, passesMade: 14, passesAttempts: 19, shots: 5, tackles: 1, saves: 0, secondsPlayed: 5400 },
      { eaName: "DORNELLAS", rating: 7.2, goals: 0, assists: 0, passesMade: 22, passesAttempts: 25, shots: 0, tackles: 6, saves: 0, secondsPlayed: 5400 },
    ] } },
    { id: "m2", played_at: at("22:10"), opponent_name: "Maquina FC", strix_score: 3, opponent_score: 0, competition_name: "Copa Yeshua", opponent_logos: null, agenda_matches: null, performance: { players: [
      { eaName: "NUNES", rating: 8.6, goals: 1, assists: 2, passesMade: 35, passesAttempts: 39, shots: 2, tackles: 3, saves: 0, secondsPlayed: 5400 },
      { eaName: "Santozz", rating: 8.3, goals: 2, assists: 0, passesMade: 12, passesAttempts: 16, shots: 6, tackles: 0, saves: 0, secondsPlayed: 5400 },
      { eaName: "DORNELLAS", rating: 7.4, goals: 0, assists: 1, passesMade: 27, passesAttempts: 29, shots: 1, tackles: 5, saves: 0, secondsPlayed: 5400 },
    ] } },
  ],
  night_related: [{ id: "n1", night_date: today, player_ids: ["p1", "p2", "p3", "p4"] }],
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(body === undefined ? "" : JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  const path = url.pathname.replace(/^\/qa-supabase/, "");
  if (request.method === "OPTIONS") return send(response, 204);

  // Pages Functions stand-ins
  if (url.pathname === "/api/public-config") return send(response, 200, { url: "http://localhost:5174/qa-supabase", publishableKey: "qa-publishable-key" });
  if (url.pathname === "/api/auth/session") {
    const entry = entryFromAuth(request);
    if (!entry) return send(response, 401, { error: "invalid_session" });
    return send(response, 200, {
      profile: {
        user_id: entry.user.id, discord_id: entry.user.user_metadata.provider_id, display_name: entry.globalName,
        avatar_url: null, access_tier: entry.tier, is_active: true, last_discord_sync_at: new Date().toISOString(),
      },
      permissions_checked_at: new Date().toISOString(), sync_warning: "",
    });
  }

  // Mock "Discord OAuth": issues a session for the server-side user, keeping whatever
  // user_metadata the server already holds (the GoTrue merge assumption).
  if (url.pathname === "/qa-login") {
    const entry = users.get(url.searchParams.get("user") || "dornellas");
    if (!entry) return send(response, 404, { error: "unknown_user" });
    if (url.searchParams.get("tier")) entry.tier = url.searchParams.get("tier");
    const session = sessionFor(entry);
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return response.end(`<!doctype html><meta charset="utf-8"><title>QA login</title><script>
      localStorage.setItem("sb-localhost-auth-token", ${JSON.stringify(JSON.stringify(session))});
      location.replace("/");
    </script>`);
  }
  if (url.pathname === "/qa-state") {
    return send(response, 200, [...users.values()].map((entry) => ({ key: entry.key, contract: entry.user.user_metadata.fc27_contract || null, metadataBytes: JSON.stringify(entry.user.user_metadata).length, tokenBytes: tokenFor(entry).length })));
  }

  // GoTrue stand-ins
  if (path === "/auth/v1/user") {
    const entry = entryFromAuth(request);
    if (!entry) return send(response, 401, { msg: "invalid JWT" });
    if (request.method === "PUT") {
      const body = await readBody(request);
      entry.user.user_metadata = { ...entry.user.user_metadata, ...(body.data || {}) };
    }
    return send(response, 200, entry.user);
  }
  if (path === "/auth/v1/token") {
    const body = await readBody(request);
    const entry = [...users.values()].find((item) => `qa-refresh-${item.key}` === body.refresh_token);
    return entry ? send(response, 200, sessionFor(entry)) : send(response, 400, { error: "invalid_grant" });
  }
  if (path === "/auth/v1/logout") return send(response, 204);

  // PostgREST stand-in: reads return fixtures or []
  const table = path.match(/^\/rest\/v1\/([a-z_]+)/)?.[1];
  if (table) {
    if (request.method === "GET") return send(response, 200, tables[table] || [], { "content-range": "0-0/*" });
    return send(response, 201, []);
  }
  return send(response, 404, { error: "not_found" });
});

server.listen(PORT, "127.0.0.1", () => console.log(`qa-app-server ready ${PORT}`));
