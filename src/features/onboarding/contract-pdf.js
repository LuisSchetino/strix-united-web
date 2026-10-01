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
  const commands = [
    "q 0.96 0.95 0.92 rg 0 0 595 842 re f Q",
    "q 0.07 0.08 0.09 rg 54 780 5 24 re f Q",
    line("STRIX UNITED", 70, 793, 10, "F2"),
    line("FC 27  /  TEMPORADA 2026/27", 376, 793, 8, "F2", "0.35 0.36 0.37"),
    rule(54, 766, 541, 766),
    line("CONTRATO DE VÍNCULO", 54, 715, 25, "F2"),
    line("STRIX UNITED  ·  FC27", 54, 695, 9, "F2", "0.36 0.37 0.38"),
    line("NOME", 54, 650, 7, "F2", "0.42 0.43 0.44"),
    line(String(identity.name || "MEMBRO STRIX").toLocaleUpperCase("pt-BR"), 54, 629, 14, "F2"),
    line("IDENTIFICAÇÃO", 310, 650, 7, "F2", "0.42 0.43 0.44"),
    line(String(identity.handle || identity.role || "STRIX UNITED").toLocaleLowerCase("pt-BR"), 310, 629, 11, "F1"),
    rule(54, 610, 541, 610),
    line("TEMPORADA", 54, 584, 7, "F2", "0.42 0.43 0.44"),
    line(String(contract.season || CONTRACT_SEASON), 54, 563, 12, "F2"),
    line("ASSINADO EM", 310, 584, 7, "F2", "0.42 0.43 0.44"),
    line(dateTimeLabel(contract.signedAt), 310, 563, 10, "F2"),
    line("FUNÇÃO", 54, 535, 7, "F2", "0.42 0.43 0.44"),
    line(String(identity.role || "—"), 54, 516, 10, "F1"),
    rule(54, 497, 541, 497),
    line("COMPROMISSO", 54, 471, 7, "F2", "0.42 0.43 0.44"),
  ];
  wrapWords(CONTRACT_COMMITMENT, 76).slice(0, 3).forEach((text, index) => commands.push(line(text, 54, 448 - index * 17, 10, "F1", "0.18 0.19 0.20")));
  commands.push(
    rule(54, 394, 541, 394),
    line("ASSINATURA DIGITAL", 54, 372, 7, "F2", "0.42 0.43 0.44"),
    "0.75 0.74 0.71 RG 0.7 w 54 240 487 116 re S",
    "0.06 0.07 0.08 RG 2.2 w 1 J 1 j",
    signatureCommands(contract),
    line("Assinatura registrada no perfil autenticado", 54, 224, 8, "F1", "0.38 0.39 0.40"),
    rule(54, 70, 541, 70),
    line("CÓPIA PESSOAL · STRIX UNITED FC27", 54, 51, 7, "F2", "0.42 0.43 0.44"),
    line("Este documento reproduz o compromisso e o traço armazenados no perfil.", 54, 37, 7, "F1", "0.48 0.49 0.50"),
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

export function downloadSignedContractPdf(contract, identity = {}) {
  const bytes = buildSignedContractPdf(contract, identity);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `strix-fc27-contrato-${String(contract.season || CONTRACT_SEASON).replaceAll("/", "-")}.pdf`;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
