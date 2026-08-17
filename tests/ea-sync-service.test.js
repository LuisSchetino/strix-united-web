import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionSource = await readFile(new URL("../functions/api/ea/matches.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../services/ea-sync/server.js", import.meta.url), "utf8");
const clientSource = await readFile(new URL("../services/ea-sync/ea-client.js", import.meta.url), "utf8");

test("Pages chama somente o EA Sync externo e não a EA diretamente", () => {
  assert.match(functionSource, /EA_SYNC_API_URL/);
  assert.match(functionSource, /EA_SYNC_API_TOKEN/);
  assert.doesNotMatch(functionSource, /proclubs\.ea\.com/);
});

test("serviço externo é privado, limitado ao clube 15686 e usa os três tipos", () => {
  assert.match(serverSource, /timingSafeEqual/);
  assert.match(serverSource, /clubId !== "15686"/);
  for (const matchType of ["friendlyMatch", "leagueMatch", "playoffMatch"]) {
    assert.match(clientSource, new RegExp(matchType));
  }
});

test("token do serviço não aparece em query string ou resposta", () => {
  assert.doesNotMatch(serverSource, /searchParams\.get\(["']token/);
  assert.doesNotMatch(serverSource, /API_TOKEN[^\n]*json/);
});
