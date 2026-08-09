export const EA_CLUB_ID = "15686";

export const normalizeName = (value) => String(value || "")
  .trim()
  .toLocaleLowerCase("pt-BR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const asEntries = (value) => Array.isArray(value)
  ? value
  : value && typeof value === "object"
    ? Object.entries(value).map(([key, item]) => ({ ...(item || {}), _eaKey: key }))
    : [];

const asClubEntries = (raw) => {
  const clubs = raw?.clubs || raw?.club || raw?.clubData || {};
  return Array.isArray(clubs)
    ? clubs
    : Object.entries(clubs).map(([key, value]) => ({ ...value, _clubKey: key }));
};

const readNumber = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return null;
};

const clubName = (club, fallback) => club?.name
  || club?.clubName
  || club?.clubInfo?.name
  || club?.details?.name
  || fallback;

const clubGoals = (club) => {
  const value = club?.goals ?? club?.score ?? club?.clubGoals ?? 0;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
};

const matchDate = (raw) => {
  const candidate = raw?.timestamp ?? raw?.matchTimestamp ?? raw?.date ?? raw?.time ?? raw?.createdAt;
  if (typeof candidate === "number" || /^\d{10,13}$/.test(String(candidate || ""))) {
    const numeric = Number(candidate);
    return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
  }
  const parsed = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export function eaPlayerRows(raw, clubId = EA_CLUB_ID) {
  const team = raw?.players?.[clubId]
    || raw?.playerStats?.[clubId]
    || raw?.details?.players?.[clubId]
    || raw?.details?.[clubId]?.players
    || raw?.players;
  return asEntries(team)
    .filter((player) => player && typeof player === "object")
    .map((player) => {
      const stats = player.stats || player.matchStats || player;
      const passesMade = readNumber(stats, ["passesmade", "passesMade", "passSuccess", "passes"]);
      const passesAttempts = readNumber(stats, ["passattempts", "passesAttempted", "passAttempts", "passesAttempt"]);
      const goals = readNumber(stats, ["goals", "goal"]) || 0;
      const assists = readNumber(stats, ["assists", "assist"]) || 0;
      const name = player.playername || player.name || player.playerName || player.personaName || player._eaKey;
      return {
        id: String(player.playerId || player.personaId || player._eaKey || name),
        eaName: name,
        name,
        position: player.pos || player.position || player.positionAbbr || "",
        rating: readNumber(stats, ["rating", "ratingAverage", "matchRating", "ratingValue"]),
        goals,
        assists,
        passesMade,
        passesAttempts,
        passes: passesMade === null ? null : passesAttempts ? `${passesMade}/${passesAttempts}` : passesMade,
        shots: readNumber(stats, ["shots", "shotsOnTarget", "shotAttempts"]),
        tackles: readNumber(stats, ["tacklesmade", "tacklesMade", "tackles", "tackleSuccess"]),
        saves: readNumber(stats, ["saves", "goalkeeperSaves"]),
      };
    })
    .filter((player) => player.eaName && player.eaName !== clubId);
}

export function eaPerformance(raw, strix, clubId = EA_CLUB_ID) {
  const stats = raw?.aggregateStats?.[clubId]
    || raw?.aggregate?.[clubId]
    || raw?.stats?.[clubId]
    || strix?.stats
    || strix?.details
    || {};
  const players = eaPlayerRows(raw, clubId);
  const sum = (key) => {
    const values = players.map((player) => player[key]).filter(Number.isFinite);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const ratings = players.map((player) => player.rating).filter(Number.isFinite);
  const passesMade = readNumber(stats, ["passesmade", "passesMade", "passes", "passSuccess"]) ?? sum("passesMade");
  const passesAttempts = readNumber(stats, ["passattempts", "passesAttempted", "passAttempts", "passesAttempt"]) ?? sum("passesAttempts");
  return {
    passes: passesMade === null ? null : passesAttempts ? `${passesMade}/${passesAttempts}` : passesMade,
    shots: readNumber(stats, ["shots", "shotsOnTarget", "shotAttempts"]) ?? sum("shots"),
    tackles: readNumber(stats, ["tacklesmade", "tacklesMade", "tackles", "tackleSuccess"]) ?? sum("tackles"),
    goalkeeperSaves: readNumber(stats, ["goalkeeperSaves", "saves"]) ?? sum("saves"),
    averageRating: ratings.length
      ? Number((ratings.reduce((total, value) => total + value, 0) / ratings.length).toFixed(1))
      : null,
    players,
  };
}

export function normalizeEaMatch(raw, index = 0, clubId = EA_CLUB_ID) {
  const clubs = asClubEntries(raw);
  const strix = clubs.find((club) => String(club?.clubId || club?.id || club?._clubKey) === clubId)
    || clubs[0]
    || {};
  const opponent = clubs.find((club) => club !== strix) || {};
  const date = matchDate(raw);
  const performance = eaPerformance(raw, strix, clubId);
  const goalScorers = performance.players.flatMap((player) =>
    Array.from({ length: Math.max(0, Number(player.goals) || 0) }, () => player.eaName));
  return {
    id: String(raw?.matchId || raw?.id || raw?.gameId || `${date.getTime()}-${index}`),
    date: date.toISOString(),
    dateLabel: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }),
    timeLabel: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
    opponent: clubName(opponent, "Adversário EA"),
    strixScore: clubGoals(strix),
    opponentScore: clubGoals(opponent),
    competition: "Amistoso",
    agendaId: "",
    performance,
    goalScorers,
    raw,
  };
}

export const resultLabel = (match) => Number(match.strixScore) > Number(match.opponentScore)
  ? "VITÓRIA"
  : Number(match.strixScore) < Number(match.opponentScore)
    ? "DERROTA"
    : "EMPATE";

