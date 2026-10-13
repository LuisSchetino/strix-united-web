import test from "node:test";
import assert from "node:assert/strict";
import { LINEUP_SLOTS, lastLineup, playerRotation, rotationLabel, suggestLineup } from "../src/features/agenda/lineup-suggest.js";
import { headToHead, opponentBrief, opponentForm } from "../src/features/agenda/opponent-brief.js";
import { stakeSentence } from "../src/features/competitions/match-stake.js";
import { myNight, tonightPlayed } from "../src/features/home/home-core.js";
import { rosterAppearances } from "../src/features/statistics/statistics-core.js";

const NOW = new Date("2026-10-04T23:20:00Z"); // 20:20 in São Paulo
const player = (id, name, positions) => ({ id, display_name: name, positions, is_active: true });
const roster = [
  player("g1", "Ceni", ["GOL"]),
  player("z1", "Dornellas", ["ZAG"]), player("z2", "Joao", ["ZAG"]), player("z3", "Ygo", ["ZAG", "VOL"]), player("z4", "Bruno", ["ZAG"]),
  player("v1", "Tito", ["VOL"]),
  player("a1", "Leo", ["ALA"]), player("a2", "Rafa", ["ALA"]),
  player("m1", "Nunes", ["MC"]), player("m2", "Caio", ["MC"]),
  player("t1", "Santozz", ["ATA"]), player("t2", "Vini", ["ATA"]), player("t3", "Davi", ["ATA"]),
];
const row = (name) => ({ eaName: name, rating: 7.2, goals: 0, assists: 0, passesMade: 12, passesAttempts: 15, shots: 1, tackles: 2, secondsPlayed: 5400 });
const game = (id, playedAt, names) => ({ id, played_at: playedAt, opponent_name: `Rival ${id}`, strix_score: 1, opponent_score: 0, performance: { players: names.map(row) } });

test("the formation has eleven slots and they are the positions the club plays", () => {
  assert.equal(LINEUP_SLOTS.length, 11);
  assert.deepEqual([...new Set(LINEUP_SLOTS)].sort(), ["ALA", "ATA", "GOL", "MC", "VOL", "ZAG"]);
});

test("the line-up to repeat is the most recent other game that has one", () => {
  const agenda = [
    { id: "old", scheduled_at: "2026-10-01T00:10:00Z", status: "completed", lineup: ["Santozz", "", "", "", "", "", "", "", "", "", "Ceni"] },
    { id: "last", scheduled_at: "2026-10-04T00:10:00Z", status: "completed", lineup: ["Vini", "Santozz", "", "", "", "", "", "", "", "", ""] },
    { id: "empty", scheduled_at: "2026-10-04T22:00:00Z", status: "scheduled", lineup: [] },
    { id: "off", scheduled_at: "2026-10-04T22:30:00Z", status: "cancelled", lineup: ["Davi"] },
    { id: "future", scheduled_at: "2026-10-09T00:10:00Z", status: "scheduled", lineup: ["Davi"] },
  ];
  const found = lastLineup(agenda, { before: NOW });
  assert.equal(found.match.id, "last");
  assert.equal(found.lineup.length, 11);
  assert.deepEqual(found.lineup.slice(0, 2), ["Vini", "Santozz"]);
  assert.equal(lastLineup(agenda, { before: NOW, excludeId: "last" }).match.id, "old");
  assert.equal(lastLineup([], { before: NOW }), null);
});

