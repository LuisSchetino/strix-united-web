const rows = (value) => Array.isArray(value) ? value : [];
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const hasNumber = (value) => value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value));
const normalized = (value) => String(value || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const performanceOf = (match = {}) => match.performance || match.performance_data || match.raw_ea?.performance || {};
const playerRows = (match) => rows(performanceOf(match).players);
const passPair = (performance = {}) => {
  const text = String(performance.passes ?? "");
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);
  return {
    made: number(performance.passesMade ?? performance.passMade ?? match?.[1] ?? (match ? 0 : performance.passes)),
    attempts: number(performance.passesAttempts ?? performance.passAttempts ?? performance.passesAttempted ?? match?.[2]),
    madeKnown: hasNumber(performance.passesMade) || hasNumber(performance.passMade) || Boolean(match) || hasNumber(performance.passes),
    attemptsKnown: hasNumber(performance.passesAttempts) || hasNumber(performance.passAttempts) || hasNumber(performance.passesAttempted) || Boolean(match),
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

const playerMetricFields = ["goals", "assists", "passesMade", "passesAttempts", "passAttempts", "passes", "shots", "tackles", "tackleAttempts", "tacklesAttempts", "saves", "goodDirectionSaves", "reflexSaves", "crossSaves", "ballDiveSaves", "parrySaves", "punchSaves", "mom", "redcards", "cleansheetsdef", "cleansheetsgk"];

/** Internal evidence classification. It deliberately does not infer non-participation from zeros alone. */
export function classifyPlayerData(player = {}) {
  if (!player || typeof player !== "object") return "UNKNOWN";
  const knownMetrics = playerMetricFields.filter((key) => hasNumber(player[key]));
  const ratingKnown = hasNumber(player.rating);
  const passDataKnown = passPair(player).madeKnown || passPair(player).attemptsKnown;
  const hasData = knownMetrics.length > 0 || ratingKnown || passDataKnown;
  const hasSeconds = hasNumber(player.secondsPlayed);
  const seconds = hasSeconds ? Number(player.secondsPlayed) : null;
  const vproattr = String(player.vproattr ?? player.vProAttr ?? "").trim();
  const passPairData = passPair(player);
  const passZero = !passDataKnown || ((passPairData.madeKnown ? passPairData.made === 0 : true) && (passPairData.attemptsKnown ? passPairData.attempts === 0 : true));
  const zeroEvidenceCount = knownMetrics.length + (passDataKnown ? 1 : 0);
  const allObservedZero = zeroEvidenceCount >= 3 && knownMetrics.every((key) => Number(player[key]) === 0) && passZero;
  if (seconds === 0 && !vproattr && allObservedZero) return "DID_NOT_PLAY";
  if (!hasData) return "NO_STATS";
  if (seconds === 0) return "PARTIAL";
  if (seconds > 0) return knownMetrics.length >= 4 || ratingKnown ? "VALID" : "PARTIAL";
  return knownMetrics.length >= 4 ? "VALID" : "PARTIAL";
}

const rowIdentity = (row = {}) => String(row.eaPlayerId ?? row.ea_player_id ?? row.id ?? "").trim();
const rowName = (row = {}) => String(row.eaName || row.name || row.handle || "").trim();

function rowsForPlayer(player, matches, { aliases = [] } = {}) {
  const ids = new Set(rows(player.eaPlayerIds).map(String));
  const names = new Set([player.handle, player.name, ...rows(aliases)
    .filter((alias) => alias.player_id === player.playerId)
    .map((alias) => alias.ea_name)].map(normalized).filter(Boolean));
  return uniqueMatches(matches).flatMap((match) => playerRows(match)
    .filter((row) => {
      const id = rowIdentity(row);
      if (id && ids.has(id)) return true;
      // A name fallback is safe only when tied to a specific canonical alias/display name.
      return names.has(normalized(rowName(row)));
    })
    .map((row) => ({ ...row, quality: classifyPlayerData(row), match }))
    .filter((row) => (row.quality === "VALID" || row.quality === "PARTIAL") && (!hasNumber(row.secondsPlayed) || Number(row.secondsPlayed) > 0)));
}

const sampleMean = (items, key) => {
  const values = items.map((row) => row[key]).filter(hasNumber).map(Number);
  return values.length ? { value: values.reduce((sum, value) => sum + value, 0) / values.length, samples: values.length } : null;
};
const compare = (recent, season, key, { percentPoint = false, recentPerGame = false } = {}) => {
  const recentValue = sampleMean(recent, key);
  const seasonValue = sampleMean(season, key);
  if (!recentValue || !seasonValue) return null;
  const delta = recentValue.value - seasonValue.value;
  return {
    recent: recentPerGame ? Number((recentValue.value / Math.max(1, recent.length)).toFixed(1)) : Number(recentValue.value.toFixed(1)),
    delta: Number(delta.toFixed(1)),
    suffix: percentPoint ? "pp" : "",
    samples: recentValue.samples,
  };
};

const passAccuracyOf = (items) => {
  const totals = items.reduce((result, row) => {
    const pass = passPair(row);
    if (pass.attempts > 0) { result.made += pass.made; result.attempts += pass.attempts; }
    return result;
  }, { made: 0, attempts: 0 });
  return totals.attempts > 0 ? { value: (totals.made / totals.attempts) * 100, samples: totals.attempts } : null;
};

export function buildPlayerProfile(player, matches = [], options = {}) {
  if (!player) return null;
  const appearances = rowsForPlayer(player, matches, options).sort((left, right) => new Date(right.match.played_at || 0) - new Date(left.match.played_at || 0));
  const recent = appearances.filter((row) => hasNumber(row.rating)).slice(0, 5);
  const ratedSeason = appearances.filter((row) => hasNumber(row.rating));
  const tackleRecent = recent.filter((row) => hasNumber(row.tackles));
  const tackleSeason = appearances.filter((row) => hasNumber(row.tackles));
  const gaRecent = recent.filter((row) => hasNumber(row.goals) && hasNumber(row.assists));
  const gaSeason = appearances.filter((row) => hasNumber(row.goals) && hasNumber(row.assists));
  const comparisons = {
    rating: compare(recent, ratedSeason, "rating"),
    passAccuracy: (() => {
      const recentAccuracy = passAccuracyOf(recent);
      const seasonAccuracy = passAccuracyOf(appearances);
      return recentAccuracy && seasonAccuracy ? { recent: Number(recentAccuracy.value.toFixed(1)), delta: Number((recentAccuracy.value - seasonAccuracy.value).toFixed(1)), suffix: "pp", samples: recentAccuracy.samples } : null;
    })(),
    tacklesPerGame: tackleRecent.length && tackleSeason.length ? {
      recent: Number((tackleRecent.reduce((sum, row) => sum + number(row.tackles), 0) / tackleRecent.length).toFixed(1)),
      delta: Number(((tackleRecent.reduce((sum, row) => sum + number(row.tackles), 0) / tackleRecent.length) - (tackleSeason.reduce((sum, row) => sum + number(row.tackles), 0) / tackleSeason.length)).toFixed(1)),
      suffix: "",
      samples: tackleRecent.length,
    } : null,
    goalAssists: gaRecent.length && gaSeason.length ? {
      recent: gaRecent.reduce((sum, row) => sum + number(row.goals) + number(row.assists), 0),
      delta: Number((gaRecent.reduce((sum, row) => sum + number(row.goals) + number(row.assists), 0) - ((gaSeason.reduce((sum, row) => sum + number(row.goals) + number(row.assists), 0) / gaSeason.length) * gaRecent.length)).toFixed(1)),
      suffix: "",
      samples: gaRecent.length,
    } : null,
  };
  const recordSpecs = [["MAIOR NOTA EA", "rating"], ["MAIS GOLS", "goals"], ["MAIS ASSISTÊNCIAS", "assists"], ["MAIS G+A", "goalAssists"], ["MAIS CHUTES", "shots"], ["MAIS PASSES CERTOS", "passesMade"], ["MAIOR PRECISÃO DE PASSE", "passAccuracy"], ["MAIS DESARMES", "tackles"], ["MAIS DEFESAS", "saves"], ["GOOD DIRECTION SAVES", "goodDirectionSaves"], ["REFLEX SAVES", "reflexSaves"]];
  const records = recordSpecs.map(([label, key]) => {
    const candidates = appearances.map((row) => {
      const passes = passPair(row);
      const value = key === "goalAssists" ? number(row.goals) + number(row.assists)
        : key === "passesMade" ? passes.made
          : key === "passAccuracy" ? passes.attempts > 0 ? (passes.made / passes.attempts) * 100 : null
            : row[key];
      return { row, value };
    })
      .filter(({ value }) => hasNumber(value));
    const best = candidates.reduce((current, candidate) => !current || Number(candidate.value) > Number(current.value) ? candidate : current, null);
    const matches = best ? candidates.filter((candidate) => Number(candidate.value) === Number(best.value)).map((candidate) => candidate.row.match) : [];
    return best && Number(best.value) > 0 ? { label, value: Number(best.value), match: best.row.match, matches } : null;
  }).filter(Boolean);
  if (player.goalkeeper) {
    let streak = 0; let longest = 0; let streakMatch = null;
    for (const row of [...appearances].reverse()) {
      if (hasNumber(row.cleansheetsgk) && Number(row.cleansheetsgk) > 0) { streak += 1; if (streak > longest) { longest = streak; streakMatch = row.match; } }
      else streak = 0;
    }
    if (longest > 0) records.push({ label: "MAIOR SEQUÊNCIA CLEAN SHEETS", value: longest, match: streakMatch, matches: [streakMatch] });
    const savesByDay = new Map();
    for (const row of appearances) {
      if (!hasNumber(row.saves)) continue;
      const day = saoPauloDay(row.match.played_at || row.match.date);
      if (!day) continue;
      const current = savesByDay.get(day) || { value: 0, matches: [] };
      current.value += Number(row.saves); current.matches.push(row.match); savesByDay.set(day, current);
    }
    const bestNight = [...savesByDay.values()].reduce((best, item) => !best || item.value > best.value ? item : best, null);
    if (bestNight?.value > 0) records.push({ label: "MAIS DEFESAS EM UMA NOITE", value: bestNight.value, match: bestNight.matches[0], matches: bestNight.matches });
  }
  return { appearances, recent, comparisons, records };
}

function positionGroup(player) {
  const values = [...rows(player.positions), ...rows(player.eaPositions)].map((value) => normalized(value));
  if (player.goalkeeper || values.some((value) => ["gol", "gk", "goalkeeper", "goleiro"].includes(value))) return "GOL";
  if (values.some((value) => ["zag", "zagueiro", "def", "ld", "le"].includes(value))) return "DEF";
  if (values.some((value) => ["ata", "sa", "pe", "pd", "st", "atacante"].includes(value))) return "ATA";
  return values.length ? "MEI" : "";
}

export function buildPositionContext(player, players = [], metric = "averageRating") {
  const group = positionGroup(player || {});
  if (!group || number(player?.validGames) < 1) return { group, insufficient: true, rank: null, total: 0 };
  const comparable = rows(players).filter((item) => item.active !== false && positionGroup(item) === group && number(item.validGames) > 0 && hasNumber(item[metric]));
  if (!comparable.some((item) => item.playerId === player.playerId || item.handle === player.handle)) return { group, insufficient: true, rank: null, total: comparable.length };
  const ordered = [...comparable].sort((left, right) => number(right[metric]) - number(left[metric]));
  const selectedValue = ordered.find((item) => item.playerId === player.playerId || item.handle === player.handle)?.[metric];
  const rank = ordered.filter((item) => number(item[metric]) > number(selectedValue)).length + 1;
  return { group, insufficient: rank < 1 || comparable.length < 2, rank: rank || null, total: comparable.length };
}

export function saoPauloDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export function summarizeNight(matches = [], date, options = {}) {
  const nightMatches = uniqueMatches(matches).filter((match) => saoPauloDay(match.played_at || match.date) === date);
  const result = { date, games: nightMatches.length, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0, leaders: {} };
  const totals = new Map();
  const { index: aliases, indexByEaId } = aliasIndex(options.players, options.aliases);
  const add = (playerKey, name, key, value) => {
    if (!hasNumber(value)) return;
    const current = totals.get(playerKey) || { name, goals: 0, assists: 0, passes: 0, tackles: 0, saves: 0, mom: 0, ratingTotal: 0, ratingGames: 0 };
    current[key] += Number(value);
    totals.set(playerKey, current);
  };
  for (const match of nightMatches) {
    const forGoals = number(match.strix_score); const against = number(match.opponent_score);
    result.goalsFor += forGoals; result.goalsAgainst += against; result.cleanSheets += against === 0 ? 1 : 0;
    if (forGoals > against) result.wins += 1; else if (forGoals < against) result.losses += 1; else result.draws += 1;
    for (const row of playerRows(match)) {
      if ((classifyPlayerData(row) !== "VALID" && classifyPlayerData(row) !== "PARTIAL") || (hasNumber(row.secondsPlayed) && Number(row.secondsPlayed) <= 0)) continue;
      const name = canonicalPlayerName(row.eaName || row.name, options.players, options.aliases);
      const id = rowIdentity(row);
      const linked = (id ? indexByEaId.get(id) : null) || aliases.get(normalized(row.eaName || row.name));
      const playerKey = linked?.roster?.id ? `roster:${linked.roster.id}` : id ? `ea:${id}` : `name:${normalized(name)}`;
      if (!totals.has(playerKey)) totals.set(playerKey, { name, goals: 0, assists: 0, passes: 0, tackles: 0, saves: 0, mom: 0, ratingTotal: 0, ratingGames: 0 });
      const passes = passPair(row);
      add(playerKey, name, "goals", row.goals); add(playerKey, name, "assists", row.assists);
      add(playerKey, name, "passes", passes.made); add(playerKey, name, "tackles", row.tackles); add(playerKey, name, "saves", row.saves); add(playerKey, name, "mom", Number(row.mom) === 1 || row.mom === true ? 1 : null);
      const record = totals.get(playerKey);
      if (hasNumber(row.rating)) { record.ratingTotal += Number(row.rating); record.ratingGames += 1; }
    }
  }
  const leaderFor = (key, accessor = (item) => item[key]) => {
    const candidates = [...totals.values()].map((item) => ({ name: item.name, value: accessor(item) })).filter((item) => Number.isFinite(item.value) && item.value > 0);
    const max = Math.max(0, ...candidates.map((item) => item.value));
    return max > 0 ? { value: Number(max.toFixed(1)), names: candidates.filter((item) => item.value === max).map((item) => item.name) } : null;
  };
  for (const key of ["goals", "assists", "passes", "tackles", "saves", "mom"]) result.leaders[key] = leaderFor(key);
  result.leaders.rating = leaderFor("rating", (item) => item.ratingGames ? item.ratingTotal / item.ratingGames : 0);
  return result;
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
    if (passes.madeKnown) all.metricSamples.passesMade += 1;
    if (passes.attemptsKnown) all.metricSamples.passAttempts += 1;
    if (hasNumber(performance.shots)) all.metricSamples.shots += 1;
    if (hasNumber(performance.tackles)) all.metricSamples.tackles += 1;
    if (hasNumber(performance.tackleAttempts ?? performance.tacklesAttempts)) all.metricSamples.tackleAttempts += 1;
    if (hasNumber(performance.goalkeeperSaves ?? performance.saves)) all.metricSamples.saves += 1;
    all.shots += number(performance.shots);
    all.tackles += number(performance.tackles);
    all.tackleAttempts += number(performance.tackleAttempts ?? performance.tacklesAttempts);
    all.saves += number(performance.goalkeeperSaves ?? performance.saves);
    if (hasNumber(performance.averageRating)) { all.ratingTotal += Number(performance.averageRating); all.ratingGames += 1; all.metricSamples.averageRating += 1; }
    return all;
  }, { games: games.length, wins: 0, draws: 0, losses: 0, cleanSheets: 0, matchesWithoutScoring: 0, matchesConceding2Plus: 0, goalsFor: 0, goalsAgainst: 0, passesMade: 0, passAttempts: 0, shots: 0, tackles: 0, tackleAttempts: 0, saves: 0, ratingTotal: 0, ratingGames: 0, metricSamples: { passesMade: 0, passAttempts: 0, shots: 0, tackles: 0, tackleAttempts: 0, saves: 0, averageRating: 0 } });
  return {
    ...total,
    goalDifference: total.goalsFor - total.goalsAgainst,
    points: total.wins * 3 + total.draws,
    efficiency: total.games ? Math.round(((total.wins * 3 + total.draws) / (total.games * 3)) * 100) : 0,
    averageGoalsFor: total.games ? Number((total.goalsFor / total.games).toFixed(2)) : 0,
    averageGoalsAgainst: total.games ? Number((total.goalsAgainst / total.games).toFixed(2)) : 0,
    shotsPerGame: total.metricSamples.shots ? Number((total.shots / total.metricSamples.shots).toFixed(1)) : null,
    tacklesPerGame: total.metricSamples.tackles ? Number((total.tackles / total.metricSamples.tackles).toFixed(1)) : null,
    savesPerGame: total.metricSamples.saves ? Number((total.saves / total.metricSamples.saves).toFixed(1)) : null,
    passesMadePerGame: total.metricSamples.passesMade ? Number((total.passesMade / total.metricSamples.passesMade).toFixed(1)) : null,
    passAttemptsPerGame: total.metricSamples.passAttempts ? Number((total.passAttempts / total.metricSamples.passAttempts).toFixed(1)) : null,
    passAccuracy: total.metricSamples.passAttempts && total.metricSamples.passesMade && total.passAttempts > 0 ? Math.round((total.passesMade / total.passAttempts) * 100) : null,
    shotConversion: total.shots ? Number(((total.goalsFor / total.shots) * 100).toFixed(1)) : null,
    tackleAccuracy: total.metricSamples.tackleAttempts && total.metricSamples.tackles && total.tackleAttempts > 0 ? Number(((total.tackles / total.tackleAttempts) * 100).toFixed(1)) : null,
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
  const indexByEaId = new Map();
  for (const player of rows(players)) {
    index.set(normalized(player.display_name), { roster: player, display: player.display_name });
    if (player.ea_player_id) indexByEaId.set(String(player.ea_player_id), { roster: player, display: player.display_name });
  }
  for (const alias of rows(aliases)) {
    const roster = playersById.get(alias.player_id);
    index.set(normalized(alias.ea_name), { roster, display: alias.club_players?.display_name || roster?.display_name });
  }
  return { index, indexByEaId, playersById };
};

export function aggregatePlayerStatistics(matches = [], options = {}) {
  const playerMap = new Map();
  const { index: aliases, indexByEaId } = aliasIndex(options.players, options.aliases);
  for (const match of uniqueMatches(matches)) {
    for (const player of playerRows(match)) {
      const handle = String(player.eaName || player.name || player.id || "Jogador EA").trim();
      const rawKey = normalized(handle);
      const eaPlayerId = String(player.eaPlayerId ?? player.id ?? "").trim() || null;
      const linked = (eaPlayerId ? indexByEaId.get(eaPlayerId) : null) || aliases.get(rawKey);
      const key = linked?.roster?.id ? `player:${linked.roster.id}` : eaPlayerId ? `ea-id:${eaPlayerId}` : `ea:${rawKey}`;
      const current = playerMap.get(key) || {
        name: linked?.display || handle,
        handle,
        playerId: linked?.roster?.id || null,
        eaPlayerIds: [],
        active: linked?.roster ? linked.roster.is_active !== false : true,
        positions: rows(linked?.roster?.positions),
        eaPositions: [],
        memberType: linked?.roster?.member_type,
        games: 0,
        validGames: 0,
        goalkeeperGames: 0,
        disconnectedGames: 0,
        goals: 0,
        assists: 0,
        passesMade: 0,
        passAttempts: 0,
        shots: 0,
        tackles: 0,
        tackleAttempts: 0,
        saves: 0,
        goodDirectionSaves: 0,
        reflexSaves: 0,
        crossSaves: 0,
        ballDiveSaves: 0,
        parrySaves: 0,
        punchSaves: 0,
        mom: 0,
        redcards: 0,
        cleanSheetsDef: 0,
        cleanSheetsGk: 0,
        goalsAgainst: 0,
        cleanSheets: 0,
        ratingTotal: 0,
        ratings: 0,
        metricSamples: {},
        archetypeSnapshots: [],
        goalkeeper: false,
      };
      const disconnected = isDisconnectedPlayer(player);
      const quality = classifyPlayerData(player);
      current.games += 1;
      current.disconnectedGames += disconnected ? 1 : 0;
      current.qualityCounts ||= { VALID: 0, PARTIAL: 0, NO_STATS: 0, DID_NOT_PLAY: 0, UNKNOWN: 0 };
      current.qualityCounts[quality] += 1;
      if (eaPlayerId && !current.eaPlayerIds.includes(eaPlayerId)) current.eaPlayerIds.push(eaPlayerId);
      const eaPosition = player.pos || player.position;
      if (eaPosition && !current.eaPositions.includes(String(eaPosition))) current.eaPositions.push(String(eaPosition));
      const metricFields = ["goals", "assists", "passesMade", "passesAttempts", "shots", "tackles", "tackleAttempts", "saves", "goodDirectionSaves", "reflexSaves", "crossSaves", "ballDiveSaves", "parrySaves", "punchSaves", "mom", "redcards", "cleansheetsdef", "cleansheetsgk"];
      if (quality === "DID_NOT_PLAY" || quality === "NO_STATS" || quality === "UNKNOWN") {
        current.goalkeeper ||= isGoalkeeper(player, linked?.roster);
        playerMap.set(key, current);
        continue;
      }
      for (const field of metricFields) {
        const rawValue = player[field];
        if (rawValue !== null && rawValue !== undefined && rawValue !== "" && Number.isFinite(Number(rawValue))) {
          current.metricSamples[field] = (current.metricSamples[field] || 0) + 1;
        }
      }
      current.goals += number(player.goals);
      current.assists += number(player.assists);
      const passes = passPair(player);
      current.passesMade += passes.made;
      current.passAttempts += passes.attempts;
      current.shots += number(player.shots);
      current.tackles += number(player.tackles);
      current.tackleAttempts += number(player.tackleAttempts ?? player.tacklesAttempts);
      current.saves += number(player.saves);
      current.goodDirectionSaves += number(player.goodDirectionSaves);
      current.reflexSaves += number(player.reflexSaves);
      current.crossSaves += number(player.crossSaves);
      current.ballDiveSaves += number(player.ballDiveSaves);
      current.parrySaves += number(player.parrySaves);
      current.punchSaves += number(player.punchSaves);
      current.mom += Number(player.mom) === 1 ? 1 : 0;
      current.redcards += number(player.redcards);
      current.cleanSheetsDef += number(player.cleansheetsdef);
      current.cleanSheetsGk += number(player.cleansheetsgk);
      current.goalkeeper ||= isGoalkeeper(player, linked?.roster);
      const secondsKnown = hasNumber(player.secondsPlayed);
      const participated = (quality === "VALID" || quality === "PARTIAL") && !disconnected && (!secondsKnown || Number(player.secondsPlayed) > 0);
      if (participated) current.validGames += 1;
      if (current.goalkeeper && participated) {
        current.goalkeeperGames += 1;
        // Goals against are derived only from the match score and only when
        // the player is a goalkeeper who has evidence of participation.
        current.goalsAgainst += number(match.opponent_score);
      }
      if (participated && Number.isFinite(Number(player.rating))) { current.ratingTotal += Number(player.rating); current.ratings += 1; }
      if (player.archetypeId !== null && player.archetypeId !== undefined && player.archetypeId !== "") {
        current.archetypeSnapshots.push({
          archetypeId: String(player.archetypeId),
          eaPlayerId,
          position: eaPosition || null,
          playedAt: match.played_at || match.date || null,
          opponent: match.opponent_name || match.opponent || null,
          rating: Number.isFinite(Number(player.rating)) ? Number(player.rating) : null,
          goals: player.goals ?? null,
          assists: player.assists ?? null,
          passesMade: player.passesMade ?? null,
          passAttempts: player.passesAttempts ?? player.passAttempts ?? null,
          tackles: player.tackles ?? null,
          tackleAttempts: player.tackleAttempts ?? null,
        });
      }
      playerMap.set(key, current);
    }
  }
  return [...playerMap.values()].map((player) => ({
    ...player,
    goalAssists: player.goals + player.assists,
    shotConversion: player.shots > 0 ? Number(((player.goals / player.shots) * 100).toFixed(1)) : null,
    passAccuracy: player.passAttempts ? Math.round((player.passesMade / player.passAttempts) * 100) : null,
    tackleAccuracy: player.tackleAttempts ? Number(((player.tackles / player.tackleAttempts) * 100).toFixed(1)) : null,
    averageRating: player.ratings ? Number((player.ratingTotal / player.ratings).toFixed(1)) : null,
    motmPercentage: player.validGames ? Number(((player.mom / player.validGames) * 100).toFixed(1)) : null,
    cleanSheets: player.cleanSheetsDef + player.cleanSheetsGk,
    savesPerGame: player.goalkeeperGames ? Number((player.saves / player.goalkeeperGames).toFixed(1)) : null,
    disconnected: player.disconnectedGames === player.games,
    rankingEligible: player.ratings > 0,
  }));
}

export function buildPlayerProfileChoices(statisticsPlayers = [], roster = [], aliases = []) {
  const activeRoster = rows(roster).filter((player) => player.is_active !== false);
  const aliasRosterIdByName = new Map(rows(aliases).map((alias) => [normalized(alias.ea_name), String(alias.player_id || "")]));
  const activeById = new Map(activeRoster.map((player) => [String(player.id), player]));
  const activeByEaId = new Map(activeRoster.filter((player) => player.ea_player_id).map((player) => [String(player.ea_player_id), player]));
  const findRoster = (player) => {
    const linkedById = player.playerId ? activeById.get(String(player.playerId)) : null;
    if (linkedById) return linkedById;
    const eaMatch = rows(player.eaPlayerIds).map((id) => activeByEaId.get(String(id))).find(Boolean);
    if (eaMatch) return eaMatch;
    const aliasId = aliasRosterIdByName.get(normalized(player.handle || player.name));
    return aliasId ? activeById.get(aliasId) || null : null;
  };
  const choices = rows(statisticsPlayers).map((player) => {
    const rosterPlayer = findRoster(player);
    if (!rosterPlayer) return player;
    return {
      ...player,
      name: rosterPlayer.display_name || player.name,
      playerId: rosterPlayer.id,
      active: true,
      positions: rows(rosterPlayer.positions),
      memberType: rosterPlayer.member_type || player.memberType,
      goalkeeper: isGoalkeeper(player, rosterPlayer),
    };
  });
  const representedIds = new Set(choices.map((player) => String(player.playerId || "")).filter(Boolean));
  for (const player of activeRoster) {
    if (representedIds.has(String(player.id))) continue;
    const positions = rows(player.positions);
    choices.push({
      name: player.display_name,
      handle: player.display_name,
      playerId: player.id,
      eaPlayerIds: player.ea_player_id ? [String(player.ea_player_id)] : [],
      active: true,
      positions,
      eaPositions: [],
      memberType: player.member_type,
      games: 0,
      validGames: 0,
      goalkeeperGames: 0,
      disconnectedGames: 0,
      goals: null,
      assists: null,
      goalAssists: null,
      passesMade: null,
      passAttempts: null,
      shots: null,
      tackles: null,
      tackleAttempts: null,
      saves: null,
      goodDirectionSaves: null,
      reflexSaves: null,
      crossSaves: null,
      ballDiveSaves: null,
      parrySaves: null,
      punchSaves: null,
      mom: null,
      redcards: null,
      cleanSheetsDef: null,
      cleanSheetsGk: null,
      goalsAgainst: null,
      cleanSheets: null,
      ratingTotal: 0,
      ratings: 0,
      metricSamples: {},
      archetypeSnapshots: [],
      goalkeeper: isGoalkeeper({}, player),
      averageRating: null,
      passAccuracy: null,
      tackleAccuracy: null,
      shotConversion: null,
      savesPerGame: null,
      motmPercentage: null,
      rankingEligible: false,
      noSample: true,
    });
  }
  return choices;
}

export const rankingCriteria = {
  averageRating: (player) => player.rankingEligible,
  passAccuracy: (player) => player.rankingEligible && player.passAttempts >= 10,
  passesMade: (player) => player.rankingEligible && player.passAttempts > 0 && player.metricSamples?.passesMade > 0,
  passAttempts: (player) => player.rankingEligible && player.passAttempts > 0 && player.metricSamples?.passesAttempts > 0,
  goals: (player) => player.rankingEligible && player.metricSamples?.goals > 0,
  assists: (player) => player.rankingEligible && player.metricSamples?.assists > 0,
  shots: (player) => player.rankingEligible && player.metricSamples?.shots > 0,
  tackles: (player) => player.rankingEligible && player.metricSamples?.tackles > 0,
  goalAssists: (player) => player.rankingEligible && player.metricSamples?.goals > 0 && player.metricSamples?.assists > 0,
  mom: (player) => player.rankingEligible && player.metricSamples?.mom > 0,
  cleanSheets: (player) => player.rankingEligible && ((player.metricSamples?.cleansheetsdef || 0) + (player.metricSamples?.cleansheetsgk || 0)) > 0,
  saves: (player) => player.rankingEligible && player.goalkeeper && player.metricSamples?.saves > 0 && player.goalkeeperGames > 0,
};

export function buildRanking(players = [], metric, limit) {
  const criterion = rankingCriteria[metric] || ((player) => player.rankingEligible);
  const goalkeeperMetric = ["saves"].includes(metric);
  const ranked = rows(players).filter((player) => player.active !== false && (metric === "cleanSheets" || (goalkeeperMetric ? player.goalkeeper : !player.goalkeeper)) && criterion(player)).sort((left, right) => number(right[metric]) - number(left[metric]) || right.games - left.games || left.name.localeCompare(right.name, "pt-BR"));
  return Number.isFinite(limit) ? ranked.slice(0, limit) : ranked;
}

export function canonicalPlayerName(rawName, players = [], aliases = []) {
  const { index } = aliasIndex(players, aliases);
  return index.get(normalized(rawName))?.display || rawName || "Jogador EA";
}
