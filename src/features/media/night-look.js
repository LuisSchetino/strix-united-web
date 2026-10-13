// What the "night vision" model needs besides its painter: the one colour it borrows, and its
// two typefaces (a blackletter for the headlines, a grotesque with a width dial for the
// readouts and the hours). They are loaded only when a piece of this model is made.
import { RASTRO_BRAND } from "../../brand.js";

export const RASTRO_BLUE = RASTRO_BRAND.color;

let ready = null;
/** The model's faces, registered once. Resolves false where they cannot be loaded (the painter falls back). */
export function loadNightFonts() {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve(false);
  ready ||= Promise.all([
    new FontFace("UnifrakturCook", "url(/fonts/media/UnifrakturCook-Bold.ttf)", { weight: "700" }),
    new FontFace("Archivo", "url(/fonts/media/Archivo-Variable.ttf)", { weight: "100 900", stretch: "62% 125%" }),
  ].map(async (face) => { await face.load(); document.fonts.add(face); })).then(() => true, () => { ready = null; return false; });
  return ready;
}

const FACE_KEY = "strix:media:face";
/** The player chosen as the Agenda's face on this device ("" = drawn at random). */
export function readFaceChoice() {
  try { return localStorage.getItem(FACE_KEY) || ""; } catch { return ""; }
}

export function writeFaceChoice(id) {
  try { if (id) localStorage.setItem(FACE_KEY, id); else localStorage.removeItem(FACE_KEY); } catch { /* a convenience only */ }
}
