import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { MAX_RESPONSE_BYTES, openProviderPage } from "../../_lib/competition-providers.js";
import { validateProviderPageUrl } from "../../../shared/competition-providers.js";

const messages = {
  provider_timeout: "O provider demorou demais para responder.",
  provider_unavailable: "O provider está indisponível agora.",
  provider_response_too_large: "A resposta do provider excedeu o limite seguro.",
  provider_redirect_limit: "O provider excedeu o limite seguro de redirecionamentos.",
  provider_invalid_redirect: "O provider retornou um redirecionamento inválido.",
  provider_invalid_content_type: "O provider não retornou uma página HTML válida.",
};

/** Lets the page through untouched, stopping it if it grows past the safe size. */
function boundedBody(body) {
  let bytes = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) controller.error(new Error("provider_response_too_large"));
      else controller.enqueue(chunk);
    },
  }));
}

/**
 * One provider page, as text. Dev only, and only addresses of a supported
 * provider page. The page is handed over as it arrives and read in the browser:
 * reading a whole edition here (a dozen pages parsed in one request) is more
 * processing than one request is allowed, and the hosting cut it mid-way.
 */
export async function onRequestGet({ request, env }) {
  // A reading is many of these in a row: the member confirmed a moment ago is not asked about again.
  const session = await authenticateDiscordMember(request, env, { reuseMs: 60_000 });
  if (session.error) return session.error;
  if (!requireTier(session, "dev")) {
    return json({ error: "insufficient_permission", message: "Somente Desenvolvimento pode consultar fontes de competição." }, 403);
  }
  let target;
  try { target = validateProviderPageUrl(new URL(request.url).searchParams.get("url") || ""); }
  catch (error) { return json({ error: "invalid_provider_url", message: error.message }, 422); }
  try {
    const page = await openProviderPage(target);
    return new Response(page.response.body ? boundedBody(page.response.body) : await page.response.text(), {
      headers: {
        // Plain text on purpose: this is data for the parser, never a document to render.
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-provider-url": page.url,
      },
    });
  } catch (error) {
    const code = error.message || "provider_error";
    return json({ error: code, message: messages[code] || (/^provider_http_/.test(code) ? "O provider recusou a página agora." : code) }, /URL|Provider|Página|Tipo|Identificador|HTTPS/.test(code) ? 422 : 502);
  }
}
