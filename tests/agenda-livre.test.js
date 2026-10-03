import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("noite livre: composição do escudo com entrada única e o próximo compromisso real da Agenda", async () => {
  const [main, home, css] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/features/home/HomePage.jsx"),
    read("../src/features/home/home.css"),
  ]);
  const hero = home.slice(home.indexOf("function FreeNight"), home.indexOf("function RecentBlock"));
  assert.match(hero, /is-free-night/);
  assert.match(hero, /free-night-logo/);
  assert.match(hero, /free-night-ring/);
  // The commitment comes from the agenda row itself; without one the copy says the agenda is free.
  assert.match(hero, /Próximo compromisso/);
  assert.match(hero, /upcoming\.scheduled_at/);
  assert.match(hero, /Agenda livre/);
  assert.doesNotMatch(main, /SEM PARTIDA/);
  assert.doesNotMatch(main, /AGUARDANDO ADVERSÁRIO/);
  // One entrance, then rest: no looping animation on the Home.
  assert.doesNotMatch(css, /@keyframes home-ring \{/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("Home é a central do clube: agora, noite, último resultado e temporada, sem estatística individual", async () => {
  const home = await read("../src/features/home/HomePage.jsx");
  for (const section of ["NowBlock", "Tonight", "LastResult", "Season", "home-now-line"]) assert.ok(home.includes(section), section);
  assert.doesNotMatch(home, /buildPlayerProfile|aggregatePlayerStatistics/);
});
