import { collageFingerprintToken } from "../../assets/collage/index.js";
import { cutoutFingerprintToken } from "./cutout-text.js";

// Internal renderer identities. The Central never exposes them: media-renderer.js
// resolves the look automatically and the user only picks section, content and format.
export const MEDIA_LOOKS = Object.freeze({
  campaign: {
    id: "campaign",
    version: "v1",
    label: "Campanha FC27",
    short: "V1",
    kicker: "CAMPANHA FC27",
  },
  collage: {
    id: "collage",
    version: "v2",
    label: "Collage editorial",
    short: "V2",
    kicker: "COLLAGE EDITORIAL",
  },
  editorial: {
    id: "editorial",
    version: "v3",
    label: "Editorial clean",
    short: "V3",
    kicker: "STRIX EDITORIAL",
  },
});

export function normalizeMediaLook(value = "editorial") {
  const normalized = String(value || "").trim().toLowerCase();
  return MEDIA_LOOKS[normalized] ? normalized : "editorial";
}

export function withMediaLook(timeline, look) {
  if (!timeline || typeof timeline !== "object") return timeline;
  return { ...timeline, mediaLook: normalizeMediaLook(look || timeline.mediaLook) };
}

export function lookAssetFingerprint(look, extra = {}) {
  const resolved = normalizeMediaLook(look);
  // Bumped with the now-line direction so every render made with the previous look is regenerated.
  if (resolved === "editorial") return "strix-nowline-v2";
  if (resolved !== "collage") return "";
  const seed = extra.seed == null ? "" : String(extra.seed);
  const mode = extra.mode ? String(extra.mode) : "";
  return `${collageFingerprintToken()}|${cutoutFingerprintToken()}|seed:${seed}|mode:${mode}`;
}
