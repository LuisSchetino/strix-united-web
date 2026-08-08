import test from "node:test";
import assert from "node:assert/strict";
import {
  aliasLookup,
  dedupeImportedMatches,
  normalizeEaMatch,
  resolvePlayerAliases,
  resultLabel,
  suggestAgendaMatch,
  suggestAgendaCandidate,
  suggestAgendaMatches,
  validateImport,
} from "../src/features/matches/import-core.js";

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
  assert.equal(candidate.autoLink, false);
  assert.match(candidate.reason, /data diferente/i);
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
