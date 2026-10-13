// Where the face is in a player's photo, so a round token frames the head instead of the
// middle of the picture. Roster photos come in every shape; the ones that lose their head in a
// token are body shots cut out on a transparent background (the figure standing, the head at
// the very top). For those the figure's own outline says where the head is. A photo with a
// background gives no such outline and keeps the product's usual framing: nothing is guessed.
//
// `headFrame` is the rule (pure, testable); `photoFocus` reads a picture and applies it.

const SOLID = 96; // alpha from which a pixel belongs to the figure
const MAX_ZOOM = 3.2;

/**
 * The square to show, for a picture described by its size and an `alpha(x, y)` reader:
 * `{ top, zoom, x, y }` (how far down the square window of a cover-fitted picture sits, 0..1;
 * how much to enlarge; the point to enlarge around, in percent of the token), or null when the
 * picture is not a cut-out or is not taller than wide.
 */
export function headFrame({ width, height, alpha } = {}) {
  if (!(width > 0) || !(height > width * 1.1) || typeof alpha !== "function") return null;
  const rows = [];
  let clear = 0;
  for (let y = 0; y < height; y += 1) {
    let first = -1;
    let last = -1;
    let sum = 0;
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (alpha(x, y) >= SOLID) { if (first < 0) first = x; last = x; sum += x; count += 1; } else clear += 1;
    }
    rows.push({ first, last, sum, count });
  }
  // Barely any transparency: a photograph with its background, not a cut-out.
  if (clear / (width * height) < 0.12) return null;
  const solid = rows.map((row, y) => ({ ...row, y })).filter((row) => row.count >= 2);
  if (solid.length < height * 0.2) return null;
  const figureTop = solid[0].y;
  const figureHeight = solid.at(-1).y - figureTop + 1;
  const figureWidth = Math.max(...solid.map((row) => row.last - row.first + 1));
  // Standing (narrow for its height): the head is about a seventh of the figure, so a square
  // of three tenths of its height holds head and shoulders. A bust is shown nearly whole.
  const standing = figureWidth / figureHeight < 0.62;
  const side = Math.min(width, Math.max(width / MAX_ZOOM, standing ? figureHeight * 0.3 : Math.min(figureWidth, figureHeight) * 0.92));
  // The head's own centre: where the figure's top band is, not the middle of the picture.
  const band = solid.filter((row) => row.y < figureTop + figureHeight * (standing ? 0.1 : 0.3));
  const centreX = band.reduce((sum, row) => sum + row.sum, 0) / Math.max(1, band.reduce((sum, row) => sum + row.count, 0));
  const centreY = figureTop - side * 0.05 + side / 2;
  // A cover-fitted tall picture shows a window as wide as itself; the window is slid so the
  // square falls inside it, then the picture is enlarged around the square's centre.
  const windowTop = Math.min(Math.max(centreY - width / 2, 0), height - width);
  const half = side / 2;
  const left = Math.min(Math.max(centreX, half), width - half) - half;
  const top = Math.min(Math.max(centreY - windowTop, half), width - half) - half;
  const zoom = width / side;
  // Enlarging around a point keeps that point still. For the square to end up filling the
  // token, the still point is the one that sends the square's own corner to the token's corner.
  const still = (start) => (zoom > 1.001 ? (start * zoom) / (zoom - 1) : width / 2);
  return {
    top: Number((windowTop / (height - width)).toFixed(4)),
    zoom: Number(zoom.toFixed(3)),
    x: Number(((still(left) / width) * 100).toFixed(2)),
    y: Number(((still(top) / width) * 100).toFixed(2)),
  };
}

const known = new Map();

async function read(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) return null;
  const bitmap = await createImageBitmap(await response.blob());
  const width = 72;
  const height = Math.max(1, Math.round(bitmap.height * (width / bitmap.width)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const layer = canvas.getContext("2d", { willReadFrequently: true });
  layer.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const { data } = layer.getImageData(0, 0, width, height);
  return headFrame({ width, height, alpha: (x, y) => data[(y * width + x) * 4 + 3] });
}

/**
 * The frame for the photo at `url` (see headFrame), read once per address. Null when the
 * picture cannot be read (another site that does not share it) or needs no special framing.
 */
export function photoFocus(url) {
  if (!url || typeof document === "undefined") return Promise.resolve(null);
  if (!known.has(url)) known.set(url, read(url).catch(() => null));
  return known.get(url);
}
