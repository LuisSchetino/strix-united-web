import test from "node:test";
import assert from "node:assert/strict";
import { qualificationOutlook } from "../src/features/competitions/scenario-engine.js";

test("last round: says what the other game has to be for each result of ours", () => {
  // Two places. Strix and Time X level on 9, the leader out of reach, Time Y two behind.
  const result = qualificationOutlook({
    standings: [
      { name: "Líder", points: 12, position: 1 },
      { name: "STRIX UNITED", points: 9, position: 2 },
      { name: "Time X", points: 9, position: 3 },
      { name: "Time Y", points: 7, position: 4 },
    ],
    fixtures: [
      { home: "STRIX UNITED", away: "Líder", scheduledAt: "2026-10-08T21:10:00-03:00" },
      { home: "Time X", away: "Time Y", scheduledAt: "2026-10-08T21:10:00-03:00" },
    ],
    qualificationSlots: 2,
  });
  assert.equal(result.status, "possible");
  assert.equal(result.combinations, 9);
  assert.equal(result.position, 2);
  assert.equal(result.remainingMatches, 1);
  assert.equal(result.pointsAvailable, 3);
  assert.equal(result.nextMatch.opponent, "Líder");
  const path = (letter) => result.conditions.find((item) => item.results[0].result === letter);
  // Winning: 12 points. Inside unless Time X also wins and reaches 12 (level on points with both).
  assert.equal(path("V").verdict, "possible");
  assert.deepEqual(path("V").needs, ["Time X não vence Time Y"]);
  assert.equal(path("V").exact, true);
  assert.deepEqual([path("V").in, path("V").tie, path("V").out], [2, 1, 0]);
  // Drawing: 10 points. Time X winning passes us; any other result leaves a club level with us on 10.
  assert.deepEqual(path("E").needs, []);
  assert.deepEqual([path("E").in, path("E").tie, path("E").out], [0, 2, 1]);
  assert.equal(path("E").verdict, "possible", "só pelo desempate");
  // Losing: 9 points, and two clubs always finish above.
  assert.equal(path("D").verdict, "impossible");
  assert.deepEqual(result.nextMatch.byResult.map((item) => [item.result, item.in, item.tie, item.total]), [["V", 2, 1, 3], ["E", 0, 2, 3], ["D", 0, 0, 3]]);
});

test("guaranteed and impossible are stated only when every combination agrees", () => {
  const safe = qualificationOutlook({
    standings: [{ name: "STRIX UNITED", points: 20 }, { name: "Time X", points: 10 }, { name: "Time Y", points: 8 }],
    fixtures: [{ home: "Time X", away: "Time Y" }],
    qualificationSlots: 1,
  });
  assert.equal(safe.status, "guaranteed");
  assert.equal(safe.guarantee.points, 20);
  const gone = qualificationOutlook({
    standings: [{ name: "Líder", points: 20 }, { name: "Time X", points: 16 }, { name: "STRIX UNITED", points: 8 }],
    fixtures: [{ home: "STRIX UNITED", away: "Líder" }],
    qualificationSlots: 2,
  });
  assert.equal(gone.status, "impossible");
  assert.equal(gone.alive, null);
});

test("a level finish on the cut line is a tie-break, never counted as in or out", () => {
  const result = qualificationOutlook({
    standings: [{ name: "STRIX UNITED", points: 3 }, { name: "Time X", points: 3 }],
    fixtures: [],
    qualificationSlots: 1,
  });
  assert.deepEqual(result.overall, { in: 0, tie: 1, out: 0 });
  assert.equal(result.status, "possible");
});

test("start of a four-club double round robin: the points that guarantee a place", () => {
  const clubs = ["Desagregados SC", "EC SINTONIA", "GORILLAS TEAM", "STRIX UNITED"];
  const fixtures = [];
  for (const home of clubs) for (const away of clubs) if (home !== away) fixtures.push({ homeTeamName: home, awayTeamName: away, status: "scheduled", scheduledAt: `2026-10-${String(5 + fixtures.length).padStart(2, "0")}T21:10:00-03:00` });
  // A game of another group and a game already played are not part of it.
  fixtures.push({ homeTeamName: "FOLGA.", awayTeamName: "REIS DO PRO", status: "scheduled" });
  const started = Date.now();
  const result = qualificationOutlook({
    standings: clubs.map((name, order) => ({ team: name, points: 0, position: order + 1 })),
    fixtures,
    qualificationSlots: 2,
  });
  assert.equal(result.pendingInGroup, 12);
  assert.equal(result.combinations, 3 ** 12);
  assert.equal(result.remainingMatches, 6);
  assert.equal(result.pointsAvailable, 18);
  assert.equal(result.tiedAtCutoff, true);
  assert.equal(result.status, "possible");
  assert.equal(result.overall.in + result.overall.tie + result.overall.out, 3 ** 12);
  // 18 points is first place alone. The engine finds the real threshold below it.
  assert.equal(result.ladder[0].points, 18);
  assert.equal(result.ladder[0].verdict, "guaranteed");
  assert.ok(result.guarantee.points <= 16 && result.guarantee.points >= 11, `garante com ${result.guarantee.points}`);
  assert.ok(result.alive.points < result.guarantee.points);
  assert.equal(result.conditions.length, 0, "com doze jogos pela frente não há combinação para listar");
  assert.equal(result.nextMatch.byResult.length, 3);
  assert.ok(result.nextMatch.byResult[0].in > result.nextMatch.byResult[2].in, "vencer o próximo jogo abre mais caminhos que perder");
  assert.ok(Date.now() - started < 3000, "a simulação inteira cabe em poucos instantes");
  console.log(`garante com ${result.guarantee.points} pts · ainda dá com ${result.alive.points} pts · ${Date.now() - started} ms`);
});

