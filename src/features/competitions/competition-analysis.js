// Entry points for reading the provider. The reader itself (HTML parser
// included) is loaded only when someone actually analyses a competition.

const reader = () => import("./provider-client.js");

/** One edition as a single preview. `fresh` reads every page again; `onProgress({ done, total })` follows the pages. */
export async function analyzeCompetition(client, url, options = {}) {
  return (await reader()).analyzeCompetition(client, url, options);
}

// The list of tournaments is kept for ten minutes, so adding one after another
// does not query the provider every time. ATUALIZAR reads it again.
const TOURNAMENTS_TTL = 10 * 60 * 1000;
const TOURNAMENTS_KEY = "strix-fc27-ccb-tournaments";
let tournamentsMemory = null;

export function cachedTournaments() {
  let stored = tournamentsMemory;
  if (!stored) {
    try { stored = JSON.parse(window.sessionStorage.getItem(TOURNAMENTS_KEY) || "null"); } catch { stored = null; }
  }
  return stored?.at && Date.now() - stored.at < TOURNAMENTS_TTL && Array.isArray(stored.tournaments) ? stored : null;
}

export async function discoverTournaments(client, { refresh = false } = {}) {
  const cached = refresh ? null : cachedTournaments();
  if (cached) return cached;
  const result = await (await reader()).discoverProviderTournaments(client, "ccb");
  const stored = { at: Date.parse(result.fetchedAt) || Date.now(), tournaments: result.tournaments || [] };
  tournamentsMemory = stored;
  try { window.sessionStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(stored)); } catch { /* private mode: memory is enough */ }
  return stored;
}
