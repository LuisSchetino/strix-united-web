import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { RASTRO_BRAND } from "../src/brand.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Rastro brand blue stays on analytics tokens, not on generic UI tokens", async () => {
  const [brandCss, selectCss, tokens] = await Promise.all([
    read("../src/fc27-brand.css"),
    read("../src/ui/select-control.css"),
    read("../src/design/tokens.css"),
  ]);
  assert.equal(RASTRO_BRAND.color, "#2F80FF");
  assert.match(tokens, /--rastro-blue:\s*#2F80FF/i);
  assert.match(tokens, /--rastro-blue-soft:\s*rgba\(47,\s*128,\s*255/);
  // Legacy "blue" aliases are gone; Rastro Blue reaches data only through --data.
  assert.doesNotMatch(tokens, /--(strix|fc27)-blue/);
  assert.match(tokens, /--data:\s*var\(--rastro-blue\)/);
  assert.match(tokens, /--text-1:\s*#f5f5f5/);
  assert.match(brandCss, /\.rastro-signature b\{color:var\(--rastro-blue\)/);
  assert.doesNotMatch(selectCss, /var\(--rastro-blue\)/);
  const statisticsCss = await read("../src/features/statistics/statistics.css");
  assert.match(statisticsCss, /select-control-menu>button span\{\s*color:#d8dce0!important/);
  assert.doesNotMatch(statisticsCss, /#62d4ff|#377ed6|#6d8ea5/);
  const sortBlock = statisticsCss.slice(statisticsCss.indexOf(".statistics-sort"));
  assert.doesNotMatch(sortBlock.slice(0, 1800), /var\(--rastro-blue\)|#2F80FF/);
  const matchesPage = await read("../src/features/matches/MatchesPage.jsx");
  assert.match(matchesPage, /readApiJson/);
  assert.doesNotMatch(matchesPage, /await response\.json\(\)/);
});
