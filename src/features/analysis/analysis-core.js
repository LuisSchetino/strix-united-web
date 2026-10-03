import { aggregatePlayerStatistics, aggregateTeamStatistics, uniqueMatches } from "../statistics/statistics-core.js";

const newest = (matches) => uniqueMatches(matches).sort((left, right) => new Date(right.played_at || 0) - new Date(left.played_at || 0));

export function selectAnalysisPeriod(matches = [], period = "season") {
  period = typeof period === "string" ? period : "season";
  const ordered = newest(matches);
  if (period === "last5") return ordered.slice(0, 5);
  if (period === "last10") return ordered.slice(0, 10);
  if (period.startsWith("competition:")) {
    const competition = period.slice("competition:".length);
    return ordered.filter((match) => String(match.competition_name || "Amistoso") === competition);
  }
  return ordered;
}

export function analysisInsightKind(insight = "") {
  const text = String(insight).toLocaleLowerCase("pt-BR");
  if (text.includes("precisão de passe")) return "passing";
  if (text.includes("produção ofensiva") || text.includes("ficou sem marcar")) return "attacking";
  return "defending";
}

export function playerComparisonState(comparison, playerIds = []) {
  if (comparison?.matches === 0) return playerIds.length ? "no-sample" : "choose";
  if ((comparison?.players?.length || 0) < 2) return "needs-more";
  return "ready";
}

export function comparePeriods(matches = [], period = "last5") {
  const ordered = newest(matches);
  const size = period === "last10" ? 10 : period === "last5" ? 5 : 0;
  if (!size || ordered.length <= size) return null;
  const current = aggregateTeamStatistics(ordered.slice(0, size));
  const previous = aggregateTeamStatistics(ordered.slice(size, size * 2));
  if (!previous.games) return null;
  const trend = (currentValue, previousValue, inverse = false) => {
    if (!Number.isFinite(Number(currentValue)) || !Number.isFinite(Number(previousValue))) return "stable";
    const scale = Math.max(Math.abs(Number(previousValue)), 1);
    const change = (Number(currentValue) - Number(previousValue)) / scale;
    if (Math.abs(change) < .05) return "stable";
    const up = change > 0;
    return inverse ? (up ? "down" : "up") : (up ? "up" : "down");
  };
  // Raw difference against the previous window of the same size; null when either side has no sample.
  const delta = (currentValue, previousValue) => {
    if (currentValue == null || previousValue == null) return null;
    const a = Number(currentValue); const b = Number(previousValue);
    return Number.isFinite(a) && Number.isFinite(b) ? Number((a - b).toFixed(1)) : null;
  };
  return {
    goals: trend(current.averageGoalsFor, previous.averageGoalsFor),
    conceded: trend(current.averageGoalsAgainst, previous.averageGoalsAgainst, true),
    passing: trend(current.passAccuracy, previous.passAccuracy),
    rating: trend(current.averageRating, previous.averageRating),
    window: size,
    deltas: {
      goals: delta(current.averageGoalsFor, previous.averageGoalsFor),
      conceded: delta(current.averageGoalsAgainst, previous.averageGoalsAgainst),
      passing: delta(current.passAccuracy, previous.passAccuracy),
      rating: delta(current.averageRating, previous.averageRating),
    },
  };
}

export function buildAnalysis(matches = [], activePlayers = []) {
  const team = aggregateTeamStatistics(matches, activePlayers);
  const insights = [];
  if (!team.games) return { team, insights };
  if (team.passAccuracy !== null) insights.push(team.passAccuracy >= 80
    ? `O Strix sustenta ${team.passAccuracy}% de precisão de passe no período.`
    : `A precisão de passe está em ${team.passAccuracy}%; há margem objetiva para reduzir perdas.`);
  if (team.goalsFor > team.goalsAgainst) insights.push(`A produção ofensiva supera a defensiva em ${team.goalDifference} gol(s) no recorte.`);
  else if (team.goalsAgainst > team.goalsFor) insights.push(`O time sofreu ${Math.abs(team.goalDifference)} gol(s) a mais do que marcou no recorte.`);
  else insights.push("Gols marcados e sofridos estão equilibrados no recorte.");
  if (team.matchesWithoutScoring) insights.push(`O Strix ficou sem marcar em ${team.matchesWithoutScoring} de ${team.games} jogo(s).`);
  if (team.matchesConceding2Plus) insights.push(`A equipe sofreu dois ou mais gols em ${team.matchesConceding2Plus} jogo(s).`);
  if (team.cleanSheets) insights.push(`${team.cleanSheets} clean sheet(s) sustentam a leitura defensiva do período.`);
  return { team, insights };
}

