import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkForNewDeploy, entryScriptOf, freshImport, isChunkLoadError, isStaleBuild, mayReloadForUpdate, reloadForUpdate } from "../src/ui/fresh-deploy.js";
import { clearContractOpen, markContractOpen, readContractOpen } from "../src/features/onboarding/contract-core.js";

const memory = () => {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
};
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("a build file that is gone after a deploy is told apart from any other failure", () => {
  assert.ok(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://strixunited.com.br/assets/contract-export-DATlqRvt.js")));
  assert.ok(isChunkLoadError(new Error("Importing a module script failed.")));
  assert.ok(isChunkLoadError(new Error("error loading dynamically imported module")));
  assert.ok(isChunkLoadError(new Error("Unable to preload CSS for /assets/MatchesPage-DS8ga9ch.css")));
  assert.equal(isChunkLoadError(new Error("Cannot read properties of undefined (reading \"map\")")), false);
  assert.equal(isChunkLoadError(null), false);
  assert.equal(entryScriptOf("<script type=\"module\" crossorigin src=\"/assets/index-QrAVDg47.js\"></script>"), "/assets/index-QrAVDg47.js");
  assert.equal(entryScriptOf("<html></html>"), "");
});

test("the tab reloads onto the new build once, and never in a loop", () => {
  const storage = memory();
  let reloads = 0;
  const location = { reload: () => { reloads += 1; } };
  assert.equal(reloadForUpdate({ storage, location, now: 1_000_000 }), true);
  assert.equal(reloadForUpdate({ storage, location, now: 1_005_000 }), false, "a second failure right after a reload is shown, not reloaded again");
  assert.equal(reloads, 1);
  assert.equal(reloadForUpdate({ storage, location, now: 1_060_000 }), true, "much later it is a new situation");
  assert.equal(mayReloadForUpdate({ getItem() { throw new Error("blocked"); } }, 5), false, "without storage a loop cannot be told from a first try");
});

test("an on-demand page that is gone reloads the tab and keeps loading; other failures are thrown", async () => {
  let reloaded = 0;
  const gone = freshImport(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module: /assets/MatchesPage-old.js")), () => { reloaded += 1; return true; });
  const pending = gone();
  const settled = await Promise.race([pending.then(() => "resolved", () => "rejected"), new Promise((resolve) => setTimeout(() => resolve("pending"), 30))]);
  assert.equal(settled, "pending", "the page keeps its loading state until the reload lands");
  assert.equal(reloaded, 1);

  await assert.rejects(freshImport(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module")), () => false)(), /dynamically imported/, "right after a reload the failure is shown");
  await assert.rejects(freshImport(() => Promise.reject(new Error("boom")), () => { throw new Error("must not reload"); })(), /boom/);
  assert.deepEqual(await freshImport(() => Promise.resolve({ default: 1 }))(), { default: 1 });
});

test("the tab notices a new build by itself", async () => {
  const page = (name) => ({ ok: true, text: async () => `<script type="module" src="/assets/${name}"></script>` });
  assert.equal(await checkForNewDeploy({ current: "/assets/index-AAAA.js", fetcher: async () => page("index-AAAA.js") }), false);
  assert.equal(isStaleBuild(), false);
  assert.equal(await checkForNewDeploy({ current: "/assets/index-AAAA.js", fetcher: async () => { throw new Error("offline"); } }), false, "offline says nothing");
  assert.equal(await checkForNewDeploy({ current: "/assets/index-AAAA.js", fetcher: async () => page("index-BBBB.js") }), true);
  assert.equal(isStaleBuild(), true);
});

test("pages, downloads, navigation and the 500 screen all recover from an updated site", async () => {
  const [main, lazy, boundary, gate] = await Promise.all([
    read("../src/main.jsx"), read("../src/features/onboarding/contract-export-lazy.js"),
    read("../src/ui/special-state/SpecialState.jsx"), read("../src/features/onboarding/ContractGate.jsx"),
  ]);
  for (const page of ["midia", "partidas", "campeonatos", "biblioteca", "desenvolvedor", "estatisticas", "analise", "elencoTools", "playerSheet"]) {
    assert.match(main, new RegExp(`lazy\\(freshImport\\(routeLoaders\\.${page}\\)\\)`), `${page} recovers`);
  }
  assert.doesNotMatch(main, /lazy\(routeLoaders\./, "no page loads without the recovery");
  assert.match(main, /if \(isStaleBuild\(\) && [^\n]+\{\s*window\.location\.assign\(next\);/, "moving between pages on an old build is a full load");
  assert.match(main, /watchForNewDeploy\(\);/);
  assert.match(lazy, /const loadVideo = freshImport\(/);
  assert.match(lazy, /const loadDocument = freshImport\(/);
  assert.match(boundary, /this\.state\.outdated \? window\.location\.reload\(\)/, "retrying an outdated page reloads it");
  assert.match(gate, /markContractOpen\(session\.user\.id\)/);
});

test("the signed-contract screen survives a reload and ends when the member continues", () => {
  const storage = memory();
  assert.equal(readContractOpen(storage), "");
  markContractOpen("user-1", storage);
  assert.equal(readContractOpen(storage), "user-1");
  clearContractOpen(storage);
  assert.equal(readContractOpen(storage), "");
  assert.equal(readContractOpen({ getItem() { throw new Error("blocked"); } }), "");
});
