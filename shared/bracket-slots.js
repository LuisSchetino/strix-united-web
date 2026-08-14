const compact = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR");

export function bracketRoundKey(label) {
  const value = compact(label);
  if (/oitava|round.?of.?16/.test(value)) return "round_of_16";
  if (/quarta|quarter/.test(value)) return "quarterfinal";
  if (/semi/.test(value)) return "semifinal";
  if (/final/.test(value)) return "final";
  return value.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "round";
}

export function bracketSlotKey(roundLabel, position) {
  return `${bracketRoundKey(roundLabel)}:${Number(position)}`;
}

const roundDepth = (label) => ["round_of_16", "quarterfinal", "semifinal", "final"].indexOf(bracketRoundKey(label));

export function knockoutPreviewScore(preview) {
  if (preview?.sourceKind !== "knockout") return -1;
  const fixtures = preview.knockout?.fixtures || [];
  const completed = fixtures.filter((fixture) => fixture.status === "completed" || (fixture.homeScore != null && fixture.awayScore != null)).length;
  const realParticipants = fixtures.reduce((total, fixture) => total
    + [fixture.homeTeamName, fixture.awayTeamName].filter((name) => name && !/^vencedor\b/i.test(name)).length, 0);
  return Math.max(0, roundDepth(preview.knockout?.currentStage)) * 10000
    + fixtures.length * 100
    + completed * 10
    + realParticipants
    + (preview.knockout?.hasStrix ? 1 : 0);
}

export function selectPreferredKnockoutPreview(previews = []) {
  return previews
    .filter((preview) => preview?.sourceKind === "knockout")
    .sort((left, right) => knockoutPreviewScore(right) - knockoutPreviewScore(left)
      || String(right.fetchedAt || "").localeCompare(String(left.fetchedAt || "")))[0] || null;
}

export function stableBracketMatchId({ provider, competitionId, groupId, roundLabel, position }) {
  return `${provider}:${competitionId}:${groupId || "main"}:slot:${bracketSlotKey(roundLabel, position)}`;
}

const feederPrefix = (roundLabel) => {
  const key = bracketRoundKey(roundLabel);
  return key === "round_of_16" ? "R16" : key === "quarterfinal" ? "QF" : key === "semifinal" ? "SF" : "FASE";
};

const normalizedTeam = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const fixtureWinner = (fixture) => {
  const homeScore = fixture?.homeScore ?? fixture?.home_score;
  const awayScore = fixture?.awayScore ?? fixture?.away_score;
  if (homeScore == null || awayScore == null
    || !Number.isFinite(Number(homeScore)) || !Number.isFinite(Number(awayScore))
    || Number(homeScore) === Number(awayScore)) return "";
  return normalizedTeam(Number(homeScore) > Number(awayScore)
    ? fixture.homeTeamName ?? fixture.home_team_name
    : fixture.awayTeamName ?? fixture.away_team_name);
};

const fixtureTeams = (fixture) => [
  fixture?.homeTeamName ?? fixture?.home_team_name,
  fixture?.awayTeamName ?? fixture?.away_team_name,
].map(normalizedTeam);

export function reconcileKnockoutRouting(fixtures = [], rounds = []) {
  const roundKeys = rounds.map((round) => bracketRoundKey(round.name));
  return fixtures.map((fixture) => {
    const currentIndex = roundKeys.indexOf(bracketRoundKey(fixture.roundLabel ?? fixture.round_label));
    const nextRoundKey = roundKeys[currentIndex + 1];
    if (currentIndex < 0 || !nextRoundKey) return fixture;
    const winner = fixtureWinner(fixture);
    const nextFixtures = fixtures.filter((candidate) => bracketRoundKey(candidate.roundLabel ?? candidate.round_label) === nextRoundKey);
    const actualTarget = winner
      ? nextFixtures.findIndex((candidate) => fixtureTeams(candidate).includes(winner))
      : -1;
    const fallbackTarget = Number(fixture.feedsIntoPosition ?? fixture.metadata?.feedsIntoPosition);
    const targetPosition = actualTarget >= 0
      ? Number(nextFixtures[actualTarget].bracketPosition ?? nextFixtures[actualTarget].bracket_position ?? actualTarget)
      : Number.isFinite(fallbackTarget) ? fallbackTarget : Math.floor(Number(fixture.bracketPosition ?? fixture.bracket_position ?? 0) / 2);
    const targetFixture = nextFixtures.find((candidate, index) => Number(candidate.bracketPosition ?? candidate.bracket_position ?? index) === targetPosition);
    const targetTeams = fixtureTeams(targetFixture);
    const winnerToSlot = winner && targetFixture
      ? targetTeams.indexOf(winner) + 1
      : Number(fixture.winnerToSlot ?? fixture.metadata?.winnerToSlot) || null;
    return {
      ...fixture,
      feedsIntoPosition: targetPosition,
      winnerToSlot,
      metadata: {
        ...(fixture.metadata || {}),
        feedsIntoPosition: targetPosition,
        winnerToSlot,
      },
    };
  });
}

