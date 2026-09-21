import {
  FC27_CLUB_ID,
  FC27_MATCH_TYPES,
  FC27_MAX_RESULTS,
  FC27_PLATFORM,
  eaMatchesUrl,
  parseEaMatchesPayload,
} from "./fc27-club.js";

const MATCH_TYPES = FC27_MATCH_TYPES;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

export function eaHeaders(random = Math.random) {
  return {
    accept: "application/json",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    origin: "https://www.ea.com",
    referer: "https://www.ea.com/games/ea-sports-fc/clubs/rankings",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent": USER_AGENTS[Math.floor(random() * USER_AGENTS.length)],
    "cache-control": "no-cache",
  };
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createEaGateway({
  fetchImpl = fetch,
  now = Date.now,
  cacheMs = 45_000,
  timeoutMs = 5_000,
  retries = 1,
  random = Math.random,
} = {}) {
  const cache = new Map();
  const inFlight = new Map();

  async function loadType({ clubId, platform, matchType, maxResultCount }) {
    const key = `${clubId}:${platform}:${matchType}:${maxResultCount}`;
    const cached = cache.get(key);
    if (cached && now() - cached.savedAt < cacheMs) return { matches: cached.matches, cached: true };
    if (inFlight.has(key)) return inFlight.get(key);

    const operation = (async () => {
      let lastError;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const url = eaMatchesUrl({ clubId, platform, matchType, maxResultCount });
          const response = await fetchImpl(url, {
            headers: eaHeaders(random),
            signal: controller.signal,
          });
          const text = await response.text();
          let payload;
          try { payload = JSON.parse(text); } catch { payload = null; }
          const matches = parseEaMatchesPayload(payload);
          if (response.ok && Array.isArray(matches)) {
            cache.set(key, { savedAt: now(), matches });
            return { matches, cached: false };
          }
          const error = new Error(`EA respondeu HTTP ${response.status || 502} para ${matchType}.`);
          error.status = response.status || 502;
          error.code = payload && !matches ? "ea_invalid_payload" : payload ? "ea_http_error" : "ea_invalid_payload";
          lastError = error;
          const retryable = [403, 404, 429, 500, 502, 503, 504].includes(error.status) || !payload;
          if (!retryable || attempt === retries) throw error;
        } catch (error) {
          lastError = error;
          if (attempt === retries) throw error;
        } finally {
          clearTimeout(timer);
        }
        await delay(250 * (2 ** attempt));
      }
      throw lastError || new Error("Não foi possível consultar a EA.");
    })().finally(() => inFlight.delete(key));

    inFlight.set(key, operation);
    return operation;
  }

  return async function loadClubMatches({
    clubId = FC27_CLUB_ID,
    platform = FC27_PLATFORM,
    maxResultCount = FC27_MAX_RESULTS,
  } = {}) {
    const startedAt = now();
    const settled = await Promise.all(MATCH_TYPES.map(async (matchType) => {
      try {
        return { matchType, result: await loadType({ clubId, platform, matchType, maxResultCount }), error: null };
      } catch (error) {
        return { matchType, result: { matches: [], cached: false }, error };
      }
    }));
    const failures = settled.filter((item) => item.error);
    if (failures.length === MATCH_TYPES.length) {
      throw failures[0].error;
    }
    return {
      matches: settled.flatMap(({ matchType, result }) => result.matches.map((match) => ({
        ...match,
        _fc27MatchType: matchType,
      }))),
      cached: settled.every(({ result }) => result.cached),
      durationMs: Math.max(0, now() - startedAt),
    };
  };
}
