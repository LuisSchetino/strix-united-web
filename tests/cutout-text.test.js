import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import {
  CUTOUT_ENGINE_VERSION,
  CUTOUT_MANIFEST_VERSION,
  CUTOUT_TEMPLATE_SEEDS,
  CUTOUT_VARIANT_COUNTS,
  cutoutAssetPath,
  cutoutCharsNeeded,
  cutoutEnterAmount,
  cutoutFingerprintToken,
  cutoutPreloadPlan,
  layoutCutoutText,
  normalizeCutoutChar,
  pickCutoutVariant,
  paintCutoutText,
  preloadCutoutChars,
} from "../src/features/media/cutout-text.js";
import { lookAssetFingerprint } from "../src/features/media/media-look.js";

const lettersRoot = new URL("../public/collage/letters/", import.meta.url);

test("mesmo seed reproduz o mesmo layout e fingerprint inclui seed/modo", () => {
  const a = layoutCutoutText("AGENDA", { seed: 42, size: 140, maxWidth: 980 });
  const b = layoutCutoutText("AGENDA", { seed: 42, size: 140, maxWidth: 980 });
  const c = layoutCutoutText("AGENDA", { seed: 99, size: 140, maxWidth: 980 });
  assert.equal(a.rows[0].glyphs.length, 6);
  assert.deepEqual(a.rows[0].glyphs.map((item) => item.char).join(""), "AGENDA");
  assert.deepEqual(
    a.rows[0].glyphs.map((item) => [item.x, item.y, item.rot, item.scale]),
    b.rows[0].glyphs.map((item) => [item.x, item.y, item.rot, item.scale]),
  );
  assert.notEqual(a.rows[0].glyphs[0].rot, c.rows[0].glyphs[0].rot);
  assert.equal(CUTOUT_ENGINE_VERSION, "cutout-v2");
  assert.equal(CUTOUT_MANIFEST_VERSION, "letters-real-v1");
  assert.match(cutoutFingerprintToken(), new RegExp(`^${CUTOUT_ENGINE_VERSION}:${CUTOUT_MANIFEST_VERSION}:`));
  assert.match(lookAssetFingerprint("collage"), /cutout-v2/);
  assert.match(lookAssetFingerprint("collage", { seed: 2, mode: "chaos" }), /seed:2/);
  assert.match(lookAssetFingerprint("collage", { seed: 2, mode: "chaos" }), /mode:chaos/);
  assert.notEqual(
    lookAssetFingerprint("collage", { seed: 2, mode: "chaos" }),
    lookAssetFingerprint("collage", { seed: 99, mode: "chaos" }),
  );
  assert.equal(lookAssetFingerprint("campaign", { seed: 2 }), "");
  assert.equal(CUTOUT_TEMPLATE_SEEDS.agenda, 2);
});

test("Chaos troca variante da mesma letra e nunca o caractere", () => {
  const chars = layoutCutoutText("AGENDA", { seed: 7 }).rows[0].glyphs.map((item) => item.char);
  assert.deepEqual(chars, ["A", "G", "E", "N", "D", "A"]);
  const first = pickCutoutVariant("A", { seed: 7, slot: 0, mode: "chaos", progress: 0, rate: 8 });
  const same = pickCutoutVariant("A", { seed: 7, slot: 0, mode: "chaos", progress: 0, rate: 8 });
  assert.equal(first, same);
  const variants = new Set(
    Array.from({ length: 24 }, (_, index) => pickCutoutVariant("A", {
      seed: 7,
      slot: 0,
      mode: "chaos",
      progress: index / 8,
      rate: 8,
    })),
  );
  assert.equal(pickCutoutVariant("A", { seed: 7, slot: 0, mode: "static", progress: 0 }), pickCutoutVariant("A", { seed: 7, slot: 0, mode: "static", progress: 4 }));
  assert.ok(variants.size >= 2);
  assert.ok([...variants].every((value) => value >= 1 && value <= CUTOUT_VARIANT_COUNTS.A));
  const held = pickCutoutVariant("A", { seed: 7, slot: 0, mode: "chaos", progress: 0.12, rate: 8 });
  const neighbor = pickCutoutVariant("A", { seed: 7, slot: 0, mode: "chaos", progress: 0.13, rate: 8 });
  assert.ok(held >= 1);
  assert.ok(neighbor >= 1);
  assert.equal(normalizeCutoutChar("á"), "A");
  assert.equal(normalizeCutoutChar("%"), "?");
});

