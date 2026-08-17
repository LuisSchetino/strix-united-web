import test from "node:test";
import assert from "node:assert/strict";
import { createEaMatchLoader } from "../shared/ea-fetch.js";

test("deduplica consultas concorrentes e reutiliza cache curto", async () => {
  let calls = 0;
  let clock = 100;
  const fetchImpl = async () => {
    calls += 1;
    await Promise.resolve();
    return new Response(JSON.stringify([{ matchId: "1" }]), { status: 200 });
  };
  const load = createEaMatchLoader({ fetchImpl, url: "https://example.test", now: () => clock });
  const [first, concurrent] = await Promise.all([load(), load()]);
  assert.equal(calls, 1);
  assert.deepEqual(first.matches, concurrent.matches);
  clock += 100;
  assert.equal((await load()).cached, true);
  assert.equal(calls, 1);
});

test("erro HTTP nao envenena o cache", async () => {
  let calls = 0;
  const load = createEaMatchLoader({
    url: "https://example.test",
    fetchImpl: async () => {
      calls += 1;
      return new Response(calls <= 2 ? "indisponivel" : "[]", { status: calls <= 2 ? 503 : 200 });
    },
  });
  await assert.rejects(load());
  assert.deepEqual((await load()).matches, []);
  assert.equal(calls, 3);
});

test("403 e HTML recebem erros estruturados sem retry indevido", async () => {
  let calls = 0;
  const forbidden = createEaMatchLoader({
    url: "https://example.test",
    fetchImpl: async () => { calls += 1; return new Response("{}", { status: 403 }); },
  });
  await assert.rejects(forbidden, (error) => error.code === "ea_forbidden" && error.status === 403);
  assert.equal(calls, 1);
  const html = createEaMatchLoader({
    url: "https://example.test",
    fetchImpl: async () => new Response("<html>maintenance</html>", { status: 200 }),
  });
  await assert.rejects(html, (error) => error.code === "ea_invalid_payload");
});
