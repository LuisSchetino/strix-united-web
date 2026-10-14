import test from "node:test";
import assert from "node:assert/strict";
import { isLiveFresh, livePhase, liveUpdate, parseScoreboard, pickAgendaMatch, tagScore } from "../shared/live-signal.js";

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
  // o jogo escreve NHE para o Night HuntersES
  assert.equal(tagScore("NHE", "Night HuntersES"), 4);
  assert.equal(tagScore("NHE", "Night Hunters ES"), 4);
  assert.equal(tagScore("NHE", "Night Hunters"), 4);
});

test("NHE no placar acha o Night HuntersES, mesmo com outro jogo mais perto do horário", () => {
  const rows = [
    { id: "bdl", opponent_name: "BDL Esports", scheduled_at: "2026-10-02T00:20:00Z", status: "scheduled" },
    { id: "nh", opponent_name: "Night HuntersES", scheduled_at: "2026-10-02T00:50:00Z", status: "scheduled" },
  ];
  assert.deepEqual(pickAgendaMatch(rows, parseScoreboard("STX 1\nNHE O\n12:40"), now), { row: rows[1], strixLeft: true });
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

test("às 23:23 com jogos às 23:10 e 23:40, sem sigla conhecida, é o das 23:10", () => {
  const at = new Date("2026-10-03T02:23:00Z"); // 23:23
  const rows = [
    { id: "1110", opponent_name: "Maquina", scheduled_at: "2026-10-03T02:10:00Z", status: "scheduled" },
    { id: "1140", opponent_name: "Velocity", scheduled_at: "2026-10-03T02:40:00Z", status: "scheduled" },
  ];
  assert.equal(pickAgendaMatch(rows, parseScoreboard("STX 0\nQQQ 0\n05:00"), at)?.row.id, "1110");
  // a sigla forte do outro jogo vence: a noite adiantou
  assert.equal(pickAgendaMatch(rows, parseScoreboard("STX 0\nVEL 0\n05:00"), at)?.row.id, "1140");
});

test("o jogo em campo continua sendo ele; o que terminou sai da disputa", () => {
  const at = new Date("2026-10-03T02:40:00Z");
  const seen = (s) => new Date(at.getTime() - s * 1000).toISOString();
  const rows = [
    { id: "a", opponent_name: "Maquina", scheduled_at: "2026-10-03T02:10:00Z", status: "scheduled", live_seen_at: seen(10), live_minute: 60, live_strix_score: 1, live_opponent_score: 0 },
    { id: "b", opponent_name: "Night HuntersES", scheduled_at: "2026-10-03T02:40:00Z", status: "scheduled" },
  ];
  // o mesmo jogo, relógio andando
  assert.equal(pickAgendaMatch(rows, parseScoreboard("STX 1\nMAQ 0\n61:00"), at)?.row.id, "a");
  // o das 23:10 acabou (90', sem sinal há 2 min): o placar novo é do jogo seguinte
  const ended = [{ ...rows[0], live_seen_at: seen(120), live_minute: 90 }, rows[1]];
  assert.equal(livePhase(ended[0], at), "ended");
  assert.equal(pickAgendaMatch(ended, parseScoreboard("STX 0\nQQQ 0\n02:00"), at)?.row.id, "b");
  // relógio voltou para 2' num jogo que estava em 60': é outro jogo
  assert.equal(pickAgendaMatch([{ ...rows[0], live_seen_at: seen(200) }, rows[1]], parseScoreboard("STX 0\nNHE 0\n02:00"), at)?.row.id, "b");
});

test("fases do sinal: em campo, intervalo, fim de jogo", () => {
  const at = new Date("2026-10-03T02:40:00Z");
  const row = (s, minute) => ({ live_seen_at: new Date(at.getTime() - s * 1000).toISOString(), live_minute: minute });
  assert.equal(livePhase(row(20, 30), at), "live");
  assert.equal(livePhase(row(120, 45), at), "halftime");
  assert.equal(livePhase(row(120, 89), at), "ended");
  assert.equal(livePhase(row(120, 60), at), "");
  assert.equal(livePhase({}, at), "");
});
