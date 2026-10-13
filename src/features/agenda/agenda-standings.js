import { normalizeTeamIdentityName } from "../teams/team-identity.js";

const standingRows = (source) => (source?.snapshot?.groups || [])
  .flatMap((group) => group?.standings || []);

/**
 * The slice of the table worth showing beside a fixture: the leader, both clubs
 * and their neighbours. `gap: true` marks a jump in positions between rows.
 */
export function standingsWindow(rows = [], strix, opponent, radius = 1) {
  const ordered = [...rows].sort((left, right) => (Number(left.position) || 999) - (Number(right.position) || 999));
  const keep = new Set([0]);
  ordered.forEach((row, index) => {
    if (row !== strix && row !== opponent) return;
    for (let offset = -radius; offset <= radius; offset += 1) if (ordered[index + offset]) keep.add(index + offset);
  });
  const picked = [...keep].sort((left, right) => left - right);
  return picked.map((index, order) => ({
    ...ordered[index],
    isStrix: ordered[index] === strix,
    isOpponent: ordered[index] === opponent,
    gap: order > 0 && index - picked[order - 1] > 1,
  }));
}

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
  const opponent = opponentMatches[0];
  // The table shown is the group both clubs share; clubs in different groups are compared by card only.
  const group = (source.snapshot.groups || []).find((item) => (item?.standings || []).includes(strix));
  const sameGroup = Boolean(group && group.standings.includes(opponent));
  const points = Number(strix.points) - Number(opponent.points);
  return {
    available: true,
    competition: source.snapshot.name || entry.competition_name,
    strix,
    opponent,
    group: sameGroup ? group.name || "" : "",
    teams: sameGroup ? group.standings.length : 0,
    table: sameGroup ? standingsWindow(group.standings, strix, opponent) : [],
    pointsGap: Number.isFinite(points) ? points : null,
  };
}
