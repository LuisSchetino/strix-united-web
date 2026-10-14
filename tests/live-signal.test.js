import test from "node:test";
import assert from "node:assert/strict";
import { isLiveFresh, liveUpdate, parseScoreboard, pickAgendaMatch, tagScore } from "../shared/live-signal.js";

test("lê o placar e o relógio no texto da tela", () => {
  assert.deepEqual(parseScoreboard("STR 1 - 0 POA 34:12"), { left: "STR", right: "POA", leftScore: 1, rightScore: 0, minute: 34 });
  assert.deepEqual(parseScoreboard("  POA  2  1  STR \n 67:05 "), { left: "POA", right: "STR", leftScore: 2, rightScore: 1, minute: 67 });
  assert.deepEqual(parseScoreboard("str 0 x 3 sfc | 90.00"), { left: "STR", right: "SFC", leftScore: 0, rightScore: 3, minute: 90 });
});

test("lê o placar empilhado do FC 27, com escudo no meio e zero lido como O", () => {
  const expected = { left: "STX", right: "BDL", leftScore: 0, rightScore: 1, minute: 45 };
  assert.deepEqual(parseScoreboard("STX O\nBDL 1\n45:17"), expected);
  assert.deepEqual(parseScoreboard("STX @ O\nBDL ¥ 1\n45:17\n1OBEENZADA\n6,6"), expected);
  assert.deepEqual(parseScoreboard("F\nSTX V O\nBDL W I\n45:17"), expected);
  assert.deepEqual(parseScoreboard("STX BDL\nO 1\n45:17"), expected);
  assert.deepEqual(parseScoreboard("STX 2\nBDL 10\n88:02"), { left: "STX", right: "BDL", leftScore: 2, rightScore: 10, minute: 88 });
});

test("sem relógio ou sem placar não é partida", () => {
  assert.equal(parseScoreboard("STR 1 - 0 POA"), null);
  assert.equal(parseScoreboard("JOGAR AGORA 12:30"), null);
  assert.equal(parseScoreboard("MENU PRINCIPAL"), null);
  assert.equal(parseScoreboard("STR 1 - 0 STR 10:00"), null);
  assert.equal(parseScoreboard("STR 1 - 0 POA 300:00"), null);
  assert.equal(parseScoreboard("Lobby Escolher Posicao Gestao de atleta zFlokyn 12:30"), null);
});

test("sigla parece o nome do adversário", () => {
  assert.equal(tagScore("POA", "POA City FC"), 3);
  assert.equal(tagScore("SFC", "Sinceridade FC"), 2);
  assert.equal(tagScore("SNC", "Sinceridade"), 1);
  assert.equal(tagScore("XYZ", "Maquina"), 0);
});

const now = new Date("2026-10-02T00:20:00Z"); // 21:20 em São Paulo
const agenda = [
  { id: "a", opponent_name: "Maquina", scheduled_at: "2026-10-02T00:10:00Z", status: "scheduled" },
  { id: "b", opponent_name: "Sinceridade FC", scheduled_at: "2026-10-02T00:40:00Z", status: "scheduled" },
  { id: "c", opponent_name: "POA City FC", scheduled_at: "2026-10-02T01:10:00Z", status: "scheduled" },
  { id: "d", opponent_name: "Velho", scheduled_at: "2026-10-01T20:00:00Z", status: "scheduled" },
];

test("acha o jogo pela sigla do adversário, de qualquer lado do placar", () => {
  assert.deepEqual(pickAgendaMatch(agenda, parseScoreboard("SFC 0 1 STR 12:00"), now), { row: agenda[1], strixLeft: false });
  assert.deepEqual(pickAgendaMatch(agenda, parseScoreboard("STR 2 0 POA 80:00"), now), { row: agenda[2], strixLeft: true });
});

test("sem sigla parecida, vale o jogo mais perto do horário quando o lado do Strix é conhecido", () => {
  assert.deepEqual(pickAgendaMatch(agenda, parseScoreboard("STR 0 0 ABC 05:00"), now), { row: agenda[0], strixLeft: true });
  assert.equal(pickAgendaMatch(agenda, parseScoreboard("XYZ 0 0 ABC 05:00"), now), null);
});

test("jogo cancelado, encerrado ou fora da janela não entra", () => {
  const closed = agenda.map((row) => ({ ...row, status: row.id === "c" ? "completed" : row.status }));
  assert.equal(pickAgendaMatch(closed, parseScoreboard("STR 2 0 POA 80:00"), now)?.row.id, "a");
  assert.equal(pickAgendaMatch([agenda[3]], parseScoreboard("STR 1 0 VEL 10:00"), now), null);
});

test("grava o placar do ponto de vista do Strix e sabe quando o sinal envelheceu", () => {
  const update = liveUpdate(parseScoreboard("SFC 2 1 STR 50:00"), false, now);
  assert.equal(update.live_strix_score, 1);
  assert.equal(update.live_opponent_score, 2);
  assert.equal(update.live_minute, 50);
  assert.equal(liveUpdate(parseScoreboard("SFC 2 1 STR 51:00"), false, now, { live_started_at: "x" }).live_started_at, "x");
  assert.equal(isLiveFresh(update, new Date(now.getTime() + 60_000)), true);
  assert.equal(isLiveFresh(update, new Date(now.getTime() + 5 * 60_000)), false);
  assert.equal(isLiveFresh({}, now), false);
});

test("placar empilhado do Strix acha o jogo da noite", () => {
  const rows = [{ id: "x", opponent_name: "Bandoleiros", scheduled_at: "2026-10-02T00:00:00Z", status: "scheduled" }];
  assert.deepEqual(pickAgendaMatch(rows, parseScoreboard("STX O\nBDL 1\n45:17"), now), { row: rows[0], strixLeft: true });
});
