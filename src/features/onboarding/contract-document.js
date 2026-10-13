import { buildSignedContractPdf } from "./contract-pdf.js";
import { captureContractSheet, mountContractSheet } from "./contract-render.jsx";
import { downloadBlob } from "../../lib/download-blob.js";

// Print resolution: the 794px sheet at 2.5× is ≈ 240 dpi on A4.
const PRINT_SCALE = 2.5;

/** Builds the official document from the signed payload and hands it to the browser. */
export async function downloadSignedContractPdf({ contract, identity } = {}) {
  if (!contract?.signature?.d) throw new Error("signed_contract_unavailable");
  const mounted = await mountContractSheet({ contract, identity });
  let captured;
  try {
    captured = await captureContractSheet(mounted.sheet, { scale: PRINT_SCALE, flatten: true, signature: contract.signature.d });
  } finally {
    mounted.dispose();
  }
  const blob = await new Promise((resolve) => captured.paper.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Não foi possível gerar a página do contrato.");
  const page = { bytes: new Uint8Array(await blob.arrayBuffer()), width: captured.paper.width, height: captured.paper.height };
  const pdf = buildSignedContractPdf(contract, identity, { page, words: captured.words, sheet: { width: captured.width, height: captured.height } });
  const handle = String(identity?.handle || identity?.name || "strix").replace(/^@/, "").replace(/[^\w.-]+/g, "-").toLowerCase();
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), `strix-contrato-${handle}-${String(contract.season).replaceAll("/", "-")}.pdf`);
}
