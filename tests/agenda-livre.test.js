import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Agenda Livre é só logo central + background sutil, sem texto de estado", async () => {
  const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/ui/strix-polish.css", import.meta.url), "utf8");
  const hero = main.slice(main.indexOf("function CentralLive"), main.indexOf("function GameRowLive"));
  assert.match(hero, /is-free-night/);
  assert.match(hero, /free-night-logo/);
  assert.match(hero, /free-night-field/);
  assert.doesNotMatch(hero, /NOITE LIVRE/);
  assert.doesNotMatch(hero, /SEM JOGOS HOJE/);
  assert.doesNotMatch(hero, /AGENDA LIVRE/);
  assert.doesNotMatch(hero, /Nenhum compromisso programado/);
  assert.doesNotMatch(hero, /free-night-mark/);
  assert.doesNotMatch(main, /SEM PARTIDA/);
  assert.doesNotMatch(main, /AGUARDANDO ADVERSÁRIO/);
  assert.match(css, /\.free-night-beam/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
