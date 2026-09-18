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
  if (classified.crop === "selfie") return 0.18;
  if (classified.crop === "fullbody") return 0.14;
  if (classified.crop === "cutout") return 0.16;
  if (classified.crop === "stadium") return 0.18;
  return 0.2;
}

function clampFit(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function headVisibleInDest(fit, destH) {
  if (!fit || destH <= 0) return false;
  const headBottom = fit.dy + fit.dh * 0.22;
  return fit.dy > -destH * 0.08 && headBottom > destH * 0.08;
}

export function fitAnnounceSubject(bitmap, destW, destH, classified = {}, options = {}) {
  const bw = Math.max(1, Number(bitmap?.width) || 1);
  const bh = Math.max(1, Number(bitmap?.height) || 1);
  const boxW = Math.max(1, Number(destW) || 1);
  const boxH = Math.max(1, Number(destH) || 1);
  const crop = classified.crop || "portrait";
  const cameraScale = Math.max(1, Number(options.scale) || 1);
  const alphaRatio = Number(classified.alphaRatio) || 0;
  const useContent = crop === "cutout" || crop === "fullbody" || alphaRatio > 0.12;
  const left = clampFit(classified.contentLeft ?? 0, 0, 0.48);
  const top = clampFit(classified.contentTop ?? 0, 0, 0.48);
  const right = clampFit(classified.contentRight ?? 1, 0.52, 1);
  const bottom = clampFit(classified.contentBottom ?? 1, 0.52, 1);
  const srcX = useContent ? left * bw : 0;
  const srcY = useContent ? top * bh : 0;
  const srcW = useContent ? Math.max(1, (right - left) * bw) : bw;
  const srcH = useContent ? Math.max(1, (bottom - top) * bh) : bh;
  const cover = Math.max(boxW / srcW, boxH / srcH);
  const contain = Math.min(boxW / srcW, boxH / srcH);
  const preferContain = crop === "cutout" || crop === "fullbody" || alphaRatio > 0.18;
  const zoomCap = crop === "cutout" ? 1.12 : crop === "fullbody" ? 1.14 : 1.22;
  let scale = (preferContain ? contain : cover) * Math.min(cameraScale, zoomCap);
  const requestedFocus = Number.isFinite(options.focusY) ? options.focusY : photoFocusY(classified);
  const focus = preferContain
    ? clampFit(Math.min(requestedFocus, 0.2), 0.14, 0.22)
    : clampFit(requestedFocus, 0.14, 0.28);
  const eyeDest = clampFit(crop === "selfie" ? 0.28 : crop === "fullbody" ? 0.26 : 0.32, 0.22, 0.4);

  const place = (nextScale) => {
    const dw = srcW * nextScale;
    const dh = srcH * nextScale;
    let dx = (boxW - dw) / 2;
    let dy = boxH * eyeDest - dh * focus;
    if (preferContain && nextScale <= contain * 1.03 && dh <= boxH) {
      dy = (boxH - dh) * 0.12;
    }
    if (dy > boxH * 0.18) dy = boxH * 0.18;
    if (dy + dh * 0.22 < boxH * 0.08) dy = boxH * 0.08 - dh * 0.22;
    if (dy < -boxH * 0.06) dy = -boxH * 0.06;
    return { dx, dy, dw, dh };
  };

  let placed = place(scale);
  let guard = 0;
  while (!headVisibleInDest(placed, boxH) && scale > contain * 0.98 && guard < 8) {
    scale *= 0.88;
    placed = place(scale);
    guard += 1;
  }
  if (!headVisibleInDest(placed, boxH)) {
    scale = contain;
    placed = place(scale);
    if (placed.dy < 0) placed.dy = 0;
  }

  return {
    sx: srcX,
    sy: srcY,
    sw: srcW,
    sh: srcH,
    dx: placed.dx,
    dy: placed.dy,
    dw: placed.dw,
    dh: placed.dh,
    scale,
  };
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

export function announceRoleInk(role = "jogador") {
  const id = String(role || "").trim().toLowerCase();
  if (id === "diretoria") return "#d4c4a0";
  if (id === "conselho") return "#c5cbc6";
  if (id === "staff" || id === "manager") return "#c9ced4";
  return "#9aa0a6";
}

export function campaignName(person) {
  return String(person?.name || "").toUpperCase();
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
    if (n <= 1) return { cols: 1, maxAspect: 1.52, nameReserve: 92 };
    if (n === 2) return { cols: 2, maxAspect: 1.5, nameReserve: 88 };
    if (n <= 4) return { cols: 2, maxAspect: 1.48, nameReserve: 84 };
    if (n <= 6) return { cols: 2, maxAspect: 1.4, nameReserve: 78 };
    return { cols: 2, maxAspect: 1.45, nameReserve: 76 };
  }
  if (n <= 1) return { cols: 1, maxAspect: 1.28, nameReserve: 98 };
  if (n === 2) return { cols: 2, maxAspect: 1.22, nameReserve: 94 };
  if (n <= 4) return { cols: 2, maxAspect: 1.18, nameReserve: 90 };
  if (n <= 6) return { cols: 2, maxAspect: 1.08, nameReserve: 84 };
  if (n <= 8) return { cols: 2, maxAspect: 1.0, nameReserve: 80 };
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
