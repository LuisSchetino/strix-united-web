import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("motion system centralizes tokens and honors reduced motion", async () => {
  const [css, source, main, pkg] = await Promise.all([
    read("src/ui/motion/motion.css"),
    read("src/ui/motion/motion.jsx"),
    read("src/main.jsx"),
    read("package.json"),
  ]);
  assert.match(css, /--motion-fast:/);
  assert.match(css, /--motion-normal:/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(main, /ArrowDown/);
  assert.match(source, /root\.scrollTo/);
  assert.doesNotMatch(source, /button\.scrollIntoView/);
  assert.doesNotMatch(pkg, /framer-motion|"motion"\s*:/);
});

test("shared MatchDisplay keeps equal home/away columns around the score", async () => {
  const source = await read("src/ui/MatchDisplay.jsx");
  const home = source.indexOf('side="home"');
  const separator = source.indexOf("<i>×</i>");
  const away = source.indexOf('side="away"');
  assert.ok(home >= 0 && separator > home && away > separator);
  assert.match(source, /homeName[\s\S]*homeLogo[\s\S]*homeScore/);
  assert.match(source, /awayName[\s\S]*awayLogo[\s\S]*awayScore/);
});

test("mobile history uses cards, sheet and horizontal swipe without page table overflow", async () => {
  const [source, css] = await Promise.all([
    read("src/features/matches/MatchesPage.jsx"),
    read("src/features/matches/match-fixes.css"),
  ]);
  assert.match(source, /function MobileMatchCard/);
  assert.match(source, /useSwipeActions/);
  assert.match(source, /useSheetDismiss/);
  assert.match(source, /match-detail-score-shell/);
  assert.match(source, /match-result-badge/);
  assert.match(source, /swipe\.dragging/);
  assert.match(css, /\.progressive-history>header,\.progressive-history>\.match-history-desktop\{display:none\}/);
  assert.match(css, /\.match-mobile-card\{[^}]*min-width:0!important/);
  assert.match(css, /max-height:min\(92dvh,920px\)/);
  assert.match(css, /padding-bottom:env\(safe-area-inset-bottom\)/);
});

test("competition mobile selector, sticky standings and round navigation stay bounded", async () => {
  const [source, css] = await Promise.all([
    read("src/features/competitions/CompetitionsPage.jsx"),
    read("src/features/competitions/competitions-inline.css"),
  ]);
  assert.match(source, /bracket-round-nav/);
  assert.match(source, /data-mobile-active/);
  assert.match(source, /SegmentedControl/);
  assert.match(css, /scroll-snap-type:x proximity/);
  assert.match(css, /-webkit-line-clamp:2/);
  assert.match(css, /\.standings-table>header>\*:nth-child\(3\)/);
  assert.match(css, /column-gap:0/);
  assert.match(css, /--standings-row-bg/);
  assert.match(css, /\.bracket-round\[data-mobile-active="true"\]/);
  assert.match(source, /function BracketConnectors/);
  assert.match(source, /ResizeObserver/);
  assert.match(css, /\.bracket-connectors path/);
});

test("global mobile shell reserves safe area and prevents global horizontal overflow", async () => {
  const css = await read("src/ui/motion/motion.css");
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /padding-bottom:\s*calc\(118px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /bottom:\s*calc\(10px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /100dvh/);
});

test("command, toast, menu and sheet keep their accessible interaction contracts", async () => {
  const [main, motion, motionCss, matches, dialog] = await Promise.all([
    read("src/main.jsx"),
    read("src/ui/motion/motion.jsx"),
    read("src/ui/motion/motion.css"),
    read("src/features/matches/MatchesPage.jsx"),
    read("src/ui/useDialog.js"),
  ]);
  assert.match(main, /role="dialog"/);
  assert.match(main, /role="listbox"/);
  assert.match(main, /className="search-button" aria-label="Buscar no Strix"/);
  assert.match(main, /event\.key === "Enter"/);
  assert.match(main, /event\.key === "Escape"/);
  assert.match(main, /command-selection-indicator/);
  assert.match(main, /data-command-index/);
  assert.match(main, /function ViewportDialog/);
  assert.match(main, /useDialog\(onClose/);
  assert.match(main, /editing !== null && <ViewportDialog[\s\S]*onClose=\{\(\) => \{ if \(!savingRef\.current\) close\(\); \}\}/);
  assert.match(main, /<CloseButton onClick=\{close\} disabled=\{saving\} \/>/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /closeRef\.current\(\)/);
  assert.match(dialog, /previous\?\.isConnected\) previous\.focus/);
  assert.match(dialog, /button:not\(:disabled\)/);
  assert.match(main, /<ToastViewport\s*\/>/);
  assert.match(main, /addEventListener\("pointerdown", closeMenu\)/);
  assert.match(motion, /setPointerCapture\?\.\(event\.pointerId\)/);
  assert.match(motion, /setDragging\(true\)/);
  assert.match(motion, /\* 0\.12/);
  assert.match(motion, /dy > 84/);
  assert.match(matches, /type="button" className="match-sheet-handle"/);
  assert.match(matches, /event\.target === event\.currentTarget && close\(\)/);
  assert.match(motionCss, /\.motion-toast\s*\{/);
  assert.match(motionCss, /@keyframes motion-menu-in/);
});
