import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("EA review uses one custom selection mark and compact G/A rows", async () => {
  const source = await readFile(new URL("../src/features/matches/MatchesPage.jsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/round-discovery.css", import.meta.url), "utf8");
  assert.doesNotMatch(source, /<span aria-hidden="true">✓<\/span>/);
  assert.match(source, /className="alias-player-row"/);
  assert.match(source, /<span>JOGADOR EA<\/span><span \/><span>ELENCO<\/span><span>G<\/span><span>A<\/span>/);
  assert.match(source, /max="99" inputMode="numeric"/);
  assert.match(css, /grid-template-columns:42px 42px/);
  assert.match(css, /--alias-grid:/);
  assert.match(css, /grid-template-columns:var\(--alias-grid\)/);
});

test("Agenda header and rows share one structural grid", async () => {
  const css = await readFile(new URL("../src/features/agenda/agenda-list.css", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(css, /--agenda-grid:/);
  assert.match(css, /\.agenda-list-heading,\s*\.agenda-game \{[^}]*grid-template-columns: var\(--agenda-grid\)/);
  assert.match(css, /\.agenda-game-open > \.game-competition/);
  assert.match(page, /<span>CAMPEONATO<\/span><span>STATUS<\/span><span aria-hidden="true" \/>/);
  // Opponent crests keep their proportions inside the round frame.
  assert.match(css, /\.agenda-match \.club-logo\.has-image img \{[^}]*object-fit: contain/);
});
