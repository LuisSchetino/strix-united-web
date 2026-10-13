import test from "node:test";
import assert from "node:assert/strict";
import { clubMilestones, playerMilestones, playerWeek } from "../src/features/players/milestones.js";

const row = (id, playedAt, values = {}) => ({ goals: 0, assists: 0, rating: 7, ...values, match: { id, played_at: playedAt, opponent_name: `Rival ${id}` } });
const NOW = new Date("2026-10-04T23:20:00Z"); // 20:20 on 04/10 in São Paulo

test("marks are reached in the match where the count crosses a round number", () => {
  const appearances = [
    row("m3", "2026-09-03T00:00:00Z", { goals: 3 }),       // 4 goals: nothing at 4, hat-trick here
    row("m1", "2026-09-01T00:00:00Z", { goals: 0 }),       // debut
    row("m2", "2026-09-02T00:00:00Z", { goals: 1, assists: 1 }),
    row("m4", "2026-09-04T00:00:00Z", { goals: 6, rating: 9.4 }), // 10 goals, first 9
  ];
  const { reached, totals, upcoming } = playerMilestones(appearances);
  assert.deepEqual(totals, { games: 4, goals: 10, assists: 1, cleanSheets: 0 });
  assert.deepEqual(reached.map((mark) => [mark.id, mark.matchId]), [
    ["games-1", "m1"],
    ["goals-1", "m2"], ["assists-1", "m2"],
    ["hat-trick", "m3"],
    ["goals-10", "m4"], ["rating-9", "m4"],
  ]);
  assert.equal(reached[0].label, "Estreia pelo Strix");
  assert.equal(reached.find((mark) => mark.id === "goals-10").label, "10 gols");
  assert.deepEqual(upcoming.map((item) => [item.kind, item.value, item.remaining]), [["games", 10, 6], ["goals", 25, 15], ["assists", 10, 9]]);
  assert.equal(upcoming[2].text, "Faltam 9 assistências para os 10");
  assert.equal(upcoming[0].text, "Faltam 6 jogos para os 10");
});

test("a goalkeeper counts games without conceding instead of goals", () => {
  const appearances = [row("m1", "2026-09-01T00:00:00Z", { cleansheetsgk: 1 }), row("m2", "2026-09-02T00:00:00Z", { cleansheetsgk: 0, goals: 5 })];
  const { reached, upcoming } = playerMilestones(appearances, { goalkeeper: true });
  assert.deepEqual(reached.map((mark) => mark.id), ["games-1", "cleanSheets-1"]);
  assert.equal(reached[1].label, "Primeiro jogo sem sofrer gol");
  assert.ok(!upcoming.some((item) => item.kind === "goals"));
  assert.deepEqual(playerMilestones([]).reached, []);
  assert.deepEqual(playerMilestones([]).upcoming, [], "nothing to count down to before the first game");
});

test("the week compares the last seven days with the seven before", () => {
  const appearances = [
    row("a", "2026-10-04T01:00:00Z", { goals: 2, rating: 8 }),   // 03/10 in São Paulo: this week
    row("b", "2026-09-29T01:00:00Z", { assists: 1, rating: 7 }), // 28/09: this week (6 days back)
    row("c", "2026-09-27T01:00:00Z", { goals: 1, rating: 6 }),   // 26/09: previous week
    row("d", "2026-09-01T01:00:00Z", { goals: 9 }),              // too old
  ];
  assert.deepEqual(playerWeek(appearances, NOW), {
    current: { games: 2, goals: 2, assists: 1, rating: 7.5 },
    previous: { games: 1, goals: 1, assists: 0, rating: 6 },
  });
  assert.equal(playerWeek([row("d", "2026-09-01T01:00:00Z")], NOW), null);
  assert.equal(playerWeek([], NOW), null);
});

test("the club's recent marks come newest first with who reached them", () => {
  const profiles = [
    { playerId: "p1", name: "Santozz", goalkeeper: false, appearances: [row("m1", "2026-09-01T00:00:00Z", { goals: 1 }), row("m9", "2026-10-03T00:00:00Z", { goals: 9 })] },
    { playerId: "p2", name: "Ceni", goalkeeper: true, appearances: [row("m9", "2026-10-03T00:00:00Z", { cleansheetsgk: 1 })] },
  ];
  const marks = clubMilestones(profiles, { since: "2026-10-01T00:00:00Z" });
  assert.deepEqual(marks.map((mark) => [mark.name, mark.id]), [["Santozz", "goals-10"], ["Santozz", "hat-trick"], ["Ceni", "games-1"], ["Ceni", "cleanSheets-1"]]);
  assert.equal(clubMilestones(profiles, { since: "2026-11-01T00:00:00Z" }).length, 0);
});
