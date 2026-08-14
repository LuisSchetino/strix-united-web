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

export function stableBracketMatchId({ provider, competitionId, groupId, roundLabel, position }) {
  return `${provider}:${competitionId}:${groupId || "main"}:slot:${bracketSlotKey(roundLabel, position)}`;
}

const feederPrefix = (roundLabel) => {
  const key = bracketRoundKey(roundLabel);
  return key === "round_of_16" ? "R16" : key === "quarterfinal" ? "QF" : key === "semifinal" ? "SF" : "FASE";
};

export function expandKnockoutSlots(preview) {
  if (preview?.sourceKind !== "knockout") return [];
  const rounds = preview.knockout?.rounds || [];
  const actual = preview.knockout?.fixtures || [];
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
      const slotKey = bracketSlotKey(round.name, position);
      const nextRound = rounds[roundIndex + 1];
      const winnerToSlotKey = nextRound ? bracketSlotKey(nextRound.name, Math.floor(position / 2)) : null;
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
        feedsIntoPosition: nextRound ? Math.floor(position / 2) : null,
        bracketSlotKey: slotKey,
        winnerToSlotKey,
        winnerToSlot: nextRound ? (position % 2) + 1 : null,
        metadata: {
          ...(fixture.metadata || {}),
          bracketPosition: position,
          feedsIntoPosition: nextRound ? Math.floor(position / 2) : null,
          bracketSlotKey: slotKey,
          winnerToSlotKey,
          winnerToSlot: nextRound ? (position % 2) + 1 : null,
          placeholder: Boolean(fixture.placeholder),
        },
      };
    });
  });
}
