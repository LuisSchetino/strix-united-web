export const COLLAGE_ASSETS_REVISION = "collage-pack-v2.3";
export const COLLAGE_PAINTER_VERSION = "collage-painter-v10";

export const COLLAGE_ASSETS = Object.freeze({
  papers: Object.freeze([
    { id: "cut-fill", url: new URL("./paper/cut-fill.jpg", import.meta.url).href, pack: "PAPERCUT SAMPLE PACK" },
    { id: "noise-paper-1", url: new URL("./paper/noise-paper-1.jpg", import.meta.url).href, pack: "NOISE GRAPHICS DESIGN SYNDROME" },
    { id: "noise-paper-2", url: new URL("./paper/noise-paper-2.jpg", import.meta.url).href, pack: "NOISE GRAPHICS DESIGN SYNDROME" },
  ]),
  tornPaper: Object.freeze([
    { id: "cut-01", url: new URL("./torn-paper/cut-01.png", import.meta.url).href, pack: "PAPERCUT SAMPLE PACK" },
    { id: "cut-02", url: new URL("./torn-paper/cut-02.png", import.meta.url).href, pack: "PAPERCUT SAMPLE PACK" },
  ]),
  noise: Object.freeze([
    { id: "grain-3", url: new URL("./noise/grain-3.png", import.meta.url).href, pack: "NOISE GRAPHICS DESIGN SYNDROME" },
  ]),
  brushes: Object.freeze([
    { id: "brush-04", url: new URL("./marker/scratch-04.png", import.meta.url).href, pack: "LASER SIGHT BRUSH PACK DESIGN SYNDROME" },
    { id: "brush-10", url: new URL("./marker/scratch-10.png", import.meta.url).href, pack: "LASER SIGHT BRUSH PACK DESIGN SYNDROME" },
  ]),
  markers: Object.freeze([
    { id: "scratch-04", url: new URL("./marker/scratch-04.png", import.meta.url).href, pack: "LASER SIGHT BRUSH PACK DESIGN SYNDROME" },
    { id: "scratch-10", url: new URL("./marker/scratch-10.png", import.meta.url).href, pack: "LASER SIGHT BRUSH PACK DESIGN SYNDROME" },
  ]),
  stickers: Object.freeze([]),
  tape: Object.freeze([]),
  overlays: Object.freeze([
    { id: "wave-noise", url: new URL("./overlays/wave-noise.png", import.meta.url).href, pack: "NOISE GRAPHICS DESIGN SYNDROME" },
  ]),
  decorative: Object.freeze([]),
  textures: Object.freeze([
    { id: "street-10", url: new URL("./texture/street-10.jpg", import.meta.url).href, pack: "Free design syndrome street smart free" },
    { id: "street-26", url: new URL("./texture/street-26.jpg", import.meta.url).href, pack: "Free design syndrome street smart free" },
    { id: "street-42", url: new URL("./texture/street-42.jpg", import.meta.url).href, pack: "Free design syndrome street smart free" },
    { id: "random-03", url: new URL("./texture/random-03.jpg", import.meta.url).href, pack: "RANDOM TEXTUREPACK DESIGN SYNDROME" },
  ]),
});

export const COLLAGE_ASSET_INDEX = Object.freeze(
  Object.fromEntries(
    Object.values(COLLAGE_ASSETS)
      .flat()
      .map((item) => [item.id, item]),
  ),
);

export function collageAssetIds() {
  return Object.keys(COLLAGE_ASSET_INDEX).sort();
}

export function collageFingerprintToken() {
  return `${COLLAGE_PAINTER_VERSION}:${COLLAGE_ASSETS_REVISION}:${collageAssetIds().join(",")}`;
}

const bitmaps = new Map();
let preloadPromise = null;

function loadImage(url) {
  if (typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export function getCollageBitmap(id) {
  return bitmaps.get(id) || null;
}

export function pickCollageAsset(category, index = 0) {
  const list = COLLAGE_ASSETS[category] || [];
  if (!list.length) return null;
  const item = list[Math.abs(Number(index) || 0) % list.length];
  return getCollageBitmap(item.id);
}

export function preloadCollageAssets() {
  if (preloadPromise) return preloadPromise;
  const items = Object.values(COLLAGE_ASSETS).flat();
  preloadPromise = Promise.all(
    items.map(async (item) => {
      if (bitmaps.has(item.id)) return;
      const image = await loadImage(item.url);
      if (image) bitmaps.set(item.id, image);
    }),
  ).then(() => bitmaps);
  return preloadPromise;
}