export function selectComparisonPeriod(matches = [], period = "season", competition = "", now = new Date()) {
  const ordered = newest(matches);
  const filtered = competition ? ordered.filter((match) => String(match.competition_name || "Amistoso") === competition) : ordered;
  if (period === "all") return filtered;
  if (period === "season") {
    const year = Number.isNaN(new Date(now).valueOf()) ? new Date().getFullYear() : new Date(now).getFullYear();
    return filtered.filter((match) => new Date(match.played_at || 0).getFullYear() === year);
  }
  const days = Number(String(period).replace("days", ""));
  if (![7, 30, 90].includes(days)) return filtered;
  const limit = new Date(now).valueOf() - days * 86400000;
  return filtered.filter((match) => new Date(match.played_at || 0).valueOf() >= limit);
}

const perGame = (value, games) => games ? Number((Number(value || 0) / games).toFixed(2)) : 0;

export function buildPlayerComparison(matches = [], options = {}) {
  const selectedMatches = selectComparisonPeriod(matches, options.period, options.competition, options.now);
  const allPlayers = aggregatePlayerStatistics(selectedMatches, { players: options.players, aliases: options.aliases });
  const kind = options.kind === "goalkeeper" ? "goalkeeper" : "line";
  const statsById = new Map(allPlayers.filter((player) => player.playerId).map((player) => [player.playerId, player]));
  const isKeeper = (player) => [...(Array.isArray(player.positions) ? player.positions : []), player.position]
    .filter(Boolean).some((position) => ["gol", "gk", "goalkeeper", "goleiro"].includes(String(position).toLocaleLowerCase("pt-BR").trim()));
  const roster = (Array.isArray(options.players) ? options.players : [])
    .filter((player) => player && player.is_active !== false && player.id)
    .filter((player) => kind === "goalkeeper" ? isKeeper(player) : !isKeeper(player))
    .map((player) => {
      const stat = statsById.get(player.id);
      return stat ? { ...stat, name: player.display_name || stat.name, positions: player.positions || stat.positions || [], hasSample: stat.validGames > 0 }
        : { playerId: player.id, name: player.display_name || "Jogador", handle: player.display_name || "Jogador", active: true, positions: player.positions || [], memberType: player.member_type, games: 0, validGames: 0, goalkeeperGames: 0, goals: 0, assists: 0, goalAssists: 0, passesMade: 0, passAttempts: 0, shots: 0, tackles: 0, saves: 0, averageRating: null, passAccuracy: null, hasSample: false, goalkeeper: kind === "goalkeeper" };
    });
  const selectedIds = new Set(options.playerIds === undefined ? roster.filter((player) => player.hasSample).map((player) => player.playerId) : options.playerIds);
  const selected = roster.filter((player) => selectedIds.has(player.playerId) && player.hasSample && !player.disconnected);
  const axes = kind === "goalkeeper"
    ? [
      ["Nota", (player) => Number(player.averageRating || 0), 10],
      ["Defesas/j", (player) => perGame(player.saves, player.goalkeeperGames)],
      ["Clean sheets", (player) => player.goalkeeperGames ? Number(((player.cleanSheetsGk / player.goalkeeperGames) * 100).toFixed(1)) : 0, 100],
      ["Passes/j", (player) => perGame(player.passesMade, player.validGames)],
      ["Precisão", (player) => Number(player.passAccuracy || 0), 100],
    ]
    : [
      ["Nota", (player) => Number(player.averageRating || 0), 10],
      ["Passes/j", (player) => perGame(player.passesMade, player.validGames)],
      ["Precisão", (player) => Number(player.passAccuracy || 0), 100],
      ["Desarmes/j", (player) => perGame(player.tackles, player.validGames)],
      ["Finalizações/j", (player) => perGame(player.shots, player.validGames)],
      ["G+A/j", (player) => perGame(player.goalAssists, player.validGames)],
    ];
  const maxima = axes.map(([, read, fixedMax]) => fixedMax || Math.max(1, ...selected.map(read)));
  return {
    matches: selectedMatches.length,
    roster,
    axes: axes.map(([label]) => label),
    players: selected.map((player) => ({
      ...player,
      rawValues: axes.map(([, read]) => read(player)),
      values: axes.map(([, read], index) => Math.max(0, Math.min(100, (read(player) / maxima[index]) * 100))),
    })),
  };
}
