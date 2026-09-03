import { STRIX_BRAND } from "../../brand.js";
import { cacheableProviderAssetUrl } from "../../ui/provider-assets.js";
import { opponentInitials } from "./agenda-media-core.js";

async function bitmapFromUrl(url) {
  const source = cacheableProviderAssetUrl(url);
  if (!source) return null;
  const response = await fetch(source, { cache: "force-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("asset_not_image");
  return createImageBitmap(blob);
}

export async function loadLogoAsset(url, name, onProgress) {
  const initials = opponentInitials(name);
  if (!url) {
    onProgress?.();
    return { name, url: "", bitmap: null, initials };
  }
  try {
    const bitmap = await bitmapFromUrl(url);
    onProgress?.();
    return { name, url, bitmap, initials };
  } catch {
    onProgress?.();
    return { name, url, bitmap: null, initials };
  }
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
    document.fonts?.load("700 132px Rajdhani"),
  ]);
  const results = await Promise.all(unique.map((item) => loadLogoAsset(item.url, item.name, report)));
  const byUrl = new Map(results.map((item) => [`${item.url}::${item.name}`, item]));
  const pick = (url, name) => byUrl.get(`${url}::${name}`) || { name, url, bitmap: null, initials: opponentInitials(name) };
  return {
    strix: pick(STRIX_BRAND.logo, "Strix United"),
    opponents: matches.map((match) => pick(match.opponent_logo, match.opponent)),
    competitions: matches.map((match) => (match.competition_logo ? pick(match.competition_logo, match.competition) : null)),
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
    document.fonts?.load("700 118px Rajdhani"),
  ]);
  const results = await Promise.all(unique.map((item) => loadLogoAsset(item.url, item.name, report)));
  const byUrl = new Map(results.map((item) => [`${item.url}::${item.name}`, item]));
  const pick = (url, name) => byUrl.get(`${url}::${name}`) || { name, url, bitmap: null, initials: opponentInitials(name) };
  const playerAssets = players.map((player) => pick(player.photo, player.name));
  return {
    strix: pick(STRIX_BRAND.logo, "Strix United"),
    players: playerAssets,
    byId: Object.fromEntries(players.map((player, index) => [player.id, playerAssets[index]])),
    total: unique.length,
  };
}
