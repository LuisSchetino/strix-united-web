import { normalizeMediaLook, withMediaLook } from "./media-look.js";

/**
 * MediaRenderer: the layer that decides HOW a piece is built so the user never has to.
 *
 *   section + content + format  →  composition (timeline builder, frame painter, output)
 *   composition + source media  →  visual treatment (editorial clean V3)
 *
 * The Central only exposes sections, content and format; the painter stays automatic.
 */

export const MEDIA_SECTIONS = Object.freeze([
  Object.freeze({ id: "agenda", label: "AGENDA", title: "Agenda do dia", output: "video", formats: ["story", "feed"] }),
  Object.freeze({ id: "related", label: "RELACIONADOS", title: "Relacionados da noite", output: "video", formats: ["story"] }),
  Object.freeze({ id: "summary-day", label: "RESUMO DO DIA", title: "Resumo do dia", output: "video", formats: ["story"] }),
  Object.freeze({ id: "summary-week", label: "RESUMO DA SEMANA", title: "Resumo da semana", output: "video", formats: ["story"] }),
  Object.freeze({ id: "announce", label: "ANÚNCIOS FC27", title: "Anúncios FC27", output: "mixed", formats: ["story", "feed"] }),
]);

export const MEDIA_FORMAT_LABELS = Object.freeze({
  story: "REELS 9:16",
  feed: "POST 4:5",
});

export const MEDIA_SECTION_IDS = Object.freeze(MEDIA_SECTIONS.map((section) => section.id));

export function mediaSection(id) {
  return MEDIA_SECTIONS.find((section) => section.id === id) || MEDIA_SECTIONS[0];
}

export function normalizeMediaSection(id) {
  return MEDIA_SECTION_IDS.includes(id) ? id : MEDIA_SECTIONS[0].id;
}

/** A format a section cannot produce falls back to its first supported one. */
export function resolveMediaFormat(sectionId, requested) {
  const section = mediaSection(sectionId);
  return section.formats.includes(requested) ? requested : section.formats[0];
}

export function resolveMediaLook() {
  return normalizeMediaLook("editorial");
}

/**
 * What the user gets out of "generate" for a given piece. Announcements in the
 * 4:5 post format are stills (PNG); everything else is an MP4.
 */
export function resolveMediaOutput({ sectionId, kind = "individual", format = "story" } = {}) {
  if (sectionId === "announce" && kind === "seletiva") return { type: "image", ext: "png", label: "PNG" };
  if (sectionId === "announce" && format === "feed") return { type: "image", ext: "png", label: "PNG" };
  return { type: "video", ext: "mp4", label: "MP4" };
}

export function mediaGenerateLabel(output) {
  return output.type === "image" ? "GERAR PNG" : "GERAR VÍDEO";
}

export function applyMediaRenderer(timeline, { collageReady = true } = {}) {
  return withMediaLook(timeline, resolveMediaLook({ collageReady }));
}