const localDay = (value) => new Intl.DateTimeFormat("sv-SE", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo",
}).format(new Date(value));

const CLUB_SUFFIXES = new Set([
  "fc", "fv", "es", "ec", "sc", "afc", "clube", "club", "esports", "esport", "e", "sports",
]);

export const normalizeClubName = (value) => normalizeName(value)
  .split(" ")
  .filter((token) => token && !CLUB_SUFFIXES.has(token))
  .join(" ");

const clubTokens = (value) => normalizeClubName(value).split(" ").filter(Boolean);

function rankAgendaCandidates(match, agenda = []) {
  const matchTime = new Date(match.date).getTime();
  const canonicalOpponent = normalizeClubName(match.opponent);
  const opponentTokens = clubTokens(match.opponent);
  if (canonicalOpponent.length < 3) return [];
  const candidates = (Array.isArray(agenda) ? agenda : [])
    .filter((entry) => !["cancelled", "completed"].includes(entry.status))
    .map((entry) => {
      const agendaTime = new Date(entry.scheduled_at).getTime();
      const canonicalAgenda = normalizeClubName(entry.opponent_name);
      const agendaTokens = clubTokens(entry.opponent_name);
      const intersection = opponentTokens.filter((token) => agendaTokens.includes(token));
      const tokenSimilarity = intersection.length / Math.max(1, new Set([...opponentTokens, ...agendaTokens]).size);
      const exactName = canonicalOpponent === canonicalAgenda;
      const safeContainment = Math.min(canonicalOpponent.length, canonicalAgenda.length) >= 5
        && (canonicalOpponent.includes(canonicalAgenda) || canonicalAgenda.includes(canonicalOpponent));
      const strongName = exactName || safeContainment || (tokenSimilarity >= .75 && intersection.join("").length >= 5);
      const possibleName = strongName || (tokenSimilarity >= .5 && intersection.join("").length >= 6);
      if (!possibleName) return null;
      const sameDay = localDay(match.date) === localDay(entry.scheduled_at);
      const minutes = Math.abs(matchTime - agendaTime) / 60000;
      const confidence = strongName && sameDay && minutes <= 180 ? "strong"
        : strongName ? "probable"
          : "possible";
      const score = (exactName ? 100 : strongName ? 82 : 58) + (sameDay ? 18 : 0) + (minutes <= 30 ? 12 : minutes <= 180 ? 5 : 0);
      const reason = confidence === "strong"
        ? "Adversário, data e horário compatíveis"
        : strongName && !sameDay
          ? "Adversário compatível · data diferente"
          : strongName
            ? "Adversário compatível · horário diferente"
            : "Nome semelhante · confirme antes de vincular";
      return { entry, confidence, autoLink: false, reason, score, minutes };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.minutes - right.minutes);
  return candidates;
}

export function suggestAgendaCandidate(match, agenda = []) {
  const candidates = rankAgendaCandidates(match, agenda) || [];
  const relevant = candidates.filter((candidate) => ["strong", "probable"].includes(candidate.confidence));
  const best = candidates[0] || null;
  return best ? { ...best, autoLink: relevant.length === 1 && relevant[0] === best } : null;
}

export function suggestAgendaMatch(match, agenda = []) {
  return suggestAgendaCandidate(match, agenda)?.entry || null;
}

export function suggestAgendaMatches(matches = [], agenda = []) {
  const reserved = new Set();
  return [...(Array.isArray(matches) ? matches : [])]
    .sort((left, right) => new Date(left.date) - new Date(right.date))
    .reduce((suggestions, match) => {
      const suggestion = suggestAgendaCandidate(match, (Array.isArray(agenda) ? agenda : []).filter((entry) => !reserved.has(entry.id)));
      if (suggestion?.autoLink) reserved.add(suggestion.entry.id);
      suggestions.set(match.id, suggestion ? { ...suggestion.entry, suggestion } : null);
      return suggestions;
    }, new Map());
}

export function aliasLookup(aliases = []) {
  return new Map((Array.isArray(aliases) ? aliases : []).map((alias) => [normalizeName(alias.ea_name), alias.player_id]));
}

export function resolvePlayerAliases(matches = [], players = [], aliases = []) {
  const remembered = aliasLookup(aliases);
  const activePlayers = (Array.isArray(players) ? players : []).filter((player) => player?.is_active);
  const result = {};
  for (const match of Array.isArray(matches) ? matches : []) {
    for (const player of match.performance?.players || []) {
      const key = normalizeName(player.eaName);
      if (!key || key in result) continue;
      const rememberedId = remembered.get(key);
      const exact = activePlayers.find((candidate) => normalizeName(candidate.display_name) === key);
      result[key] = rememberedId || exact?.id || "";
    }
  }
  return result;
}

export function validateImport(matches, aliasSelections = {}) {
  const pending = [];
  for (const match of Array.isArray(matches) ? matches : []) {
    if (!String(match.competition || "").trim()) pending.push({ matchId: match.id, type: "competition" });
    for (const player of match.performance?.players || []) {
      const key = normalizeName(player.eaName);
      if (!(key in aliasSelections)) pending.push({ matchId: match.id, type: "alias", player: player.eaName });
    }
  }
  return { valid: pending.length === 0, pending };
}

export function dedupeImportedMatches(matches, existing = []) {
  const ids = new Set((Array.isArray(existing) ? existing : []).map((match) => String(match?.external_match_id || "")).filter(Boolean));
  return (Array.isArray(matches) ? matches : []).filter((match) => match && !ids.has(String(match.id)));
}
