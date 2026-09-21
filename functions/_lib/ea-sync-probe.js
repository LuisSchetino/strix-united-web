import { FC27_CLUB_ID, FC27_PLATFORM } from "../../shared/fc27-club.js";

export function sanitizeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function looksLikeHtml(text = "", contentType = "") {
  const type = String(contentType || "").toLowerCase();
  const body = String(text || "").trimStart();
  return type.includes("text/html") || /^<!doctype html/i.test(body) || /^<html[\s>]/i.test(body);
}

export async function probeEaSyncHealth(env) {
  if (!env.EA_SYNC_API_URL) {
    return {
      configured: false,
      host: "",
      reachable: false,
      health: "missing_url",
      status: 0,
      contentType: "",
      durationMs: 0,
      service: { clubId: FC27_CLUB_ID, platform: FC27_PLATFORM },
    };
  }
  const host = sanitizeHost(env.EA_SYNC_API_URL);
  let healthUrl;
  try {
    healthUrl = new URL("/health", env.EA_SYNC_API_URL);
  } catch {
    return {
      configured: true,
      host,
      reachable: false,
      health: "invalid_url",
      status: 0,
      contentType: "",
      durationMs: 0,
      service: { clubId: FC27_CLUB_ID, platform: FC27_PLATFORM },
    };
  }
  const started = Date.now();
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const contentType = String(response.headers.get("content-type") || "").split(";")[0];
    const text = await response.text();
    const html = looksLikeHtml(text, contentType);
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    return {
      configured: true,
      host,
      reachable: response.ok && !html && Boolean(payload?.ok),
      health: html ? "html" : (response.ok && payload?.ok ? "ok" : "error"),
      status: response.status,
      contentType: contentType || "unknown",
      durationMs: Date.now() - started,
      service: {
        clubId: payload?.club_id || FC27_CLUB_ID,
        platform: payload?.platform || FC27_PLATFORM,
        name: payload?.service || "",
      },
    };
  } catch (error) {
    return {
      configured: true,
      host,
      reachable: false,
      health: "unreachable",
      status: 0,
      contentType: "unknown",
      durationMs: Date.now() - started,
      error: String(error?.message || "unreachable").slice(0, 80),
      service: { clubId: FC27_CLUB_ID, platform: FC27_PLATFORM },
    };
  }
}

export async function probeEaSyncMatches(env) {
  const host = sanitizeHost(env.EA_SYNC_API_URL);
  if (!env.EA_SYNC_API_URL || !env.EA_SYNC_API_TOKEN) {
    return {
      configured: Boolean(env.EA_SYNC_API_URL),
      host,
      reachable: false,
      status: 0,
      contentType: "",
      durationMs: 0,
      error: "missing_token_or_url",
    };
  }
  let url;
  try {
    url = new URL("/v1/matches", env.EA_SYNC_API_URL);
    url.searchParams.set("clubId", FC27_CLUB_ID);
    url.searchParams.set("platform", FC27_PLATFORM);
  } catch {
    return { configured: true, host, reachable: false, status: 0, contentType: "", durationMs: 0, error: "invalid_url" };
  }
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${env.EA_SYNC_API_TOKEN}`,
      },
      cache: "no-store",
    });
    const contentType = String(response.headers.get("content-type") || "").split(";")[0];
    const text = await response.text();
    const html = looksLikeHtml(text, contentType);
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    return {
      configured: true,
      host,
      reachable: !html && Boolean(payload),
      status: response.status,
      contentType: contentType || "unknown",
      durationMs: Date.now() - started,
      html,
      ok: Boolean(payload?.ok),
      matchCount: Array.isArray(payload?.matches) ? payload.matches.length : 0,
      clubId: payload?.club_id || "",
      platform: payload?.platform || "",
    };
  } catch (error) {
    return {
      configured: true,
      host,
      reachable: false,
      status: 0,
      contentType: "unknown",
      durationMs: Date.now() - started,
      error: String(error?.message || "unreachable").slice(0, 80),
    };
  }
}
