import test from "node:test";
import assert from "node:assert/strict";
import { buildSignedContractPdf } from "../src/features/onboarding/contract-pdf.js";
import { CONTRACT_SEASON, contractDocumentId, contractSignedLabel } from "../src/features/onboarding/contract-core.js";
import { parseStrokes, penPose, signatureAt, signatureTimeline } from "../src/features/onboarding/signature-motion.js";

const contract = { season: CONTRACT_SEASON, signedAt: "2026-10-01T20:15:00.000Z", signature: { w: 600, h: 200, d: "M10 100L300 60L590 120M20 180L580 180" } };
const page = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1985, height: 2808 };
const hex = (value) => `<${Buffer.from(value, "latin1").toString("hex")}>`;

test("o PDF é a mesma folha do site: página A4 com a folha embutida e camada de texto pesquisável", () => {
  const words = [
    { text: "CONTRATO", x: 200, y: 260, size: 40, width: 220, bold: true },
    { text: "JÚLIO", x: 74, y: 420, size: 11.5, width: 40, bold: true },
  ];
  const bytes = buildSignedContractPdf(contract, { name: "JÚLIO" }, { page, words });
  const text = new TextDecoder("latin1").decode(bytes);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /%%EOF$/);
  assert.match(text, /\/Count 1/);
  assert.match(text, /\/MediaBox \[0 0 595 842\]/);
  assert.match(text, /\/Width 1985 \/Height 2808/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /q 595 0 0 842 0 0 cm \/Sheet Do Q/);
  assert.match(text, /3 Tr/, "o texto fica invisível sobre a imagem");
  assert.ok(text.includes(hex("JÚLIO")), "acentos em WinAnsi");
  assert.ok(text.includes(hex(`Registro ${contractDocumentId(contract)}`)), "metadados citam o registro");
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xref, xref + 4), "xref", "o xref aponta para o byte certo mesmo com o JPEG binário");
});

test("não fabrica um PDF sem contrato assinado nem sem a folha", () => {
  assert.throws(() => buildSignedContractPdf(null), /signed_contract_unavailable/);
  assert.throws(() => buildSignedContractPdf({ signature: { d: "M1 1" }, signedAt: "inválida" }), /signed_contract_unavailable/);
  assert.throws(() => buildSignedContractPdf(contract, {}, {}), /contract_sheet_unavailable/);
});

test("o identificador e a data do contrato são estáveis", () => {
  const id = contractDocumentId(contract);
  assert.match(id, /^STX-2627-[0-9A-F]{6}$/);
  assert.equal(contractDocumentId(contract), id);
  assert.match(contractSignedLabel(contract.signedAt), /1 de outubro de 2026/);
  assert.equal(contractSignedLabel("x"), "");
});

test("a caneta escreve os traços em ordem, levanta entre eles e sai no fim", () => {
  assert.equal(parseStrokes(contract.signature.d).length, 2);
  const timeline = signatureTimeline(contract.signature.d);
  assert.ok(timeline.duration >= 1.4 && timeline.duration <= 3.2);
  assert.equal(signatureAt(timeline, 0).ink.length, 1);
  const lift = timeline.segments.find((segment) => segment.kind === "lift");
  assert.ok(penPose(timeline, (lift.start + lift.end) / 2).lift > 0.5, "a caneta sai do papel entre traços");
  assert.equal(signatureAt(timeline, timeline.duration + 1).ink.length, 2);
  assert.ok(penPose(timeline, -0.4).opacity < 1, "entra antes do primeiro traço");
  assert.equal(penPose(timeline, timeline.duration + 1).opacity, 0, "e some depois do último");
});
