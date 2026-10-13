import { aggregatePlayerStatistics, buildPlayerProfile, buildPlayerProfileChoices } from "../statistics/statistics-core.js";

/**
 * Every active roster player with his real appearances (the rows the ficha reads), for
 * whatever needs to look across the squad: marks reached, the member's own week.
 * `[{ playerId, name, goalkeeper, appearances }]`.
 */
export function rosterProfiles({ matches = [], players = [], aliases = [] } = {}) {
  const statistics = aggregatePlayerStatistics(matches, { players, aliases });
  return buildPlayerProfileChoices(statistics, players, aliases)
    .filter((choice) => choice.playerId)
    .map((choice) => ({
      playerId: choice.playerId,
      name: choice.name,
      goalkeeper: Boolean(choice.goalkeeper),
      appearances: buildPlayerProfile(choice, matches, { aliases })?.appearances || [],
    }));
}
