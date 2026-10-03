import test from "node:test";
import assert from "node:assert/strict";
import { buildSignedContractPdf, pdfFromJpeg } from "../src/features/onboarding/contract-pdf.js";
import { CONTRACT_SEASON } from "../src/features/onboarding/contract-core.js";

test("PDF do contrato inclui compromisso, identidade, data e traço vetorial assinado", () => {
  const contract = {
    season: CONTRACT_SEASON,
    signedAt: "2026-10-01T20:15:00.000Z",
    signature: { w: 600, h: 200, d: "M0 0L600 200M0 200L600 0" },
  };
  const bytes = buildSignedContractPdf(contract, { name: "JÚLIO DORNELLAS", handle: "@julio", role: "MC · JOGADOR" });
  const pdf = new TextDecoder().decode(bytes);
  const nameHex = Buffer.from("JÚLIO DORNELLAS", "latin1").toString("hex");

  assert.ok(bytes instanceof Uint8Array);
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /%%EOF$/);
  assert.match(pdf, /\/Count 1/);
  assert.ok(pdf.includes(`<${nameHex}>`), "o nome usa WinAnsi com acento preservado");
  assert.ok(pdf.includes("76.00 348.00 m 519.00 246.00 l S 76.00 246.00 m 519.00 348.00 l S"), "os sub-traços mantêm coordenadas independentes");
  assert.ok(pdf.includes(`<${Buffer.from("MC · JOGADOR", "latin1").toString("hex")}>`));
  assert.ok(pdf.includes(`<${Buffer.from("CONTRATO DE VÍNCULO", "latin1").toString("hex")}>`));
});

test("o PDF do download é a imagem do contrato que está na tela", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = pdfFromJpeg(jpeg, 640, 900);
  const text = new TextDecoder().decode(pdf);
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /\/Count 1/);
  assert.match(text, /\/MediaBox \[0 0 595 837\]/);
  assert.match(text, /%%EOF$/);
  assert.ok(pdf.includes(0xff) && pdf.includes(0xd8));
});

test("não fabrica um PDF quando não há contrato assinado válido", () => {
  assert.throws(() => buildSignedContractPdf(null), /signed_contract_unavailable/);
  assert.throws(() => buildSignedContractPdf({ signature: { d: "M1 1" }, signedAt: "inválida" }), /signed_contract_unavailable/);
});
