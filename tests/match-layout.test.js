import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("escudos do histórico ficam dentro de um container com limites rígidos", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../src/features/matches/MatchesPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/matches/match-fixes.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className={`team-mark/);
  assert.match(component, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(css, /\.progressive-history \.team-mark[^}]*max-width:34px[^}]*max-height:34px[^}]*overflow:hidden/s);
  assert.match(css, /\.progressive-history \.team-mark img[^}]*width:100%[^}]*height:100%[^}]*object-fit:contain/s);
  assert.match(css, /grid-template-columns:112px minmax\(320px,1fr\) 100px minmax\(120px,\.55fr\) 110px/);
});
