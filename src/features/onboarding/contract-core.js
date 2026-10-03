// Contrato de vínculo FC27: regras puras (identidade, assinatura, persistência).
//
// ONDE O ACEITE MORA — e o que isso significa (auditoria):
//   • auth.users.raw_user_meta_data, lido como session.user.user_metadata.
//   • É gravável pelo PRÓPRIO usuário (auth.updateUser). Portanto é estado de UX
//     ("já assinou, não mostre de novo"), NÃO um registro confiável. `signedAt`
//     vem do cliente. Nada na ACL, no Launch Gate ou no backend lê este campo.
//   • Viaja dentro do JWT (claim user_metadata). Por isso o payload é mínimo:
//     só temporada, versão, data e o traço vetorial. Nome e @ NÃO são guardados
//     (já existem em team_members / no Discord).
//   • Se o clube precisar de um registro auditável (quem assinou, quando), o
//     lugar certo é uma coluna em team_members escrita por uma Pages Function
//     com service role. Isso exige migration e não é necessário para o gate.

export const CONTRACT_SEASON = "2026/27";
export const CONTRACT_VERSION = 1;
export const CONTRACT_METADATA_KEY = "fc27_contract";
export const SIGNATURE_VIEWBOX = Object.freeze({ width: 600, height: 200 });
// Teto do traço dentro do JWT. Reduzido de 2400: um traço legível cabe com folga.
export const SIGNATURE_PATH_LIMIT = 1800;
export const MIN_SIGNATURE_POINTS = 14;
export const MIN_SIGNATURE_EXTENT = 48;

export const CONTRACT_COMMITMENT = "Declaro estar ciente das regras, compromissos e responsabilidades do Strix United FC27 e confirmo minha participação na temporada.";

const text = (value) => String(value ?? "").trim();
const normalize = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function normalizeHandle(value) {
  const clean = text(value).replace(/^@+/, "").replace(/\s+/g, "").toLocaleLowerCase("pt-BR");
  return clean ? `@${clean}` : "";
}

export function readContract(user) {
  const contract = user?.user_metadata?.[CONTRACT_METADATA_KEY];
  return contract && typeof contract === "object" ? contract : null;
}

export function hasSignedContract(user, season = CONTRACT_SEASON) {
  const contract = readContract(user);
  if (!contract) return false;
  if (contract.season !== season) return false;
  if (!Number.isFinite(Date.parse(contract.signedAt))) return false;
  return typeof contract.signature?.d === "string" && contract.signature.d.startsWith("M");
}

const ROLE_LABELS = Object.freeze({
  jogador: "JOGADOR", staff: "STAFF", diretoria: "DIRETORIA", conselho: "CONSELHO", manager: "MANAGER",
});

function identityMetadata(user) {
  const meta = user?.user_metadata || {};
  const identity = (user?.identities || []).find((item) => String(item?.provider).toLowerCase() === "discord");
  const data = identity?.identity_data || {};
  return { meta, data };
}

/** Prioridade: identidade autenticada → perfil Strix → workspace.players → fallback. */
export function resolveContractIdentity({ session, profile, players = [] } = {}) {
  const user = session?.user;
  const { meta, data } = identityMetadata(user);
  const handleRaw = [meta.user_name, meta.preferred_username, data.user_name, data.preferred_username, meta.name, data.name, meta.full_name, data.full_name]
    .map(text).find(Boolean) || "";
  const handle = normalizeHandle(handleRaw.split("#")[0]);
  const authName = [meta.custom_claims?.global_name, data.custom_claims?.global_name].map(text).find(Boolean) || "";
  const name = authName || text(profile?.display_name) || [meta.full_name, meta.name, data.full_name, data.name].map(text).find(Boolean) || "";

  const keys = new Set([name, authName, profile?.display_name, handleRaw.split("#")[0]].map(normalize).filter(Boolean));
  const player = (players || []).find((item) => item?.is_active !== false && keys.has(normalize(item.display_name)));
  const positions = Array.isArray(player?.positions) ? player.positions.filter(Boolean) : [];
  const role = ROLE_LABELS[normalize(player?.structure_role)] || "";
  const func = [positions.join(" · "), role].filter(Boolean).join(" · ");

  return {
    name: (name || text(player?.display_name) || "MEMBRO STRIX").toLocaleUpperCase("pt-BR"),
    handle,
    role: func,
    avatar: text(meta.avatar_url || profile?.avatar_url || data.avatar_url),
  };
}

