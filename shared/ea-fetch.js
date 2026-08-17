export class EaFetchError extends Error {
  constructor(message, { status = 502, code = "ea_unreachable", retryable = false } = {}) {
    super(message);
    this.name = "EaFetchError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createEaMatchLoader({ fetchImpl = fetch, url, timeoutMs = 10000, cacheMs = 5000, now = Date.now, retries = 1 } = {}) {
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
        let response;
        let text = "";
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          response = await fetchImpl(url, {
            headers: {
              accept: "application/json, text/plain, */*",
              "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
              origin: "https://proclubs.ea.com",
              referer: "https://proclubs.ea.com/",
              "user-agent": "Mozilla/5.0 (compatible; StrixUnitedFC27/1.0)",
            },
            cache: "no-store",
            signal: controller.signal,
          });
          text = await response.text();
          if (![429, 500, 502, 503, 504].includes(response.status) || attempt === retries) break;
          await wait(Math.min(500, 150 * (attempt + 1)));
        }
        let payload;
        try { payload = JSON.parse(text); } catch { payload = null; }
        if (!response.ok) {
          const status = response.status || 502;
          const code = status === 403 ? "ea_forbidden" : status === 429 ? "ea_rate_limited" : "ea_http_error";
          throw new EaFetchError(`EA respondeu HTTP ${status}.`, { status, code, retryable: status === 429 || status >= 500 });
        }
        if (!payload) throw new EaFetchError("A EA respondeu HTML ou conteúdo não JSON.", { code: "ea_invalid_payload" });
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
