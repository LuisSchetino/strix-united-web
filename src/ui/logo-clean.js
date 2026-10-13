// Crests arrive in every state: with a white card behind them, with a black one ("fake PNG"),
// or small in the middle of an empty canvas. This reads a crest's pixels and decides, with a
// strong bias to doing nothing, what can be improved for free:
//
//   * a flat WHITE background that surrounds the crest is made transparent. Only what is
//     connected to the border goes, so the white inside an outline stays. If the removal would
//     take almost everything (a white crest on white: nothing tells them apart) or almost
//     nothing, the picture is left exactly as it came;
//   * a flat BLACK background that surrounds the crest is made transparent the same way. A
//     black badge with no outline loses its black body with it: on this site every surface is
//     near black, so that body was not visible anyway. The black inside a CLOSED lighter
//     outline stays; through an opening in the outline the background gets in (a wider
//     "brush" that stops at openings was tried and left a black halo on textured crests);
//   * the empty space around the crest is trimmed, so a small crest fills its token.
//
// `cleanLogoPixels` is the rule (pure, tested); `cleanLogo` reads a picture and applies it.

const WORK = 512;          // the largest side the picture is worked at
const LIGHT = 226;         // every channel at or above this, and nearly grey: "white"
const DARK = 30;           // every channel at or below this: "black"
const CLEAR = 24;          // alpha below this is empty
const BORDER_SHARE = 0.9;  // how much of the border must be one flat colour
const MIN_GONE = 0.06;     // removing less than this is not a background
const MAX_GONE = 0.86;     // removing more than this is eating the crest
const FILL = 0.84;         // a crest already filling this much of its canvas is not trimmed

const isWhite = (r, g, b) => r >= LIGHT && g >= LIGHT && b >= LIGHT && Math.max(r, g, b) - Math.min(r, g, b) <= 22;
const isBlack = (r, g, b) => r <= DARK && g <= DARK && b <= DARK;
// A little more tolerant while following the background inwards (compression leaves it uneven).
const isBlackish = (r, g, b) => r <= DARK + 10 && g <= DARK + 10 && b <= DARK + 10;

/** Everything of one kind (`match`) that is connected to the border of the picture. */
function floodFromBorder(data, width, height, match) {
  const gone = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    const i = y * width + x;
    if (gone[i]) return;
    const p = i * 4;
    if (data[p + 3] >= CLEAR && !match(data[p], data[p + 1], data[p + 2])) return;
    gone[i] = 1; stack.push(i);
  };
  for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % width, y = (i - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  return gone;
}

/**
 * What to do with a crest. `data` is RGBA (it is changed in place when a white background is
 * removed). Returns `{ removed, box }`: whether pixels were made transparent, and the square
 * `{ x, y, size }` to keep; or null when the picture should be shown as it came.
 */
