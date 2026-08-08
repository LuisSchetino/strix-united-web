import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";

const EA_MATCHES_URL =
  "https://proclubs.ea.com/api/fc/clubs/matches?platform=common-gen5&clubIds=15686&matchType=friendlyMatch&maxResultCount=10";

export async function onRequestGet({ request, env }) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  if (!requireTier(session, "diretoria")) {
    return json({ error: "insufficient_permission", message: "Importacao EA restrita a Diretoria e Desenvolvimento." }, 403);
  }

  let upstream;
  try {
    upstream = await fetch(EA_MATCHES_URL, {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
        referer: "https://proclubs.ea.com/",
      },
      cache: "no-store",
    });
  } catch {
    return json({ error: "ea_unreachable", message: "A API da EA nao respondeu. Tente novamente em alguns instantes." }, 502);
  }

  if (!upstream.ok) {
    return json({
      error: "ea_upstream_rejected",
      message: `A EA recusou a consulta agora (HTTP ${upstream.status}). Nenhuma partida foi importada.`,
    }, 502);
  }
  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "ea_invalid_payload", message: "A EA respondeu sem dados de partidas validos." }, 502);
  }
  const matches = Array.isArray(payload) ? payload : Array.isArray(payload?.matches) ? payload.matches : [];
  return json({ matches, fetched_at: new Date().toISOString(), club_id: "15686" });
}
