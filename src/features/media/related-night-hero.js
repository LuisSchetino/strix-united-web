import { easeInOutCubic, easeOutExpo, reveal } from "./agenda-timeline.js";

const photoClass = new WeakMap();

export function heroStageBox(timeline) {
  const { width, height, safe } = timeline;
  const story = timeline.format !== "feed";
  const stageW = Math.round(width * (story ? 0.37 : 0.32));
  const right = width - Math.max(18, safe.side * 0.28);
  const left = right - stageW;
  const top = safe.top + (story ? 28 : 12);
  const plateH = story ? 124 : 102;
  const bottom = height - safe.bottom + (story ? 12 : 4);
  const portraitH = Math.round(stageW * 1.36);
  const portraitTop = top + (story ? 48 : 24);
  return {
    left,
    right,
    top,
    bottom,
    width: stageW,
    height: bottom - top,
    plateH,
    plateY: Math.min(portraitTop + portraitH + 8, bottom - plateH),
    portraitTop,
    portraitH,
    portraitW: stageW,
    featuredId: null,
  };
}

export function heroPresence(scene, time) {
  if (scene?.type !== "player") return 0;
  const local = time - scene.start;
  const enter = reveal(local, 0, 0.26, easeOutExpo);
  const exit = time > scene.end - 0.2 ? 1 - reveal(time, scene.end - 0.2, 0.2, easeInOutCubic) : 1;
  return enter * exit;
}

export function lowerThirdPresence(scene, time) {
  if (scene?.type !== "player") return 0;
  const local = time - scene.start;
  const enter = reveal(local, 0.08, 0.22, easeOutExpo);
  const exit = time > scene.end - 0.2 ? 1 - reveal(time, scene.end - 0.2, 0.2, easeInOutCubic) : 1;
  return enter * exit;
}

export function cameraHeroAmount(scene, time, timeline) {
  if (scene?.type !== "player" || time < (timeline?.introEnd || 0) || time >= (timeline?.finaleStart || Infinity)) {
    return 0;
  }
  const local = time - scene.start;
  const enter = reveal(local, 0, 0.16, easeOutExpo);
  const exit = time > scene.end - 0.28 ? 1 - reveal(time, scene.end - 0.28, 0.28, easeInOutCubic) : 1;
  return enter * exit;
}

export function classifyHeroPixels(data, width, height) {
  const total = width * height;
  let transparent = 0;
  let edgeCount = 0;
  let edgeBright = 0;
  let saturation = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 40) transparent += 1;
      const edge = x < 3 || x > width - 4 || y < 3 || y > height - 4;
      if (!edge || alpha < 40) continue;
      edgeCount += 1;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const luma = (red + green + blue) / 3;
      if (luma > 72) edgeBright += 1;
      saturation += Math.max(red, green, blue) - Math.min(red, green, blue);
    }
  }
  const alphaRatio = transparent / Math.max(1, total);
  const kind = alphaRatio > 0.12 ? "cutout" : "photo";
  const strongBg = kind === "photo" && edgeCount > 0
    && (edgeBright / edgeCount > 0.32 || saturation / edgeCount > 42);
  return { kind, strongBg, alphaRatio };
}

export function classifyHeroPhoto(bitmap) {
  if (!bitmap) return { kind: "none", strongBg: false, alphaRatio: 0 };
  if (photoClass.has(bitmap)) return photoClass.get(bitmap);
  const width = 48;
  const height = 72;
  const canvas = typeof OffscreenCanvas === "function"
    ? new OffscreenCanvas(width, height)
    : (typeof document !== "undefined" ? document.createElement("canvas") : null);
  if (!canvas) {
    const fallback = { kind: "photo", strongBg: true, alphaRatio: 0 };
    return fallback;
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  const classified = classifyHeroPixels(ctx.getImageData(0, 0, width, height).data, width, height);
  photoClass.set(bitmap, classified);
  return classified;
}
