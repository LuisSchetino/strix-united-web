import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { fetchCompetitionPreview } from "../../_lib/competition-providers.js";

const messages = {
  provider_timeout: "O provider demorou demais para responder.",
  provider_unavailable: "O provider está indisponível agora.",
  provider_response_too_large: "A resposta do provider excedeu o limite seguro.",
  provider_redirect_limit: "O provider excedeu o limite seguro de redirecionamentos.",
  provider_invalid_redirect: "O provider retornou um redirecionamento inválido.",
  provider_invalid_content_type: "O provider não retornou uma página HTML válida.",
};

export async function onRequestPost({ request, env }) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  if (!requireTier(session, "dev")) {
    return json({ error: "insufficient_permission", message: "Somente Desenvolvimento pode importar fontes de competição." }, 403);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body?.url || typeof body.url !== "string") return json({ error: "url_required", message: "Informe a URL da competição." }, 422);
  try {
    const preview = await fetchCompetitionPreview(body.url);
    return json({ preview });
  } catch (error) {
    const message = messages[error.message] || error.message || "Não foi possível analisar a competição.";
    const status = /^provider_http_/.test(error.message) ? 502 : /URL|Provider|página|Identificador|HTTPS|porta/.test(message) ? 422 : 502;
    return json({ error: error.message || "provider_error", message }, status);
  }
}
