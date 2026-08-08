import { authenticateDiscordMember, json, requireTier } from "../../_lib/auth.js";
import { createEaMatchLoader } from "../../../shared/ea-fetch.js";

const EA_MATCHES_URL =
  "https://proclubs.ea.com/api/fc/clubs/matches?platform=common-gen5&clubIds=15686&matchType=friendlyMatch&maxResultCount=10";
const loadEaMatches = createEaMatchLoader({ url: EA_MATCHES_URL });

export async function onRequestGet({ request, env }) {
  const session = await authenticateDiscordMember(request, env);
  if (session.error) return session.error;
  if (!requireTier(session, "diretoria")) {
    return json({ error: "insufficient_permission", message: "Importacao EA restrita a Diretoria e Desenvolvimento." }, 403);
  }

  try {
    const result = await loadEaMatches();
    return json({ matches: result.matches, fetched_at: new Date().toISOString(), club_id: "15686", duration_ms: result.durationMs, cached: result.cached });
  } catch (error) {
    return json({ error: "ea_unreachable", message: error.name === "AbortError" ? "A EA excedeu 9 segundos para responder." : "A API da EA nao respondeu. Tente novamente em alguns instantes." }, 502);
  }
}
