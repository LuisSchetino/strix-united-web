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
  assert.match(css, /\.match-detail-score \.team-mark\{[^}]*overflow:hidden[^}]*border-radius:14px/s);
  assert.match(css, /\.match-detail-score \.team-mark img\{[^}]*max-width:100%[^}]*max-height:100%[^}]*object-fit:contain/s);
  assert.match(css, /grid-template-columns:112px minmax\(320px,1fr\) 100px minmax\(120px,\.55fr\) 110px/);
  assert.match(component, /JOGADOR<\/span><span>NOTA<\/span><span>G<\/span><span>A<\/span><span>PASSES<\/span><span>CHUTES<\/span><span>DESARMES<\/span><span>DEFESAS<\/span>/s);
  assert.match(component, /function StatIcon/);
  assert.match(css, /\.match-player-table>header,\.match-player-table>article\{display:grid;grid-template-columns:minmax\(190px,1\.6fr\) 70px 55px 55px 95px 76px 90px 75px/);
});
