import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { normalizeEaMatches, suggestAgendaMatches } from "../../../src/features/matches/import-core.js";
import { FC27_CLUB_ID } from "../../../shared/fc27-club.js";

const serviceHeaders = (env) => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
});

function looksLikeHtml(text = "", contentType = "") {
  const type = String(contentType || "").toLowerCase();
  const body = String(text || "").trimStart();
  return type.includes("text/html") || /^<!doctype html/i.test(body) || /^<html[\s>]/i.test(body);
}

function bodyPreview(text = "") {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function readUpstream(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  return {
    ok: response.ok,
    status: response.status,
    contentType,
    payload,
    html: looksLikeHtml(text, contentType),
    preview: bodyPreview(text),
  };
}

function sanitizeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function eaSyncTarget(env) {
  const host = sanitizeHost(env.EA_SYNC_API_URL);
  if (!host) return { host: "", layer: "pages" };
  const layer = host.includes("railway.app")
    ? "railway"
    : host.includes("onrender.com") || host.includes("render.com")
      ? "render"
      : host.includes("localhost") || host.includes("127.0.0.1")
        ? "local"
        : "ea_sync";
  return { host, layer };
}

function upstreamError(upstream, message, layer = "ea_sync") {
  const error = new Error(message);
  error.code = "ea_sync_upstream_error";
  error.layer = layer;
  error.status = 502;
  error.upstreamStatus = upstream.status;
  error.upstreamContentType = String(upstream.contentType || "").split(";")[0] || "unknown";
  error.bodyPreview = upstream.preview;
  return error;
}

async function fetchAllMatches(env) {
  if (!env.EA_SYNC_API_URL || !env.EA_SYNC_API_TOKEN) {
    const error = new Error("O serviço de sincronização da EA não está configurado.");
    error.code = "ea_sync_not_configured";
    error.layer = "pages";
    throw error;
  }
  const target = eaSyncTarget(env);
  const base = new URL(env.EA_SYNC_API_URL);
  if (base.protocol !== "https:") {
    const error = new Error("EA Sync API must use HTTPS.");
    error.code = "ea_sync_not_configured";
    error.layer = "pages";
    throw error;
  }
  const url = new URL("/v1/matches", base);
  url.searchParams.set("clubId", FC27_CLUB_ID);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
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
    const upstream = await readUpstream(response);
    if (upstream.html || !upstream.payload) {
      throw upstreamError(upstream, `${target.layer} respondeu HTML/inválido em vez de JSON.`, target.layer);
    }
    if (!upstream.ok || !upstream.payload.ok || upstream.payload.club_id !== FC27_CLUB_ID || !Array.isArray(upstream.payload.matches)) {
      const error = new Error(upstream.payload.message || `${target.layer} respondeu HTTP ${upstream.status}.`);
      error.code = upstream.payload.error || "ea_sync_upstream_error";
      error.layer = target.layer;
      error.status = upstream.status === 429 ? 429 : 502;
      error.upstreamStatus = upstream.status;
      error.upstreamContentType = String(upstream.contentType || "").split(";")[0] || "application/json";
      error.bodyPreview = upstream.preview;
      throw error;
    }
    return {
      raw: upstream.payload.matches,
      durationMs: Number(upstream.payload.duration_ms || 0),
      cached: Boolean(upstream.payload.cached),
    };
  } catch (error) {
    if (error?.layer || error?.name === "AbortError") throw error;
    const target = eaSyncTarget(env);
    const wrapped = new Error(`${target.layer || "ea_sync"} não respondeu.`);
    wrapped.code = "ea_sync_upstream_error";
    wrapped.layer = target.layer || "ea_sync";
    wrapped.status = 502;
    wrapped.upstreamStatus = 502;
    wrapped.upstreamContentType = "unknown";
    wrapped.bodyPreview = String(error?.message || "").slice(0, 180);
    throw wrapped;
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
  const upstream = await readUpstream(response);
  if (!response.ok) {
    const error = new Error(upstream.payload?.message || upstream.payload?.hint || `Supabase respondeu HTTP ${response.status}.`);
    error.status = response.status;
    error.layer = "pages";
    throw error;
  }
  return upstream.payload;
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
  const layer = error?.layer || (error?.name === "AbortError" ? "ea_sync" : "pages");
  if (error?.name === "AbortError") {
    return json({
      error: "ea_timeout",
      layer: "ea_sync",
      message: "SYNC INDISPONÍVEL. O serviço de sincronização da EA não respondeu a tempo.",
    }, 504);
  }
  const status = error.status === 429 ? 429 : 502;
  const messages = {
    ea_rate_limited: "A EA limitou temporariamente as consultas. Tente novamente em instantes.",
    ea_invalid_payload: "A EA respondeu com conteúdo inválido em vez de JSON.",
    ea_sync_not_configured: "O serviço de sincronização da EA não está configurado nas Pages.",
    ea_sync_invalid_response: "O serviço de sincronização respondeu com conteúdo inválido.",
    ea_sync_upstream_error: error.message || "O serviço de sincronização respondeu HTML ou JSON inválido.",
    unsupported_club: "O serviço de sincronização recusou o clube FC27 atual.",
  };
  return json({
    error: error?.code || "ea_sync_failed",
    layer,
    message: messages[error?.code] || error?.message || "Não foi possível sincronizar a EA.",
    upstreamStatus: error.upstreamStatus || error.status || status,
    upstreamContentType: error.upstreamContentType || "",
    bodyPreview: error.bodyPreview || "",
  }, status);
}

async function authorize(request, env) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session;
  if (!requireTier(session, "dev")) {
    return { error: json({ error: "insufficient_permission", layer: "pages", message: "Sincronização EA restrita a Desenvolvimento." }, 403) };
  }
  return session;
}

export async function onRequestGet({ request, env }) {
  try {
    const session = await authorize(request, env);
    if (session.error) return session.error;
    const result = await fetchAllMatches(env);
    const normalized = normalizeEaMatches(result.raw, FC27_CLUB_ID);
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
      club_id: FC27_CLUB_ID,
      duration_ms: result.durationMs,
      cached: result.cached,
      layer: "ea",
    });
  } catch (error) {
    return eaError(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const session = await authorize(request, env);
    if (session.error) return session.error;
    const startedAt = Date.now();
    const body = await request.json().catch(() => null);
    const submitted = Array.isArray(body?.matches) ? body.matches : [];
    const matches = [...new Map(submitted
      .filter((match) => match && String(match.id || "").trim())
      .map((match) => [String(match.id), match])).values()];
    if (!matches.length || matches.length > 10) {
      return json({ error: "invalid_publish_payload", layer: "pages", message: "Selecione de 1 a 10 partidas revisadas para publicar." }, 400);
    }
    const report = await supabaseJson(env, "/rest/v1/rpc/sync_fc27_ea_matches", {
      method: "POST",
      body: JSON.stringify({ p_matches: matches, p_actor: session.user.id }),
    });
    console.log(JSON.stringify({ event: "fc27_ea_publish", club_id: FC27_CLUB_ID, selected: matches.length, inserted: report?.inserted || 0, updated: report?.updated || 0, skipped: report?.skipped || 0, duration_ms: Date.now() - startedAt }));
    return json({ ok: true, club_id: FC27_CLUB_ID, layer: "pages", published_at: new Date().toISOString(), duration_ms: Date.now() - startedAt, selected: matches.length, ...report });
  } catch (error) {
    console.error(JSON.stringify({ event: "fc27_ea_publish_error", club_id: FC27_CLUB_ID, message: error?.message }));
    return eaError(error);
  }
}
