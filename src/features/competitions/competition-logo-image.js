const images = new Map();

/** The provider's image, downloaded once per address however many readers ask for it. */
export function loadProviderImage(client, imageUrl) {
  if (!images.has(imageUrl)) {
    const request = (async () => {
      const { data } = await client.auth.getSession();
      const response = await fetch(`/api/competitions/asset?url=${encodeURIComponent(imageUrl)}`, { headers: { authorization: `Bearer ${data.session?.access_token || ""}` } });
      if (!response.ok) throw new Error("asset_unavailable");
      return response.blob();
    })();
    request.catch(() => images.delete(imageUrl));
    images.set(imageUrl, request);
  }
  return images.get(imageUrl);
}

/** A small copy of the logo (longest side `size`), transparency kept: what the app shows instead of the original. */
export async function logoThumbnail(client, imageUrl, size = 320) {
  const bitmap = await createImageBitmap(await loadProviderImage(client, imageUrl));
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise((resolve) => { canvas.toBlob(resolve, "image/webp", 0.9); });
  if (!blob) throw new Error("thumbnail_unavailable");
  return blob;
}
