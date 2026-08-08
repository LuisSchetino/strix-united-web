const cloneTable = (standings) => standings.map((row) => ({
  ...row,
  points: Number(row.points) || 0,
  played: Number(row.played) || 0,
  wins: Number(row.wins) || 0,
  draws: Number(row.draws) || 0,
  losses: Number(row.losses) || 0,
  goalsFor: Number(row.goalsFor ?? row.goals_for) || 0,
  goalsAgainst: Number(row.goalsAgainst ?? row.goals_against) || 0,
}));

const normalizedTeam = (value) => String(value || "").trim().toLowerCase();

const normalizedFixture = (fixture) => ({
  ...fixture,
  home: fixture.home || fixture.homeTeamName || fixture.home_team_name || "",
  away: fixture.away || fixture.awayTeamName || fixture.away_team_name || "",
});

const isPendingFixture = (fixture) => {
  const status = String(fixture.status || "").toLowerCase();
  if (["completed", "cancelled", "canceled", "finished"].includes(status)) return false;
  const homeScore = fixture.homeScore ?? fixture.home_score;
  const awayScore = fixture.awayScore ?? fixture.away_score;
  return homeScore == null || awayScore == null;
};

const outcomeOptions = (fixture) => fixture.outcomes || [
  { id: "H", homeGoals: 1, awayGoals: 0 },
  { id: "D", homeGoals: 0, awayGoals: 0 },
  { id: "A", homeGoals: 0, awayGoals: 1 },
];

function applyFixture(table, fixture, outcome) {
  const home = table.find((row) => normalizedTeam(row.name) === normalizedTeam(fixture.home));
  const away = table.find((row) => normalizedTeam(row.name) === normalizedTeam(fixture.away));
  if (!home || !away) return;
  const homeGoals = Number(outcome.homeGoals) || 0;
  const awayGoals = Number(outcome.awayGoals) || 0;
  home.played += 1; away.played += 1;
  home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
  if (homeGoals > awayGoals) { home.points += 3; home.wins += 1; away.losses += 1; }
  else if (homeGoals < awayGoals) { away.points += 3; away.wins += 1; home.losses += 1; }
  else { home.points += 1; away.points += 1; home.draws += 1; away.draws += 1; }
}

const comparator = (rules) => (left, right) => {
  for (const rule of rules) {
    const a = rule === "goal_difference" ? left.goalsFor - left.goalsAgainst
      : rule === "goals_for" ? left.goalsFor
        : Number(left[rule]) || 0;
    const b = rule === "goal_difference" ? right.goalsFor - right.goalsAgainst
      : rule === "goals_for" ? right.goalsFor
        : Number(right[rule]) || 0;
    if (a !== b) return b - a;
  }
  return normalizedTeam(left.name).localeCompare(normalizedTeam(right.name));
};

function enumerate(fixtures, visit, index = 0, choices = []) {
  if (index >= fixtures.length) return visit(choices);
  for (const outcome of outcomeOptions(fixtures[index])) {
    choices.push(outcome);
    enumerate(fixtures, visit, index + 1, choices);
    choices.pop();
  }
}

