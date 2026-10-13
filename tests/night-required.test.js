import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  PING_GAP_LIMIT, PING_MAX_CREDIT, REQUIRED_MAX, completionSeconds, creditPing, isRequiredExempt,
  matchDay, requiredBoard, requiredDetail, requiredLabel, requiredStatus, requiredSummary,
} from "../shared/night-required.js";

const at = (seconds) => new Date(Date.UTC(2026, 9, 7, 23, 0, seconds));

test("o primeiro aviso abre o trecho e não vale tempo", () => {
  const row = creditPing({}, { playing: true, duration: 60, now: at(0) });
  assert.equal(row.watched_seconds, 0);
  assert.equal(row.last_ping_at, at(0).toISOString());
  assert.equal(row.completed_at, null);
});

test("cada aviso vale o tempo do relógio do servidor desde o anterior", () => {
  let row = creditPing({}, { playing: true, duration: 60, now: at(0) });
  row = creditPing(row, { playing: true, duration: 60, now: at(6) });
  assert.equal(row.watched_seconds, 6);
  row = creditPing(row, { playing: true, duration: 60, now: at(12) });
  assert.equal(row.watched_seconds, 12);
});

test("avisar mais rápido não ganha mais do que o tempo real", () => {
  let row = creditPing({}, { playing: true, duration: 60, now: at(0) });
  for (let i = 1; i <= 20; i += 1) row = creditPing(row, { playing: true, duration: 60, now: new Date(at(0).getTime() + i * 100) });
  assert.equal(row.watched_seconds, 2);
});

test("um aviso sozinho nunca vale mais que o teto, e um silêncio longo vale zero", () => {
  const first = creditPing({}, { playing: true, duration: 300, now: at(0) });
  assert.equal(creditPing(first, { playing: true, duration: 300, now: at(PING_MAX_CREDIT + 3) }).watched_seconds, PING_MAX_CREDIT);
  assert.equal(creditPing(first, { playing: true, duration: 300, now: at(PING_GAP_LIMIT + 1) }).watched_seconds, 0);
});

test("pausar encerra o trecho: o tempo parado não conta ao voltar", () => {
  let row = creditPing({}, { playing: true, duration: 60, now: at(0) });
  row = creditPing(row, { playing: true, duration: 60, now: at(6) });
  row = creditPing(row, { playing: false, duration: 60, now: at(7) });
  assert.equal(row.last_ping_at, null);
  assert.equal(row.watched_seconds, 7);
  row = creditPing(row, { playing: true, duration: 60, now: at(12) });
  assert.equal(row.watched_seconds, 7);
  row = creditPing(row, { playing: false, duration: 60, now: at(13) });
  assert.equal(row.watched_seconds, 8);
  // Parado de novo, e avisando "parado" várias vezes: nada.
  row = creditPing(row, { playing: false, duration: 60, now: at(20) });
  assert.equal(row.watched_seconds, 8);
});

test("duas jogadas rodando ao mesmo tempo não contam", () => {
  const row = creditPing({ watched_seconds: 10, last_ping_at: at(0).toISOString() }, { playing: true, duration: 60, now: at(6), busyElsewhere: true });
  assert.equal(row.watched_seconds, 10);
});

test("o tempo nunca passa da duração e completa perto do fim", () => {
  assert.equal(completionSeconds(30), 27.6);
  assert.equal(completionSeconds(120), 116);
  assert.equal(completionSeconds(0), Number.POSITIVE_INFINITY);
  let row = { watched_seconds: 26, last_ping_at: at(0).toISOString() };
  row = creditPing(row, { playing: true, duration: 30, now: at(1) });
  assert.equal(row.completed_at, null);
  row = creditPing(row, { playing: true, duration: 30, now: at(9) });
  assert.equal(row.watched_seconds, 30);
  assert.equal(row.completed_at, at(9).toISOString());
  const later = creditPing(row, { playing: true, duration: 30, now: at(15) });
  assert.equal(later.watched_seconds, 30);
  assert.equal(later.completed_at, at(9).toISOString());
});

test("conselho, diretoria e desenvolvimento são isentos; jogador não", () => {
  assert.equal(isRequiredExempt("player"), false);
  assert.equal(isRequiredExempt("teste"), false);
  assert.equal(isRequiredExempt(""), false);
  for (const tier of ["conselho", "diretoria", "dev"]) assert.equal(isRequiredExempt(tier), true);
});

test("a escalação fica fechada até a última jogada", () => {
  const items = [{ item_id: "a", position: 0 }, { item_id: "b", position: 1 }];
  assert.deepEqual(requiredStatus({ items: [], progress: [], tier: "player" }).locked, false);
  const none = requiredStatus({ items, progress: [], tier: "player" });
  assert.equal(none.locked, true);
  assert.equal(none.next, "a");
  const half = requiredStatus({ items, progress: [{ item_id: "a", completed_at: "x" }, { item_id: "b", completed_at: null }], tier: "player" });
  assert.equal(half.done, 1);
  assert.equal(half.locked, true);
  assert.equal(half.next, "b");
  assert.equal(requiredStatus({ items, progress: [{ item_id: "a", completed_at: "x" }, { item_id: "b", completed_at: "y" }], tier: "player" }).locked, false);
  const staff = requiredStatus({ items, progress: [], tier: "diretoria" });
  assert.equal(staff.locked, false);
  assert.equal(staff.exempt, true);
});

