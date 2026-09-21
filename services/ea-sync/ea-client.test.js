import assert from "node:assert/strict";
import test from "node:test";
import { createEaGateway, eaHeaders } from "./ea-client.js";
import { FC27_CLUB_ID, FC27_PLATFORM, parseEaMatchesPayload } from "./fc27-club.js";

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
  const result = await gateway();
  assert.equal(result.matches.length, 3);
  assert.deepEqual(result.matches.map((item) => item._fc27MatchType).sort(), ["friendlyMatch", "leagueMatch", "playoffMatch"]);
  assert.ok(calls.every((call) => call.url.includes(`clubIds=${FC27_CLUB_ID}`)));
  assert.ok(calls.every((call) => call.url.includes(`platform=${FC27_PLATFORM}`)));
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

test("[] é sucesso e uma liga válida não cai se o amistoso falhar", async () => {
  const gateway = createEaGateway({
    retries: 0,
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes("friendlyMatch")) return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      if (href.includes("playoffMatch")) return new Response("<html>blocked</html>", { status: 502, headers: { "content-type": "text/html" } });
      return new Response(JSON.stringify([{ matchId: "league-1" }]), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await gateway();
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].matchId, "league-1");
  assert.equal(result.matches[0]._fc27MatchType, "leagueMatch");
});

test("aceita array ou {matches} e não cacheia erro/HTML", async () => {
  assert.deepEqual(parseEaMatchesPayload([{ matchId: "1" }]), [{ matchId: "1" }]);
  assert.deepEqual(parseEaMatchesPayload({ matches: [{ matchId: "2" }] }), [{ matchId: "2" }]);
  assert.equal(parseEaMatchesPayload({ ok: true }), null);
  let calls = 0;
  let phase = "html";
  const gateway = createEaGateway({
    retries: 0,
    cacheMs: 60_000,
    fetchImpl: async () => {
      calls += 1;
      if (phase === "html") return new Response("<html>blocked</html>", { status: 200, headers: { "content-type": "text/html" } });
      if (phase === "forbidden") return new Response("{}", { status: 403, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ matches: [{ matchId: "ok" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  await assert.rejects(gateway());
  phase = "forbidden";
  await assert.rejects(gateway());
  phase = "ok";
  const result = await gateway();
  assert.equal(result.matches.length, 3);
  assert.equal(result.matches[0].matchId, "ok");
  assert.equal(calls, 9);
});
