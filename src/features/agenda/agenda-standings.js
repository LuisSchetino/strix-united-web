import { normalizeTeamIdentityName } from "../teams/team-identity.js";

const standingRows = (source) => (source?.snapshot?.groups || [])
  .flatMap((group) => group?.standings || []);

export function agendaStandingComparison(entry, sources = [], teams = []) {
  if (!entry?.competition_edition_id) return { available: false, reason: "no_competition" };
  const source = sources.find((item) => item.edition_id === entry.competition_edition_id
    && item.source_kind === "standings"
    && item.snapshot);
  if (!source) return { available: false, reason: "no_standings" };
  const rows = standingRows(source);
  const strix = rows.find((row) => row.isStrix)
    || rows.find((row) => normalizeTeamIdentityName(row.team).includes("strix"));
  const canonicalOpponent = teams.find((team) => team.id === entry.opponent_team_id)?.name
    || entry.opponent_name;
  const normalizedOpponent = normalizeTeamIdentityName(canonicalOpponent);
  const opponentMatches = rows.filter((row) => normalizeTeamIdentityName(row.team) === normalizedOpponent);
  if (!strix || opponentMatches.length !== 1) {
    return {
      available: false,
      reason: !strix ? "strix_missing" : opponentMatches.length ? "ambiguous_opponent" : "opponent_missing",
    };
  }
  return {
    available: true,
    competition: source.snapshot.name || entry.competition_name,
    strix,
    opponent: opponentMatches[0],
  };
}
