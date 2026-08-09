const rows = (value) => Array.isArray(value) ? value : [];
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const normalized = (value) => String(value || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const performanceOf = (match = {}) => match.performance || match.performance_data || match.raw_ea?.performance || {};
const playerRows = (match) => rows(performanceOf(match).players);
const passPair = (performance = {}) => {
  const text = String(performance.passes ?? "");
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  return {
    made: number(performance.passesMade ?? performance.passMade ?? match?.[1] ?? (match ? 0 : performance.passes)),
    attempts: number(performance.passesAttempts ?? performance.passAttempts ?? performance.passesAttempted ?? match?.[2]),
  };
};

const matchIdentity = (match = {}) => {
  const played = match.played_at ? new Date(match.played_at) : null;
  const minute = played && !Number.isNaN(played.valueOf()) ? played.toISOString().slice(0, 16) : "sem-data";
  return [minute, normalized(match.opponent_name || match.opponent), number(match.strix_score), number(match.opponent_score)].join("|");
};

const richness = (match) => JSON.stringify(performanceOf(match)).length + (match.raw_ea ? JSON.stringify(match.raw_ea).length : 0);

export function uniqueMatches(matches = []) {
  const reconciled = new Map();
  for (const match of rows(matches)) {
    const key = matchIdentity(match);
    const current = reconciled.get(key);
    if (!current || richness(match) > richness(current)) reconciled.set(key, match);
  }
  return [...reconciled.values()].sort((left, right) => new Date(left.played_at || 0) - new Date(right.played_at || 0));
}

export function isDisconnectedPlayer(player = {}) {
  const rating = Number(player.rating ?? player.averageRating);
  if (!Number.isFinite(rating) || rating > 3.1) return false;
  const passes = passPair(player);
  return [player.goals, player.assists, passes.made, passes.attempts, player.shots, player.tackles, player.saves].every((value) => number(value) === 0);
}

export function aggregateTeamStatistics(matches = [], activePlayers = []) {
  const games = uniqueMatches(matches);
  const total = games.reduce((all, match) => {
    const performance = performanceOf(match);
    const passes = passPair(performance);
    const goalsFor = number(match.strix_score);
    const goalsAgainst = number(match.opponent_score);
    all.goalsFor += goalsFor;
    all.goalsAgainst += goalsAgainst;
    all.wins += goalsFor > goalsAgainst ? 1 : 0;
    all.draws += goalsFor === goalsAgainst ? 1 : 0;
    all.losses += goalsFor < goalsAgainst ? 1 : 0;
    all.cleanSheets += goalsAgainst === 0 ? 1 : 0;
    all.matchesWithoutScoring += goalsFor === 0 ? 1 : 0;
    all.matchesConceding2Plus += goalsAgainst >= 2 ? 1 : 0;
    all.passesMade += passes.made;
    all.passAttempts += passes.attempts;
    all.shots += number(performance.shots);
    all.tackles += number(performance.tackles);
    all.tackleAttempts += number(performance.tackleAttempts ?? performance.tacklesAttempts);
    all.saves += number(performance.goalkeeperSaves ?? performance.saves);
    if (Number.isFinite(Number(performance.averageRating))) { all.ratingTotal += Number(performance.averageRating); all.ratingGames += 1; }
    return all;
  }, { games: games.length, wins: 0, draws: 0, losses: 0, cleanSheets: 0, matchesWithoutScoring: 0, matchesConceding2Plus: 0, goalsFor: 0, goalsAgainst: 0, passesMade: 0, passAttempts: 0, shots: 0, tackles: 0, tackleAttempts: 0, saves: 0, ratingTotal: 0, ratingGames: 0 });
  return {
    ...total,
    goalDifference: total.goalsFor - total.goalsAgainst,
    points: total.wins * 3 + total.draws,
    efficiency: total.games ? Math.round(((total.wins * 3 + total.draws) / (total.games * 3)) * 100) : 0,
    averageGoalsFor: total.games ? Number((total.goalsFor / total.games).toFixed(2)) : 0,
    averageGoalsAgainst: total.games ? Number((total.goalsAgainst / total.games).toFixed(2)) : 0,
    shotsPerGame: total.games ? Number((total.shots / total.games).toFixed(1)) : 0,
    tacklesPerGame: total.games ? Number((total.tackles / total.games).toFixed(1)) : 0,
    savesPerGame: total.games ? Number((total.saves / total.games).toFixed(1)) : 0,
    passesMadePerGame: total.games ? Number((total.passesMade / total.games).toFixed(1)) : 0,
    passAttemptsPerGame: total.games ? Number((total.passAttempts / total.games).toFixed(1)) : 0,
    passAccuracy: total.passAttempts ? Math.round((total.passesMade / total.passAttempts) * 100) : null,
    shotConversion: total.shots ? Number(((total.goalsFor / total.shots) * 100).toFixed(1)) : null,
    tackleAccuracy: total.tackleAttempts ? Number(((total.tackles / total.tackleAttempts) * 100).toFixed(1)) : null,
    averageRating: total.ratingGames ? Number((total.ratingTotal / total.ratingGames).toFixed(1)) : null,
    activeSquad: rows(activePlayers).filter((player) => player?.is_active).length,
  };
}

const isGoalkeeper = (player = {}, rosterPlayer) => {
  const positions = [...rows(player.positions), ...rows(rosterPlayer?.positions), player.position].filter(Boolean).map(normalized);
  return positions.some((position) => ["gol", "gk", "goalkeeper", "goleiro"].includes(position)) || number(player.saves) > 0;
};

const aliasIndex = (players, aliases) => {
  const playersById = new Map(rows(players).map((player) => [player.id, player]));
  const index = new Map();
  for (const player of rows(players)) index.set(normalized(player.display_name), { roster: player, display: player.display_name });
  for (const alias of rows(aliases)) {
    const roster = playersById.get(alias.player_id);
    index.set(normalized(alias.ea_name), { roster, display: alias.club_players?.display_name || roster?.display_name });
  }
  return { index, playersById };
};

export function aggregatePlayerStatistics(matches = [], options = {}) {
  const playerMap = new Map();
  const { index: aliases } = aliasIndex(options.players, options.aliases);
  for (const match of uniqueMatches(matches)) {
    for (const player of playerRows(match)) {
      const handle = String(player.eaName || player.name || player.id || "Jogador EA").trim();
      const rawKey = normalized(handle);
      const linked = aliases.get(rawKey);
      const key = linked?.roster?.id ? `player:${linked.roster.id}` : `ea:${rawKey}`;
      const current = playerMap.get(key) || { name: linked?.display || handle, handle, playerId: linked?.roster?.id || null, active: linked?.roster ? linked.roster.is_active !== false : true, positions: rows(linked?.roster?.positions), memberType: linked?.roster?.member_type, games: 0, disconnectedGames: 0, goals: 0, assists: 0, passesMade: 0, passAttempts: 0, shots: 0, tackles: 0, tackleAttempts: 0, saves: 0, goalsAgainst: 0, cleanSheets: 0, ratingTotal: 0, ratings: 0, goalkeeper: false };
      const disconnected = isDisconnectedPlayer(player);
      current.games += 1;
      current.disconnectedGames += disconnected ? 1 : 0;
      current.goals += number(player.goals);
      current.assists += number(player.assists);
      const passes = passPair(player);
      current.passesMade += passes.made;
      current.passAttempts += passes.attempts;
      current.shots += number(player.shots);
      current.tackles += number(player.tackles);
      current.tackleAttempts += number(player.tackleAttempts ?? player.tacklesAttempts);
      current.saves += number(player.saves);
      current.goalkeeper ||= isGoalkeeper(player, linked?.roster);
      if (current.goalkeeper) {
        current.goalsAgainst += number(match.opponent_score);
        current.cleanSheets += number(match.opponent_score) === 0 ? 1 : 0;
      }
      if (!disconnected && Number.isFinite(Number(player.rating))) { current.ratingTotal += Number(player.rating); current.ratings += 1; }
      playerMap.set(key, current);
    }
  }
  return [...playerMap.values()].map((player) => ({
    ...player,
    goalAssists: player.goals + player.assists,
    passAccuracy: player.passAttempts ? Math.round((player.passesMade / player.passAttempts) * 100) : null,
    tackleAccuracy: player.tackleAttempts ? Math.round((player.tackles / player.tackleAttempts) * 100) : null,
    averageRating: player.ratings ? Number((player.ratingTotal / player.ratings).toFixed(1)) : null,
    disconnected: player.disconnectedGames === player.games,
    rankingEligible: player.ratings > 0,
  }));
}

export const rankingCriteria = {
  averageRating: (player) => player.rankingEligible,
  passAccuracy: (player) => player.rankingEligible && player.passAttempts >= 10,
  passesMade: (player) => player.rankingEligible && player.passAttempts > 0,
  passAttempts: (player) => player.rankingEligible && player.passAttempts > 0,
  goals: (player) => player.rankingEligible,
  assists: (player) => player.rankingEligible,
  shots: (player) => player.rankingEligible,
  tackles: (player) => player.rankingEligible,
};

export function buildRanking(players = [], metric, limit) {
  const criterion = rankingCriteria[metric] || ((player) => player.rankingEligible);
  const ranked = rows(players).filter((player) => player.active !== false && !player.goalkeeper && criterion(player)).sort((left, right) => number(right[metric]) - number(left[metric]) || right.games - left.games || left.name.localeCompare(right.name, "pt-BR"));
  return Number.isFinite(limit) ? ranked.slice(0, limit) : ranked;
}

export function canonicalPlayerName(rawName, players = [], aliases = []) {
  const { index } = aliasIndex(players, aliases);
  return index.get(normalized(rawName))?.display || rawName || "Jogador EA";
}
