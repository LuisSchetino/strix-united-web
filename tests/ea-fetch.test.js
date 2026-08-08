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
    fetchImpl: async () => new Response(calls++ === 0 ? "indisponivel" : "[]", { status: calls === 1 ? 503 : 200 }),
  });
  await assert.rejects(load());
  assert.deepEqual((await load()).matches, []);
  assert.equal(calls, 2);
});
