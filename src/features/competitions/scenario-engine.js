// What Strix needs to qualify, worked out by playing every remaining game of
// its group in every possible way (win, draw, loss). Only points are projected:
// the scores of games not yet played are unknown, so a finish level on points
// with the cut line is reported as "depends on the tie-break", never guessed.

// Club names are matched without accents, spaces or punctuation: the table and the calendar of
// the same organiser do not always write a club the same way.
const key = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const sideNames = (fixture) => ({
  home: fixture.home || fixture.homeTeamName || fixture.home_team_name || "",
  away: fixture.away || fixture.awayTeamName || fixture.away_team_name || "",
});

const isPending = (fixture) => {
  const status = String(fixture.status || "").toLowerCase();
  if (["completed", "cancelled", "canceled", "finished"].includes(status)) return false;
  const homeScore = fixture.homeScore ?? fixture.home_score;
  const awayScore = fixture.awayScore ?? fixture.away_score;
  return homeScore == null || awayScore == null;
};

const when = (fixture) => String(fixture.scheduledAt || fixture.scheduled_at || "");

// Outcome of one game: 0 = home wins, 1 = draw, 2 = away wins.
const HOME = [3, 1, 0];
const AWAY = [0, 1, 3];
const blank = () => ({ in: 0, tie: 0, out: 0 });
const total = (count) => count.in + count.tie + count.out;

/**
 * The count is only as true as the list of games it plays out. A group table is a round robin:
 * every club ends on the same number of games, at least one against each rival. While the
 * organiser has published only part of the calendar (the first round, say), playing out "every
 * remaining game" would close the group after that round and announce a place won or lost that
 * is still wide open. `played` comes from the table; where the table does not say it, the games
 * already played are counted from the calendar itself (`settled`). A calendar that cannot be
 * shown to be whole is treated as not whole: better no sentence than a wrong "vaga garantida".
 */
function scheduleIsComplete(teams, pending, settled = []) {
  // Nothing to check against (no games played in the table, none settled in the calendar): the list is taken as given.
  if (teams.some((team) => team.played == null) && !settled.some(Boolean)) return true;
  const totals = teams.map((team, position) => (team.played == null ? settled[position] || 0 : team.played) + pending.filter((fixture) => fixture.h === position || fixture.a === position).length);
  return totals[0] >= teams.length - 1 && totals.every((games) => games === totals[0]);
}

/** What one other game must be for a set of allowed outcomes, in words. */
function requirement(fixture, allowed) {
  const has = (outcome) => allowed.includes(outcome);
  const { home, away } = fixture;
  if (allowed.length === 1) return has(0) ? `${home} vence ${away}` : has(2) ? `${away} vence ${home}` : `${home} e ${away} empatam`;
  if (has(0) && has(1)) return `${home} não perde para ${away}`;
  if (has(1) && has(2)) return `${home} não vence ${away}`;
  return `${home} × ${away} não termina empatado`;
}

/**
 * The outlook for Strix in its group.
 *
 * `standings` are the group's rows (`name`, `points`, `position`), `fixtures`
 * the edition's games (played ones and games of other groups are ignored).
 * Returns the current picture, the points that guarantee a place, how each
 * result of the next game changes the count, and, near the end, what the other
 * games have to be for each result of Strix's own.
 */