export function sortBracketFixtures(fixtures = []) {
  return [...fixtures].sort((left, right) => {
    const leftPosition = Number(left.bracket_position ?? left.bracketPosition ?? left.metadata?.bracketPosition);
    const rightPosition = Number(right.bracket_position ?? right.bracketPosition ?? right.metadata?.bracketPosition);
    return (Number.isFinite(leftPosition) ? leftPosition : Number.MAX_SAFE_INTEGER)
      - (Number.isFinite(rightPosition) ? rightPosition : Number.MAX_SAFE_INTEGER);
  });
}

export function expandKnockoutSlots(preview) {
  if (preview?.sourceKind !== "knockout") return [];
  const rounds = preview.knockout?.rounds || [];
  const actual = reconcileKnockoutRouting(preview.knockout?.fixtures || [], rounds);
  if (!rounds.length || !actual.length) return actual;
  const actualByRound = new Map();
  for (const fixture of actual) {
    const key = bracketRoundKey(fixture.roundLabel);
    if (!actualByRound.has(key)) actualByRound.set(key, new Map());
    const position = Number.isInteger(Number(fixture.bracketPosition))
      ? Number(fixture.bracketPosition)
      : actualByRound.get(key).size;
    actualByRound.get(key).set(position, fixture);
  }
  const firstRoundFixtures = actualByRound.get(bracketRoundKey(rounds[0]?.name));
  let previousCount = firstRoundFixtures?.size || actual.length;
  return rounds.flatMap((round, roundIndex) => {
    const existing = actualByRound.get(bracketRoundKey(round.name)) || new Map();
    const count = existing.size || (roundIndex ? Math.max(1, Math.ceil(previousCount / 2)) : previousCount);
    previousCount = count;
    return Array.from({ length: count }, (_, position) => {
      const fixture = existing.get(position) || {
        roundLabel: round.name,
        scheduledAt: round.scheduledAt || null,
        homeTeamName: `Vencedor ${feederPrefix(rounds[roundIndex - 1]?.name)}${position * 2 + 1}`,
        awayTeamName: `Vencedor ${feederPrefix(rounds[roundIndex - 1]?.name)}${position * 2 + 2}`,
        homeLogo: "",
        awayLogo: "",
        homeScore: null,
        awayScore: null,
        status: "scheduled",
        placeholder: true,
      };
      const slotKey = bracketSlotKey(round.name, position);
      const nextRound = rounds[roundIndex + 1];
      const feedsIntoPosition = nextRound
        ? Number(fixture.feedsIntoPosition ?? fixture.metadata?.feedsIntoPosition ?? Math.floor(position / 2))
        : null;
      const winnerToSlotKey = nextRound ? bracketSlotKey(nextRound.name, feedsIntoPosition) : null;
      const winnerToSlot = nextRound
        ? Number(fixture.winnerToSlot ?? fixture.metadata?.winnerToSlot ?? ((position % 2) + 1))
        : null;
      return {
        ...fixture,
        externalMatchId: stableBracketMatchId({
          provider: preview.provider,
          competitionId: preview.externalCompetitionId,
          groupId: preview.externalGroupId,
          roundLabel: round.name,
          position,
        }),
        bracketPosition: position,
        feedsIntoPosition,
        bracketSlotKey: slotKey,
        winnerToSlotKey,
        winnerToSlot,
        metadata: {
          ...(fixture.metadata || {}),
          bracketPosition: position,
          feedsIntoPosition,
          bracketSlotKey: slotKey,
          winnerToSlotKey,
          winnerToSlot,
          placeholder: Boolean(fixture.placeholder),
        },
      };
    });
  });
}
