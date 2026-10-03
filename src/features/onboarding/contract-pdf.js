import { CONTRACT_COMMITMENT, CONTRACT_SEASON, SIGNATURE_VIEWBOX, contractDocumentId } from "./contract-core.js";

// The official copy of the contract: an A4 vector document drawn from the
// signed payload itself — letterhead, identification, clauses, the signature
// stroke, the document id and a paginated footer. Not a screenshot of the page.

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

const INK = "0.08 0.09 0.10";
const MUTED = "0.42 0.44 0.47";
const HAIR = "0.80 0.80 0.78";
const PAPER = "0.985 0.982 0.972";

const pdfText = (value) => `<${winAnsiBytes(value).map((byte) => byte.toString(16).padStart(2, "0")).join("")}>`;
const line = (text, x, y, size, font = "F1", color = INK) => `${color} rg BT /${font} ${size} Tf ${x} ${y} Td ${pdfText(text)} Tj ET`;
const rule = (x1, y1, x2, y2, color = HAIR, width = 0.7) => `${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;

function dateTimeLabel(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "DATA INDISPONÍVEL";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short",
  }).format(date).toLocaleUpperCase("pt-BR");
}

function wrapWords(value, limit = 96) {
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

// Signature box on the page (points). The stroke keeps the pad's 600×200 proportions.
const SIGN = Object.freeze({ left: 76, base: 246, width: 443, height: 102 });

function signatureCommands(contract) {
  const path = contract?.signature?.d;
  if (typeof path !== "string") return "";
  const tokens = [...path.matchAll(/([ML])(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
  if (!tokens.length) return "";
  const commands = [];
  let hasSegment = false;
  for (const [, kind, rawX, rawY] of tokens) {
    const x = SIGN.left + (Number(rawX) / SIGNATURE_VIEWBOX.width) * SIGN.width;
    const y = SIGN.base + SIGN.height - (Number(rawY) / SIGNATURE_VIEWBOX.height) * SIGN.height;
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
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const pdf = new Uint8Array(size);
  let cursor = 0;
  chunks.forEach((chunk) => { pdf.set(chunk, cursor); cursor += chunk.length; });
  return pdf;
}

/**
 * The signed contract as a one-page A4 document.
 * `crest` (optional) is the club crest as JPEG bytes: { bytes, width, height }.
 */
export function buildSignedContractPdf(contract, identity = {}, { crest = null } = {}) {
  if (!contract?.signature?.d || !Number.isFinite(Date.parse(contract.signedAt))) {
    throw new Error("signed_contract_unavailable");
  }
  const name = String(identity.name || "MEMBRO STRIX").toLocaleUpperCase("pt-BR");
  const role = String(identity.role || "—");
  const season = String(contract.season || CONTRACT_SEASON);
  const documentId = contractDocumentId(contract);
  const signedLabel = dateTimeLabel(contract.signedAt);
  const hasCrest = crest?.bytes?.length > 0 && crest.width > 0 && crest.height > 0;

  const commands = [
    // Paper and a thin frame inside the margin.
    `q ${PAPER} rg 0 0 595 842 re f Q`,
    `${HAIR} RG 0.6 w 32 32 531 778 re S`,
  ];
  // Letterhead
  const crestSize = 50;
  const textLeft = hasCrest ? 56 + crestSize + 14 : 56;
  if (hasCrest) commands.push(`q ${crestSize} 0 0 ${crestSize} 56 740 cm /Crest Do Q`);
  commands.push(
    line("STRIX UNITED", textLeft, 772, 16, "F2"),
    line("FC 27  ·  SÃO PAULO  ·  TEMPORADA " + season, textLeft, 756, 7.5, "F2", MUTED),
    line(`Nº FC27-${season}`, 404, 772, 9, "F2"),
    line(documentId, 404, 758, 8, "F1", MUTED),
    rule(56, 726, 539, 726, INK, 1.1),
    line("CONTRATO DE VÍNCULO", 56, 694, 19, "F2"),
    line("Instrumento particular de vínculo esportivo do elenco Strix United FC27.", 56, 678, 9, "F1", MUTED),
  );
  // Identification ledger: two columns, three rows.
  const fields = [
    ["VINCULADO", name], ["IDENTIFICAÇÃO", identity.handle || "—"],
    ["FUNÇÃO", role], ["TEMPORADA", season],
    ["ASSINADO EM", signedLabel], ["DOCUMENTO", documentId],
  ];
  let rowY = 646;
  for (let index = 0; index < fields.length; index += 2) {
    commands.push(rule(56, rowY + 14, 539, rowY + 14));
    fields.slice(index, index + 2).forEach(([label, value], column) => {
      const x = column ? 304 : 56;
      commands.push(line(label, x, rowY + 2, 6.5, "F2", MUTED), line(value, x, rowY - 10, 9.5, "F2"));
    });
    rowY -= 30;
  }
  commands.push(rule(56, rowY + 14, 539, rowY + 14));
  // Clauses
  const clauses = [
    ["DAS PARTES", `Strix United FC27, agremiação com sede em São Paulo, representada pela sua direção, e o vinculado identificado acima ajustam este contrato, que se rege pelas cláusulas seguintes.`],
    ["CLÁUSULA 1ª · DO OBJETO", `O vinculado integra o elenco do Strix United na temporada ${season}, na função ${role}, em caráter exclusivo para as atividades do clube nesta temporada.`],
    ["CLÁUSULA 2ª · DO COMPROMISSO", CONTRACT_COMMITMENT],
    ["CLÁUSULA 3ª · DO ACEITE", `A assinatura abaixo registra o aceite no perfil autenticado, em ${signedLabel}. Foro de São Paulo.`],
  ];
  let cursor = rowY - 6;
  for (const [title, body] of clauses) {
    commands.push(line(title, 56, cursor, 7.5, "F2"));
    cursor -= 13;
    for (const text of wrapWords(body)) {
      commands.push(line(text, 56, cursor, 9.2, "F1"));
      cursor -= 12;
    }
    cursor -= 5;
  }
  // Signature block
  commands.push(
    line("ASSINATURA DO VINCULADO", SIGN.left, 360, 7, "F2", MUTED),
    `${INK} RG 1.9 w 1 J 1 j`,
    signatureCommands(contract),
    rule(SIGN.left, 236, SIGN.left + SIGN.width, 236, INK, 0.8),
    line(name, SIGN.left, 218, 11, "F2"),
    line(`${identity.handle ? `${identity.handle}  ·  ` : ""}SÃO PAULO  ·  TEMPORADA ${season}`, SIGN.left, 203, 7.5, "F1", MUTED),
    line("REGISTRO", 404, 218, 6.5, "F2", MUTED),
    line(documentId, 404, 206, 8.5, "F2"),
  );
  // Footer
  commands.push(
    rule(56, 74, 539, 74),
    line("Documento gerado no STRIX FC27 a partir do aceite registrado no perfil autenticado do vinculado.", 56, 58, 7, "F1", MUTED),
    line("Página 1 de 1", 494, 58, 7, "F2", MUTED),
  );

  const stream = commands.filter(Boolean).join("\n");
  const resources = `<< /Font << /F1 5 0 R /F2 6 0 R >>${hasCrest ? " /XObject << /Crest 7 0 R >>" : ""} >>`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ${resources} /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  if (hasCrest) {
    objects.push([
      `<< /Type /XObject /Subtype /Image /Width ${crest.width} /Height ${crest.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${crest.bytes.length} >>\nstream\n`,
      crest.bytes instanceof Uint8Array ? crest.bytes : new Uint8Array(crest.bytes),
      "\nendstream",
    ]);
  }
  return assemble(objects);
}
