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
});

export function normalizeMediaLook(value = "campaign") {
  return String(value || "").trim().toLowerCase() === "collage" ? "collage" : "campaign";
}

export function withMediaLook(timeline, look) {
  if (!timeline || typeof timeline !== "object") return timeline;
  return { ...timeline, mediaLook: normalizeMediaLook(look || timeline.mediaLook) };
}

export function lookAssetFingerprint(look, extra = {}) {
  if (normalizeMediaLook(look) !== "collage") return "";
  const seed = extra.seed == null ? "" : String(extra.seed);
  const mode = extra.mode ? String(extra.mode) : "";
  return `${collageFingerprintToken()}|${cutoutFingerprintToken()}|seed:${seed}|mode:${mode}`;
}
