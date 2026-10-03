import { CONTRACT_COMMITMENT, CONTRACT_SEASON, SIGNATURE_VIEWBOX } from "./contract-core.js";

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
const line = (text, x, y, size, font = "F1", color = "0.08 0.09 0.10") => `${color} rg BT /${font} ${size} Tf ${x} ${y} Td ${pdfText(text)} Tj ET`;
const rule = (x1, y1, x2, y2, color = "0.78 0.77 0.74", width = 0.7) => `${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;

function dateTimeLabel(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "DATA INDISPONÍVEL";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short",
  }).format(date).toLocaleUpperCase("pt-BR");
}

function wrapWords(value, limit = 68) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > limit && current) { lines.push(current); current = word; }
    else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function signatureCommands(contract) {
  const path = contract?.signature?.d;
  if (typeof path !== "string") return "";
  const tokens = [...path.matchAll(/([ML])(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
  if (!tokens.length) return "";
  const left = 76; const base = 246; const width = 443; const height = 102;
  const commands = [];
  let hasSegment = false;
  for (const [, kind, rawX, rawY] of tokens) {
    const x = left + (Number(rawX) / SIGNATURE_VIEWBOX.width) * width;
    const y = base + height - (Number(rawY) / SIGNATURE_VIEWBOX.height) * height;
    if (kind === "M") {
      if (hasSegment) commands.push("S");
      // PDF path operators m/l use absolute page coordinates (unlike SVG's lowercase forms).
      commands.push(`${x.toFixed(2)} ${y.toFixed(2)} m`);
      hasSegment = false;
      continue;
    }
    commands.push(`${x.toFixed(2)} ${y.toFixed(2)} l`);
    hasSegment = true;
  }
  if (hasSegment) commands.push("S");
  return commands.join(" ");
}

/** Creates a one-page, self-contained copy. No third-party PDF service or data write. */
export function buildSignedContractPdf(contract, identity = {}) {
  if (!contract?.signature?.d || !Number.isFinite(Date.parse(contract.signedAt))) {
    throw new Error("signed_contract_unavailable");
  }
  const name = String(identity.name || "MEMBRO STRIX").toLocaleUpperCase("pt-BR");
  const role = String(identity.role || "—");
  const season = String(contract.season || CONTRACT_SEASON);
  const ink = "0.96 0.96 0.95";
  const muted = "0.78 0.80 0.82";
  const commands = [
    "q 0.035 0.04 0.05 rg 0 0 595 842 re f Q",
    "0.92 0.92 0.91 RG 1.2 w 36 36 523 770 re S",
    line("STRIX UNITED", 58, 764, 16, "F2", ink),
    line("FC 27  ·  SÃO PAULO", 58, 748, 8, "F2", muted),
    line(`Nº FC27-${season}`, 430, 756, 9, "F2", ink),
    rule(58, 734, 537, 734, "0.92 0.92 0.91", 0.9),
    line("CONTRATO DE VÍNCULO", 58, 708, 18, "F2", ink),
    line(role, 58, 690, 10, "F2", ink),
    line("IDENTIFICAÇÃO DAS PARTES", 58, 662, 9, "F2", ink),
  ];
  const blocks = [
    `CLUBE. Strix United FC27, agremiação com sede em São Paulo, neste instrumento representada pela sua direção. Registro interno da temporada ${season}.`,
    `VINCULADO. ${name}${identity.handle ? `, identificado como ${identity.handle}` : ""}, função ${role}.`,
    "As partes acima identificadas ajustam o presente contrato, que se rege pelas cláusulas seguintes.",
    `CLÁUSULA 1ª. O vinculado integra o elenco do Strix United na temporada ${season}, na função ${role}.`,
    `CLÁUSULA 2ª. ${CONTRACT_COMMITMENT}`,
    `CLÁUSULA 3ª. A assinatura abaixo registra o aceite no perfil autenticado, em ${dateTimeLabel(contract.signedAt)}. Foro de São Paulo.`,
  ];
  let cursor = 642;
  blocks.forEach((block) => {
    wrapWords(block, 92).forEach((text) => {
      commands.push(line(text, 58, cursor, 9, "F1", ink));
      cursor -= 12;
    });
    cursor -= 6;
  });
  commands.push(
    line("ASSINATURA DO VINCULADO", 76, 360, 8, "F2", muted),
    "0.92 0.92 0.91 RG 0.7 w 76 236 443 112 re S",
    "0.96 0.96 0.95 RG 2.1 w 1 J 1 j",
    signatureCommands(contract),
    rule(76, 228, 519, 228, "0.92 0.92 0.91", 0.8),
    line(name, 76, 210, 11, "F2", ink),
    line(`${identity.handle ? `${identity.handle}  ·  ` : ""}SÃO PAULO  ·  TEMPORADA ${season}`, 76, 194, 8, "F1", muted),
  );

  const stream = commands.filter(Boolean).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

/** One page whose only content is the JPEG of the on-screen contract. */
export function pdfFromJpeg(jpegBytes, pixelWidth, pixelHeight) {
  const jpeg = jpegBytes instanceof Uint8Array ? jpegBytes : new Uint8Array(jpegBytes);
  if (!jpeg.byteLength || !pixelWidth || !pixelHeight) throw new Error("signed_contract_unavailable");
  const pageWidth = 595;
  const pageHeight = Math.max(1, Math.round(pageWidth * (pixelHeight / pixelWidth)));
  const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`;
  const encoder = new TextEncoder();
  const chunks = [];
  const push = (value) => chunks.push(typeof value === "string" ? encoder.encode(value) : value);
  const length = () => chunks.reduce((total, chunk) => total + chunk.length, 0);
  const offsets = [0];
  push("%PDF-1.4\n");
  const add = (body) => {
    offsets.push(length());
    push(`${offsets.length - 1} 0 obj\n`);
    body.forEach(push);
    push("\nendobj\n");
  };
  add(["<< /Type /Catalog /Pages 2 0 R >>"]);
  add(["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  add([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`]);
  add([
    `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`,
    jpeg,
    "\nendstream",
  ]);
  add([`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
  const xref = length();
  let xrefBody = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { xrefBody += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  push(`${xrefBody}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const total = length();
  const pdf = new Uint8Array(total);
  let cursor = 0;
  chunks.forEach((chunk) => { pdf.set(chunk, cursor); cursor += chunk.length; });
  return pdf;
}
