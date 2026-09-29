import { isDev } from "./access.js";

const envLaunchAt =
  typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_LAUNCH_AT;

export const LAUNCH_CONFIG = Object.freeze({
  enabled: true,
  timezone: "America/Sao_Paulo",
  launchAt: String(envLaunchAt || "2026-10-06T20:00:00-03:00"),
});

const OFFICIAL_HOSTS = new Set(["strixunited.com.br"]);
const QA_PREVIEW_HOST = "strix-united-fc27.pages.dev";
export const LAUNCH_RETURN_KEY = "strix-fc27-launch-return";
export const LAUNCH_ACCESS_KEY = "strix-fc27-launch-access-verified";
export const LAUNCH_ACCESS_TTL_MS = 12 * 60 * 60 * 1000;

export function normalizeHostname(hostname = "") {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

export function isQaPreviewHost(hostname) {
  return normalizeHostname(hostname) === QA_PREVIEW_HOST;
}

export function isOfficialLaunchHost(hostname) {
  return OFFICIAL_HOSTS.has(normalizeHostname(hostname));
}

export function canShowInternalAccess(hostname) {
  if (isOfficialLaunchHost(hostname)) return false;
  return isQaPreviewHost(hostname) || isLocalReviewHost(hostname);
}

function isLocalReviewHost(hostname) {
  const host = normalizeHostname(hostname);
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  );
}

export function isLaunchGateHost(hostname) {
  if (isQaPreviewHost(hostname)) return false;
  const host = normalizeHostname(hostname);
  if (host.endsWith(".pages.dev") || host === "pages.dev") return true;
  return isOfficialLaunchHost(hostname) || isLocalReviewHost(hostname);
}

export function parseLaunchAt(config = LAUNCH_CONFIG) {
  const raw = String(config?.launchAt || "").trim();
  if (!raw || raw.toUpperCase() === "TODO/CONFIG") return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isLaunchConfigPending(config = LAUNCH_CONFIG) {
  return parseLaunchAt(config) == null;
}

export function isLaunchUnlocked(now = Date.now(), config = LAUNCH_CONFIG) {
  if (config?.enabled === false) return true;
  const at = parseLaunchAt(config);
  if (at == null) return false;
  return Number(now) >= at;
}

function launchStorage(storage, now = Date.now()) {
  if (isLaunchUnlocked(now)) return null;
  try {
    return storage || globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

export function rememberLaunchAccess(profile, storage, now = Date.now()) {
  const target = launchStorage(storage, now);
  if (!target?.setItem || !isDev(profile) || !profile?.user_id) return false;
  try {
    target.setItem(LAUNCH_ACCESS_KEY, JSON.stringify({ userId: String(profile.user_id), tier: "dev", verifiedAt: Number(now) }));
    return true;
  } catch {
    return false;
  }
}

// This is a rendering hint only. Access is always decided from the live profile.
export function readLaunchAccessVerification(storage, now = Date.now()) {
  const target = launchStorage(storage, now);
  if (!target?.getItem) return null;
  try {
    const value = JSON.parse(target.getItem(LAUNCH_ACCESS_KEY) || "null");
    const age = Number(now) - Number(value?.verifiedAt);
    if (value?.tier !== "dev" || !value?.userId || !Number.isFinite(age) || age < 0 || age > LAUNCH_ACCESS_TTL_MS) {
      target.removeItem?.(LAUNCH_ACCESS_KEY);
      return null;
    }
    return { userId: String(value.userId), verifiedAt: Number(value.verifiedAt) };
  } catch {
    try { target.removeItem?.(LAUNCH_ACCESS_KEY); } catch {}
    return null;
  }
}

export function clearLaunchAccessVerification(storage, now = Date.now()) {
  const target = launchStorage(storage, now);
  if (!target?.removeItem) return false;
  try {
    target.removeItem(LAUNCH_ACCESS_KEY);
    return true;
  } catch {
    return false;
  }
}

export function remainingMs(now = Date.now(), config = LAUNCH_CONFIG) {
  const at = parseLaunchAt(config);
  if (at == null) return Number.POSITIVE_INFINITY;
  return Math.max(0, at - Number(now));
}

export function displayRemainingMs(now = Date.now(), config = LAUNCH_CONFIG) {
  const at = parseLaunchAt(config);
  if (at == null) return 0;
  return Math.max(0, at - Number(now));
}

export function countdownParts(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function rememberLaunchReturn(path, storage = globalThis.sessionStorage) {
  const next = String(path || "").trim();
  if (!storage?.setItem || !next || next === "/") return "";
  storage.setItem(LAUNCH_RETURN_KEY, next);
  return next;
}

export function consumeLaunchReturn(storage = globalThis.sessionStorage) {
  if (!storage?.getItem) return "";
  const next = String(storage.getItem(LAUNCH_RETURN_KEY) || "");
  storage.removeItem(LAUNCH_RETURN_KEY);
  return next;
}

export function launchGateDecision({
  hostname,
  now = Date.now(),
  profile = null,
  sessionUserId = "",
  authLoading = false,
  config = LAUNCH_CONFIG,
} = {}) {
  if (!config?.enabled) return "app";
  if (!isLaunchGateHost(hostname)) return "app";
  if (isLaunchUnlocked(now, config)) return "app";
  const sameVerifiedUser = Boolean(sessionUserId && profile?.user_id && String(sessionUserId) === String(profile.user_id));
  if (isDev(profile) && sameVerifiedUser) return "app";
  if (authLoading) return "bootstrap";
  return "countdown";
}
