import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("unmatched /api routes stay JSON 404 instead of an SPA page", async () => {
  const [catchall, vite, redirects, auth] = await Promise.all([
    read("../functions/api/[[path]].js"),
    read("../vite.config.js"),
    read("../public/_redirects"),
    read("../functions/_lib/auth.js"),
  ]);
  assert.match(catchall, /not_found/);
  assert.match(catchall, /404/);
  assert.match(vite, /application\/json/);
  assert.match(vite, /strix-api-json-404/);
  assert.match(redirects, /\/\* +\/index\.html +200/);
  assert.match(auth, /invalid_session/);
  assert.match(auth, /authentication_required/);
});