test("o texto ao lado do nome", () => {
  assert.equal(requiredLabel({ total: 3, done: 0, exempt: true }), "Isento");
  assert.equal(requiredLabel({ total: 3, done: 0, account: false }), "Sem acesso ao site");
  assert.equal(requiredLabel({ total: 3, done: 3 }), "Viu os 3 vídeos");
  assert.equal(requiredLabel({ total: 1, done: 1 }), "Viu o vídeo");
  assert.equal(requiredLabel({ total: 3, done: 2 }), "Viu 2 de 3");
  assert.equal(requiredLabel({ total: 3, done: 0 }), "Não viu nenhum vídeo");
  assert.equal(requiredLabel({ total: 1, done: 0 }), "Não viu o vídeo");
  assert.equal(requiredLabel({ total: 0, done: 0 }), "");
});

test("a segunda linha: quando entrou, ou por que não tem o que ver", () => {
  assert.equal(requiredDetail({ visitedAt: "2026-10-08T00:40:00Z" }), "Entrou no site às 21:40");
  assert.equal(requiredDetail({ visitedAt: "" }), "Não entrou no site hoje");
  assert.equal(requiredDetail({ account: false }), "Ainda não criou conta");
  assert.equal(requiredDetail({ account: false, trial: true }), "Em teste: vê a escalação pelo link da noite");
  assert.equal(requiredDetail({ exempt: true, tier: "diretoria" }), "Diretoria");
});

test("o quadro de quem escala: todo o elenco, quem deve primeiro, isentos por último", () => {
  const items = [{ item_id: "a" }, { item_id: "b" }, { item_id: "c" }];
  const players = [
    { id: 7, display_name: "Ygo", is_active: true }, { id: 9, display_name: "Ceni", is_active: true },
    { id: 11, display_name: "Yuri", is_active: true }, { id: 12, display_name: "Novato", is_active: true, member_type: "teste" },
    { id: 13, display_name: "Saiu", is_active: false },
  ];
  const rows = requiredBoard({
    items, players,
    members: [
      { userId: "u1", name: "Chefe", tier: "diretoria", playerId: "", visitedAt: "2026-10-07T22:00:00Z", progress: [] },
      { userId: "u2", name: "ygo", tier: "player", playerId: "", visitedAt: "2026-10-07T22:10:00Z", progress: [{ item_id: "a", completed_at: "x" }, { item_id: "b", completed_at: "y" }, { item_id: "zzz", completed_at: "y" }] },
      { userId: "u3", name: "Outro nome", tier: "player", playerId: "9", visitedAt: "", progress: [] },
      { userId: "u4", name: "Fulano", tier: "player", playerId: "", visitedAt: "2026-10-07T22:20:00Z", progress: [{ item_id: "a", completed_at: "x" }, { item_id: "b", completed_at: "y" }, { item_id: "c", completed_at: "z" }] },
    ],
  });
  assert.deepEqual(rows.map((row) => row.name), ["Ceni", "Ygo", "Novato", "Yuri", "Fulano", "Chefe"]);
  assert.deepEqual(rows.map((row) => row.label), ["Não viu nenhum vídeo", "Viu 2 de 3", "Sem acesso ao site", "Sem acesso ao site", "Viu os 3 vídeos", "Isento"]);
  assert.deepEqual(rows.map((row) => row.state), ["pending", "partial", "noaccount", "noaccount", "done", "exempt"]);
  assert.equal(rows[0].detail, "Não entrou no site hoje");
  assert.equal(rows[2].detail, "Em teste: vê a escalação pelo link da noite");
  assert.equal(rows[3].detail, "Ainda não criou conta");
  assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
  assert.deepEqual(requiredSummary(rows), { owing: 2, done: 1, noAccount: 2, exempt: 1 });
});

test("conta que parou na tela do contrato não aparece como quem deve vídeo", () => {
  const rows = requiredBoard({
    items: [{ item_id: "a" }], players: [{ id: 3, display_name: "Bitten", is_active: true }],
    members: [{ userId: "u9", name: "wBitteN²", tier: "player", playerId: "3", signed: false, visitedAt: "", progress: [] }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Bitten");
  assert.equal(rows[0].state, "nocontract");
  assert.equal(rows[0].label, "Não assinou o contrato");
  assert.deepEqual(requiredSummary(rows), { owing: 0, done: 0, noAccount: 1, exempt: 0 });
});

test("o dia do jogo é o dia de São Paulo", () => {
  assert.equal(matchDay({ scheduled_at: "2026-10-08T01:30:00Z" }), "2026-10-07");
  assert.equal(matchDay({}), "");
});

test("o banco só deixa o servidor escrever o que foi assistido", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261007230000_fc27_night_required.sql", import.meta.url), "utf8");
  assert.match(sql, /grant select on public\.night_required_progress to authenticated/);
  assert.doesNotMatch(sql, /grant[^;]*(insert|update)[^;]*night_required_progress/);
  assert.doesNotMatch(sql, /for (insert|update)[^;]*\n?[^;]*night_required_progress/);
  assert.match(sql, new RegExp(`>= ${REQUIRED_MAX} then`));
});

test("o servidor não aceita tempo vindo do navegador", () => {
  const source = readFileSync(new URL("../functions/api/night/required.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /body\?*\.(watched|seconds|duration|position)/);
  assert.match(source, /requiredDays\(now\)\.includes\(day\)/);
});
