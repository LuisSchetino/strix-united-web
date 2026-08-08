export function createEaMatchLoader({ fetchImpl = fetch, url, timeoutMs = 9000, cacheMs = 2500, now = Date.now } = {}) {
  let inFlight = null;
  let cached = null;

  return async function loadEaMatches() {
    if (cached && now() - cached.savedAt < cacheMs) return { ...cached.result, cached: true };
    if (inFlight) return inFlight;
    const started = now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    inFlight = (async () => {
      try {
        const response = await fetchImpl(url, {
          headers: { accept: "application/json, text/plain, */*", "accept-language": "pt-BR,pt;q=0.9,en;q=0.8", referer: "https://proclubs.ea.com/" },
          cache: "no-store",
          signal: controller.signal,
        });
        const text = await response.text();
        let payload;
        try { payload = JSON.parse(text); } catch { payload = null; }
        if (!response.ok || !payload) {
          const error = new Error(payload ? `EA respondeu HTTP ${response.status}.` : "A EA respondeu sem JSON válido.");
          error.status = response.status || 502;
          throw error;
        }
        const matches = Array.isArray(payload) ? payload : Array.isArray(payload.matches) ? payload.matches : [];
        const result = { matches, durationMs: Math.max(0, now() - started), cached: false };
        cached = { savedAt: now(), result };
        return result;
      } finally {
        clearTimeout(timer);
        inFlight = null;
      }
    })();
    return inFlight;
  };
}
