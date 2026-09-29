import test from "node:test";
import assert from "node:assert/strict";
import {
  EA_CLUB_ID,
  aliasLookup,
  dedupeImportedMatches,
  eaPlayerRows,
  normalizeEaMatch,
  normalizeEaMatches,
  resolvePlayerAliases,
  resultLabel,
  suggestAgendaMatch,
  suggestAgendaCandidate,
  suggestAgendaMatches,
  validateImport,
} from "../src/features/matches/import-core.js";
import { FC27_CLUB_ID } from "../shared/fc27-club.js";

const eaFixture = {
  matchId: "poa-0708",
  timestamp: Date.parse("2026-08-07T03:08:00Z") / 1000,
  clubs: {
    "15686": { clubId: "15686", name: "STRIX UNITED", goals: 2 },
    "632": { clubId: "632", name: "POA CITY FC", goals: 3 },
  },
  players: {
    "15686": {
      one: { playername: "Obenzera", goals: 1, assists: 0, passesmade: 22, passattempts: 27 },
      two: { playername: "SxntsTheAngel", goals: 1, assists: 0, passesmade: 12, passattempts: 16 },
      three: { playername: "39ygo", goals: 0, assists: 1, tacklesmade: 4 },
    },
  },
};

test("normaliza STRIX 2 x 3 POA CITY e preserva autores dos gols", () => {
  const match = normalizeEaMatch(eaFixture);
  assert.equal(match.opponent, "POA CITY FC");
  assert.equal(match.strixScore, 2);
  assert.equal(match.opponentScore, 3);
  assert.equal(resultLabel(match), "DERROTA");
  assert.deepEqual(match.goalScorers, ["Obenzera", "SxntsTheAngel"]);
  assert.equal(match.performance.players.length, 3);
});

test("EA identifica o Strix pelo clubId e deduplica o mesmo match entre tipos", () => {
  assert.equal(normalizeEaMatch({ matchId: "bad", clubs: { "999": { clubId: "999", name: "Outro", goals: 2 } } }), null);
  const base = {
    matchId: "stable-1",
    timestamp: 1786924800,
    clubs: {
      "999": { clubId: "999", name: "Rival", goals: 1 },
      "15686": { clubId: "15686", name: "Strix United", goals: 3 },
    },
  };
  const rows = normalizeEaMatches([base, { ...base, players: { "15686": [{ playerId: "p1", playername: "Oben" }] } }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].strixScore, 3);
  assert.equal(rows[0].opponent, "Rival");
  assert.equal(rows[0].performance.players.length, 1);
});

test("sugere agenda por dia, horário e adversário sem duplicar", () => {
  const match = normalizeEaMatch(eaFixture);
  const correct = { id: "agenda-poa", opponent_name: "Poa City", scheduled_at: "2026-08-07T00:10:00-03:00", status: "scheduled" };
  const suggestion = suggestAgendaMatch(match, [
    { id: "other", opponent_name: "Old Skull", scheduled_at: "2026-08-07T00:10:00-03:00", status: "scheduled" },
    correct,
  ]);
  assert.equal(suggestion.id, "agenda-poa");
  assert.equal(dedupeImportedMatches([match], [{ external_match_id: "poa-0708" }]).length, 0);
});

test("tolera sufixo FC e timestamp numérico em texto ao sugerir a Agenda", () => {
  const match = normalizeEaMatch({ ...eaFixture, timestamp: String(eaFixture.timestamp) });
  const suggestion = suggestAgendaMatch(match, [
    { id: "agenda-poa", opponent_name: "POA CITY", scheduled_at: "2026-08-07T00:10:00-03:00", status: "scheduled" },
  ]);
  assert.equal(match.date, "2026-08-07T03:08:00.000Z");
  assert.equal(suggestion.id, "agenda-poa");
});

test("mantém POA CITY como candidato provável mesmo com data diferente", () => {
  const match = normalizeEaMatch(eaFixture);
  const candidate = suggestAgendaCandidate(match, [
    { id: "agenda-poa-old", opponent_name: "POA CITY", scheduled_at: "2026-07-30T21:10:00-03:00", status: "scheduled" },
    { id: "agenda-unrelated", opponent_name: "CITY LIONS", scheduled_at: "2026-08-07T00:10:00-03:00", status: "scheduled" },
  ]);
  assert.equal(candidate.entry.id, "agenda-poa-old");
  assert.equal(candidate.confidence, "probable");
  assert.equal(candidate.autoLink, true);
  assert.match(candidate.reason, /data diferente/i);
});

test("nÃ£o auto-seleciona quando existem dois candidatos provÃ¡veis", () => {
  const match = normalizeEaMatch(eaFixture);
  const candidate = suggestAgendaCandidate(match, [
    { id: "agenda-poa-one", opponent_name: "POA CITY", scheduled_at: "2026-07-30T21:10:00-03:00", status: "scheduled" },
    { id: "agenda-poa-two", opponent_name: "POA CITY FC", scheduled_at: "2026-08-01T21:10:00-03:00", status: "scheduled" },
  ]);
  assert.equal(candidate.autoLink, false);
});

test("não sugere o mesmo item da Agenda para duas importações", () => {
  const first = normalizeEaMatch(eaFixture);
  const second = { ...first, id: "poa-second", date: "2026-08-07T03:20:00.000Z" };
  const suggestions = suggestAgendaMatches([first, second], [
    { id: "agenda-poa", opponent_name: "POA CITY", scheduled_at: "2026-08-07T00:10:00-03:00", status: "scheduled" },
  ]);
  assert.equal(suggestions.get(first.id)?.id, "agenda-poa");
  assert.equal(suggestions.get(second.id), null);
});

