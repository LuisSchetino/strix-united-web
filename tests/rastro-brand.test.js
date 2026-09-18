import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { RASTRO_BRAND } from "../src/brand.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Rastro brand blue stays on analytics tokens, not on generic UI tokens", async () => {
  const [brandCss, selectCss] = await Promise.all([
    read("../src/fc27-brand.css"),
    read("../src/ui/select-control.css"),
  ]);
  assert.equal(RASTRO_BRAND.color, "#2F80FF");
  assert.match(brandCss, /--rastro-blue:\s*#2F80FF/i);
  assert.match(brandCss, /--rastro-blue-soft:\s*rgba\(47,128,255/);
  assert.match(brandCss, /--strix-blue:\s*#f5f5f5/);
  assert.match(brandCss, /--fc27-blue:\s*#f5f5f5/);
  assert.match(brandCss, /\.rastro-signature b\{color:var\(--rastro-blue\)/);
  assert.doesNotMatch(selectCss, /var\(--rastro-blue\)/);
});
