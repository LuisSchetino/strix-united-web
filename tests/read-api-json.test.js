import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseApiJson, looksLikeHtml, ApiJsonError } from "../src/lib/read-api-json.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("HTML/DOCTYPE from /api is a structured JSON error, never a parse crash", () => {
  assert.equal(looksLikeHtml("<!DOCTYPE html><html></html>", "text/html"), true);
  assert.equal(looksLikeHtml('{"ok":true}', "application/json"), false);
  assert.throws(
    () => parseApiJson("<!DOCTYPE html><html lang='en'><head></head></html>", {
      status: 200,
      contentType: "text/html; charset=utf-8",
    }),
    (error) => error instanceof ApiJsonError && error.code === "html_instead_of_json",
  );
  assert.deepEqual(parseApiJson('{"matches":[]}', { status: 200, contentType: "application/json" }), { matches: [] });
  assert.throws(
    () => parseApiJson("<html><h1>Bad gateway</h1></html>", {
      status: 502,
      contentType: "text/html",
    }),
    (error) => error instanceof ApiJsonError
      && error.code === "ea_sync_upstream_error"
      && error.layer === "pages_edge"
      && error.contentType === "text/html"
      && error.status === 502
      && /Falha antes da resposta da API/.test(error.message),
  );
  assert.throws(
    () => parseApiJson("<html><h1>Bad gateway</h1></html>", {
      status: 502,
      contentType: "text/html",
      apiLayer: "pages-function",
    }),
    (error) => error instanceof ApiJsonError
      && error.layer === "pages"
      && /depois de executar/.test(error.message),
  );
});

test("Buscar na EA trata [] como vazio válido e não chama json() cego", async () => {
  const [main, matches] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/features/matches/MatchesPage.jsx"),
  ]);
  assert.match(main, /readApiJson/);
  assert.match(matches, /readApiJson/);
  assert.doesNotMatch(main, /if \(!normalized\.length\) throw/);
  assert.doesNotMatch(matches, /await response\.json\(\)/);
  assert.match(matches, /A EA respondeu normalmente, mas não retornou partidas recentes/);
  assert.match(matches, /SYNC INDISPONÍVEL/);
  assert.match(matches, /layer === "railway"/);
  assert.match(matches, /layer === "ea"/);
  assert.match(matches, /layer === "pages"/);
  assert.match(matches, /Falha antes da resposta da API/);
});