test("lembra 39ygo para YGO e não pergunta novamente", () => {
  const match = normalizeEaMatch(eaFixture);
  const players = [{ id: "ygo", display_name: "YGO", is_active: true }];
  const aliases = [{ ea_name: "39ygo", player_id: "ygo" }];
  assert.equal(aliasLookup(aliases).get("39ygo"), "ygo");
  assert.equal(resolvePlayerAliases([match], players, aliases)["39ygo"], "ygo");
});

test("competição vazia bloqueia e Amistoso é válido", () => {
  const match = { ...normalizeEaMatch(eaFixture), competition: "", performance: { players: [] } };
  assert.equal(validateImport([match]).valid, false);
  assert.equal(validateImport([{ ...match, competition: "Amistoso" }]).valid, true);
});

test("payload parcial da ponte não lança erro com listas nulas", () => {
  assert.doesNotThrow(() => suggestAgendaMatches(null, null));
  assert.equal(suggestAgendaMatches(null, null).size, 0);
  assert.deepEqual(resolvePlayerAliases(null, null, null), {});
  assert.deepEqual(dedupeImportedMatches(null, null), []);
});

test("clube FC27 atual e legado 15686 alimentam o mesmo parser", () => {
  assert.equal(EA_CLUB_ID, FC27_CLUB_ID);
  assert.equal(FC27_CLUB_ID, "30428");
  const current = normalizeEaMatch({
    matchId: "fc27-now",
    timestamp: 1786924800,
    clubs: {
      "30428": { clubId: "30428", name: "STRIX UNITED", goals: 4 },
      "900": { clubId: "900", name: "MÁQUINA", goals: 1 },
    },
    players: {
      "30428": [{ playerId: "p1", playername: "Oben", goals: 2 }],
    },
  });
  assert.equal(current.strixScore, 4);
  assert.equal(current.opponent, "MÁQUINA");
  assert.equal(current.performance.players[0].eaName, "Oben");
  const legacy = normalizeEaMatch(eaFixture);
  assert.equal(legacy.strixScore, 2);
  assert.equal(legacy.opponent, "POA CITY FC");
  assert.equal(legacy.performance.players.length, 3);
});

test("friendlies preservam EA player id e somente os campos individuais enviados", () => {
  const rows = eaPlayerRows({ players: { "30428": {
    "9007199254740993": {
      playername: "Teste FC27", pos: "GK", archetypeid: 12, secondsPlayed: 0,
      goals: 0, assists: 1, shots: 2, passattempts: 10, passesmade: 8,
      tackleattempts: 3, tacklesmade: 2, rating: 7.4, mom: 1, redcards: 0,
      cleansheetsdef: 1, cleansheetsgk: 0, saves: 4, goodDirectionSaves: 2,
      reflexSaves: 3, crossSaves: 0, ballDiveSaves: 1, parrySaves: 1, punchSaves: 0,
      realtimegame: 88, realtimeidle: 5, userresult: 1, goalsconceded: 99,
    },
  } } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].eaPlayerId, "9007199254740993");
  assert.equal(rows[0].id, "9007199254740993");
  assert.equal(rows[0].archetypeId, 12);
  assert.equal(rows[0].position, "GK");
  assert.equal(rows[0].passesMade, 8);
  assert.equal(rows[0].passesAttempts, 10);
  assert.equal(rows[0].tackleAttempts, 3);
  assert.equal(rows[0].tackles, 2);
  assert.equal(rows[0].goodDirectionSaves, 2);
  assert.equal(rows[0].mom, 1);
  assert.equal(rows[0].redcards, 0);
  assert.equal(rows[0].cleansheetsdef, 1);
  assert.equal(rows[0].cleansheetsgk, 0);
  assert.equal(rows[0].saves, 4);
  assert.equal(rows[0].reflexSaves, 3);
  assert.equal(rows[0].crossSaves, 0);
  assert.equal(rows[0].ballDiveSaves, 1);
  assert.equal(rows[0].parrySaves, 1);
  assert.equal(rows[0].punchSaves, 0);
  assert.equal(rows[0].goalsconceded, undefined);
  assert.equal(rows[0].realtimegame, undefined);
  assert.equal(rows[0].userresult, undefined);
});

test("payload FC27 real usa clubs.details.name, goals string e players por persona", () => {
  const match = normalizeEaMatch({
    matchId: "10830089460337",
    timestamp: 1789880366,
    clubs: {
      "30428": {
        goals: "1",
        score: "1",
        details: { name: "STRIX UNITED", clubId: 30428 },
      },
      "50008": {
        goals: "1",
        score: "1",
        details: { name: "Waves 013", clubId: 50008 },
      },
    },
    players: {
      "30428": {
        "1772207578": { playername: "Nunesdgz", goals: "0", assists: "0", passesmade: "12", passattempts: "16", pos: "forward", rating: "6.30" },
        "1817198477": { playername: "B7N_FELIPE", goals: "1", assists: "0", passesmade: "23", passattempts: "27", pos: "midfielder", rating: "8.10" },
      },
    },
    aggregate: {
      "30428": { goals: 1, passattempts: 121, passesmade: 95, shots: 1, tacklesmade: 12, saves: 5 },
    },
  });
  assert.equal(match.opponent, "Waves 013");
  assert.equal(match.strixScore, 1);
  assert.equal(match.opponentScore, 1);
  assert.equal(resultLabel(match), "EMPATE");
  assert.deepEqual(match.goalScorers, ["B7N_FELIPE"]);
  assert.equal(match.performance.players.length, 2);
  assert.equal(match.performance.passes, "95/121");
});
