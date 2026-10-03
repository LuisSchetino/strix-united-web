import { STRIX_BRAND } from "../../brand.js";
import { buildSignedContractPdf } from "./contract-pdf.js";
import { downloadBlob } from "../../lib/download-blob.js";

/** The crest as a JPEG on paper, for the letterhead. A missing crest leaves the letterhead typographic. */
async function crestJpeg(size = 240) {
  try {
    const response = await fetch(STRIX_BRAND.logo);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fbfaf8";
    ctx.fillRect(0, 0, size, size);
    const scale = Math.min(size / bitmap.width, size / bitmap.height);
    ctx.drawImage(bitmap, (size - bitmap.width * scale) / 2, (size - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), width: size, height: size } : null;
  } catch {
    return null;
  }
}

/** Builds the official document from the signed payload and hands it to the browser. */
export async function downloadSignedContractPdf({ contract, identity } = {}) {
  if (!contract?.signature?.d) throw new Error("signed_contract_unavailable");
  const pdf = buildSignedContractPdf(contract, identity, { crest: await crestJpeg() });
  const handle = String(identity?.handle || identity?.name || "strix").replace(/^@/, "").replace(/[^\w.-]+/g, "-").toLowerCase();
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), `strix-contrato-${handle}-${String(contract.season).replaceAll("/", "-")}.pdf`);
}