test("rotation counts real appearances in the week and the month and says when each one last played", () => {
  const aliases = [{ ea_name: "santozz_ps", player_id: "t1" }];
  const matches = [
    game("m1", "2026-10-04T01:10:00Z", ["Ceni", "santozz_ps", "Nunes"]),      // yesterday night (03/10 in São Paulo)
    game("m2", "2026-09-30T01:10:00Z", ["Ceni", "Nunes"]),                    // 5 days before
    game("m3", "2026-09-10T01:10:00Z", ["Ceni", "Vini"]),                     // 25 days before
    game("m4", "2026-08-01T01:10:00Z", ["Ceni", "Davi"]),                     // long ago
  ];
  const appearances = rosterAppearances(matches, { players: roster, aliases });
  assert.equal(appearances.length, 4);
  assert.ok(appearances.at(-1).playerIds.has("t1"), "an alias resolves to the roster player");
  const rotation = playerRotation({ players: roster, aliases, matches, now: NOW });
  assert.deepEqual(rotation.get("g1"), { week: 2, month: 3, lastPlayedAt: "2026-10-04T01:10:00Z", daysSince: 1 });
  assert.equal(rotation.get("t1").week, 1);
  assert.equal(rotation.get("t2").month, 1);
  assert.equal(rotation.get("t2").daysSince, 25);
  assert.equal(rotation.get("t3").month, 0);
  assert.equal(rotation.get("t3").daysSince, 65);
  assert.equal(rotation.get("z1").daysSince, null);
  assert.equal(rotationLabel(rotation.get("g1")), "2 jogos na semana · jogou ontem");
  assert.equal(rotationLabel(rotation.get("t2")), "Nenhum jogo na semana · último jogo há 25 dias");
  assert.equal(rotationLabel(rotation.get("z1")), "Ainda sem jogo importado");
});

test("a suggested line-up keeps who held each slot and never plays someone out of position", () => {
  const rotation = playerRotation({ players: roster, aliases: [], matches: [game("m1", "2026-10-04T01:10:00Z", ["Santozz", "Dornellas"])], now: NOW });
  const reference = ["Santozz", "", "", "Nunes", "", "", "", "Dornellas", "", "", "Ceni"];
  const lineup = suggestLineup({ candidates: roster, rotation, reference });
  assert.equal(lineup.length, 11);
  assert.equal(lineup[0], "Santozz", "kept his slot");
  assert.equal(lineup[3], "Nunes");
  assert.equal(lineup[7], "Dornellas");
  assert.equal(lineup[10], "Ceni");
  lineup.forEach((name, index) => {
    if (!name) return;
    const who = roster.find((item) => item.display_name === name);
    assert.ok(who.positions.includes(LINEUP_SLOTS[index]), `${name} plays ${LINEUP_SLOTS[index]}`);
  });
  assert.equal(new Set(lineup.filter(Boolean)).size, lineup.filter(Boolean).length, "nobody twice");
  const short = suggestLineup({ candidates: roster.filter((item) => !item.positions.includes("GOL")), rotation, reference: [] });
  assert.equal(short[10], "", "no goalkeeper on the list: the slot stays empty");
});

test("the opponent's card: Strix's record against it and its own published form", () => {
  const matches = [
    { id: "r1", opponent_name: "Gorillas Team", strix_score: 2, opponent_score: 1, played_at: "2026-09-01T00:00:00Z", competition_name: "Copa" },
    { id: "r2", opponent_name: "GORILLAS TEAM", strix_score: 0, opponent_score: 0, played_at: "2026-09-20T00:00:00Z" },
    { id: "r3", opponent_name: "Outro", strix_score: 5, opponent_score: 0, played_at: "2026-09-21T00:00:00Z" },
  ];
  const record = headToHead(matches, "Gorillas Team");
  assert.deepEqual(record.record, { games: 2, wins: 1, draws: 1, losses: 0, goalsFor: 2, goalsAgainst: 1 });
  assert.equal(record.games[0].id, "r2", "most recent first");
  assert.equal(headToHead([{ id: "x", opponent_name: "Maquina FC", strix_score: 3, opponent_score: 0, played_at: "2026-09-01T00:00:00Z" }], "MAQUINA ESPORTS").record.games, 1, "a club is the same with or without its suffix");
  const fixtures = [
    { id: "f1", edition_id: "e1", home_team_name: "Gorillas Team", away_team_name: "EC Sintonia", home_score: 3, away_score: 1, scheduled_at: "2026-10-01T00:00:00Z", round_label: "Rodada 1" },
    { id: "f2", edition_id: "e1", home_team_name: "Desagregados SC", away_team_name: "Gorillas Team", home_score: 2, away_score: 0, scheduled_at: "2026-10-02T00:00:00Z" },
    { id: "f3", edition_id: "e1", home_team_name: "Gorillas Team", away_team_name: "Strix United", home_score: null, away_score: null, scheduled_at: "2026-10-05T00:00:00Z" },
    { id: "f4", edition_id: "e2", home_team_name: "Gorillas Team", away_team_name: "X", home_score: 9, away_score: 0, scheduled_at: "2026-10-03T00:00:00Z" },
  ];
  const form = opponentForm(fixtures, "e1", "gorillas team");
  assert.deepEqual(form.map((item) => [item.against, item.own, item.other, item.result]), [["Desagregados SC", 0, 2, "D"], ["EC Sintonia", 3, 1, "V"]]);
  const brief = opponentBrief({ opponent_name: "Gorillas Team", competition_edition_id: "e1" }, { matches, fixtures });
  assert.equal(brief.empty, false);
  assert.equal(opponentBrief({ opponent_name: "Desconhecido" }, { matches, fixtures }).empty, true);
});

