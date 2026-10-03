import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Agenda Livre é só logo central + background sutil, sem texto de estado", async () => {
  const [main, home, css] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/features/home/HomePage.jsx"),
    read("../src/features/home/home.css"),
  ]);
  const hero = home.slice(home.indexOf("function FreeNight"), home.indexOf("function statusFor"));
  assert.match(hero, /is-free-night/);
  assert.match(hero, /free-night-logo/);
  assert.match(hero, /free-night-field/);
  for (const copy of [/NOITE LIVRE/i, /SEM JOGOS HOJE/i, /AGENDA LIVRE/i, /Nenhum compromisso programado/i, /free-night-mark/]) {
    assert.doesNotMatch(hero, copy);
  }
  assert.doesNotMatch(main, /SEM PARTIDA/);
  assert.doesNotMatch(main, /AGUARDANDO ADVERSÁRIO/);
  assert.match(css, /\.free-night-ring/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("Home é a central do clube: agora, noite, último resultado e temporada, sem estatística individual", async () => {
  const home = await read("../src/features/home/HomePage.jsx");
  for (const section of ["NowBlock", "Tonight", "LastResult", "Season", "home-now-line"]) assert.ok(home.includes(section), section);
  assert.doesNotMatch(home, /buildPlayerProfile|aggregatePlayerStatistics/);
});
