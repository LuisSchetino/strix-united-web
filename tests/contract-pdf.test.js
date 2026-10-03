import test from "node:test";
import assert from "node:assert/strict";
import { buildSignedContractPdf } from "../src/features/onboarding/contract-pdf.js";
import { CONTRACT_SEASON, contractDocumentId } from "../src/features/onboarding/contract-core.js";

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

test("o PDF é um documento oficial: timbre, identificador, rodapé paginado e escudo embutido", () => {
  const contract = { season: CONTRACT_SEASON, signedAt: "2026-10-01T20:15:00.000Z", signature: { d: "M10 100L300 60L590 120" } };
  const id = contractDocumentId(contract);
  assert.match(id, /^STX-2627-[0-9A-F]{6}$/);
  assert.equal(contractDocumentId(contract), id, "o mesmo aceite gera sempre o mesmo número");
  const crest = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 240, height: 240 };
  const pdf = buildSignedContractPdf(contract, { name: "NUNES" }, { crest });
  const text = new TextDecoder("latin1").decode(pdf);
  const hex = (value) => `<${Buffer.from(value, "latin1").toString("hex")}>`;
  assert.match(text, /\/MediaBox \[0 0 595 842\]/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /\/XObject << \/Crest 7 0 R >>/);
  assert.ok(text.includes(hex(id)), "o identificador aparece no documento");
  assert.ok(text.includes(hex("Página 1 de 1")), "rodapé paginado");
  assert.ok(text.includes(hex("STRIX UNITED")), "timbre do clube");
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xref, xref + 4), "xref", "o xref aponta para o byte certo mesmo com o JPEG binário");
});

test("não fabrica um PDF quando não há contrato assinado válido", () => {
  assert.throws(() => buildSignedContractPdf(null), /signed_contract_unavailable/);
  assert.throws(() => buildSignedContractPdf({ signature: { d: "M1 1" }, signedAt: "inválida" }), /signed_contract_unavailable/);
});
