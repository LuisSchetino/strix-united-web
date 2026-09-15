import { classifyHeroPhoto } from "./related-night-hero.js";

export const ANNOUNCE_VARIANTS = Object.freeze(["left", "center", "tight"]);

export function hashSeed(seed = "") {
  let hash = 2166136261;
  const encoded = new TextEncoder().encode(String(seed));
  for (const byte of encoded) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed = "") {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 13), 1274126177) >>> 0;
    return state / 4294967296;
  };
}

export function personVariant(index = 0) {
  return ANNOUNCE_VARIANTS[Math.abs(Number(index) || 0) % ANNOUNCE_VARIANTS.length];
}

export function classifyAnnouncePhoto(bitmap) {
  const classified = classifyHeroPhoto(bitmap);
  if (!bitmap) return { ...classified, crop: "none" };
  const ratio = bitmap.width / Math.max(1, bitmap.height);
  if (classified.kind === "cutout") return { ...classified, crop: "cutout" };
  if (ratio > 0.92) return { ...classified, crop: "selfie" };
  if (ratio < 0.55) return { ...classified, crop: "fullbody" };
  return { ...classified, crop: classified.strongBg ? "stadium" : "portrait" };
}

export function photoFocusY(classified = {}) {
  if (classified.crop === "selfie") return 0.16;
  if (classified.crop === "fullbody") return 0.12;
  if (classified.crop === "stadium") return 0.18;
  return 0.2;
}

export function faceSafeBox(box = {}, classified = {}) {
  const w = Math.round((box.w || 0) * 0.52);
  const head = classified.crop === "selfie" ? 0.5 : classified.crop === "fullbody" ? 0.3 : 0.36;
  return {
    x: (box.x || 0) + ((box.w || 0) - w) / 2,
    y: (box.y || 0) + (box.h || 0) * 0.04,
    w,
    h: Math.round((box.h || 0) * head),
  };
}

export function photoBoxForVariant(variant, timeline, classified = {}) {
  const { width, height, safe } = timeline;
  const story = timeline.format !== "feed";
  const focusY = photoFocusY(classified);

  if (!story) {
    return {
      x: 0,
      y: 0,
      w: width,
      h: height,
      focusY,
      type: "overlay",
    };
  }

  if (variant === "left") {
    return {
      x: 0,
      y: 0,
      w: Math.round(width * 0.62),
      h: height,
      focusY,
      type: "right",
    };
  }

  if (variant === "tight") {
    return {
      x: Math.round(width * 0.34),
      y: 0,
      w: Math.round(width * 0.66),
      h: height,
      focusY: classified.crop === "selfie" ? 0.14 : 0.18,
      type: "left",
    };
  }

  return {
    x: 0,
    y: 0,
    w: width,
    h: Math.round(height * 0.72),
    focusY,
    type: "below",
  };
}

export function typeBoxForVariant(variant, timeline, photo) {
  const { width, height, safe } = timeline;
  const story = timeline.format !== "feed";
  if (!story) {
    return {
      x: safe.side,
      y: Math.round(height * 0.64),
      w: width - safe.side * 2,
      align: "left",
    };
  }
  if (variant === "left" || photo.type === "right") {
    return {
      x: Math.round(width * 0.66),
      y: height * 0.42,
      w: width - Math.round(width * 0.66) - safe.side,
      align: "left",
    };
  }
  if (variant === "tight" || photo.type === "left") {
    return {
      x: safe.side,
      y: height * 0.42,
      w: Math.round(width * 0.32) - 8,
      align: "left",
    };
  }
  return {
    x: safe.side,
    y: height * 0.69,
    w: width - safe.side * 2,
    align: "left",
  };
}

export function buildNameBrush(seed, box) {
  const rand = seededRandom(`brush:${seed}:${Math.round(box.x)}:${Math.round(box.y)}`);
  const y = box.y + (rand() - 0.5) * 6;
  return {
    x: box.x - 8,
    y,
    w: Math.min(box.w * 0.92, box.w - 4),
    lift: 10 + rand() * 8,
    width: 11 + rand() * 5,
  };
}

export function campaignName(person) {
  return String(person?.nick || person?.name || "").toUpperCase();
}

export function fitNameLayout(ctx, name, maxWidth, prefer = 88, min = 40) {
  const text = String(name || "").toUpperCase().trim();
  if (!text || !ctx) return { lines: text ? [text] : [], size: prefer };
  const words = text.split(/\s+/).filter(Boolean);
  const fits = (size, lines) => {
    ctx.font = `700 ${size}px Rajdhani, sans-serif`;
    return lines.every((line) => ctx.measureText(line).width <= maxWidth);
  };
  if (fits(prefer, [text])) return { lines: [text], size: prefer };
  for (let size = prefer - 2; size >= min; size -= 2) {
    if (fits(size, [text])) return { lines: [text], size };
  }
  const splitAt = Math.max(1, Math.ceil(words.length / 2));
  const two = words.length > 1
    ? [words.slice(0, splitAt).join(" "), words.slice(splitAt).join(" ")].filter(Boolean)
    : [text];
  for (let size = Math.min(prefer, 72); size >= min; size -= 2) {
    if (fits(size, two)) return { lines: two, size };
  }
  ctx.font = `700 ${min}px Rajdhani, sans-serif`;
  const clipped = two.map((line) => {
    if (ctx.measureText(line).width <= maxWidth) return line;
    let next = line;
    while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) next = next.slice(0, -1);
    return `${next}…`;
  });
  return { lines: clipped, size: min };
}

export function announceGridSpec(count = 0, format = "story") {
  const n = Math.max(0, Number(count) || 0);
  const story = format !== "feed";
  if (story) {
    if (n <= 4) return { cols: 2, maxAspect: 1.48, nameReserve: 70 };
    if (n <= 6) return { cols: 2, maxAspect: 1.4, nameReserve: 66 };
    return { cols: 2, maxAspect: 1.45, nameReserve: 68 };
  }
  if (n <= 4) return { cols: 2, maxAspect: 1.18, nameReserve: 80 };
  if (n <= 6) return { cols: 2, maxAspect: 1.08, nameReserve: 76 };
  if (n <= 8) return { cols: 2, maxAspect: 1.0, nameReserve: 74 };
  if (n <= 12) return { cols: 3, maxAspect: 1.12, nameReserve: 62 };
  return { cols: 3, maxAspect: 1.02, nameReserve: 58 };
}

export function buildAnnounceLook({ kind, people = [], format = "story", width, height, season = "FC 27" } = {}) {
  const seed = `announce-v31:${kind}:${format}:${people.map((person) => person.id).join(",")}`;
  return {
    seed,
    version: "season-announce-v3.1",
    season,
    variants: people.map((_, index) => (kind === "individual" ? "center" : personVariant(index))),
  };
}

export function finalePageSize(count = 0) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 6) return Math.max(1, n);
  if (n <= 8) return 4;
  return 6;
}
