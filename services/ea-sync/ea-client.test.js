import assert from "node:assert/strict";
import test from "node:test";
import { createEaGateway, eaHeaders } from "./ea-client.js";

test("usa a origem oficial da EA e agrega os três tipos", async () => {
  const calls = [];
  const gateway = createEaGateway({
    random: () => 0,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), headers: init.headers });
      return new Response(JSON.stringify([{ matchId: String(calls.length) }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const result = await gateway({ clubId: "15686" });
  assert.equal(result.matches.length, 3);
  assert.deepEqual(result.matches.map((item) => item._fc27MatchType).sort(), ["friendlyMatch", "leagueMatch", "playoffMatch"]);
  assert.ok(calls.every((call) => call.url.includes("clubIds=15686")));
  assert.ok(calls.every((call) => call.headers.origin === "https://www.ea.com"));
});

test("reutiliza cache e chamada em voo sem consultar a EA de novo", async () => {
  let calls = 0;
  const gateway = createEaGateway({
    fetchImpl: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  await Promise.all([gateway(), gateway()]);
  await gateway();
  assert.equal(calls, 3);
});

test("headers não carregam qualquer segredo", () => {
  const headers = eaHeaders(() => 0);
  assert.equal(headers.referer, "https://www.ea.com/games/ea-sports-fc/clubs/rankings");
  assert.equal("authorization" in headers, false);
});
