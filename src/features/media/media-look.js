export const MEDIA_LOOK_STORAGE_KEY = "strix-fc27-media-look";

export const MEDIA_LOOKS = Object.freeze({
  campaign: {
    id: "campaign",
    version: "v1",
    label: "V1 — Campanha FC27",
    short: "V1",
    kicker: "CAMPANHA FC27",
  },
  collage: {
    id: "collage",
    version: "v2",
    label: "V2 — Collage Editorial",
    short: "V2",
    kicker: "COLLAGE EDITORIAL",
  },
});

export const MEDIA_LOOK_OPTIONS = Object.freeze([
  ["campaign", MEDIA_LOOKS.campaign.label],
  ["collage", MEDIA_LOOKS.collage.label],
]);

export function normalizeMediaLook(value = "campaign") {
  return String(value || "").trim().toLowerCase() === "collage" ? "collage" : "campaign";
}

export function readStoredMediaLook() {
  try {
    return normalizeMediaLook(globalThis.localStorage?.getItem(MEDIA_LOOK_STORAGE_KEY));
  } catch {
    return "campaign";
  }
}

export function writeStoredMediaLook(value) {
  const look = normalizeMediaLook(value);
  try {
    globalThis.localStorage?.setItem(MEDIA_LOOK_STORAGE_KEY, look);
  } catch {
    /* ignore quota / private mode */
  }
  return look;
}

export function mediaLookLabel(value) {
  return MEDIA_LOOKS[normalizeMediaLook(value)]?.label || MEDIA_LOOKS.campaign.label;
}

export function withMediaLook(timeline, look) {
  if (!timeline || typeof timeline !== "object") return timeline;
  return { ...timeline, mediaLook: normalizeMediaLook(look || timeline.mediaLook) };
}
