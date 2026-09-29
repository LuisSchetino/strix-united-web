import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SELETIVA_COPY,
  normalizeSeletivaCopy,
  sanitizeSeletivaInput,
  SELETIVA_POSTER_SIZE,
  seletivaFileName,
  seletivaHeadingSize,
} from "../src/features/media/seletiva-template-core.js";
import { fitStaticMediaText, normalizeStaticMediaText, safeStaticMediaFileName, STATIC_MEDIA_V2_CANVAS, STATIC_MEDIA_V2_TEMPLATES, getStaticMediaV2Template } from "../src/features/media/static-media-v2-core.js";

test("static seletiva template exports at exact Instagram Story dimensions", () => {
  assert.deepEqual(SELETIVA_POSTER_SIZE, { width: 1080, height: 1920 });
  assert.deepEqual(STATIC_MEDIA_V2_CANVAS, SELETIVA_POSTER_SIZE);
});

test("Seletiva is one registered static template in the shared V2 catalog", () => {
  assert.equal(STATIC_MEDIA_V2_TEMPLATES.length, 1);
  assert.equal(getStaticMediaV2Template("seletiva-open-v2")?.name, "Seletiva aberta");
  assert.equal(getStaticMediaV2Template("agenda-static-v2"), null);
});

test("shared V2 text and filename helpers are bounded and template agnostic", () => {
  assert.equal(normalizeStaticMediaText("  linha\n nova  ", { maxLength: 20 }), "linha nova");
  assert.equal(normalizeStaticMediaText("   ", { fallback: "Strix" }), "Strix");
  assert.equal(fitStaticMediaText("Resultado", { max: 100, min: 50 }), 95.5);
  assert.equal(safeStaticMediaFileName("MVP · 2026"), "mvp-2026");
});

test("seletiva copy is bounded, whitespace-normalized and falls back when empty", () => {
  const copy = normalizeSeletivaCopy({ headlineTop: "  TESTE\n ABERTO ", cta: "   ", positions: "GOL".repeat(20) });
  assert.equal(copy.headlineTop, "TESTE ABERTO");
  assert.equal(copy.cta, DEFAULT_SELETIVA_COPY.cta);
  assert.equal(copy.positions.length, 28);
  assert.equal(sanitizeSeletivaInput("cta", ""), "");
});

test("long headings shrink within the safe poster range", () => {
  assert.equal(seletivaHeadingSize("ABERTA"), 150);
  assert.ok(seletivaHeadingSize("SELETIVA EXTREMAMENTE LONGA") >= 96);
});

test("file name is safe and follows edited headline", () => {
  assert.equal(seletivaFileName({ headlineTop: "Peneira 2026!", headlineBottom: "Ação & Futebol" }), "strix-peneira-2026-acao-futebol.png");
});
