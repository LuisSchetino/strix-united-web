import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionSource = await readFile(new URL("../functions/api/ea/matches.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../services/ea-sync/server.js", import.meta.url), "utf8");
const clientSource = await readFile(new URL("../services/ea-sync/ea-client.js", import.meta.url), "utf8");
const clubSource = await readFile(new URL("../services/ea-sync/fc27-club.js", import.meta.url), "utf8");

test("Pages chama somente o EA Sync externo e não a EA diretamente", () => {
  assert.match(functionSource, /EA_SYNC_API_URL/);
  assert.match(functionSource, /EA_SYNC_API_TOKEN/);
  assert.doesNotMatch(functionSource, /proclubs\.ea\.com/);
});

test("serviço externo é privado, limitado ao clube FC27 e usa os três tipos", () => {
  assert.match(serverSource, /timingSafeEqual/);
  assert.match(serverSource, /clubId !== FC27_CLUB_ID/);
  assert.match(serverSource, /from "\.\/fc27-club\.js"/);
  assert.doesNotMatch(serverSource, /15686/);
  assert.doesNotMatch(functionSource, /15686/);
  assert.match(functionSource, /from "\.\.\/\.\.\/\.\.\/shared\/fc27-club\.js"/);
  assert.match(clientSource, /FC27_MATCH_TYPES/);
  for (const matchType of ["friendlyMatch", "leagueMatch", "playoffMatch"]) {
    assert.match(clubSource, new RegExp(matchType));
  }
});

test("Pages nunca devolve HTML do Railway e identifica a camada", () => {
  assert.match(functionSource, /await response\.text\(\)/);
  assert.match(functionSource, /ea_sync_upstream_error/);
  assert.match(functionSource, /layer: "railway"/);
  assert.match(functionSource, /layer: "ea"/);
  assert.match(functionSource, /10_000/);
  assert.doesNotMatch(functionSource, /await response\.json\(\)/);
});

test("token do serviço não aparece em query string ou resposta", () => {
  assert.doesNotMatch(serverSource, /searchParams\.get\(["']token/);
  assert.doesNotMatch(serverSource, /API_TOKEN[^\n]*json/);
});
