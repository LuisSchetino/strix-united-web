import { CONTRACT_SEASON, contractDocumentId } from "./contract-core.js";

// The official copy of the contract: one A4 page carrying the very sheet the
// site shows (rasterised from the signed payload by contract-render.jsx at
// print resolution), with an invisible text layer on top so the document can
// be searched, selected and read by assistive technology.

const cp1252 = new Map(Object.entries({
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
  "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93,
  "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c,
  "ž": 0x9e, "Ÿ": 0x9f,
}));

function winAnsiBytes(value) {
  const bytes = [];
  for (const char of String(value ?? "")) {
    const code = char.codePointAt(0);
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) bytes.push(code);
    else if (cp1252.has(char)) bytes.push(cp1252.get(char));
    else bytes.push(0x3f);
  }
  return bytes;
}

const pdfText = (value) => `<${winAnsiBytes(value).map((byte) => byte.toString(16).padStart(2, "0")).join("")}>`;
const PAGE = Object.freeze({ width: 595, height: 842 });
const fixed = (value) => (Math.round(value * 100) / 100).toString();

/** Serialises PDF objects whose bodies may mix text and binary chunks. */
function assemble(objects) {
  const encoder = new TextEncoder();
  const chunks = [];
  let size = 0;
  const push = (value) => { const chunk = typeof value === "string" ? encoder.encode(value) : value; chunks.push(chunk); size += chunk.length; };
  const offsets = [];
  push("%PDF-1.4\n");
  objects.forEach((body, index) => {
    offsets.push(size);
    push(`${index + 1} 0 obj\n`);
    (Array.isArray(body) ? body : [body]).forEach(push);
    push("\nendobj\n");
  });
  const xref = size;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const pdf = new Uint8Array(size);
  let cursor = 0;
  chunks.forEach((chunk) => { pdf.set(chunk, cursor); cursor += chunk.length; });
  return pdf;
}

const pdfDate = (iso) => {
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, "0");
  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

/**
 * The signed contract as a one-page A4 document.
 *  - `page`: the sheet as JPEG bytes { bytes, width, height } (required: the
 *    document is never printed without the sheet);
 *  - `words`: the sheet's words in sheet pixels { text, x, y (baseline), size, width, bold };
 *  - `sheet`: the sheet's size in pixels (default 794×1123).
 */
export function buildSignedContractPdf(contract, identity = {}, { page = null, words = [], sheet = { width: 794, height: 1123 } } = {}) {
  if (!contract?.signature?.d || !Number.isFinite(Date.parse(contract.signedAt))) {
    throw new Error("signed_contract_unavailable");
  }
  if (!(page?.bytes?.length > 0 && page.width > 0 && page.height > 0)) throw new Error("contract_sheet_unavailable");
  const season = String(contract.season || CONTRACT_SEASON);
  const documentId = contractDocumentId(contract);
  const sx = PAGE.width / sheet.width;
  const sy = PAGE.height / sheet.height;

  const commands = [`q ${PAGE.width} 0 0 ${PAGE.height} 0 0 cm /Sheet Do Q`];
  // Invisible text (render mode 3) over each word, sized to its box on the sheet.
  const layer = words
    .filter((word) => word?.text && Number.isFinite(word.x) && Number.isFinite(word.y) && word.size > 0)
    .map((word) => {
      const size = word.size * sy;
      const natural = word.text.length * size * 0.5;
      const stretch = natural > 0 ? Math.max(30, Math.min(300, ((word.width * sx) / natural) * 100)) : 100;
      return `BT /${word.bold ? "F2" : "F1"} ${fixed(size)} Tf ${fixed(stretch)} Tz ${fixed(word.x * sx)} ${fixed(PAGE.height - word.y * sy)} Td ${pdfText(word.text)} Tj ET`;
    });
  if (layer.length) commands.push("3 Tr", ...layer, "0 Tr");

  const stream = commands.join("\n");
  const title = `Contrato de vínculo · Strix United FC27 · ${season}`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R /Lang (pt-BR) >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Sheet 7 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    [
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
      page.bytes instanceof Uint8Array ? page.bytes : new Uint8Array(page.bytes),
      "\nendstream",
    ],
    `<< /Title ${pdfText(title)} /Author ${pdfText(String(identity.name || "Strix United FC27"))} /Subject ${pdfText(`Registro ${documentId}`)} /Creator ${pdfText("STRIX FC27")} /CreationDate (${pdfDate(contract.signedAt)}) >>`,
  ];
  return assemble(objects);
}
