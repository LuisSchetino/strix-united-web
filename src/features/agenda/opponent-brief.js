// "Ficha do adversário": what the club already knows about the team it is about to face.
// Two sources, both real: Strix's own results against that team, and that team's published
// results in the competition this game belongs to. Nothing else is known, nothing else is shown.
import { normalizeTeamIdentityName } from "../teams/team-identity.js";

// A club is the same club with or without its suffix: "Maquina FC", "MAQUINA ESPORTS" and
// "Maquina" are one opponent (the rule the rest of the product uses to recognise a team).
const normalizeName = (value) => normalizeTeamIdentityName(value);

const score = (value) => (value === null || value === undefined || String(value).trim() === "" ? NaN : Number(value));
const stamp = (value) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};
const verdict = (ours, theirs) => (ours > theirs ? "V" : ours < theirs ? "D" : "E");

/** Strix against this opponent, most recent first, with the record. */
export function headToHead(matches = [], opponentName = "", { limit = 5 } = {}) {
  const key = normalizeName(opponentName);
  const games = (Array.isArray(matches) ? matches : [])
    .filter((match) => key && normalizeName(match.opponent_name) === key && Number.isFinite(score(match.strix_score)) && Number.isFinite(score(match.opponent_score)))
    .sort((left, right) => stamp(right.played_at) - stamp(left.played_at))
    .map((match) => ({
      id: match.id,
      playedAt: match.played_at,
      competition: match.competition_name || "Amistoso",
      strix: score(match.strix_score),
      opponent: score(match.opponent_score),
      result: verdict(score(match.strix_score), score(match.opponent_score)),
    }));
  const record = { games: games.length, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const game of games) {
    record[game.result === "V" ? "wins" : game.result === "D" ? "losses" : "draws"] += 1;
    record.goalsFor += game.strix;
    record.goalsAgainst += game.opponent;
  }
  return { record, games: games.slice(0, limit) };
}

/**
 * The opponent's finished games in one edition, most recent first, seen from its side
 * (`result` is its result). Games against Strix are included: they are part of its form.
 */
export function opponentForm(fixtures = [], editionId = "", opponentName = "", { limit = 5 } = {}) {
  const key = normalizeName(opponentName);
  if (!key || !editionId) return [];
  return (Array.isArray(fixtures) ? fixtures : [])
    .filter((fixture) => fixture.edition_id === editionId)
    .map((fixture) => {
      const home = normalizeName(fixture.home_team_name) === key;
      const away = normalizeName(fixture.away_team_name) === key;
      const homeScore = score(fixture.home_score);
      const awayScore = score(fixture.away_score);
      if ((!home && !away) || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
      const own = home ? homeScore : awayScore;
      const other = home ? awayScore : homeScore;
      return {
        id: fixture.id,
        playedAt: fixture.scheduled_at,
        round: fixture.round_label || "",
        against: home ? fixture.away_team_name : fixture.home_team_name,
        own,
        other,
        result: verdict(own, other),
      };
    })
    .filter(Boolean)
    .sort((left, right) => stamp(right.playedAt) - stamp(left.playedAt))
    .slice(0, limit);
}

/** Everything known about the opponent of one Agenda match; `empty` when there is nothing to show. */
export function opponentBrief(match, { matches = [], fixtures = [] } = {}) {
  const name = match?.opponent_name || "";
  const history = headToHead(matches, name);
  const form = opponentForm(fixtures, match?.competition_edition_id || "", name);
  return { name, history, form, empty: history.record.games === 0 && form.length === 0 };
}
