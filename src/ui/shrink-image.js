// A photo straight from a phone's camera is several megabytes and thousands of pixels wide; the
// site shows it in a token a few dozen pixels across. Sending it as it is makes saving slow on a
// phone's connection. Before an upload the picture is redrawn at the size the product needs and
// re-encoded; transparency is kept. Anything that cannot be redrawn here is sent as it was.

/** The picture as a smaller file (longest side at most `max`), or the same file when that would not help. */
export async function shrinkImage(file, { max = 1200, quality = 0.86 } = {}) {
  try {
    if (!file || !/^image\/(png|jpe?g|webp)$/i.test(file.type || "") || typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    // Already small in pixels and in bytes: nothing to gain.
    if (scale === 1 && file.size <= 400 * 1024) { bitmap.close?.(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const layer = canvas.getContext("2d");
    if (!layer) { bitmap.close?.(); return file; }
    layer.imageSmoothingQuality = "high";
    layer.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    // A browser that cannot write WebP answers with another type (or nothing): keep the original.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    const name = `${String(file.name || "imagem").replace(/\.[a-z0-9]+$/i, "")}.webp`;
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}
