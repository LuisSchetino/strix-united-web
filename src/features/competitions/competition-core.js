import { normalizeName } from "../matches/import-core.js";

const stageLabel = (value) => {
  if (/quarter|quarta/i.test(value || "")) return "Quartas de final";
  if (/round_of_16|oitava/i.test(value || "")) return "Oitavas de final";
  if (/semi/i.test(value || "")) return "Semifinais";
  if (/final/i.test(value || "")) return "Final";
  if (/group|standings|league/i.test(value || "")) return "Classificação";
  return value || "Fase não identificada";
};

const fixtureKey = (fixture) => fixture.external_match_id || fixture.externalMatchId
  || `${normalizeName(fixture.home_team_name || fixture.homeTeamName)}:${normalizeName(fixture.away_team_name || fixture.awayTeamName)}:${fixture.scheduled_at || fixture.scheduledAt || ""}`;

export function deriveCompetitionView(sources = [], persistedFixtures = []) {
  const standingsSource = sources.find((source) => source.source_kind === "standings");
  const knockoutSource = sources.find((source) => source.source_kind === "knockout");
  const standings = standingsSource?.snapshot || {};
  const knockout = knockoutSource?.snapshot || {};
  const snapshotFixtures = sources.flatMap((source) => [
    ...(source.snapshot?.fixtures || []),
    ...(source.snapshot?.knockout?.fixtures || []),
  ]).map((fixture) => ({
    ...fixture,
    external_match_id: fixture.externalMatchId,
    round_label: fixture.roundLabel,
    scheduled_at: fixture.scheduledAt,
    home_team_name: fixture.homeTeamName,
    away_team_name: fixture.awayTeamName,
    home_score: fixture.homeScore,
    away_score: fixture.awayScore,
  }));
  const fixtures = [...persistedFixtures, ...snapshotFixtures].filter((fixture, index, all) => all.findIndex((item) => fixtureKey(item) === fixtureKey(fixture)) === index);
  const currentStage = stageLabel(knockout.knockout?.currentStage || (knockoutSource ? "knockout" : standings.phase));
  const upcoming = fixtures.filter((fixture) => !["completed", "cancelled"].includes(fixture.status));
  const providerResults = fixtures.filter((fixture) => fixture.status === "completed" || (fixture.home_score != null && fixture.away_score != null));
  const strixFixture = upcoming.find((fixture) => /\bstrix\b/i.test(`${fixture.home_team_name} ${fixture.away_team_name}`)) || null;
  return {
    standingsSource,
    knockoutSource,
    standings,
    knockout,
    hasKnockout: Boolean(knockoutSource),
    currentStage,
    fixtures,
    upcoming,
    providerResults,
    strixFixture,
    lastSyncedAt: sources.map((source) => source.last_synced_at).filter(Boolean).sort().at(-1) || null,
  };
}

export function reconcileCompetitionResults(providerResults = [], internalMatches = []) {
  return providerResults.map((fixture) => {
    const internal = internalMatches.find((match) => {
      const opponent = /\bstrix\b/i.test(fixture.home_team_name) ? fixture.away_team_name : fixture.home_team_name;
      return normalizeName(match.opponent_name) === normalizeName(opponent);
    });
    return internal ? { ...fixture, internalMatch: internal } : fixture;
  });
}
