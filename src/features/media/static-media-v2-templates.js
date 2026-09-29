import { SeletivaTemplate } from "./SeletivaTemplate.jsx";
import {
  DEFAULT_SELETIVA_COPY,
  sanitizeSeletivaInput,
  seletivaFileName,
} from "./seletiva-template-core.js";
import { STATIC_MEDIA_V2_TEMPLATES } from "./static-media-v2-core.js";

const seletiva = STATIC_MEDIA_V2_TEMPLATES[0];

/** Adapter layer keeps the V2 workbench generic while each template owns its content model. */
export const STATIC_MEDIA_V2_TEMPLATE_REGISTRY = Object.freeze({
  [seletiva.id]: Object.freeze({
    ...seletiva,
    Component: SeletivaTemplate,
    defaultCopy: DEFAULT_SELETIVA_COPY,
    fields: Object.freeze([
      { key: "eyebrow", label: "Assinatura superior", maxLength: 24 },
      { key: "headlineTop", label: "Título · linha 1", maxLength: 20, prominent: true },
      { key: "headlineBottom", label: "Título · linha 2", maxLength: 20, prominent: true },
      { key: "positions", label: "Posições abertas", maxLength: 28 },
      { key: "edition", label: "Edição", maxLength: 16 },
      { key: "cta", label: "Chamada", maxLength: 24 },
    ]),
    sanitizeInput: sanitizeSeletivaInput,
    fileName: seletivaFileName,
  }),
});