test("MATCH_CUT troca recorte no mesmo slot e ASSEMBLE entra letra a letra", () => {
  const layout = layoutCutoutText("AGENDA", { seed: 2, size: 140, maxWidth: 980 });
  const slots = layout.rows[0].glyphs.map((glyph) => [glyph.x, glyph.y, glyph.w, glyph.h, glyph.baseline]);
  assert.equal(slots.length, 6);
  const cuts = new Set(Array.from({ length: 12 }, (_, index) => pickCutoutVariant("A", {
    seed: 2,
    slot: 0,
    mode: "match_cut",
    progress: index * 0.45,
    rate: 6,
  })));
  assert.ok(cuts.size >= 2);
  assert.ok(cutoutEnterAmount("assemble", 0.08, 0) > 0.5);
  assert.ok(cutoutEnterAmount("assemble", 0.08, 0.12) <= 0.02);
  assert.ok(cutoutEnterAmount("assemble", 0.2, 0.12) > 0.5);
  assert.ok(cutoutEnterAmount("assemble", 0.2, 0.24) <= 0.02);
  assert.equal(cutoutEnterAmount("static", 0, 99), 1);
});

test("multiline, max width, fallback e preload seletivo", async () => {
  const wrapped = layoutCutoutText("AGENDA\nDA NOITE", { seed: 3, size: 90, maxWidth: 980, align: "center" });
  assert.equal(wrapped.rows.length, 2);
  assert.ok(wrapped.rows[0].glyphs[0].x >= 0);
  assert.ok(wrapped.rows.some((row) => row.glyphs.some((glyph) => glyph.char === "N")));
  const squeezed = layoutCutoutText("RELACIONADOS", { seed: 4, size: 180, maxWidth: 240 });
  assert.ok(squeezed.width <= 240 + 0.01);
  assert.deepEqual(cutoutCharsNeeded("Agenda!!"), ["A", "G", "E", "N", "D", "!"]);
  assert.equal(cutoutAssetPath("A", 8).endsWith("/A/08.png"), true);
  assert.match(cutoutAssetPath("%", 1), /\?/);
  const staticPlan = cutoutPreloadPlan("AGENDA", { seed: 2, mode: "static" });
  const chaosPlan = cutoutPreloadPlan("AGENDA", { seed: 2, mode: "chaos" });
  assert.equal(staticPlan.length, 6);
  assert.equal(chaosPlan.length, ["A", "G", "E", "N", "D"].reduce((sum, char) => sum + CUTOUT_VARIANT_COUNTS[char], 0));
  assert.ok(chaosPlan.every((path) => /\/[AGEND]\//.test(path)));
  assert.ok(!chaosPlan.some((path) => /\/Z\//.test(path)));
  const cache = await preloadCutoutChars("AGENDA");
  assert.equal(typeof cache.get, "function");
  const ctx = {
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    fillRect() {},
    strokeRect() {},
    fillText(text) { this.texts.push(String(text)); },
    drawImage() {},
    texts: [],
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
  };
  paintCutoutText(ctx, { text: "AGENDA", x: 0, y: 0, seed: 2, size: 80, progress: 1, animation: "static" });
  assert.deepEqual(ctx.texts, ["A", "G", "E", "N", "D", "A"]);
  ctx.texts = [];
  paintCutoutText(ctx, { text: "AGENDA", x: 0, y: 0, seed: 2, size: 80, progress: 0.08, animation: "assemble" });
  assert.deepEqual(ctx.texts, ["A"]);
  ctx.texts = [];
  paintCutoutText(ctx, { text: "AGENDA", x: 0, y: 0, seed: 2, size: 80, progress: 0, animation: "chaos" });
  assert.deepEqual(ctx.texts, ["A", "G", "E", "N", "D", "A"]);
});

test("biblioteca real tem as variantes encontradas, sem alfabeto artificial 8/4", async () => {
  const agenda = await Promise.all(["A", "G", "E", "N", "D"].map(async (char) => {
    const files = await readdir(new URL(`${char}/`, lettersRoot));
    return [char, files.filter((name) => name.endsWith(".png")).length];
  }));
  assert.deepEqual(Object.fromEntries(agenda), { A: 19, G: 10, E: 22, N: 25, D: 5 });
  const z = (await readdir(new URL("Z/", lettersRoot))).filter((name) => name.endsWith(".png"));
  assert.equal(z.length, 1);
  const sample = await stat(new URL("A/01.png", lettersRoot));
  assert.ok(sample.size > 8_000);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", lettersRoot), "utf8"));
  assert.equal(manifest.version, "letters-real-v1");
  assert.equal(manifest.source, "fernandochueire/letras_recortadas");
  assert.equal(CUTOUT_VARIANT_COUNTS.A, 19);
  assert.equal(CUTOUT_VARIANT_COUNTS.Z, 1);
  const engine = await readFile(new URL("../src/features/media/cutout-text.js", import.meta.url), "utf8");
  assert.match(engine, /CUTOUT_LIBRARY/);
  assert.doesNotMatch(engine, /HEADLINE_CHARS/);
});
