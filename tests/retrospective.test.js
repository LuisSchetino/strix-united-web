import test from "node:test";
import assert from "node:assert/strict";
import { editionLeaders } from "../src/features/competitions/history-core.js";
import { compareRows } from "../src/features/statistics/compare-core.js";
import { nightBatchPlan } from "../src/features/media/night-batch.js";

const players = [
  { id: "p1", display_name: "Santozz", positions: ["ATA"], is_active: true },
  { id: "p2", display_name: "Nunes", positions: ["MC"], is_active: true },
  { id: "p3", display_name: "Ceni", positions: ["GOL"], is_active: true },
];
const row = (name, rating, goals = 0) => ({ eaName: name, rating, goals, assists: 0, passesMade: 10, passesAttempts: 12, shots: 2, tackles: 1, secondsPlayed: 5400 });
const game = (id, rows) => ({ id, played_at: `2026-09-0${id}T00:00:00Z`, opponent_name: `Rival ${id}`, strix_score: 2, opponent_score: 0, performance: { players: rows } });

test("an edition's retrospective names the top scorer and the best average among regulars", () => {
  const matches = [
    game(1, [row("Santozz", 8, 2), row("Nunes", 7), row("Ceni", 7.5)]),
    game(2, [row("Santozz", 7, 1), row("Nunes", 9.5)]),
    game(3, [row("Santozz", 6, 0), row("Ceni", 9.9)]),
    game(4, [row("Santozz", 7, 0), row("Nunes", 8.5, 3)]),
  ];
  const leaders = editionLeaders(matches, { players, aliases: [] });
  assert.equal(leaders.games, 4);
  assert.deepEqual(leaders.topScorer, { names: ["Santozz", "Nunes"], goals: 3 }, "a tie names both");
  // Ceni averages 8.7 over two games; Nunes 8.3 over three; both reach the minimum of two.
  assert.deepEqual(leaders.bestRating, { names: ["Ceni"], value: 8.7, minimum: 2 });
  assert.deepEqual(editionLeaders([], { players }), { games: 0, topScorer: null, bestRating: null });
  const quiet = editionLeaders([game(1, [{ eaName: "Santozz", secondsPlayed: 5400, passesMade: 1, passesAttempts: 2, shots: 0, tackles: 0, goals: 0 }])], { players, aliases: [] });
  assert.equal(quiet.topScorer, null);
});

test("two players are compared only on what both have a sample of", () => {
  const a = { name: "A", validGames: 10, games: 10, averageRating: 7.64, goals: 8, assists: 3, shots: 20, tackles: 9, passAttempts: 100, passAccuracy: 81.26, mom: 2, metricSamples: { goals: 10, assists: 10, shots: 10, tackles: 10 } };
  const b = { name: "B", validGames: 4, games: 4, averageRating: 6.9, goals: 0, assists: 0, shots: 0, tackles: 0, passAttempts: 0, passAccuracy: 0, mom: 0, metricSamples: { goals: 4 } };
  const rows = Object.fromEntries(compareRows(a, b).map(([label, left, right]) => [label, [left, right]]));
  assert.deepEqual(rows.JOGOS, [10, 4]);
  assert.deepEqual(rows["NOTA MÉDIA"], [7.6, 6.9]);
  assert.deepEqual(rows.GOLS, [8, 0]);
  assert.deepEqual(rows["ASSISTÊNCIAS"], [3, null], "no sample is not a zero");
  assert.deepEqual(rows["PRECISÃO DE PASSE"], [81.3, null]);
  const keepers = compareRows({ goalkeeper: true, goalkeeperGames: 3, saves: 12, savesPerGame: 4, cleanSheets: 1, metricSamples: { saves: 3 } }, { goalkeeper: true, goalkeeperGames: 0, saves: 0, metricSamples: {} });
  assert.ok(keepers.some(([label]) => label === "DEFESAS / JOGO"));
  assert.ok(!keepers.some(([label]) => label === "GOLS"));
});

test("the night batch says beforehand what can be made and why not", () => {
  const empty = nightBatchPlan({ agenda: [], nightRelated: [], players: [] }, new Date("2026-10-04T23:20:00Z"));
  assert.deepEqual(empty.map((piece) => [piece.id, piece.ready]), [["agenda-story", false], ["agenda-feed", false], ["related", false]]);
  assert.equal(empty[0].reason, "Sem jogo marcado para hoje.");
  assert.equal(empty[2].reason, "A lista da noite ainda não foi salva.");
  const ready = nightBatchPlan({
    agenda: [{ id: "a1", scheduled_at: "2026-10-05T00:10:00Z", opponent_name: "Maquina", status: "scheduled" }],
    nightRelated: [{ night_date: "2026-10-04", player_ids: ["p1"] }],
    players,
  }, new Date("2026-10-04T23:20:00Z"));
  assert.deepEqual(ready.map((piece) => piece.ready), [true, true, true]);
});

test("an EA name nobody linked gets a suggestion only when one roster player clearly stands out", async () => {
  const { suggestAliasPlayer } = await import("../src/features/matches/import-core.js");
  const roster = [
    { id: "p1", display_name: "Santozz", is_active: true },
    { id: "p2", display_name: "Nunes", is_active: true },
    { id: "p3", display_name: "Santos", is_active: true },
    { id: "p4", display_name: "Arquivado", is_active: false },
  ];
  assert.deepEqual(suggestAliasPlayer("santozz_ps5", roster), { playerId: "p1", name: "Santozz", reason: "nome parecido" });
  assert.equal(suggestAliasPlayer("xX_Nunes_Xx", roster).playerId, "p2");
  assert.equal(suggestAliasPlayer("arquivado", roster), null, "archived players are never suggested");
  assert.equal(suggestAliasPlayer("zzz", roster), null);
  assert.equal(suggestAliasPlayer("santozz_ps5", roster, { taken: new Set(["p1"]) })?.playerId ?? null, null, "already used in this match and no one else is close enough");
  // "santo" is close to both Santozz and Santos: the line-up of the linked game breaks the tie.
  assert.equal(suggestAliasPlayer("santo", roster), null);
  assert.deepEqual(suggestAliasPlayer("santo", roster, { lineup: ["Santos"] }), { playerId: "p3", name: "Santos", reason: "nome parecido e está na escalação deste jogo" });
});
