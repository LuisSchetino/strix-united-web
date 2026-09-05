import test from "node:test";
import assert from "node:assert/strict";
import { preloadClubLogos, cacheableProviderAssetUrl } from "../src/ui/provider-assets.js";

test("failed logo preloads are retryable; successful warmups are deduplicated", () => {
  const previous = globalThis.Image;
  const images = [];
  globalThis.Image = class { constructor() { images.push(this); } };
  try {
    preloadClubLogos(["/qa-retry.png", "/qa-retry.png"]);
    assert.equal(images.length, 1);
    images[0].onerror();
    preloadClubLogos(["/qa-retry.png"]);
    assert.equal(images.length, 2);
    preloadClubLogos(["/qa-retry.png"]);
    assert.equal(images.length, 2);
  } finally { globalThis.Image = previous; }
});

test("already resolved proxy URLs and transparent local PNG assets remain unchanged", () => {
  for (const url of ["/brand/team-transparent.png", "/api/competitions/asset?url=https%3A%2F%2Fccbclubs.com.br%2Fteam.png", "https://assets.example.org/team.webp", ""]) {
    assert.equal(cacheableProviderAssetUrl(url), url);
  }
});