export function strokePointCount(strokes) {
  return (strokes || []).reduce((sum, stroke) => sum + (stroke?.length || 0), 0);
}

export function signatureExtent(strokes) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const stroke of strokes || []) for (const [x, y] of stroke) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return 0;
  return Math.max(maxX - minX, maxY - minY);
}

/** Um ponto ou um risco curtinho não é uma assinatura. */
export function isMeaningfulSignature(strokes) {
  return strokePointCount(strokes) >= MIN_SIGNATURE_POINTS && signatureExtent(strokes) >= MIN_SIGNATURE_EXTENT;
}

function decimate(stroke, minDistance) {
  const out = [];
  let last = null;
  stroke.forEach(([x, y], index) => {
    const px = Math.round(x); const py = Math.round(y);
    const isEnd = index === stroke.length - 1;
    if (!last || isEnd || Math.hypot(px - last[0], py - last[1]) >= minDistance) {
      if (!last || px !== last[0] || py !== last[1]) { out.push([px, py]); last = [px, py]; }
    }
  });
  return out;
}

/** Strokes normalizados (viewBox 600×200) → `d` compacto, sempre ≤ SIGNATURE_PATH_LIMIT. */
export function strokesToPath(strokes, limit = SIGNATURE_PATH_LIMIT) {
  const valid = (strokes || []).filter((stroke) => stroke?.length);
  if (!valid.length) return "";
  for (let distance = 2; distance <= 40; distance += 1.5) {
    const parts = valid.map((stroke) => {
      const points = decimate(stroke, distance);
      if (points.length === 1) points.push([points[0][0] + 1, points[0][1]]);
      return points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join("");
    });
    const d = parts.join("");
    if (d.length <= limit) return d;
  }
  // Rabisco muito longo: amostragem uniforme por traço, sempre dentro do limite.
  const perStroke = Math.max(2, Math.floor(limit / (valid.length * 9)));
  const sampled = valid.map((stroke) => {
    if (stroke.length <= perStroke) return stroke;
    return Array.from({ length: perStroke }, (_, index) => stroke[Math.round((index * (stroke.length - 1)) / (perStroke - 1))]);
  });
  const d = sampled.map((stroke) => {
    const points = decimate(stroke, 0);
    if (points.length === 1) points.push([points[0][0] + 1, points[0][1]]);
    return points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join("");
  }).join("");
  return d.length <= limit ? d : "";
}

/** Payload mínimo: nome e @ ficam de fora de propósito (já existem em team_members e no Discord). */
export function buildContractPayload({ strokes, now = new Date() }) {
  const d = strokesToPath(strokes);
  if (!d) throw new Error("signature_empty");
  return {
    season: CONTRACT_SEASON,
    version: CONTRACT_VERSION,
    signedAt: now.toISOString(),
    signature: { w: SIGNATURE_VIEWBOX.width, h: SIGNATURE_VIEWBOX.height, d },
  };
}

export function contractDateLabel(now = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" })
    .format(now).toLocaleUpperCase("pt-BR");
}

/**
 * Identificador do documento: derivado do próprio aceite (temporada, data e
 * traço), então o mesmo contrato sempre mostra o mesmo número. Não é um
 * registro de servidor — serve para o vínculo e o PDF citarem o mesmo papel.
 */
export function contractDocumentId(contract) {
  if (!contract?.signature?.d || !contract?.signedAt) return "";
  const source = `${contract.season}|${contract.signedAt}|${contract.signature.d}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const season = String(contract.season || CONTRACT_SEASON).replace(/\D/g, "").slice(2, 4) + String(contract.season || CONTRACT_SEASON).replace(/\D/g, "").slice(-2);
  return `STX-${season}-${hash.toString(16).toUpperCase().padStart(8, "0").slice(0, 6)}`;
}
