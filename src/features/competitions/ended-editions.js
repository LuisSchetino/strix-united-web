import { deriveCompetitionView } from "./competition-core.js";
import { detectParticipationEnd } from "./history-core.js";

/**
 * Editions still listed as active in which Strix's participation is over for certain
 * (eliminated in a knockout round, or the final was played): the ones to send to the Histórico.
 * `[{ id, name, outcome, at }]`.
 */
export function endedEditions({ editions = [], competitions = [], sources = [], fixtures = [] } = {}) {
  return (Array.isArray(editions) ? editions : [])
    .filter((edition) => edition && edition.status !== "historical")
    .map((edition) => {
      const competition = competitions.find((item) => item.id === edition.competition_id);
      if (!competition) return null;
      const view = deriveCompetitionView(sources.filter((source) => source.edition_id === edition.id), fixtures.filter((fixture) => fixture.edition_id === edition.id), edition);
      const end = detectParticipationEnd({ edition, fixtures: view.fixtures });
      return end.ended ? { id: edition.id, name: competition.name, outcome: end.outcome, at: end.fixture?.scheduled_at || edition.updated_at || "" } : null;
    })
    .filter(Boolean);
}
