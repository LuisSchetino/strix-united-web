import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("sidebar footer stays docked open or collapsed", async () => {
  const [main, css] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/mobile-safe.css"),
  ]);
  assert.match(main, /sidebar-dock/);
  assert.match(main, /sidebar-scroll/);
  assert.match(css, /\.sidebar-dock\{/);
  assert.match(css, /margin-top:auto/);
  assert.match(css, /min-height:136px/);
  assert.match(css, /\.formation-picker-field \.slot-10\{\s*bottom:2%/);
  assert.match(css, /\.sidebar \.rastro-signature[\s\S]*position:static!important/);
  assert.match(css, /\.sidebar-user[\s\S]*position:static!important/);
});

test("mobile sheets keep header body footer and iPhone safe area", async () => {
  const [main, css, html] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/mobile-safe.css"),
    read("../index.html"),
  ]);
  assert.match(main, /preset-panel-body/);
  assert.match(main, /preset-panel-footer/);
  assert.match(css, /100svh/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
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
