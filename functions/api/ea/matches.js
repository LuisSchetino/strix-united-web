import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { normalizeEaMatches, suggestAgendaMatches } from "../../../src/features/matches/import-core.js";

const EA_CLUB_ID = "15686";

const serviceHeaders = (env) => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
});

async function fetchAllMatches(env) {
  if (!env.EA_SYNC_API_URL || !env.EA_SYNC_API_TOKEN) {
    const error = new Error("EA Sync API is not configured.");
    error.code = "ea_sync_not_configured";
    throw error;
  }
  const base = new URL(env.EA_SYNC_API_URL);
  if (base.protocol !== "https:") throw new Error("EA Sync API must use HTTPS.");
  const url = new URL("/v1/matches", base);
  url.searchParams.set("clubId", EA_CLUB_ID);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${env.EA_SYNC_API_TOKEN}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = null; }
    if (!response.ok || !payload?.ok || payload.club_id !== EA_CLUB_ID || !Array.isArray(payload.matches)) {
      const error = new Error(payload?.message || `EA Sync API respondeu HTTP ${response.status}.`);
      error.status = response.status || 502;
      error.code = payload?.error || "ea_sync_invalid_response";
      throw error;
    }
    return { raw: payload.matches, durationMs: Number(payload.duration_ms || 0), cached: Boolean(payload.cached) };
  } finally {
    clearTimeout(timer);
  }
}

async function supabaseJson(env, path, init = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("EA sync server configuration is incomplete.");
  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: { ...serviceHeaders(env), ...(init.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.hint || `Supabase respondeu HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function loadAgenda(env) {
  return await supabaseJson(env, "/rest/v1/agenda_matches?select=id,opponent_name,scheduled_at,status&status=in.(scheduled,live)&order=scheduled_at.asc", { method: "GET" }) || [];
}

async function loadImportedMatchIds(env) {
  const rows = await supabaseJson(
    env,
    "/rest/v1/club_matches?select=external_match_id&external_match_id=not.is.null",
    { method: "GET" },
  ) || [];
  return new Set(rows.map((row) => String(row.external_match_id || "")).filter(Boolean));
}

function withAgendaSuggestions(matches, agenda) {
  const suggestions = suggestAgendaMatches(matches, agenda);
  return matches.map((match) => {
    const suggestion = suggestions.get(match.id);
    return { ...match, agendaId: suggestion?.suggestion?.autoLink ? suggestion.id : "" };
  });
}

function eaError(error) {
  if (error?.name === "AbortError") return json({ error: "ea_timeout", message: "A EA excedeu o tempo limite de 10 segundos." }, 504);
  if (error?.code?.startsWith?.("ea_")) {
    const status = error.status === 429 ? 429 : 502;
    const messages = {
      ea_rate_limited: "A EA limitou temporariamente as consultas. Tente novamente em instantes.",
      ea_invalid_payload: "A EA respondeu com conteúdo inválido em vez de JSON.",
      ea_sync_not_configured: "O serviço de sincronização da EA não está configurado.",
      ea_sync_invalid_response: "O serviço de sincronização respondeu com conteúdo inválido.",
    };
    return json({ error: error.code, message: messages[error.code] || error.message }, status);
  }
  return json({ error: "ea_sync_failed", message: error?.message || "Não foi possível sincronizar a EA." }, 502);
}

async function authorize(request, env) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session;
  if (!requireTier(session, "dev")) {
    return { error: json({ error: "insufficient_permission", message: "Sincronização EA restrita a Desenvolvimento." }, 403) };
  }
  return session;
}

export async function onRequestGet({ request, env }) {
  const session = await authorize(request, env);
  if (session.error) return session.error;
  try {
    const result = await fetchAllMatches(env);
    const normalized = normalizeEaMatches(result.raw, EA_CLUB_ID);
    const [agenda, importedIds] = await Promise.all([
      loadAgenda(env),
      loadImportedMatchIds(env),
    ]);
    const matches = withAgendaSuggestions(normalized, agenda).map((match) => ({
      ...match,
      alreadyImported: importedIds.has(String(match.id)),
    }));
    return json({
      ok: true,
      matches,
      fetched_at: new Date().toISOString(),
      club_id: EA_CLUB_ID,
      duration_ms: result.durationMs,
      cached: result.cached,
    });
  } catch (error) { return eaError(error); }
}

export async function onRequestPost({ request, env }) {
  const session = await authorize(request, env);
  if (session.error) return session.error;
  const startedAt = Date.now();
  try {
    const body = await request.json().catch(() => null);
    const submitted = Array.isArray(body?.matches) ? body.matches : [];
    const matches = [...new Map(submitted
      .filter((match) => match && String(match.id || "").trim())
      .map((match) => [String(match.id), match])).values()];
    if (!matches.length || matches.length > 10) {
      return json({ error: "invalid_publish_payload", message: "Selecione de 1 a 10 partidas revisadas para publicar." }, 400);
    }
    const report = await supabaseJson(env, "/rest/v1/rpc/sync_fc27_ea_matches", {
      method: "POST",
      body: JSON.stringify({ p_matches: matches, p_actor: session.user.id }),
    });
    console.log(JSON.stringify({ event: "fc27_ea_publish", club_id: EA_CLUB_ID, selected: matches.length, inserted: report?.inserted || 0, updated: report?.updated || 0, skipped: report?.skipped || 0, duration_ms: Date.now() - startedAt }));
    return json({ ok: true, club_id: EA_CLUB_ID, published_at: new Date().toISOString(), duration_ms: Date.now() - startedAt, selected: matches.length, ...report });
  } catch (error) {
    console.error(JSON.stringify({ event: "fc27_ea_publish_error", club_id: EA_CLUB_ID, message: error?.message, duration_ms: Date.now() - startedAt }));
    return eaError(error);
  }
}
