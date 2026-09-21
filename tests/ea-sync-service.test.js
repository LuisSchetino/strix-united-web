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
  assert.match(serverSource, /club_id: FC27_CLUB_ID/);
  assert.match(serverSource, /platform: FC27_PLATFORM/);
  assert.doesNotMatch(serverSource, /15686/);
  assert.doesNotMatch(functionSource, /15686/);
  assert.match(functionSource, /from "\.\.\/\.\.\/\.\.\/shared\/fc27-club\.js"/);
  assert.match(clientSource, /FC27_MATCH_TYPES/);
  for (const matchType of ["friendlyMatch", "leagueMatch", "playoffMatch"]) {
    assert.match(clubSource, new RegExp(matchType));
  }
});

test("Pages nunca devolve HTML do upstream e identifica a camada pelo host", () => {
  assert.match(functionSource, /await response\.text\(\)/);
  assert.match(functionSource, /ea_sync_upstream_error/);
  assert.match(functionSource, /eaSyncTarget/);
  assert.match(functionSource, /railway\.app/);
  assert.match(functionSource, /layer: "ea"/);
  assert.match(functionSource, /10_000/);
  assert.doesNotMatch(functionSource, /await response\.json\(\)/);
});

test("health de DEV sonda o host sanitizado do EA Sync", async () => {
  const health = await readFile(new URL("../functions/api/internal/health.js", import.meta.url), "utf8");
  assert.match(health, /probeEaSync/);
  assert.match(health, /EA_SYNC_API_URL/);
  assert.match(health, /\/health/);
  assert.match(health, /sanitizeHost/);
  assert.match(health, /fc27: \{ clubId: FC27_CLUB_ID, platform: FC27_PLATFORM \}/);
  assert.doesNotMatch(health, /authorization: `Bearer \$\{env\.EA_SYNC_API_TOKEN\}/);
});

test("Pages middleware converte HTML 502 em JSON estruturado", async () => {
  const middleware = await readFile(new URL("../functions/api/_middleware.js", import.meta.url), "utf8");
  assert.match(middleware, /ea_sync_upstream_error/);
  assert.match(middleware, /pages_edge/);
  assert.match(middleware, /contentType/);
  assert.match(middleware, /upstreamStatus/);
  assert.match(functionSource, /contentType: error\.upstreamContentType/);
  assert.match(functionSource, /searchParams\.set\("platform", FC27_PLATFORM\)/);
});

test("token do serviço não aparece em query string ou resposta", () => {
  assert.doesNotMatch(serverSource, /searchParams\.get\(["']token/);
  assert.doesNotMatch(serverSource, /API_TOKEN[^\n]*json/);
});
