import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const endpoint = await readFile(new URL("../functions/api/ea/matches.js", import.meta.url), "utf8");
const page = await readFile(new URL("../src/features/matches/MatchesPage.jsx", import.meta.url), "utf8");

test("buscar na EA é somente descoberta e não chama o RPC", () => {
  const getHandler = endpoint.slice(endpoint.indexOf("export async function onRequestGet"), endpoint.indexOf("export async function onRequestPost"));
  assert.match(getHandler, /fetchAllMatches/);
  assert.match(getHandler, /alreadyImported/);
  assert.doesNotMatch(getHandler, /sync_fc27_ea_matches/);
});

test("publicar usa somente a seleção revisada e não consulta a EA novamente", () => {
  const postHandler = endpoint.slice(endpoint.indexOf("export async function onRequestPost"));
  assert.match(postHandler, /body\?\.matches/);
  assert.match(postHandler, /sync_fc27_ea_matches/);
  assert.doesNotMatch(postHandler, /fetchAllMatches\(env\)/);
  assert.match(page, /method: "GET"/);
  assert.match(page, /PUBLICAR JOGO/);
});
