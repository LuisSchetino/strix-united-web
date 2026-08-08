const hex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
const toHex = (red, green, blue) => `#${hex(red)}${hex(green)}${hex(blue)}`;

export function dominantColorsFromPixels(data, limit = 5) {
  const buckets = new Map();
  for (let index = 0; index < data.length; index += 16) {
    const red = data[index]; const green = data[index + 1]; const blue = data[index + 2]; const alpha = data[index + 3];
    if (alpha < 180) continue;
    const max = Math.max(red, green, blue); const min = Math.min(red, green, blue);
    const lightness = (max + min) / 2;
    const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lightness - 255));
    if (lightness < 24 || lightness > 238 || saturation < 0.12) continue;
    const key = `${Math.round(red / 32) * 32},${Math.round(green / 32) * 32},${Math.round(blue / 32) * 32}`;
    const current = buckets.get(key) || { red: 0, green: 0, blue: 0, count: 0, saturation: 0 };
    current.red += red; current.green += green; current.blue += blue; current.count += 1; current.saturation += saturation;
    buckets.set(key, current);
  }
  return [...buckets.values()]
    .map((bucket) => ({ color: toHex(bucket.red / bucket.count, bucket.green / bucket.count, bucket.blue / bucket.count), score: bucket.count * (1 + bucket.saturation / bucket.count) }))
    .sort((left, right) => right.score - left.score)
    .filter((entry, index, all) => all.findIndex((candidate) => {
      const parts = (value) => value.color.match(/[a-f\d]{2}/gi).map((item) => parseInt(item, 16));
      const [r1, g1, b1] = parts(candidate); const [r2, g2, b2] = parts(entry);
      return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 55;
    }) === index)
    .slice(0, limit)
    .map((entry) => entry.color);
}

export async function extractPalette(client, imageUrl) {
  if (!imageUrl || !client) return [];
  const { data } = await client.auth.getSession();
  const response = await fetch(`/api/competitions/asset?url=${encodeURIComponent(imageUrl)}`, { headers: { authorization: `Bearer ${data.session?.access_token || ""}` } });
  if (!response.ok) return [];
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 96;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, 96, 96); bitmap.close();
  return dominantColorsFromPixels(context.getImageData(0, 0, 96, 96).data);
}
