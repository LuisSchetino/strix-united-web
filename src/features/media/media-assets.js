import { NEXT_CLUBS_BRAND, RASTRO_BRAND, STRIX_BRAND } from "../../brand.js";
import { cacheableProviderAssetUrl } from "../../ui/provider-assets.js";
import { cleanLogoBitmap } from "../../ui/logo-clean.js";
import { STRIX_KIT_URL, boardKit } from "./board-kit.js";
import { opponentInitials } from "./agenda-media-core.js";
import { loadAnnounceFxLibrary } from "./announce-fx.js";
import { loadNightFonts } from "./night-look.js";

async function bitmapFromUrl(url) {
  const source = cacheableProviderAssetUrl(url);
  if (!source) return null;
  const response = await fetch(source, { cache: "force-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("asset_not_image");
  return createImageBitmap(blob);
}

/** `clean` is for crests only (opponents, competitions): a player's photo is never altered. */
export async function loadLogoAsset(url, name, onProgress, { clean = false } = {}) {
  const initials = opponentInitials(name);
  if (!url) {
    onProgress?.();
    return { name, url: "", bitmap: null, initials };
  }
  try {
    // Crests of opponents and competitions go through the site's cleaning (white or black card
    // off, small crest brought closer); the club's own marks are drawn exactly as they are.
    const own = [STRIX_BRAND.logo, RASTRO_BRAND.logo, NEXT_CLUBS_BRAND.logo].includes(url);
    const raw = await bitmapFromUrl(url);
    const bitmap = clean && !own ? await cleanLogoBitmap(raw) : raw;
    onProgress?.();
    return { name, url, bitmap, initials };
  } catch {
    onProgress?.();
    return { name, url, bitmap: null, initials };
  }
}

/**
 * A mark as a flat off-white shape (its own silhouette). The generated pieces are one ink stage
 * with white type: a partner's mark sits on it in that same white, not in its own colours.
 */
function whiteMark(bitmap) {
  if (!bitmap || typeof document === "undefined") return bitmap || null;
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const layer = canvas.getContext("2d");
  if (!layer) return bitmap;
  layer.drawImage(bitmap, 0, 0);
  layer.globalCompositeOperation = "source-in";
  layer.fillStyle = "#fbfaf5";
  layer.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

let sponsorMarks = null;
/**
 * The club's partners (Rastro, Next Clubs), ready to be painted: `[{ name, bitmap }]`, in the
 * order they are shown. Read once per session; a mark that cannot be read is simply left out.
 */
export function loadSponsorAssets() {
  sponsorMarks ||= Promise.all([RASTRO_BRAND, NEXT_CLUBS_BRAND].map((brand) => loadLogoAsset(brand.logo, brand.name)))
    .then((marks) => marks.filter((mark) => mark.bitmap).map((mark) => ({ name: mark.name, bitmap: whiteMark(mark.bitmap) })))
    .catch(() => []);
  return sponsorMarks;
}

export async function loadAgendaAssets(matches = [], { onProgress } = {}) {
  const unique = [];
  const seen = new Set();
  const push = (url, name) => {
    const key = `${url}::${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({ url, name });
  };
  push(STRIX_BRAND.logo, "Strix United");
  for (const match of matches) {
    push(match.opponent_logo, match.opponent);
    if (match.competition_logo) push(match.competition_logo, match.competition);
  }
  let loaded = 0;
  const report = () => {
    loaded += 1;
    onProgress?.({ loaded, total: unique.length, stage: "preparing" });
  };
  await document.fonts?.ready;
  await Promise.allSettled([
    document.fonts?.load("800 36px Inter"),
    document.fonts?.load("700 30px Inter"),
    document.fonts?.load("600 30px Inter"),
    document.fonts?.load("700 132px Rajdhani"),
  ]);
  const results = await Promise.all(unique.map((item) => loadLogoAsset(item.url, item.name, report, { clean: true })));
  const byUrl = new Map(results.map((item) => [`${item.url}::${item.name}`, item]));
  const pick = (url, name) => byUrl.get(`${url}::${name}`) || { name, url, bitmap: null, initials: opponentInitials(name) };
  return {
    strix: pick(STRIX_BRAND.logo, "Strix United"),
    opponents: matches.map((match) => pick(match.opponent_logo, match.opponent)),
    competitions: matches.map((match) => (match.competition_logo ? pick(match.competition_logo, match.competition) : null)),
    sponsors: await loadSponsorAssets(),
    total: unique.length,
  };
}

export async function loadRelatedNightAssets(players = [], { onProgress } = {}) {
  const unique = [];
  const seen = new Set();
  const push = (url, name) => {
    const key = `${url}::${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push({ url, name });
  };
  push(STRIX_BRAND.logo, "Strix United");
  for (const player of players) {
    push(player.photo, player.name);
  }
  let loaded = 0;
  const report = () => {
    loaded += 1;
    onProgress?.({ loaded, total: unique.length, stage: "preparing" });
  };
  await document.fonts?.ready;
  await Promise.allSettled([
    document.fonts?.load("800 36px Inter"),
    document.fonts?.load("700 30px Inter"),
    document.fonts?.load("600 30px Inter"),
    document.fonts?.load("800 28px Inter"),
    document.fonts?.load("700 118px Rajdhani"),
    document.fonts?.load("700 64px Rajdhani"),
  ]);
  const results = await Promise.all(unique.map((item) => loadLogoAsset(item.url, item.name, report)));
  const byUrl = new Map(results.map((item) => [`${item.url}::${item.name}`, item]));
  const pick = (url, name) => byUrl.get(`${url}::${name}`) || { name, url, bitmap: null, initials: opponentInitials(name) };
  const playerAssets = players.map((player) => pick(player.photo, player.name));
  // The pitch wears the club's shirt.
  if (!boardKit.bitmap) boardKit.bitmap = (await loadLogoAsset(STRIX_KIT_URL, "Uniforme")).bitmap;
  return {
    strix: pick(STRIX_BRAND.logo, "Strix United"),
    players: playerAssets,
    byId: Object.fromEntries(players.map((player, index) => [player.id, playerAssets[index]])),
    sponsors: await loadSponsorAssets(),
    total: unique.length,
  };
}

export function loadSummaryAssets(matches = [], options = {}) {
  return loadAgendaAssets(matches, options);
}

export async function loadAnnounceAssets(people = [], { onProgress, loadFx = true } = {}) {
  const assets = await loadRelatedNightAssets(people, { onProgress });
  await Promise.allSettled([
    document.fonts?.load("800 22px Inter"),
    document.fonts?.load("600 34px Inter"),
    document.fonts?.load("700 128px Rajdhani"),
    document.fonts?.load("700 92px Rajdhani"),
  ]);
  // The legacy still/post renderer still uses its overlay library. The new MP4
  // painter does not, so video generation can skip that fetch and decode work.
  if (!loadFx) return assets;
  return { ...assets, fx: await loadAnnounceFxLibrary() };
}

/**
 * The Agenda in the "night vision" model: the crests, the model's typefaces and the face the
 * piece wears (`face`: `{ name, photo }`, or null: the crest takes its place). A player's
 * photo is drawn as it is, never "cleaned".
 */
export async function loadNightAgendaAssets(matches = [], face = null, options = {}) {
  const [assets] = await Promise.all([loadAgendaAssets(matches, options), loadNightFonts()]);
  return { ...assets, face: face?.photo ? await loadLogoAsset(face.photo, face.name) : null };
}

/** The Relacionados in the "night vision" model: the photos and the model's typefaces. */
export async function loadNightRelatedAssets(players = [], options = {}) {
  const [assets] = await Promise.all([loadRelatedNightAssets(players, options), loadNightFonts()]);
  return assets;
}
