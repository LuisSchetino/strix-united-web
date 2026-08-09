const rows = (value) => Array.isArray(value) ? value : [];
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const passPair = (performance = {}) => {
  const text = String(performance.passes ?? "");
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  return {
    made: number(performance.passesMade ?? match?.[1] ?? (match ? 0 : performance.passes)),
    attempts: number(performance.passesAttempts ?? match?.[2]),
  };
};

export function aggregateTeamStatistics(matches = [], activePlayers = []) {
  const games = rows(matches);
  const total = games.reduce((all, match) => {
    const performance = match.performance || match.raw_ea?.performance || {};
    const passes = passPair(performance);
    all.goalsFor += number(match.strix_score);
    all.goalsAgainst += number(match.opponent_score);
    all.wins += number(match.strix_score) > number(match.opponent_score) ? 1 : 0;
    all.draws += number(match.strix_score) === number(match.opponent_score) ? 1 : 0;
    all.losses += number(match.strix_score) < number(match.opponent_score) ? 1 : 0;
    all.passesMade += passes.made;
    all.passAttempts += passes.attempts;
    all.shots += number(performance.shots);
    all.tackles += number(performance.tackles);
    all.saves += number(performance.goalkeeperSaves ?? performance.saves);
    if (Number.isFinite(Number(performance.averageRating))) {
      all.ratingTotal += Number(performance.averageRating);
      all.ratingGames += 1;
    }
    return all;
  }, { games: games.length, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, passesMade: 0, passAttempts: 0, shots: 0, tackles: 0, saves: 0, ratingTotal: 0, ratingGames: 0 });
  return {
    ...total,
    goalDifference: total.goalsFor - total.goalsAgainst,
    points: total.wins * 3 + total.draws,
    efficiency: total.games ? Math.round(((total.wins * 3 + total.draws) / (total.games * 3)) * 100) : 0,
    averageGoalsFor: total.games ? Number((total.goalsFor / total.games).toFixed(2)) : 0,
    averageGoalsAgainst: total.games ? Number((total.goalsAgainst / total.games).toFixed(2)) : 0,
    passAccuracy: total.passAttempts ? Math.round((total.passesMade / total.passAttempts) * 100) : 0,
    averageRating: total.ratingGames ? Number((total.ratingTotal / total.ratingGames).toFixed(1)) : 0,
    activeSquad: rows(activePlayers).filter((player) => player?.is_active).length,
  };
}

export function aggregatePlayerStatistics(matches = []) {
  const playerMap = new Map();
  for (const match of rows(matches)) {
    for (const player of rows(match?.performance?.players || match?.raw_ea?.performance?.players)) {
      const name = String(player.eaName || player.name || player.id || "Jogador EA").trim();
      const key = name.toLocaleLowerCase("pt-BR");
      const current = playerMap.get(key) || { name, games: 0, goals: 0, assists: 0, passesMade: 0, passAttempts: 0, shots: 0, tackles: 0, tackleAttempts: 0, saves: 0, ratingTotal: 0, ratings: 0 };
      current.games += 1;
      current.goals += number(player.goals);
      current.assists += number(player.assists);
      const passes = passPair(player);
      current.passesMade += passes.made;
      current.passAttempts += passes.attempts;
      current.shots += number(player.shots);
      current.tackles += number(player.tackles);
      current.tackleAttempts += number(player.tackleAttempts ?? player.tacklesAttempts);
      current.saves += number(player.saves);
      if (Number.isFinite(Number(player.rating))) { current.ratingTotal += Number(player.rating); current.ratings += 1; }
      playerMap.set(key, current);
    }
  }
  return [...playerMap.values()].map((player) => ({
    ...player,
    goalAssists: player.goals + player.assists,
    passAccuracy: player.passAttempts ? Math.round((player.passesMade / player.passAttempts) * 100) : 0,
    tackleAccuracy: player.tackleAttempts ? Math.round((player.tackles / player.tackleAttempts) * 100) : null,
    averageRating: player.ratings ? Number((player.ratingTotal / player.ratings).toFixed(1)) : null,
  }));
}
