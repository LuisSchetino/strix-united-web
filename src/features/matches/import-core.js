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
  if (typeof candidate === "number") return new Date(candidate < 1e12 ? candidate * 1000 : candidate);
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

export function suggestAgendaMatch(match, agenda = []) {
  const matchTime = new Date(match.date).getTime();
  const normalizedOpponent = normalizeName(match.opponent);
  const candidates = agenda
    .filter((entry) => !["cancelled", "completed"].includes(entry.status))
    .map((entry) => {
      const agendaTime = new Date(entry.scheduled_at).getTime();
      const agendaOpponent = normalizeName(entry.opponent_name);
      let score = 0;
      if (localDay(match.date) === localDay(entry.scheduled_at)) score += 60;
      if (normalizedOpponent === agendaOpponent) score += 50;
      else if (normalizedOpponent.length >= 3 && (normalizedOpponent.includes(agendaOpponent) || agendaOpponent.includes(normalizedOpponent))) score += 30;
      const minutes = Math.abs(matchTime - agendaTime) / 60000;
      if (minutes <= 30) score += 25;
      else if (minutes <= 120) score += 12;
      return { entry, score, minutes };
    })
    .sort((left, right) => right.score - left.score || left.minutes - right.minutes);
  return candidates[0]?.score >= 60 ? candidates[0].entry : null;
}

export function aliasLookup(aliases = []) {
  return new Map(aliases.map((alias) => [normalizeName(alias.ea_name), alias.player_id]));
}

export function resolvePlayerAliases(matches, players, aliases) {
  const remembered = aliasLookup(aliases);
  const activePlayers = players.filter((player) => player.is_active);
  const result = {};
  for (const match of matches) {
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
  for (const match of matches) {
    if (!String(match.competition || "").trim()) pending.push({ matchId: match.id, type: "competition" });
    for (const player of match.performance?.players || []) {
      const key = normalizeName(player.eaName);
      if (!(key in aliasSelections)) pending.push({ matchId: match.id, type: "alias", player: player.eaName });
    }
  }
  return { valid: pending.length === 0, pending };
}

export function dedupeImportedMatches(matches, existing = []) {
  const ids = new Set(existing.map((match) => String(match.external_match_id || "")).filter(Boolean));
  return matches.filter((match) => !ids.has(String(match.id)));
}
