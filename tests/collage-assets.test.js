import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COLLAGE_ASSETS, collageFingerprintToken, collageAssetIds } from "../src/assets/collage/index.js";
import { announceIdentityPayload } from "../src/features/media/announce-core.js";
import { lookAssetFingerprint } from "../src/features/media/media-look.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("V2 usa manifest local, não a biblioteca-fonte", async () => {
  const [manifest, painter, gitignore] = await Promise.all([
    read("../src/assets/collage/index.js"),
    read("../src/features/media/collage-paint.js"),
    read("../.gitignore"),
  ]);
  assert.ok(COLLAGE_ASSETS.brushes.length >= 2);
  assert.ok(COLLAGE_ASSETS.papers.length >= 3);
  assert.ok(COLLAGE_ASSETS.tornPaper.length >= 2);
  assert.ok(COLLAGE_ASSETS.noise.length >= 1);
  assert.ok(collageAssetIds().includes("cut-fill"));
  assert.match(manifest, /COLLAGE_ASSETS_REVISION/);
  assert.doesNotMatch(manifest, /design-assets\/source/);
  assert.doesNotMatch(painter, /import\.meta\.glob/);
  assert.match(painter, /paintCutoutText/);
  assert.match(painter, /paintAgendaFrame/);
  assert.match(gitignore, /design-assets\/source\//);
  assert.match(gitignore, /design-assets\/working\//);
  const campaign = announceIdentityPayload({ people: [], look: "campaign" });
  const collage = announceIdentityPayload({ people: [], look: "collage" });
  assert.equal(campaign.collageAssets, "");
  assert.equal(collage.collageAssets, lookAssetFingerprint("collage", { seed: 41, mode: "chaos" }));
  assert.match(collage.collageAssets, /cutout-v4/);
  assert.match(collage.collageAssets, /seed:41/);
  assert.ok(collage.collageAssets.includes(collageFingerprintToken()));
  assert.notEqual(campaign.collageAssets, collage.collageAssets);
});
