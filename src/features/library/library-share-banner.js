// The banner a library link shows in a chat: the material's own picture under the Strix frame,
// with its title. It is drawn once in the browser of whoever manages the Library and published
// next to the club's other assets; the link preview (shared/link-preview.js) looks for it by id.
import { LIBRARY_BANNER_FOLDER, SHARE_BUCKET, libraryBannerPath } from "../../../shared/link-preview.js";
import { STRIX_BRAND } from "../../brand.js";
import { librarySource } from "./library-core.js";

export const BANNER_WIDTH = 1200;
export const BANNER_HEIGHT = 630;
// Chat apps do not always show the whole banner: WhatsApp's compact card keeps only the middle
// of it, at about 3:2. Everything that must be read stays inside this band; what lies outside
// is ground (ink, light, the picture) that may be cut without losing a letter.
export const BANNER_SAFE_LEFT = 176;
export const BANNER_SAFE_RIGHT = 1024;
const INK = "#050607";
const TEXT = "#f5f5f5";
const QUIET = "#9aa1a9";
const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

/** The picture a material is known by: its own thumbnail, else the YouTube frame. Empty when it has none. */
export function bannerPicture(item = {}) {
  const own = String(item.thumbnail_url || "").trim();
  if (/^https?:\/\//i.test(own)) return own;
  const source = librarySource(item.source_url);
  return source.type === "youtube" && source.id ? `https://i.ytimg.com/vi/${source.id}/hqdefault.jpg` : "";
}

/**
 * The pictures to try, best first. A YouTube frame comes wide when the video has one; the
 * standard frame is 4:3 with black bars above and below, so only its middle band is used.
 */
export function bannerPictures(item = {}) {
  const own = String(item.thumbnail_url || "").trim();
  if (/^https?:\/\//i.test(own)) return [{ url: own, band: false }];
  const source = librarySource(item.source_url);
  if (source.type !== "youtube" || !source.id) return [];
  return [
    { url: `https://i.ytimg.com/vi/${source.id}/maxresdefault.jpg`, band: false },
    { url: `https://i.ytimg.com/vi/${source.id}/hqdefault.jpg`, band: true },
  ];
}

/**
 * Breaks a title into at most `maxLines` lines no wider than `maxWidth`, as measured by
 * `measure(text)`. A title that does not fit ends in an ellipsis; a single word wider than the
 * line stays whole on its own line (the caller shrinks the type instead of cutting a word).
 */
export function wrapTitle(measure, title, maxWidth, maxLines) {
  const words = String(title || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (let index = 0; index < words.length; index += 1) {
    const next = line ? `${line} ${words[index]}` : words[index];
    if (!line || measure(next) <= maxWidth) { line = next; continue; }
    lines.push(line);
    line = words[index];
    if (lines.length === maxLines) { line = ""; break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const used = lines.join(" ").split(" ").filter(Boolean).length;
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.includes(" ") && measure(`${last}…`) > maxWidth) last = last.slice(0, last.lastIndexOf(" "));
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

/** The largest type size (from `sizes`, largest first) at which the title fits the block. */
export function fitTitle(measureAt, title, maxWidth, maxLines, sizes) {
  for (const size of sizes) {
    const lines = wrapTitle((value) => measureAt(value, size), title, maxWidth, maxLines);
    const complete = !lines.at(-1)?.endsWith("…");
    const fits = lines.every((line) => measureAt(line, size) <= maxWidth);
    if (complete && fits) return { size, lines };
  }
  const size = sizes.at(-1);
  return { size, lines: wrapTitle((value) => measureAt(value, size), title, maxWidth, maxLines) };
}

function loadImage(url, crossOrigin = true) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_unavailable"));
    image.src = url;
  });
}

function label(context, value, x, y, { align = "left", color = QUIET } = {}) {
  context.font = `700 17px ${FONT}`;
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = "middle";
  if ("letterSpacing" in context) context.letterSpacing = "3.4px";
  context.fillText(String(value).toLocaleUpperCase("pt-BR"), x, y);
  if ("letterSpacing" in context) context.letterSpacing = "0px";
}

/** Draws the banner and returns it as a JPEG blob. Browser only. */
export async function composeLibraryBanner(item) {
  const canvas = document.createElement("canvas");
  canvas.width = BANNER_WIDTH;
  canvas.height = BANNER_HEIGHT;
  const context = canvas.getContext("2d");
  await Promise.all([document.fonts?.load(`800 84px Inter`), document.fonts?.load(`700 17px Inter`)].filter(Boolean)).catch(() => null);

  context.fillStyle = INK;
  context.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);
  let picture = null;
  let band = false;
  for (const candidate of bannerPictures(item)) {
    // YouTube answers a missing wide frame with a tiny placeholder: anything that small is not a picture.
    const loaded = await loadImage(candidate.url).catch(() => null);
    if (loaded && loaded.width >= 320) { picture = loaded; band = candidate.band; break; }
  }
  if (picture) {
    // The material's frame fills the right side, cover-fitted, and fades into the ink where the title sits.
    const areaX = 360;
    const areaWidth = BANNER_WIDTH - areaX;
    const sourceY = band ? picture.height * 0.125 : 0;
    const sourceHeight = band ? picture.height * 0.75 : picture.height;
    const scale = Math.max(areaWidth / picture.width, BANNER_HEIGHT / sourceHeight);
    const width = picture.width * scale;
    const height = sourceHeight * scale;
    // Cover-fitting can make the picture wider than its area: it is clipped to it, so no strip
    // of picture shows to the left of where the fade begins.
    context.save();
    context.beginPath();
    context.rect(areaX, 0, areaWidth, BANNER_HEIGHT);
    context.clip();
    context.drawImage(picture, 0, sourceY, picture.width, sourceHeight, areaX + (areaWidth - width) / 2, (BANNER_HEIGHT - height) / 2, width, height);
    context.restore();
    const fade = context.createLinearGradient(areaX, 0, BANNER_WIDTH, 0);
    fade.addColorStop(0, "rgba(5,6,7,1)");
    fade.addColorStop(0.5, "rgba(5,6,7,0.9)");
    fade.addColorStop(1, "rgba(5,6,7,0.58)");
    context.fillStyle = fade;
    context.fillRect(areaX, 0, areaWidth, BANNER_HEIGHT);
    const floor = context.createLinearGradient(0, BANNER_HEIGHT * 0.45, 0, BANNER_HEIGHT);
    floor.addColorStop(0, "rgba(5,6,7,0)");
    floor.addColorStop(1, "rgba(5,6,7,0.9)");
    context.fillStyle = floor;
    context.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);
  } else {
    // No picture: the site's own poster ground (corner light and fine lines).
    const light = context.createRadialGradient(0, 0, 0, 0, 0, 760);
    light.addColorStop(0, "rgba(255,255,255,0.085)");
    light.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = light;
    context.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);
    context.strokeStyle = "rgba(255,255,255,0.035)";
    context.lineWidth = 1;
    for (let x = 520; x < BANNER_WIDTH + 400; x += 46) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x - 294, BANNER_HEIGHT);
      context.stroke();
    }
  }

  const left = BANNER_SAFE_LEFT;
  const right = BANNER_SAFE_RIGHT;

  // Head: what it is.
  context.fillStyle = TEXT;
  context.beginPath();
  context.arc(left + 4.5, 92, 4.5, 0, Math.PI * 2);
  context.fill();
  label(context, item.category === "review" ? "Review" : "Jogada", left + 24, 93, { color: TEXT });
  label(context, "Biblioteca do clube", right, 93, { align: "right" });

  // Title, as large as it fits in three lines inside the safe band.
  const measureAt = (value, size) => {
    context.font = `800 ${size}px ${FONT}`;
    if ("letterSpacing" in context) context.letterSpacing = `${(-0.045 * size).toFixed(2)}px`;
    const width = context.measureText(value).width;
    if ("letterSpacing" in context) context.letterSpacing = "0px";
    return width;
  };
  const { size, lines } = fitTitle(measureAt, item.title, right - left, 3, [88, 78, 68, 60, 52, 46]);
  context.font = `800 ${size}px ${FONT}`;
  context.fillStyle = TEXT;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  if ("letterSpacing" in context) context.letterSpacing = `${(-0.045 * size).toFixed(2)}px`;
  const lineHeight = size * 1.02;
  const blockBottom = 446;
  lines.forEach((line, index) => {
    context.fillText(line, left, blockBottom - (lines.length - 1 - index) * lineHeight);
  });
  if ("letterSpacing" in context) context.letterSpacing = "0px";

  // Foot: the club, above a hairline.
  context.fillStyle = "rgba(255,255,255,0.14)";
  context.fillRect(left, 498, right - left, 1);
  const crest = await loadImage(STRIX_BRAND.logoFallback, false).catch(() => null);
  if (crest) context.drawImage(crest, left, 518, 52, 52);
  context.font = `800 22px ${FONT}`;
  context.fillStyle = TEXT;
  context.textAlign = "left";
  context.textBaseline = "middle";
  if ("letterSpacing" in context) context.letterSpacing = "-0.4px";
  context.fillText("STRIX UNITED", crest ? left + 68 : left, 545);
  if ("letterSpacing" in context) context.letterSpacing = "0px";
  label(context, "Assista no site", right, 545, { align: "right" });

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("banner_encode_failed"))), "image/jpeg", 0.88);
  });
}

const attempted = new Set();

/**
 * Publishes the banner of every material that does not have one yet. Runs for whoever manages
 * the Library (the bucket only accepts their uploads), one material at a time, at most once
 * per material per visit. Returns how many were published.
 */
export async function ensureLibraryBanners(client, items = []) {
  const pending = items.filter((item) => item?.id && item.status !== "archived" && !attempted.has(item.id));
  if (!pending.length || !client?.storage) return 0;
  for (const item of pending) attempted.add(item.id);
  const bucket = client.storage.from(SHARE_BUCKET);
  const { data: existing, error } = await bucket.list(LIBRARY_BANNER_FOLDER, { limit: 1000 });
  if (error) throw error;
  const have = new Set((existing || []).map((file) => file.name));
  let published = 0;
  for (const item of pending) {
    if (have.has(`${item.id}.jpg`)) continue;
    const blob = await composeLibraryBanner(item);
    const { error: uploadError } = await bucket.upload(libraryBannerPath(item.id), blob, { contentType: "image/jpeg", cacheControl: "86400", upsert: true });
    if (uploadError) throw uploadError;
    published += 1;
  }
  return published;
}
