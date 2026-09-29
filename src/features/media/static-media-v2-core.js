/** Shared contract for every static-media template. Template-specific copy/layout stays outside this module. */
export const STATIC_MEDIA_V2_CANVAS = Object.freeze({ width: 1080, height: 1920 });

export const STATIC_MEDIA_V2_TOKENS = Object.freeze({
  background: "#030303",
  foreground: "#f5f4f0",
  muted: "#969ca3",
  hairline: "#ffffff24",
  safeInset: 72,
  displayFont: 'Impact, "Arial Narrow", Inter, sans-serif',
  bodyFont: "Inter, Arial, sans-serif",
});

export function normalizeStaticMediaText(value, { maxLength = 120, fallback = "" } = {}) {
  const normalized = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return normalized || fallback;
}

export function fitStaticMediaText(value, { max = 150, min = 96, referenceLength = 8, step = 4.5 } = {}) {
  const overflow = Math.max(0, String(value ?? "").trim().length - referenceLength);
  return Math.max(min, max - overflow * step);
}

export function safeStaticMediaFileName(value, fallback = "arte-estatica") {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

/** Only completed templates belong here; future media types can register on the same contract. */
export const STATIC_MEDIA_V2_TEMPLATES = Object.freeze([
  Object.freeze({
    id: "seletiva-open-v2",
    name: "Seletiva aberta",
    category: "Institucional",
    description: "Divulgação editorial de posições abertas no elenco.",
    output: "story",
    implemented: true,
  }),
]);

export function getStaticMediaV2Template(templateId) {
  return STATIC_MEDIA_V2_TEMPLATES.find((template) => template.id === templateId) || null;
}
