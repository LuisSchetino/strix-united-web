import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Agenda Livre deixa de usar placeholder de adversário", async () => {
  const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/ui-bugfix.css", import.meta.url), "utf8");
  assert.match(main, /NOITE LIVRE/);
  assert.match(main, /SEM JOGOS HOJE/);
  assert.match(main, /Nenhum compromisso programado/);
  assert.match(main, /is-free-night/);
  assert.match(main, /free-night-mark/);
  assert.doesNotMatch(main, /SEM PARTIDA/);
  assert.doesNotMatch(main, /AGUARDANDO ADVERSÁRIO/);
  assert.match(css, /versus\.is-free/);
  assert.match(css, /free-night-mark/);
});