test("the stake of the next game says only what every combination agrees on", () => {
  const next = (V, E, D) => ({ status: "possible", nextMatch: { opponent: "X", byResult: [["V", V], ["E", E], ["D", D]].map(([result, [inside, tie, out]]) => ({ result, in: inside, tie, out, total: inside + tie + out })) } });
  assert.equal(stakeSentence(next([9, 0, 0], [4, 2, 3], [0, 0, 9])), "Vitória garante a vaga; derrota elimina.");
  assert.equal(stakeSentence(next([9, 0, 0], [9, 0, 0], [2, 3, 4])), "Empate garante a vaga.");
  assert.equal(stakeSentence(next([3, 2, 4], [0, 0, 9], [0, 0, 9])), "Só a vitória mantém a chance.");
  assert.equal(stakeSentence(next([3, 2, 4], [1, 2, 6], [0, 0, 9])), "Derrota elimina.");
  assert.equal(stakeSentence(next([3, 2, 4], [1, 2, 6], [1, 0, 8])), "", "nothing certain: nothing is said");
  assert.equal(stakeSentence({ status: "guaranteed" }), "Vaga já garantida.");
  assert.equal(stakeSentence({ status: "impossible" }), "Sem chance matemática de classificação.");
  assert.equal(stakeSentence({ status: "too_many" }), "");
  assert.equal(stakeSentence(null), "");
});

test("my night is read from the line-ups alone: where I play, and how many are still empty", () => {
  const me = roster.find((item) => item.id === "t1");
  const tonight = [
    { id: "a1", scheduled_at: "2026-10-05T00:10:00Z", opponent_name: "Maquina", lineup: ["Santozz", "Vini", "", "", "", "", "", "", "", "", ""] },
    { id: "a2", scheduled_at: "2026-10-05T00:40:00Z", opponent_name: "Sinceridade", lineup: ["Vini", "Davi", "", "", "", "", "", "", "", "", "Ceni"] },
    { id: "a3", scheduled_at: "2026-10-05T01:10:00Z", opponent_name: "POA City", lineup: [] },
  ];
  const night = myNight({ player: me, tonight });
  assert.equal(night.starting, 1);
  assert.equal(night.open, 1);
  assert.deepEqual(night.games.map((item) => [item.id, item.position, item.open]), [["a1", "ATA", false], ["a2", "", false], ["a3", "", true]]);
  assert.equal("listed" in night, false, "the media list plays no part");
  // Taken out of the only line-up he was in: he is in none, at once.
  const removed = myNight({ player: me, tonight: [{ ...tonight[0], lineup: ["", "Vini", "", "", "", "", "", "", "", "", ""] }, tonight[1], tonight[2]] });
  assert.equal(removed.starting, 0);
  assert.equal(myNight({ player: null, tonight }), null);
  assert.equal(myNight({ player: me, tonight: [] }), null);
});

test("tonight's played games come back with their score", () => {
  const agenda = [
    { id: "a1", scheduled_at: "2026-10-05T00:10:00Z", opponent_name: "Maquina", status: "completed" },
    { id: "a2", scheduled_at: "2026-10-05T00:40:00Z", opponent_name: "Sinceridade", status: "scheduled" },
    { id: "a0", scheduled_at: "2026-10-03T00:10:00Z", opponent_name: "Ontem", status: "completed" },
  ];
  const matches = [{ id: "m1", agenda_match_id: "a1", strix_score: 3, opponent_score: 0 }, { id: "m0", agenda_match_id: "a0", strix_score: 1, opponent_score: 1 }];
  assert.deepEqual(tonightPlayed({ agenda, matches, now: NOW }).map((item) => [item.id, item.matchId, item.strix, item.opponent, item.result]), [["a1", "m1", 3, 0, "V"]]);
});
