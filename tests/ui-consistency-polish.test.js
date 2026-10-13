import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const hexes = (css) => [...css.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((match) => match[1].toLowerCase());
const isBlueish = (hex) => { const r = parseInt(hex.slice(0, 2), 16); const g = parseInt(hex.slice(2, 4), 16); const b = parseInt(hex.slice(4, 6), 16); return b - r >= 36 && b >= g && b > 60; };
const isReddish = (hex) => { const r = parseInt(hex.slice(0, 2), 16); const g = parseInt(hex.slice(2, 4), 16); const b = parseInt(hex.slice(4, 6), 16); return r - Math.max(g, b) >= 70 && r > 120; };

test("camada de consistência não introduz azul nem vermelho estrutural", async () => {
  const css = await read("../src/ui/strix-polish.css");
  const found = hexes(css);
  assert.deepEqual(found.filter(isBlueish), []);
  assert.deepEqual(found.filter(isReddish), []);
  assert.doesNotMatch(css, /rastro-blue|2f80ff/i, "Rastro Blue não pinta estrutura");
});

test("menu da partida é uma superfície única sem caixa por item e sem vermelho", async () => {
  const css = await read("../src/ui/strix-polish.css");
  const menu = css.slice(css.indexOf("Menus:"), css.indexOf("Confirmation dialogs"));
  assert.match(menu, /\.agenda-game \.agenda-actions/);
  assert.match(menu, /\.action-menu-popover/);
  assert.match(menu, /background:transparent!important/);
  assert.match(menu, /translate:0 6px/);
  assert.match(menu, /border-top:1px solid var\(--sp-line\)/);
  assert.doesNotMatch(menu, /ff[0-9a-f]{4}|e88996|ffb4be/i);
});

test("modal de exclusão: centralizado, neutro e com o CloseButton compartilhado", async () => {
  const [main, css] = await Promise.all([read("../src/main.jsx"), read("../src/ui/strix-polish.css")]);
  const dialog = main.slice(main.indexOf("{pendingAction && <ViewportDialog"), main.indexOf("function SquadPage"));
  assert.match(dialog, /modal-backdrop is-centered/);
  assert.match(dialog, /<CloseButton onClick=\{\(\) => setPendingAction\(null\)\}/);
  assert.doesNotMatch(dialog, /×|✕|&times;|XX/);
  assert.match(css, /\.modal-backdrop\.is-centered\{[^}]*place-items:center!important/);
  assert.match(css, /\.agenda-confirm-danger,\s*\.competition-danger\{[^}]*background:#f5f5f5!important/);
});

test("Adicionar campeonato usa o container Strix e é monocromático", async () => {
  const css = await read("../src/ui/strix-polish.css");
  const modal = css.slice(css.indexOf("Adicionar campeonato"), css.indexOf("Texto descritivo"));
  assert.match(modal, /\.competition-import-modal/);
  assert.match(modal, /background:var\(--sp-surface\)/);
  const sheet = await read("../src/features/competitions/competition-import.css");
  assert.doesNotMatch(sheet, /competition-accent|state-(danger|warning)/, "a única cor da folha é a logo da competição");
  assert.match(css, /\.competition-import-modal>header>\.close-button/);
});

test("goleiros separam total oficial e subtipos, sem transformar ausência em zero", async () => {
  const page = await read("../src/features/statistics/StatisticsPage.jsx");
  const keeper = page.slice(page.indexOf("function GoalkeeperCard"), page.indexOf("function NightSummary"));
  for (const label of ["DEFESAS", "DEFESAS / JOGO", "GOLS SOFRIDOS", "NOTA MÉDIA", "GOLEIROS · FC27"]) assert.ok(keeper.includes(label), label);
  assert.match(keeper, /present \? display\(value\) : "—"/);
  assert.match(keeper, /filter\(\(\[, , present\]\) => present\)/);
  assert.doesNotMatch(keeper, /Tipos registrados pela EA/);
  for (const subtype of ["REFLEXO", "DIREÇÃO BOA", "CRUZAMENTO", "MERGULHO", "ESPALMO", "SOCO"]) assert.ok(keeper.includes(subtype), subtype);
  assert.doesNotMatch(keeper, /REFLEX SAVES|GOOD DIRECTION SAVES/);
});

test("ranking de notas usa estrela SVG e a ficha não inventa arquétipo", async () => {
  const [page, sheet] = await Promise.all([read("../src/features/statistics/StatisticsPage.jsx"), read("../src/features/players/PlayerProfile.jsx")]);
  assert.match(page, /<IconStar size=\{13\}[^>]*aria-hidden="true"/);
  assert.match(page, /metric === "averageRating"/);
  assert.match(sheet, /archetypeInfo\?\.verified/);
});

test("dados individuais: nenhuma ficha pré-selecionada, abre ao clicar e fecha com o CloseButton", async () => {
  const [stats, sheet] = await Promise.all([read("../src/features/statistics/StatisticsPage.jsx"), read("../src/features/players/PlayerProfile.jsx")]);
  const page = stats + sheet;
  assert.match(page, /\.find\(\(player\) => profileKey\(player\) === selectedPlayerKey\) \|\| null/);
  assert.doesNotMatch(page, /selectedPlayerKey\) \|\| eligibleProfiles\[0\]/);
  assert.match(page, /onClose=\{\(\) => setSelectedPlayerKey\(""\)\}/);
  assert.match(page, /<CloseButton onClick=\{onClose\} label="Fechar ficha"/);
  for (const status of ["ATIVO", "SEM AMOSTRA", "AMOSTRA LIMITADA"]) assert.ok(page.includes(status), status);
  assert.match(page, /ÚLTIMA ATUAÇÃO/);
  assert.match(page, /statistics-profile-shortcuts/);
});
