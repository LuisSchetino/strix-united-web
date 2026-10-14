// Recebe o texto do placar lido na tela pelo vigia do PC (tools/ao-vivo) e marca o jogo da
// Agenda como em campo, com placar parcial e minuto. Protegido por FC27_LIVE_SECRET; sem placar
// no texto, nada muda. A leitura e a escolha do jogo estão em shared/live-signal.js (testadas).
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_STRIX_TAGS, liveUpdate, parseScoreboard, pickAgendaMatch } from "../../../shared/live-signal.js";

const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || ""))));
}

async function validSecret(request, expected) {
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!supplied || !expected) return false;
  const [left, right] = await Promise.all([digest(supplied), digest(expected)]);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) mismatch |= (left[index] || 0) ^ (right[index] || 0);
  return mismatch === 0;
}

export async function onRequestPost({ request, env }) {
  if (!await validSecret(request, env.FC27_LIVE_SECRET)) return response({ error: "authentication_required" }, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return response({ error: "backend_configuration_missing" }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return response({ error: "invalid_json" }, 400);
  }
  const text = String(body?.text || "").slice(0, 2000);
  const board = parseScoreboard(text);
  if (!board) return response({ status: "no_scoreboard" }, 202);

  const now = new Date();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await client.from("agenda_matches")
    .select("id, opponent_name, scheduled_at, status, live_seen_at, live_started_at, live_minute, live_strix_score, live_opponent_score")
    .gte("scheduled_at", new Date(now.getTime() - 3 * 3_600_000).toISOString())
    .lte("scheduled_at", new Date(now.getTime() + 3 * 3_600_000).toISOString());
  if (error) return response({ error: "agenda_unavailable" }, 502);

  const tags = String(env.FC27_STRIX_TAGS || "").split(",").map((tag) => tag.trim().toUpperCase()).filter(Boolean);
  const picked = pickAgendaMatch(rows, board, now, tags.length ? tags : DEFAULT_STRIX_TAGS);
  if (!picked) return response({ status: "no_agenda_match", board }, 202);

  const update = liveUpdate(board, picked.strixLeft, now, picked.row);
  const { error: saveError } = await client.from("agenda_matches").update(update).eq("id", picked.row.id);
  if (saveError) return response({ error: "save_failed" }, 502);
  return response({
    status: "live",
    match_id: picked.row.id,
    opponent: picked.row.opponent_name,
    strix: update.live_strix_score,
    opponent_score: update.live_opponent_score,
    minute: update.live_minute,
  });
}

export function onRequest() {
  return response({ error: "method_not_allowed" }, 405);
}