test("too many games left or no rule: says so instead of guessing", () => {
  const clubs = Array.from({ length: 8 }, (_, order) => `Clube ${order}`).concat("STRIX UNITED");
  const fixtures = [];
  for (const home of clubs) for (const away of clubs) if (home < away) fixtures.push({ home, away });
  const result = qualificationOutlook({ standings: clubs.map((name) => ({ name, points: 0 })), fixtures, qualificationSlots: 4 });
  assert.equal(result.status, "too_many");
  assert.equal(result.remainingMatches, 8);
  assert.equal(qualificationOutlook({ standings: [{ name: "STRIX UNITED", points: 1 }], fixtures: [] }).status, "insufficient_data");
  assert.equal(qualificationOutlook({ standings: [{ name: "Outro", points: 1 }], fixtures: [], qualificationSlots: 1 }).status, "insufficient_data");
});

test("played games are ignored and the provider's field names are understood", () => {
  const result = qualificationOutlook({
    standings: [{ name: "Líder", points: 12 }, { name: "STRIX UNITED", points: 9 }, { name: "Time X", points: 8 }],
    fixtures: [
      { homeTeamName: "STRIX UNITED", awayTeamName: "Líder", status: "scheduled" },
      { homeTeamName: "STRIX UNITED", awayTeamName: "Time X", status: "completed", homeScore: 2, awayScore: 0 },
      { home_team_name: "Time X", away_team_name: "Líder", home_score: 1, away_score: 1 },
    ],
    qualificationSlots: 2,
  });
  assert.equal(result.remainingMatches, 1);
  assert.equal(result.pendingInGroup, 1);
  assert.equal(result.status, "guaranteed", "com 9 pontos e o Time X sem jogos, a vaga já é do Strix");
});

test("a half-published calendar never closes the group: no verdict after the first round only", () => {
  // Four clubs, two go through, only the first round is on the calendar. Played out as if it
  // were everything, a win would "guarantee" and a loss would "eliminate": both are false.
  const standings = ["STRIX UNITED", "Desagregados SC", "Scout Team", "Roma"].map((name, index) => ({ name, points: 0, played: 0, position: index + 1 }));
  const firstRound = [
    { home: "STRIX UNITED", away: "Desagregados SC", status: "scheduled", scheduledAt: "2026-10-05T21:10:00-03:00" },
    { home: "Scout Team", away: "Roma", status: "scheduled", scheduledAt: "2026-10-05T21:40:00-03:00" },
  ];
  const partial = qualificationOutlook({ standings, fixtures: firstRound, qualificationSlots: 2 });
  assert.equal(partial.status, "schedule_incomplete");
  assert.equal(partial.nextMatch, undefined);

  const full = [
    ...firstRound,
    { home: "STRIX UNITED", away: "Scout Team", status: "scheduled", scheduledAt: "2026-10-06T21:10:00-03:00" },
    { home: "Desagregados SC", away: "Roma", status: "scheduled", scheduledAt: "2026-10-06T21:40:00-03:00" },
    { home: "STRIX UNITED", away: "Roma", status: "scheduled", scheduledAt: "2026-10-07T21:10:00-03:00" },
    { home: "Desagregados SC", away: "Scout Team", status: "scheduled", scheduledAt: "2026-10-07T21:40:00-03:00" },
  ];
  const whole = qualificationOutlook({ standings, fixtures: full, qualificationSlots: 2 });
  assert.equal(whole.status, "possible");
  const win = whole.nextMatch.byResult.find((entry) => entry.result === "V");
  assert.ok(win.in < win.total, "with the whole calendar, winning the first game guarantees nothing");
});