export function calculateQualificationScenarios({
  standings,
  fixtures,
  strixName = "STRIX UNITED",
  qualificationSlots,
  tieBreakRules = [],
  maxCombinations = 59049,
}) {
  const pendingFixtures = (fixtures || [])
    .map(normalizedFixture)
    .filter((fixture) => fixture.home && fixture.away && isPendingFixture(fixture));
  const rules = tieBreakRules.length ? tieBreakRules : ["points"];
  const combinations = pendingFixtures.reduce((total, fixture) => total * outcomeOptions(fixture).length, 1);
  const base = cloneTable(standings);
  const sortedBase = [...base].sort(comparator(rules));
  const strixKey = normalizedTeam(strixName);
  const strix = base.find((row) => normalizedTeam(row.name) === strixKey);
  const computedPosition = sortedBase.findIndex((row) => normalizedTeam(row.name) === strixKey) + 1;
  const currentPosition = Number(strix?.position) || computedPosition;
  const strixFixtures = pendingFixtures.filter((fixture) => [fixture.home, fixture.away].some((team) => normalizedTeam(team) === strixKey));
  const pointsAvailable = strixFixtures.length * 3;
  const cutoff = base.find((row) => Number(row.position) === Number(qualificationSlots))
    || sortedBase[Math.max(0, qualificationSlots - 1)];
  const distanceToCutoff = cutoff && strix ? Math.max(0, cutoff.points - strix.points) : 0;
  const tiedAtCutoff = Boolean(
    cutoff && strix && currentPosition > qualificationSlots && cutoff.points === strix.points,
  );
  if (!standings.length || !qualificationSlots || !strix) {
    return { status: "insufficient_data", confirmed: false, combinations: 0, scenarios: [] };
  }
  if (combinations > maxCombinations) {
    return {
      status: "too_many_combinations", confirmed: false, combinations,
      currentPosition, remainingMatches: strixFixtures.length, pointsAvailable,
      distanceToCutoff, tiedAtCutoff, cutoffPosition: qualificationSlots, scenarios: [],
    };
  }

  let qualifies = 0;
  let misses = 0;
  let touchesUnresolvedTie = false;
  const byOwnResult = { V: { qualifies: 0, total: 0, sample: null }, E: { qualifies: 0, total: 0, sample: null }, D: { qualifies: 0, total: 0, sample: null } };
  enumerate(pendingFixtures, (choices) => {
    const table = cloneTable(base);
    pendingFixtures.forEach((fixture, index) => applyFixture(table, fixture, choices[index]));
    const sorted = table.sort(comparator(rules));
    const position = sorted.findIndex((row) => normalizedTeam(row.name) === strixKey) + 1;
    const qualified = position > 0 && position <= qualificationSlots;
    qualified ? qualifies += 1 : misses += 1;
    const boundaryA = sorted[qualificationSlots - 1];
    const boundaryB = sorted[qualificationSlots];
    if (boundaryA && boundaryB && rules.every((rule) => {
      const value = (row) => rule === "goal_difference" ? row.goalsFor - row.goalsAgainst : rule === "goals_for" ? row.goalsFor : row[rule];
      return value(boundaryA) === value(boundaryB);
    })) touchesUnresolvedTie = true;
    const ownIndex = pendingFixtures.findIndex((fixture) => [fixture.home, fixture.away].some((team) => normalizedTeam(team) === strixKey));
    if (ownIndex >= 0) {
      const fixture = pendingFixtures[ownIndex];
      const outcome = choices[ownIndex];
      const homeIsStrix = normalizedTeam(fixture.home) === strixKey;
      const ownGoals = homeIsStrix ? outcome.homeGoals : outcome.awayGoals;
      const otherGoals = homeIsStrix ? outcome.awayGoals : outcome.homeGoals;
      const key = ownGoals > otherGoals ? "V" : ownGoals < otherGoals ? "D" : "E";
      byOwnResult[key].total += 1;
      if (qualified) {
        byOwnResult[key].qualifies += 1;
        byOwnResult[key].sample ||= pendingFixtures.map((item, index) => ({ fixture: `${item.home} × ${item.away}`, outcome: choices[index].id }));
      }
    }
  });
  const scenarios = Object.entries(byOwnResult).map(([result, data]) => ({
    result,
    possible: data.qualifies > 0,
    guaranteed: data.total > 0 && data.qualifies === data.total,
    qualifyingCombinations: data.qualifies,
    totalCombinations: data.total,
    sample: data.sample,
  }));
  return {
    status: qualifies === 0 ? "impossible" : misses === 0 ? "guaranteed" : "possible",
    confirmed: tieBreakRules.length > 0 && !touchesUnresolvedTie,
    tieBreakWarning: tieBreakRules.length ? (touchesUnresolvedTie ? "Há empate além dos critérios configurados." : "") : "Critério de desempate não confirmado.",
    combinations, qualifies, misses, currentPosition,
    remainingMatches: strixFixtures.length, pointsAvailable, distanceToCutoff,
    tiedAtCutoff, cutoffPosition: qualificationSlots, scenarios,
  };
}
