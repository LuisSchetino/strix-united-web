const CACHEABLE_PROVIDER_HOSTS = new Set([
  "ccbclubs.com.br",
  "www.ccbclubs.com.br",
  "lbesports.com",
  "www.lbesports.com",
]);

export function cacheableProviderAssetUrl(value) {
  if (!value || typeof value !== "string") return value || "";
  try {
    const url = new URL(value, globalThis.location?.origin || "https://strix.invalid");
    if (url.protocol !== "https:" || !CACHEABLE_PROVIDER_HOSTS.has(url.hostname.toLowerCase())) return value;
    return `/api/competitions/asset?url=${encodeURIComponent(url.toString())}`;
  } catch {
    return value;
  }
}

const preloadedAssets = new Set();

export function preloadClubLogos(values = []) {
  if (typeof Image === "undefined") return;
  for (const value of values) {
    const url = cacheableProviderAssetUrl(value);
    if (!url || preloadedAssets.has(url)) continue;
    preloadedAssets.add(url);
    const image = new Image();
    image.decoding = "async";
    image.onerror = () => preloadedAssets.delete(url);
    image.src = url;
    image.decode?.().catch(() => preloadedAssets.delete(url));
  }
}
