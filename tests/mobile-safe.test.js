import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("sidebar footer stays docked open or collapsed", async () => {
  const [main, css, shell] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/mobile-safe.css"),
    read("../src/design/shell.css"),
  ]);
  assert.match(main, /sidebar-dock/);
  assert.match(main, /sidebar-scroll/);
  assert.match(shell, /\.sidebar-dock \{[^}]*margin-top: auto/);
  assert.match(shell, /\.sidebar-dock \{[^}]*env\(safe-area-inset-bottom\)/);
  assert.match(shell, /\.sidebar-scroll \{[^}]*overflow-y: auto/);
  assert.match(css, /\.formation-picker-field \.slot-10\{\s*bottom:4%/);
  assert.match(shell, /\.sidebar \.rastro-signature \{[^}]*position: static/);
  assert.match(shell, /\.sidebar-user \{[^}]*display: grid/);
});

test("mobile sheets keep header body footer and iPhone safe area", async () => {
  const [main, css, html, shell] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/mobile-safe.css"),
    read("../index.html"),
    read("../src/design/shell.css"),
  ]);
  assert.match(main, /preset-panel-body/);
  assert.match(main, /preset-panel-footer/);
  assert.match(css, /100svh/);
  assert.match(css + shell, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /\.match-preview \.avatar img[\s\S]*object-fit:contain/);
  assert.match(css, /\.match-preview-mark/);
  assert.match(css, /--vv-bottom/);
  assert.match(css, /min\(100dvh, 100svh\)|min\(100dvh,100svh\)/);
  assert.match(css, /font-size:16px!important/);
  assert.match(css, /\.formation-picker-field \.slot-10/);
  assert.match(main, /visualViewport/);
  assert.match(main, /match-preview-mark/);
  assert.match(css, /overflow:hidden!important/);
  assert.match(css, /100dvh/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /interactive-widget=resizes-content/);
});
