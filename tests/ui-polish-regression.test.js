import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("sidebar avatar stays compact and does not share elenco preview size", async () => {
  const [logoCss, main, shell] = await Promise.all([
    read("../src/ui/club-logo.css"),
    read("../src/main.jsx"),
    read("../src/design/shell.css"),
  ]);
  assert.match(logoCss, /\.club-logo\{[^}]*width:var\(--avatar-size\)/);
  assert.doesNotMatch(logoCss, /--avatar-size,100%/);
  assert.doesNotMatch(logoCss, /--avatar-size,48px/);
  assert.match(logoCss, /\.avatar-sm,\.sidebar-user \.avatar[^}]*width:36px/);
  assert.match(logoCss, /\.avatar-lg,\.squad-preview \.avatar[^}]*width:116px/);
  assert.match(logoCss, /\.club-logo\.is-photo img\{[^}]*object-fit:cover/);
  assert.match(main, /size="sm"/);
  assert.match(main, /size="lg"/);
  assert.match(main, /const AVATAR_PX = \{ sm: 36, md: 46, lg: 116 \}/);
  assert.match(shell, /\.sidebar-user > span \{[^}]*min-width: 0/);
  assert.doesNotMatch(logoCss, /\.sidebar-user \.avatar[^}]*116px/);
});

test("elenco preview circle is 1:1 cover without contain gaps", async () => {
  const [logoCss, preview] = await Promise.all([
    read("../src/ui/club-logo.css"),
    read("../src/fc27-fixes.css"),
  ]);
  assert.match(logoCss, /\.squad-preview \.avatar,\.squad-preview \.club-logo\{[^}]*aspect-ratio:1\/1/);
  assert.match(logoCss, /\.squad-preview \.avatar img[^}]*object-fit:cover/);
  assert.match(preview, /\.squad-preview \.avatar\.is-photo img[^}]*object-fit:cover/);
  assert.doesNotMatch(logoCss, /\.squad-preview[^{]*\{[^}]*object-fit:contain/);
});

test("library action menu uses shared popover with outside click, ESC and trash icon", async () => {
  const [menu, library, select] = await Promise.all([
    read("../src/ui/ActionMenu.jsx"),
    read("../src/features/library/LibraryPage.jsx"),
    read("../src/ui/SelectControl.jsx"),
  ]);
  assert.match(menu, /strix-action-menu-open/);
  assert.match(menu, /event\.key === "Escape"/);
  assert.match(menu, /pointerdown/);
  assert.match(menu, /IconTrash/);
  assert.match(menu, /createPortal/);
  assert.match(library, /<ActionMenu/);
  assert.match(library, /Remover material/);
  assert.match(library, /<SelectControl/);
  assert.doesNotMatch(library, /⌄/);
  assert.doesNotMatch(library, />•••</);
  assert.match(select, /IconChevronDown/);
  assert.match(select, /pointerdown/);
  assert.match(select, /Escape/);
});

test("analysis segmented control reuses statistics language without an extra box", async () => {
  const [analysisPage, analysisCss, statsPage] = await Promise.all([
    read("../src/features/analysis/AnalysisPage.jsx"),
    read("../src/features/analysis/analysis.css"),
    read("../src/features/statistics/StatisticsPage.jsx"),
  ]);
  assert.match(analysisPage, /<SegmentedControl\s+className="statistics-tabs-v3"/);
  assert.match(statsPage, /className="statistics-tabs-v3"/);
  assert.match(analysisCss, /\.analysis-filters \{[^}]*border: 0;[^}]*background: transparent;/);
  assert.doesNotMatch(analysisCss, /!important/);
  assert.doesNotMatch(analysisCss, /\.analysis-filters\{padding:4px;border:1px solid var\(--strix-border\)/);
});
