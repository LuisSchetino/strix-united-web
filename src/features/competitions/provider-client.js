import { parseCompetitionHtml } from "../../../shared/competition-providers.js";
import { assembleCompetitionBundle, discoverTournaments } from "../../../shared/competition-bundle.js";

// The provider is read one page per request and put together here, in the
// browser. Each request does almost nothing on the server, so the hosting's
// processing limit is never the reason an analysis fails; a page that fails is
// asked again on its own, and pages already read are not asked twice.

const PAGE_TTL = 2 * 60 * 1000;
const ATTEMPTS = 3;
const pages = new Map();

const wait = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });
const HOSTING_BUSY = "O servidor não respondeu agora. Aguarde alguns segundos e tente de novo.";

// Refusals that come from checking who is asking, not from the organiser's site.
const ACCESS_MESSAGES = Object.freeze({
  discord_lookup_unavailable: "O Discord não respondeu à conferência de acesso agora. Tente de novo em alguns segundos.",
  invalid_session: "Sua sessão expirou. Recarregue a página e entre de novo.",
  authentication_required: "Sua sessão expirou. Recarregue a página e entre de novo.",
  not_in_team_server: "Essa conta não está mais no servidor do Strix.",
  discord_role_unmapped: "Sua conta está sem um cargo que libere esta ação.",
  trial_access_closed: "Jogadores em teste não têm acesso a esta ação.",
});

class PageError extends Error {
  constructor(message, { retry = true } = {}) {
    super(message);
    this.retry = retry;
  }
}

async function requestPage(client, url) {
  const { data } = await client.auth.getSession();
  let response;
  try {
    response = await fetch(`/api/competitions/page?url=${encodeURIComponent(url)}`, {
      headers: { authorization: `Bearer ${data.session?.access_token || ""}` },
      cache: "no-store",
    });
  } catch {
    throw new PageError("Sem conexão com o servidor agora.");
  }
  const text = await response.text();
  if (response.ok && response.headers.get("x-provider-url")) return { html: text, url: response.headers.get("x-provider-url") };
  let payload = null;
  try { payload = JSON.parse(text); } catch { /* the hosting's own error page */ }
  if (!payload) throw new PageError(HOSTING_BUSY);
  // A refused address or a missing permission will not change by asking again.
  throw new PageError(payload.message || ACCESS_MESSAGES[payload.error] || payload.error || "Não foi possível ler a página do provider.", { retry: response.status >= 500 || response.status === 429 });
}

/** One provider page as HTML, retried with a growing pause. `fresh` skips the short memory of pages just read. */
async function loadPage(client, url, { fresh = false } = {}) {
  const key = String(url).split("#")[0];
  const known = pages.get(key);
  if (!fresh && known && Date.now() - known.at < PAGE_TTL) return known;
  let failure;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (attempt) await wait(700 * attempt * attempt);
    try {
      const page = { ...(await requestPage(client, key)), at: Date.now() };
      pages.set(key, page);
      return page;
    } catch (error) {
      failure = error;
      if (!error.retry) break;
    }
  }
  throw failure;
}

/**
 * One edition as a single preview. Pages read in the last two minutes are
 * reused, so analysing again after a partial read only asks for what failed;
 * `fresh` reads everything again (the ATUALIZAR of a saved competition).
 */
export async function analyzeCompetition(client, url, { onProgress, fresh = false } = {}) {
  const loadPreview = async (target) => {
    const page = await loadPage(client, target, { fresh });
    return { ...parseCompetitionHtml(page.html, page.url), security: { fetchedUrl: page.url } };
  };
  return assembleCompetitionBundle(url, loadPreview, { concurrency: 2, onProgress });
}

/** Tournaments in progress on the provider, with the ones Strix plays marked. */
export async function discoverProviderTournaments(client, provider = "ccb") {
  return discoverTournaments(provider, async (target) => (await loadPage(client, target, { fresh: true })).html, { concurrency: 2 });
}
