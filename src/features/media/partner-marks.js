// The partners' marks (Rastro, Next Clubs) as the pieces show them: a mark sized to a height,
// and each one building itself the way its shape suggests. Shared by the editorial model and the
// "night vision" model (night-kit.js `drawPartners`).
import { logoDrawRect } from "./agenda-paint.js";
import { remap, easeOutQuart, easeInOutCubic } from "./agenda-timeline.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const ease = (value) => easeOutQuart(clamp(value));

export const sponsorMarksOf = (assets) => (Array.isArray(assets?.sponsors) ? assets.sponsors.filter((mark) => mark?.bitmap) : []);

/** The size a mark is drawn at to stand `height` tall without passing `maxWidth` (its transparent margin does not count). */
export function markSize(mark, height, maxWidth) {
  const rect = logoDrawRect(mark, 1000);
  const scale = Math.min(height / rect.sh, maxWidth / rect.sw);
  return { rect, w: rect.sw * scale, h: rect.sh * scale };
}

export function drawMark(ctx, mark, x, y, size) {
  const { rect, w, h } = size;
  ctx.drawImage(mark.bitmap, rect.sx, rect.sy, rect.sw, rect.sh, x, y - h / 2, w, h);
}

// How each mark is made, measured on the files in public/brand (pixels of the image itself).
// Rastro: two outlined chevrons and then the R, three ">" shapes one after the other. The cuts
// are the ">" lines that pass between them (`up`/`down`: how far the line leans above and
// below its tip). Next Clubs: N, E, the X made of two arrows that meet at `split`, T, and
// CLUBS on a line of its own.
const RASTRO_SHAPE = Object.freeze({ width: 1080, top: 313, bottom: 724, tipY: 470, up: 1.147, down: 0.916, cuts: [435, 568], end: 1200 });
const NEXT_SHAPE = Object.freeze({ width: 1407, height: 385, wordBottom: 268, lettersEnd: 662, split: 903, tStart: 1116 });

/** The ">" line of the Rastro mark with its tip at x = tip, from above the mark to below it. */
function rastroFront(tip, pad = 24) {
  const shape = RASTRO_SHAPE;
  return [
    [tip - shape.up * (shape.tipY - shape.top + pad), shape.top - pad],
    [tip, shape.tipY],
    [tip - shape.down * (shape.bottom + pad - shape.tipY), shape.bottom + pad],
  ];
}

/** Clips to what lies between two ">" lines (null: no limit on that side). */
function clipBetweenFronts(ctx, from, to) {
  const shape = RASTRO_SHAPE;
  const left = from == null ? [[-200, shape.top - 24], [-200, shape.bottom + 24]] : rastroFront(from);
  const right = to == null ? [[shape.width + 200, shape.top - 24], [shape.width + 200, shape.bottom + 24]] : rastroFront(to);
  ctx.beginPath();
  left.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  [...right].reverse().forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.clip();
}

/**
 * Rastro builds itself the way its name says, left to right: the first chevron arrives, then
 * the second, and the R is drawn behind a ">" that runs across it. `p` 0→1.
 */
function buildRastro(ctx, mark, p) {
  const shape = RASTRO_SHAPE;
  [[null, shape.cuts[0]], [shape.cuts[0], shape.cuts[1]]].forEach(([from, to], index) => {
    const arrive = ease(remap(p, index * 0.16, index * 0.16 + 0.4));
    if (arrive <= 0) return;
    ctx.save();
    ctx.globalAlpha *= arrive;
    ctx.translate(-(1 - arrive) * 70, 0);
    clipBetweenFronts(ctx, from, to);
    ctx.drawImage(mark.bitmap, 0, 0);
    ctx.restore();
  });
  const run = easeInOutCubic(remap(p, 0.3, 1));
  if (run <= 0) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, run * 4);
  clipBetweenFronts(ctx, shape.cuts[1], shape.cuts[1] + (shape.end - shape.cuts[1]) * run);
  ctx.drawImage(mark.bitmap, 0, 0);
  ctx.restore();
}

/**
 * Next Clubs builds itself from its X: the two arrows come from each side and meet in the
 * middle, the letters open outwards from them (N and E to the left, T to the right), and
 * CLUBS settles underneath. `p` 0→1.
 */
function buildNextClubs(ctx, mark, p) {
  const shape = NEXT_SHAPE;
  const piece = (x0, x1, y0, y1, { alpha = 1, dx = 0, dy = 0 } = {}) => {
    if (alpha <= 0 || x1 <= x0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(dx, dy);
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.drawImage(mark.bitmap, 0, 0);
    ctx.restore();
  };
  const meet = ease(remap(p, 0, 0.42));
  piece(shape.lettersEnd, shape.split, 0, shape.wordBottom, { alpha: Math.min(1, meet * 1.6), dx: -(1 - meet) * 150 });
  piece(shape.split, shape.tStart, 0, shape.wordBottom, { alpha: Math.min(1, meet * 1.6), dx: (1 - meet) * 150 });
  const open = ease(remap(p, 0.3, 0.76));
  piece(shape.lettersEnd * (1 - open), shape.lettersEnd, 0, shape.wordBottom);
  piece(shape.tStart, shape.tStart + (shape.width - shape.tStart) * open, 0, shape.wordBottom);
  const settle = ease(remap(p, 0.58, 1));
  piece(0, shape.width, shape.wordBottom, shape.height, { alpha: settle, dy: (1 - settle) * 26 });
}

const MARK_BUILDERS = Object.freeze({ rastro: buildRastro, "next clubs": buildNextClubs });

/** A mark building itself at the given place and size. A mark with no build of its own fades in. */
export function drawMarkBuilding(ctx, mark, x, y, size, progress) {
  const p = clamp(progress);
  if (p <= 0) return;
  const build = MARK_BUILDERS[String(mark.name || "").trim().toLowerCase()];
  if (p >= 1 || !build) {
    ctx.save();
    ctx.globalAlpha *= build ? 1 : ease(p);
    drawMark(ctx, mark, x, y, size);
    ctx.restore();
    return;
  }
  const { rect, w, h } = size;
  ctx.save();
  // From here on the drawing is in the image's own pixels.
  ctx.translate(x, y - h / 2);
  ctx.scale(w / rect.sw, h / rect.sh);
  ctx.translate(-rect.sx, -rect.sy);
  build(ctx, mark, p);
  ctx.restore();
}
