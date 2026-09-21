import test from "node:test";
import assert from "node:assert/strict";
import { json } from "../functions/_lib/auth.js";
import { guardApiHtml } from "../functions/_lib/api-html-guard.js";
import { onRequestGet as getEaMatches } from "../functions/api/ea/matches.js";
import { onRequest as missingApi } from "../functions/api/[[path]].js";

test("JSON da Function ganha sentinela e HTML 502 vira JSON", async () => {
  const ok = json({ ok: true }, 200, { route: "ea-matches" });
  assert.match(ok.headers.get("content-type"), /application\/json/);
  assert.equal(ok.headers.get("X-Strix-Api-Layer"), "pages-function");
  assert.equal(ok.headers.get("X-Strix-Api-Route"), "ea-matches");
  assert.ok(ok.headers.get("X-Strix-Request-Id"));

  const kept = await guardApiHtml({
    request: { url: "https://strixunited.com.br/api/ea/matches" },
    next: async () => new Response(JSON.stringify({ matches: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  assert.match(kept.headers.get("content-type"), /json/);
  assert.equal(JSON.parse(await kept.text()).matches.length, 0);
  assert.equal(kept.headers.get("X-Strix-Api-Layer"), "pages-function");
  assert.equal(kept.headers.get("X-Strix-Api-Route"), "ea-matches");

  const html = await guardApiHtml({
    request: { url: "https://strixunited.com.br/api/ea/matches" },
    next: async () => new Response("<html>Bad Gateway</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    }),
  });
  assert.match(html.headers.get("content-type"), /json/);
  assert.equal(html.headers.get("X-Strix-Api-Layer"), "pages-function");
  const body = JSON.parse(await html.text());
  assert.equal(body.error, "ea_sync_upstream_error");
  assert.equal(body.layer, "pages");
  assert.equal(body.upstreamStatus, 502);
  assert.equal(body.contentType, "text/html");

  const missing = await guardApiHtml({
    request: { url: "https://strixunited.com.br/api/does-not-exist" },
    next: async () => json({ error: "not_found" }, 404),
  });
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("content-type"), /json/);
  assert.equal(JSON.parse(await missing.text()).error, "not_found");
  assert.equal(missing.headers.get("X-Strix-Api-Layer"), "pages-function");
});

test("exceção controlável da Function vira JSON", async () => {
  const failed = await guardApiHtml({
    request: { url: "https://strixunited.com.br/api/ea/matches" },
    next: async () => {
      throw new Error("worker exploded");
    },
  });
  assert.equal(failed.status, 502);
  assert.match(failed.headers.get("content-type"), /json/);
  const body = JSON.parse(await failed.text());
  assert.equal(body.layer, "pages");
  assert.match(body.message, /worker exploded/);
  assert.equal(failed.headers.get("X-Strix-Api-Layer"), "pages-function");
});

test("GET /api/ea/matches sem sessão é 401 JSON com sentinela", async () => {
  const request = new Request("https://strixunited.com.br/api/ea/matches");
  const inner = await getEaMatches({ request, env: {} });
  assert.equal(inner.status, 401);
  assert.match(inner.headers.get("content-type"), /application\/json/);
  assert.equal(inner.headers.get("X-Strix-Api-Layer"), "pages-function");
  assert.equal(inner.headers.get("X-Strix-Api-Route"), "ea-matches");
  assert.ok(inner.headers.get("X-Strix-Request-Id"));
  assert.equal(JSON.parse(await inner.clone().text()).error, "authentication_required");

  const wrapped = await guardApiHtml({
    request,
    next: async () => inner,
  });
  assert.equal(wrapped.status, 401);
  assert.equal(wrapped.headers.get("X-Strix-Api-Layer"), "pages-function");
  assert.equal(wrapped.headers.get("X-Strix-Api-Route"), "ea-matches");
  assert.ok(wrapped.headers.get("X-Strix-Request-Id"));
});

test("middleware carimba 401 mesmo se o handler esqueceu a sentinela", async () => {
  const stamped = await guardApiHtml({
    request: { url: "https://strixunited.com.br/api/ea/matches" },
    next: async () => new Response(JSON.stringify({ error: "authentication_required" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
  });
  assert.equal(stamped.status, 401);
  assert.equal(stamped.headers.get("X-Strix-Api-Layer"), "pages-function");
  assert.equal(stamped.headers.get("X-Strix-Api-Route"), "ea-matches");
  assert.ok(stamped.headers.get("X-Strix-Request-Id"));
  assert.equal(JSON.parse(await stamped.text()).error, "authentication_required");
});

test("/api/does-not-exist é JSON 404 com sentinela se passou pelo middleware", async () => {
  const request = new Request("https://strixunited.com.br/api/does-not-exist");
  const response = await guardApiHtml({
    request,
    next: async () => missingApi(),
  });
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.equal(JSON.parse(await response.text()).error, "not_found");
  assert.equal(response.headers.get("X-Strix-Api-Layer"), "pages-function");
  assert.ok(response.headers.get("X-Strix-Request-Id"));
});