export function qualificationOutlook({ standings = [], fixtures = [], strixName = "STRIX UNITED", qualificationSlots, maxLeaves = 1_600_000 } = {}) {
  const slots = Number(qualificationSlots) || 0;
  const teams = standings.map((row) => ({
    name: row.name || row.team || "",
    points: Number(row.points) || 0,
    position: Number(row.position) || 0,
    played: row.played == null || row.played === "" || !Number.isFinite(Number(row.played)) ? null : Number(row.played),
  }));
  const strixIndex = teams.findIndex((team) => key(team.name) === key(strixName));
  if (!teams.length || !slots || strixIndex < 0) return { status: "insufficient_data" };

  const index = new Map(teams.map((team, position) => [key(team.name), position]));
  const pending = fixtures
    .map((fixture) => ({ ...sideNames(fixture), at: when(fixture), raw: fixture }))
    .filter((fixture) => index.has(key(fixture.home)) && index.has(key(fixture.away)) && isPending(fixture.raw))
    .sort((left, right) => left.at.localeCompare(right.at))
    .map((fixture) => ({ ...fixture, h: index.get(key(fixture.home)), a: index.get(key(fixture.away)) }));
  const own = pending.map((fixture, order) => ({ fixture, order })).filter(({ fixture }) => fixture.h === strixIndex || fixture.a === strixIndex);

  const strix = teams[strixIndex];
  const ranked = [...teams].sort((left, right) => right.points - left.points);
  const position = strix.position || ranked.findIndex((team) => team === strix) + 1;
  const cut = teams.find((team) => team.position === slots) || ranked[Math.min(slots, ranked.length) - 1];
  const basics = {
    position,
    points: strix.points,
    cutoffPosition: slots,
    cutoffPoints: cut?.points ?? 0,
    distanceToCutoff: cut ? Math.max(0, cut.points - strix.points) : 0,
    tiedAtCutoff: Boolean(cut && position > slots && cut.points === strix.points),
    remainingMatches: own.length,
    pointsAvailable: own.length * 3,
    pendingInGroup: pending.length,
    teams: teams.length,
  };
  const settled = teams.map(() => 0);
  for (const fixture of fixtures) {
    const names = sideNames(fixture);
    const h = index.get(key(names.home)), a = index.get(key(names.away));
    if (h == null || a == null || isPending(fixture) || /^cancel/i.test(String(fixture.status || ""))) continue;
    settled[h] += 1; settled[a] += 1;
  }
  if (!scheduleIsComplete(teams, pending, settled)) return { status: "schedule_incomplete", ...basics };
  const leaves = 3 ** pending.length;
  if (leaves > maxLeaves) return { status: "too_many", ...basics, combinations: leaves };

  const points = teams.map((team) => team.points);
  // The best and the worst place on points alone (level on points counts against, for the worst).
  let best = teams.length, worst = 1;
  const overall = blank();
  const byPoints = new Map();
  const next = own[0] || null;
  const byNext = { V: blank(), E: blank(), D: blank() };
  // Near the end (few games, at most two of ours) every leaf is kept, to say what the other games must be.
  const detailed = pending.length <= 8 && own.length <= 2;
  const paths = new Map();
  const choice = new Array(pending.length).fill(0);
  const ownResult = (fixture, outcome) => (outcome === 1 ? "E" : (outcome === 0) === (fixture.h === strixIndex) ? "V" : "D");

  const visit = (depth) => {
    if (depth === pending.length) {
      const mine = points[strixIndex];
      let better = 0;
      let level = 0;
      for (let team = 0; team < points.length; team += 1) {
        if (team === strixIndex) continue;
        if (points[team] > mine) better += 1;
        else if (points[team] === mine) level += 1;
      }
      if (better + 1 < best) best = better + 1;
      if (better + level + 1 > worst) worst = better + level + 1;
      const verdict = better + level < slots ? "in" : better >= slots ? "out" : "tie";
      overall[verdict] += 1;
      const bucket = byPoints.get(mine) || blank();
      bucket[verdict] += 1;
      byPoints.set(mine, bucket);
      if (next) byNext[ownResult(next.fixture, choice[next.order])][verdict] += 1;
      if (detailed) {
        const results = own.map(({ fixture, order }) => ownResult(fixture, choice[order])).join("");
        const path = paths.get(results) || { results, count: blank(), allowed: pending.map(() => new Set()) };
        path.count[verdict] += 1;
        if (verdict === "in") choice.forEach((outcome, order) => path.allowed[order].add(outcome));
        paths.set(results, path);
      }
      return;
    }
    const fixture = pending[depth];
    for (let outcome = 0; outcome < 3; outcome += 1) {
      choice[depth] = outcome;
      points[fixture.h] += HOME[outcome];
      points[fixture.a] += AWAY[outcome];
      visit(depth + 1);
      points[fixture.h] -= HOME[outcome];
      points[fixture.a] -= AWAY[outcome];
    }
  };
  visit(0);

  const ladder = [...byPoints.entries()].sort((left, right) => right[0] - left[0]).map(([finalPoints, count]) => ({
    points: finalPoints,
    gained: finalPoints - strix.points,
    ...count,
    total: total(count),
    verdict: count.out === 0 && count.tie === 0 ? "guaranteed" : count.in === 0 && count.tie === 0 ? "impossible" : "possible",
  }));
  // The fewest points from which every finish is inside, whatever the others do.
  let guarantee = null;
  for (const step of ladder) {
    if (step.verdict !== "guaranteed") break;
    guarantee = step;
  }
  const alive = [...ladder].reverse().find((step) => step.verdict !== "impossible") || null;

  const others = pending.map((fixture, order) => ({ fixture, order })).filter(({ fixture }) => fixture.h !== strixIndex && fixture.a !== strixIndex);
  const conditions = detailed ? [...paths.values()].map((path) => {
    const sum = total(path.count);
    const needs = others
      .filter(({ order }) => path.allowed[order].size > 0 && path.allowed[order].size < 3)
      .map(({ fixture, order }) => requirement(fixture, [...path.allowed[order]].sort()));
    // When the allowed results multiply exactly into the qualifying count, the list is the whole condition.
    const product = others.reduce((size, { order }) => size * (path.allowed[order].size || 0), 1);
    return {
      results: own.map(({ fixture }, order) => ({ opponent: fixture.h === strixIndex ? fixture.away : fixture.home, result: path.results[order] })),
      earned: [...path.results].reduce((sum2, result) => sum2 + (result === "V" ? 3 : result === "E" ? 1 : 0), 0),
      verdict: path.count.in === sum ? "guaranteed" : path.count.in === 0 && path.count.tie === 0 ? "impossible" : "possible",
      ...path.count,
      total: sum,
      needs,
      exact: path.count.in > 0 && product === path.count.in,
    };
  }).sort((left, right) => right.earned - left.earned || right.in - left.in) : [];

  return {
    status: overall.out === 0 && overall.tie === 0 ? "guaranteed" : overall.in === 0 && overall.tie === 0 ? "impossible" : "possible",
    ...basics,
    combinations: leaves,
    finish: { best, worst },
    overall,
    ladder,
    guarantee,
    alive,
    nextMatch: next ? {
      opponent: next.fixture.h === strixIndex ? next.fixture.away : next.fixture.home,
      at: next.fixture.at,
      byResult: ["V", "E", "D"].map((result) => ({ result, ...byNext[result], total: total(byNext[result]) })),
    } : null,
    conditions,
  };
}
