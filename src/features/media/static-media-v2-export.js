import { toBlob } from "html-to-image";
import { downloadBlob } from "./media-jobs.js";
import { STATIC_MEDIA_V2_CANVAS } from "./static-media-v2-core.js";

/** Shared, dimension-checked PNG export used by all static V2 templates. */
export async function exportStaticMediaV2Png(element, fileName, size = STATIC_MEDIA_V2_CANVAS) {
  if (!element) throw new Error("O preview está indisponível.");
  await document.fonts?.ready;
  await Promise.all(Array.from(element.querySelectorAll("img")).map((image) => image.decode().catch(() => undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const blob = await toBlob(element, {
    width: size.width,
    height: size.height,
    pixelRatio: 1,
    backgroundColor: "#030303",
    cacheBust: false,
    style: { transform: "none", transformOrigin: "top left", margin: "0" },
  });
  if (!blob || blob.type !== "image/png") throw new Error("O navegador não conseguiu gerar o PNG.");

  if (typeof createImageBitmap === "function") {
    const image = await createImageBitmap(blob);
    const isExpectedSize = image.width === size.width && image.height === size.height;
    image.close();
    if (!isExpectedSize) throw new Error(`A imagem exportada não está em ${size.width} × ${size.height}.`);
  }

  downloadBlob(blob, fileName);
  return blob;
}
