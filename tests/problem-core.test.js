import test from "node:test";
import assert from "node:assert/strict";
import { buildProblemRow, createErrorLog, describeDevice, deviceInfo, problemNotices, problemPicturePath } from "../src/features/support/problem-core.js";

test("registro de erros guarda os últimos, sem repetir o mesmo em sequência", () => {
  const log = createErrorLog(3, () => new Date("2026-10-14T01:00:00Z"));
  log.remember("erro", "A");
  log.remember("erro", "A");
  log.remember("falha", "B");
  log.remember("aviso", "C");
  log.remember("erro", "D");
  const list = log.list();
  assert.deepEqual(list.map((entry) => entry.message), ["B", "C", "D"]);
  log.remember("erro", "  ");
  assert.equal(log.list().length, 3);
  const twice = createErrorLog();
  twice.remember("erro", "X"); twice.remember("erro", "X");
  assert.equal(twice.list()[0].times, 2);
});

test("aparelho em uma linha", () => {
  const win = { innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/129 Mobile Safari", onLine: true, language: "pt-BR" }, matchMedia: () => ({ matches: true }) };
  const device = deviceInfo(win);
  assert.equal(device.system, "Android");
  assert.equal(device.browser, "Chrome");
  assert.equal(describeDevice(device), "Android · Chrome · 390×844 · app instalado");
});

test("o reporte precisa de texto e de conta; leva página, aparelho e erros", () => {
  const profile = { user_id: "u1", display_name: "Nunes" };
  assert.throws(() => buildProblemRow({ message: " a ", profile }), /poucas palavras/);
  assert.throws(() => buildProblemRow({ message: "x".repeat(2001), profile }), /2000/);
  assert.throws(() => buildProblemRow({ message: "não salva", profile: null }), /conta/);
  const row = buildProblemRow({ message: "  A escalação não salva  ", profile, page: "/agenda", device: { system: "iOS" }, errors: [{ message: "x" }], screenshotPath: "u1/a.webp" });
  assert.deepEqual(row, { reporter_user_id: "u1", reporter_name: "Nunes", message: "A escalação não salva", page: "/agenda", device: { system: "iOS" }, errors: [{ message: "x" }], screenshot_path: "u1/a.webp" });
  assert.equal(problemPicturePath("u1", { type: "image/webp" }, 5, () => 0.5), "u1/5-i.webp");
});

test("sininho: dev vê os abertos dos outros; quem reportou vê quando andou", () => {
  const now = new Date("2026-10-14T03:00:00Z");
  const reports = [
    { id: "1", reporter_user_id: "p", reporter_name: "Nunes", message: "Escalação não salva", status: "open", created_at: "2026-10-14T02:00:00Z" },
    { id: "2", reporter_user_id: "p", reporter_name: "Nunes", message: "Vídeo não abre", status: "resolved", resolution_note: "Corrigido no deploy de hoje", resolved_at: "2026-10-14T02:30:00Z", updated_at: "2026-10-14T02:30:00Z" },
    { id: "3", reporter_user_id: "d", reporter_name: "Dev", message: "meu", status: "open", created_at: "2026-10-14T02:00:00Z" },
  ];
  const dev = problemNotices({ reports, profile: { user_id: "d", access_tier: "dev" }, now });
  assert.deepEqual(dev.map((item) => item.key), ["problem:new:1"]);
  assert.deepEqual(dev[0].target.remember, ["developer-tab", "problems"]);
  const member = problemNotices({ reports, profile: { user_id: "p", access_tier: "player" }, now });
  assert.deepEqual(member.map((item) => item.title), ["Seu problema foi resolvido"]);
  assert.equal(member[0].text, "Corrigido no deploy de hoje");
  assert.equal(problemNotices({ reports, profile: { user_id: "p" }, now: new Date("2026-11-14T03:00:00Z") }).length, 0);
});
