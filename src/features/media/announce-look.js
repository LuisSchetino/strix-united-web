import { classifyHeroPhoto } from "./related-night-hero.js";

export const ANNOUNCE_VARIANTS = Object.freeze(["left", "overlap", "bleed", "stack"]);

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

function strokePoints(rand, width, height, kind) {
  const points = [];
  const count = kind === "ring" ? 14 : 9 + Math.floor(rand() * 5);
  if (kind === "ring") {
    const cx = width * (0.28 + rand() * 0.5);
    const cy = height * (0.32 + rand() * 0.28);
    const rx = width * (0.12 + rand() * 0.18);
    const ry = rx * (0.55 + rand() * 0.3);
    for (let index = 0; index < count; index += 1) {
      const a = (index / (count - 1)) * Math.PI * 1.65 + rand() * 0.08;
      points.push({
        x: cx + Math.cos(a) * rx + (rand() - 0.5) * 10,
        y: cy + Math.sin(a) * ry + (rand() - 0.5) * 10,
        w: 5 + rand() * 11,
      });
    }
    return points;
  }
  let x = kind === "slash" ? width * (rand() * 0.2) : width * (0.05 + rand() * 0.7);
  let y = height * (0.18 + rand() * 0.55);
  const dx = kind === "slash" ? width * (0.08 + rand() * 0.06) : (rand() - 0.35) * width * 0.16;
  const dy = kind === "slash" ? height * (0.045 + rand() * 0.03) : (rand() - 0.5) * 42;
  for (let index = 0; index < count; index += 1) {
    x += dx + (rand() - 0.5) * 28;
    y += dy + (rand() - 0.5) * 22;
    points.push({ x, y, w: 3 + rand() * 16 });
  }
  return points;
}

export function buildStrokeSet(seed, width, height) {
  const rand = seededRandom(`stroke:${seed}:${width}x${height}`);
  return ["slash", "spray", "ring", "slash"].map((kind, index) => ({
    id: index,
    kind,
    points: strokePoints(rand, width, height, kind),
    alpha: 0.24 + rand() * 0.16,
  }));
}

export function photoBoxForVariant(variant, timeline, classified = {}) {
  const { width, height, safe } = timeline;
  const story = timeline.format !== "feed";
  const cutout = classified.crop === "cutout";
  const selfie = classified.crop === "selfie";
  const fullbody = classified.crop === "fullbody";
  if (!story) {
    return {
      x: cutout ? Math.round(width * 0.08) : 0,
      y: 0,
      w: cutout ? Math.round(width * 0.84) : width,
      h: Math.round(height * (cutout ? 0.68 : 0.62)),
      focusY: selfie ? 0.18 : fullbody ? 0.12 : 0.22,
      radius: 0,
    };
  }
  if (variant === "left") {
    return {
      x: -72,
      y: safe.top - 20,
      w: Math.round(width * (cutout ? 0.78 : 0.7)),
      h: height - safe.top + 40,
      focusY: selfie ? 0.16 : fullbody ? 0.1 : 0.2,
      radius: 0,
    };
  }
  if (variant === "overlap") {
    return {
      x: Math.round(width * 0.22),
      y: safe.top - 10,
      w: Math.round(width * 0.86),
      h: height - safe.top - 40,
      focusY: 0.2,
      radius: 0,
    };
  }
  if (variant === "bleed") {
    return {
      x: Math.round(width * 0.08),
      y: 0,
      w: Math.round(width * 0.92),
      h: height,
      focusY: selfie ? 0.14 : 0.22,
      radius: 0,
    };
  }
  return {
    x: Math.round(width * 0.28),
    y: safe.top + 48,
    w: Math.round(width * 0.78),
    h: Math.round(height * 0.62),
    focusY: fullbody ? 0.08 : 0.24,
    radius: 0,
  };
}

export function buildAnnounceLook({ kind, people = [], format = "story", width, height, season = "FC 27" } = {}) {
  const seed = `announce-v2:${kind}:${format}:${people.map((person) => person.id).join(",")}`;
  return {
    seed,
    version: "season-announce-v2",
    season,
    strokes: buildStrokeSet(seed, width, height),
    variants: people.map((person, index) => personVariant(index)),
    classified: {},
  };
}

export function inkWipeX(progress, width, height) {
  const amount = Math.max(0, Math.min(1, progress));
  return -width + amount * (width + height) * 1.35;
}
