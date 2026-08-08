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

const isStrixFixture = (fixture) => /\bstrix\b/i.test(`${fixture.home_team_name || fixture.homeTeamName} ${fixture.away_team_name || fixture.awayTeamName}`);

export function qualificationState(row, slots) {
  if (!row || !Number(slots)) return null;
  const distance = Number(row.position) - Number(slots);
  return distance <= 0
    ? { inside: true, label: "Dentro da zona", distance: 0 }
    : { inside: false, label: `Fora da zona Â· ${distance} posiÃ§Ã£o${distance === 1 ? "" : "Ãµes"}`, distance };
}

export function deriveCompetitionView(sources = [], persistedFixtures = [], edition = {}) {
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
  const allUpcoming = fixtures.filter((fixture) => !["completed", "cancelled"].includes(fixture.status));
  const allProviderResults = fixtures.filter((fixture) => fixture.status === "completed" || (fixture.home_score != null && fixture.away_score != null));
  const upcoming = allUpcoming.filter(isStrixFixture);
  const providerResults = allProviderResults.filter(isStrixFixture);
  const groupFinished = fixtures.length > 0 && fixtures.every((fixture) => ["completed", "cancelled"].includes(fixture.status));
  const expectsKnockout = /grupo|mata-mata|knockout/i.test(`${standings.type || ""} ${standings.phase || ""}`);
  const awaitingKnockout = !knockoutSource && groupFinished && expectsKnockout;
  const currentStage = awaitingKnockout
    ? "Aguardando mata-mata"
    : stageLabel(knockout.knockout?.currentStage || (knockoutSource ? "knockout" : standings.phase));
  const strixFixture = upcoming.find((fixture) => /\bstrix\b/i.test(`${fixture.home_team_name} ${fixture.away_team_name}`)) || null;
  return {
    standingsSource,
    knockoutSource,
    standings,
    knockout,
    hasKnockout: Boolean(knockoutSource),
    currentStage,
    fixtures,
    allUpcoming,
    allProviderResults,
    upcoming,
    providerResults,
    strixFixture,
    awaitingKnockout,
    qualificationSlots: Number(edition.qualification_slots || standings.qualificationRule?.slots) || null,
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
