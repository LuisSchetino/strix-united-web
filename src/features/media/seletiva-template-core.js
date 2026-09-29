import { fitStaticMediaText, normalizeStaticMediaText, safeStaticMediaFileName, STATIC_MEDIA_V2_CANVAS, STATIC_MEDIA_V2_TEMPLATES } from "./static-media-v2-core.js";

export const SELETIVA_TEMPLATE_ID = STATIC_MEDIA_V2_TEMPLATES.find((template) => template.name === "Seletiva aberta")?.id;
export const SELETIVA_TEMPLATE_VERSION = "1.0.0";
export const SELETIVA_POSTER_SIZE = STATIC_MEDIA_V2_CANVAS;

export const DEFAULT_SELETIVA_COPY = Object.freeze({
  eyebrow: "STRIX UNITED",
  headlineTop: "SELETIVA",
  headlineBottom: "ABERTA",
  positions: "ZAGUEIRO · ALA",
  edition: "FC 27",
  cta: "CHAMA NO DIRECT",
});

const LIMITS = Object.freeze({ eyebrow: 24, headlineTop: 20, headlineBottom: 20, positions: 28, edition: 16, cta: 24 });

export function sanitizeSeletivaInput(key, value) {
  const limit = LIMITS[key] || 24;
  return normalizeStaticMediaText(value, { maxLength: limit });
}

export function normalizeSeletivaCopy(copy = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_SELETIVA_COPY).map(([key, fallback]) => {
    const value = sanitizeSeletivaInput(key, copy[key] ?? fallback).trim();
    return [key, value || fallback];
  }));
}

export function seletivaHeadingSize(value = "", { max = 150, min = 96 } = {}) {
  return fitStaticMediaText(value, { max, min });
}

export function seletivaFileName(copy = DEFAULT_SELETIVA_COPY) {
  const normalized = normalizeSeletivaCopy(copy);
  const slug = safeStaticMediaFileName(`${normalized.headlineTop}-${normalized.headlineBottom}`, "seletiva");
  return `strix-${slug}.png`;
}
