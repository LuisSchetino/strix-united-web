import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cacheableProviderAssetUrl } from "../src/ui/provider-assets.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("known provider logos use the same-origin cache while local assets stay direct", () => {
  const source = "https://ccbclubs.com.br/src/image/proclubs/escudodostimes/genius.png";
  assert.equal(cacheableProviderAssetUrl(source), `/api/competitions/asset?url=${encodeURIComponent(source)}`);
  assert.equal(cacheableProviderAssetUrl("https://assets.example.com/team.png"), "https://assets.example.com/team.png");
  assert.equal(cacheableProviderAssetUrl("/brand/strix/strix-united-fc27.png"), "/brand/strix/strix-united-fc27.png");
});

test("agenda mobile exposes sibling controls and a direct edit path", async () => {
  const source = await read("src/main.jsx");
  const css = await read("src/performance-polish.css");
  assert.match(source, /className="agenda-game-open"/);
  assert.doesNotMatch(source, /className={`agenda-game[\s\S]{0,180}role="button"/);
  assert.match(source, /EDITAR ESCALAÇÃO/);
  assert.match(source, /onEdit=\{modal\.entry/);
  assert.match(css, /\.agenda-game-open\{grid-column:1\/5/);
  assert.match(css, /\.agenda-game\{grid-template-columns:64px minmax\(0,1fr\) 48px!important\}/);
  assert.match(css, /min-height:46px/);
  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("route preloading and faithful skeleton variants are wired without a new query library", async () => {
  const [source, css, pkg] = await Promise.all([
    read("src/main.jsx"),
    read("src/performance-polish.css"),
    read("package.json"),
  ]);
  assert.match(source, /const routeLoaders/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /onPointerEnter=\{warmRoute\(id\)\}/);
  assert.match(source, /FeatureBoundary type="statistics"/);
  assert.match(source, /FeatureBoundary type="analysis"/);
  assert.match(css, /\.skeleton-metrics/);
  assert.match(css, /\.skeleton-table-row/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(pkg, /react-query|tanstack|framer-motion/);
});

test("standing comparison uses the official restrained Next Clubs accent", async () => {
  const [source, css] = await Promise.all([read("src/main.jsx"), read("src/performance-polish.css")]);
  assert.match(source, /agenda-standing-team \$\{label === "STRIX" \? "is-strix"/);
  assert.match(css, /--next-clubs-accent:#c7ff2f/);
  assert.match(css, /\.agenda-standing-team\.is-strix>strong/);
  assert.doesNotMatch(css, /box-shadow:[^;]*c7ff2f/i);
});

test("provider asset response is public edge-cacheable but remains allowlisted", async () => {
  const [handler, provider] = await Promise.all([
    read("functions/api/competitions/asset.js"),
    read("shared/competition-providers.js"),
  ]);
  assert.match(handler, /caches\?\.default/);
  assert.match(handler, /public, max-age=604800, stale-while-revalidate=86400/);
  assert.match(handler, /validateProviderAssetUrl/);
  assert.match(provider, /Host de asset não suportado/);
  assert.match(provider, /Somente assets HTTPS/);
});
