import test from "node:test";
import assert from "node:assert/strict";
import { cleanManualStats, manualStatsRows, withManualStats } from "../src/features/matches/manual-stats.js";
import { aggregatePlayerStatistics, summarizeNight } from "../src/features/statistics/statistics-core.js";

const performance = {
  players: [
    { eaName: "oBEENzada", goals: 0, assists: 0, rating: 0, secondsPlayed: 0, passesMade: 0, passesAttempts: 0, tackles: 0, shots: 0 },
    { eaName: "Felipe", goals: 1, assists: 0, rating: 7.6, secondsPlayed: 5400, passesMade: 30, passesAttempts: 35, tackles: 2, shots: 3 },
  ],
};

test("números à mão passam por cima dos da EA e quem não tinha linha ganha uma", () => {
  const out = withManualStats({ ...performance, manualStats: [{ key: "obeenzada", name: "oBEENzada", goals: 2, assists: 1 }, { name: "Yuri", goals: 0, assists: 1 }] });
  const oben = out.players.find((row) => row.eaName === "oBEENzada");
  assert.equal(oben.goals, 2); assert.equal(oben.assists, 1); assert.equal(oben.manual, true);
  assert.equal(oben.rating, null, "nota zerada pela EA não conta");
  assert.equal(oben.secondsPlayed, null);
  assert.equal(out.players.find((row) => row.eaName === "Yuri").assists, 1);
  assert.deepEqual(out.goalScorers.sort(), ["Felipe", "oBEENzada", "oBEENzada"].sort());
  assert.equal(withManualStats(performance), performance, "sem nada à mão, nada muda");
});

test("entradas limpas: sem repetidas, sem negativos", () => {
  assert.deepEqual(cleanManualStats([{ name: "Yuri", goals: -2, assists: "3" }, { name: "yuri", goals: 9 }, { name: "" }]), [{ key: "yuri", name: "Yuri", playerId: null, goals: 0, assists: 3 }]);
});

test("as linhas do editor usam o nome do elenco", () => {
  const rows = manualStatsRows(performance, (name) => (name === "oBEENzada" ? "OBEEN" : name));
  assert.deepEqual(rows.map((row) => row.label), ["OBEEN", "Felipe"]);
});

test("conta nas estatísticas e no resumo da noite", () => {
  const players = [{ id: "o", display_name: "OBEEN", is_active: true }, { id: "f", display_name: "FELIPE", is_active: true }, { id: "y", display_name: "YURI", is_active: true }];
  const aliases = [{ ea_name: "oBEENzada", player_id: "o" }, { ea_name: "Felipe", player_id: "f" }];
  const match = { id: "m", played_at: "2026-10-14T03:10:00Z", strix_score: 3, opponent_score: 0, performance: withManualStats({ ...performance, manualStats: [{ name: "oBEENzada", goals: 2, assists: 0 }, { name: "YURI", goals: 0, assists: 2 }] }) };
  const stats = aggregatePlayerStatistics([match], { players, aliases });
  const by = (name) => stats.find((row) => row.name === name);
  assert.equal(by("OBEEN").goals, 2);
  assert.equal(by("YURI").assists, 2);
  const night = summarizeNight([match], "2026-10-13", { players, aliases });
  assert.deepEqual(night.leaders.goals, { value: 2, names: ["OBEEN"] });
  assert.deepEqual(night.leaders.assists, { value: 2, names: ["YURI"] });
});