export function cleanLogoPixels(data, width, height) {
  if (!(width > 8) || !(height > 8) || !data || data.length < width * height * 4) return null;
  // What is the border made of?
  let border = 0, clear = 0, white = 0, black = 0;
  const look = (x, y) => {
    const p = (y * width + x) * 4;
    border += 1;
    if (data[p + 3] < CLEAR) clear += 1;
    else if (isWhite(data[p], data[p + 1], data[p + 2])) white += 1;
    else if (isBlack(data[p], data[p + 1], data[p + 2])) black += 1;
  };
  for (let x = 0; x < width; x += 1) { look(x, 0); look(x, height - 1); }
  for (let y = 1; y < height - 1; y += 1) { look(0, y); look(width - 1, y); }
  const kind = white / border >= BORDER_SHARE ? "white" : black / border >= BORDER_SHARE ? "black" : clear / border >= 0.5 ? "clear" : "";
  if (!kind) return null;

  const total = width * height;
  let empty = null;
  let removed = false;
  if (kind === "clear") {
    empty = new Uint8Array(total);
    for (let i = 0; i < total; i += 1) if (data[i * 4 + 3] < CLEAR) empty[i] = 1;
  } else {
    empty = floodFromBorder(data, width, height, kind === "white" ? isWhite : isBlackish);
    let count = 0;
    for (let i = 0; i < total; i += 1) count += empty[i];
    const share = count / total;
    // Too little: that was not a background. Too much white: the crest itself is white, and
    // nothing tells it from its card. (A crest eaten by black shows nothing different on a
    // near-black surface, so black has no upper limit.)
    if (share < MIN_GONE || (kind === "white" && share > MAX_GONE)) return null;
    if (kind === "black") {
      removed = true;
      for (let i = 0; i < total; i += 1) if (empty[i]) data[i * 4 + 3] = 0;
      // The rim: dark pixels beside the removed area are the crest's soft edge mixed with black.
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (empty[i]) continue;
        if (!((x > 0 && empty[i - 1]) || (x < width - 1 && empty[i + 1]) || (y > 0 && empty[i - width]) || (y < height - 1 && empty[i + width]))) continue;
        const p = i * 4;
        const bright = Math.max(data[p], data[p + 1], data[p + 2]);
        if (bright > 110) continue;
        const alpha = Math.max(0.12, Math.min(1, bright / 110));
        for (let c = 0; c < 3; c += 1) data[p + c] = Math.max(0, Math.min(255, Math.round(data[p + c] / alpha)));
        data[p + 3] = Math.round(data[p + 3] * alpha);
      }
    }
    if (kind === "white") {
      removed = true;
      for (let i = 0; i < total; i += 1) if (empty[i]) data[i * 4 + 3] = 0;
      // The rim: pixels beside the removed area that are still pale are the crest's soft edge
      // mixed with white. They keep their own colour and become as see-through as they are pale.
      for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (empty[i]) continue;
        if (!((x > 0 && empty[i - 1]) || (x < width - 1 && empty[i + 1]) || (y > 0 && empty[i - width]) || (y < height - 1 && empty[i + width]))) continue;
        const p = i * 4;
        const pale = Math.min(data[p], data[p + 1], data[p + 2]);
        if (pale < 150) continue;
        const alpha = Math.max(0.12, Math.min(1, (255 - pale) / 105));
        for (let c = 0; c < 3; c += 1) data[p + c] = Math.max(0, Math.min(255, Math.round((data[p + c] - 255 * (1 - alpha)) / alpha)));
        data[p + 3] = Math.round(data[p + 3] * alpha);
      }
    }
  }
  // The crest's own box.
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (empty[y * width + x]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < x0 || y1 < y0) return null;
  const side = Math.max(x1 - x0 + 1, y1 - y0 + 1);
  // A crest that already fills its canvas is not trimmed (and, with nothing removed, not touched).
  // The token is a square that fits the picture's longer side: that is what the crest is measured against.
  if (side >= Math.max(width, height) * FILL) return removed ? { removed, box: null } : null;
  const size = Math.round(side * 1.06);
  const box = { x: Math.round((x0 + x1 + 1) / 2 - size / 2), y: Math.round((y0 + y1 + 1) / 2 - size / 2), size };
  return { removed, box };
}

/**
 * The same rule for a picture already in memory (the generated videos draw crests from
 * bitmaps): the cleaned bitmap, or the one given when there is nothing to improve.
 */
export async function cleanLogoBitmap(bitmap) {
  if (!bitmap?.width || typeof document === "undefined") return bitmap;
  try {
    // Videos draw crests large: the work size is higher than the site's.
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high"; ctx.drawImage(bitmap, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    const verdict = cleanLogoPixels(image.data, width, height);
    if (!verdict) return bitmap;
    if (verdict.removed) ctx.putImageData(image, 0, 0);
    let out = canvas;
    if (verdict.box) {
      out = document.createElement("canvas"); out.width = verdict.box.size; out.height = verdict.box.size;
      out.getContext("2d").drawImage(canvas, -verdict.box.x, -verdict.box.y);
    }
    return await createImageBitmap(out);
  } catch {
    return bitmap;
  }
}

const done = new Map();

/**
 * The cleaned crest for `url`, as an object URL, or null when the picture should be shown as it
 * came (nothing to improve, the rule was not sure, or the picture cannot be read from here).
 * Each address is worked once per visit.
 */
export function cleanLogo(url) {
  if (!url || typeof document === "undefined" || /^(data|blob):/i.test(url) || /\.svg(\?|#|$)/i.test(url)) return Promise.resolve(null);
  if (done.has(url)) return done.get(url);
  const work = (async () => {
    try {
      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!response.ok) return null;
      const bitmap = await createImageBitmap(await response.blob());
      const scale = Math.min(1, WORK / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingQuality = "high"; ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      const image = ctx.getImageData(0, 0, width, height);
      const verdict = cleanLogoPixels(image.data, width, height);
      if (!verdict) return null;
      if (verdict.removed) ctx.putImageData(image, 0, 0);
      let out = canvas;
      if (verdict.box) {
        out = document.createElement("canvas"); out.width = verdict.box.size; out.height = verdict.box.size;
        out.getContext("2d").drawImage(canvas, -verdict.box.x, -verdict.box.y);
      }
      const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
      return blob ? URL.createObjectURL(blob) : null;
    } catch {
      return null;
    }
  })();
  done.set(url, work);
  return work;
}
