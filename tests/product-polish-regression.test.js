import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("team statistics use canonical FC27 identity and scoped Rastro data accents", async () => {
  const [page, css] = await Promise.all([
    read("../src/features/statistics/StatisticsPage.jsx"),
    read("../src/features/statistics/statistics.css"),
  ]);
  assert.match(page, /import \{ FC27_CLUB \} from "\.\.\/\.\.\/\.\.\/shared\/fc27-club\.js"/);
  assert.match(page, /Club ID · \{FC27_CLUB\.clubId\}/);
  assert.doesNotMatch(page, /625257/);
  // STRIX UI ≠ RASTRO UI: data values read in Strix off-white; Rastro Blue
  // only appears inside Rastro-scoped selectors (the signature).
  assert.match(css, /\.statistics-v3 \.statistics-stat-card>strong\{color:var\(--text-1\)!important\}/);
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const leaks = rules.filter(([, selector, body]) => /rastro-blue|#2f80ff|47,\s*128,\s*255/i.test(body) && !/rastro/i.test(selector.split("*/").pop()));
  assert.deepEqual(leaks.map(([, selector]) => selector.trim()), []);
  assert.doesNotMatch(css, /\.select-control[^}]*rastro-blue/);
});

test("roster x-ray uses shared sliding segmented tabs and custom selects", async () => {
  const [page, css] = await Promise.all([
    read("../src/features/analysis/AnalysisPage.jsx"),
    read("../src/features/analysis/analysis.css"),
  ]);
  assert.match(page, /<SegmentedControl className="analysis-xray-toggle"/);
  assert.equal((page.match(/className="analysis-xray-toggle"/g) || []).length, 1);
  assert.match(page, /<SelectControl value=\{period\}/);
  assert.match(page, /<SelectControl value=\{competition\}/);
  assert.match(css, /\.analysis-xray-toggle\.motion-tabs \.motion-tabs-indicator[^}]*190ms/);
  assert.match(page, /Os jogadores sem amostra continuam disponíveis/);
  assert.match(page, /SEM AMOSTRA NESTE RECORTE/);
});

test("team analytics uses an em dash rather than zero when the EA metric is missing", async () => {
  const [statistics, analysis] = await Promise.all([
    read("../src/features/statistics/StatisticsPage.jsx"),
    read("../src/features/analysis/AnalysisPage.jsx"),
  ]);
  assert.match(statistics, /team\.metricSamples\?\.shots \? team\.shots : null/);
  assert.match(statistics, /team\.metricSamples\?\.saves \? team\.saves : null/);
  assert.match(analysis, /\{value == null \? "Sem dados registrados" : note\}/);
  assert.match(analysis, /team\.metricSamples\?\.passesMade \? team\.passesMadePerGame : null/);
});

test("announcement studio keeps filtering, selection, ordering and export actions in a compact hierarchy", async () => {
  const [page, css] = await Promise.all([
    read("../src/features/media/AnnounceStudio.jsx"),
    read("../src/features/media/announce.css"),
  ]);
  for (const feature of ["announce-filters", "SÓ JOGADORES", "SÓ ESTRUTURA", "announce-person-index", "Subir ${person.name}", "Descer ${person.name}", "announce-generate", "ArchiveList", "<Options>"]) {
    assert.ok(page.includes(feature) || css.includes(feature), `missing media UI feature: ${feature}`);
  }
  assert.match(page, /TELA CHEIA/);
  assert.match(page, /VER ÚLTIMA/);
  assert.match(page, /BAIXAR/);
  assert.match(css, /\.announce-people\{[^}]*overflow:auto/);
});

test("empty agenda widget exposes only the centered crest with an accessible action label", async () => {
  const [main, css] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/design/shell.css"),
  ]);
  const widget = main.slice(main.indexOf("function CurrentGameLive"), main.indexOf("function WorkspaceSkeleton"));
  assert.match(widget, /aria-label=\{item \? `Próxima partida:/);
  assert.match(widget, /Agenda: nenhuma partida programada/);
  assert.match(widget, /item \? <><Crest small\/>/);
  assert.match(css, /button\.now-playing\.is-agenda-free \{[^}]*width: 40px[^}]*height: 40px/s);
});
