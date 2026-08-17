import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("modal de posição usa elenco ativo e separa naturais de improvisados", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(source, /activeRoster[\s\S]*player\?\.is_active/);
  assert.match(source, /NATURAIS · \{desiredPosition\}/);
  assert.match(source, /IMPROVISADOS/);
  assert.match(source, /roster=\{workspace\.players\}/);
});

test("predefinições editam em lugar e excluem com confirmação própria", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(source, /setEditingId\(preset\.id\)/);
  assert.match(source, /current\.map\(\(preset\) => preset\.id === editingId/);
  assert.match(source, /role="alertdialog"/);
  assert.doesNotMatch(source.slice(source.indexOf("function PresetPanel"), source.indexOf("function Agenda(")), /window\.confirm/);
});

test("fluxo ativo separa descoberta EA da publicação explícita", async () => {
  const source = await readFile(new URL("../src/features/matches/MatchesPage.jsx", import.meta.url), "utf8");
  assert.match(source, /method: "GET"/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /BUSCAR NA EA/);
  assert.match(source, /PUBLICAR JOGO/);
  assert.doesNotMatch(source, /BUSCAR PELO MEU PC|127\.0\.0\.1:8789/);
});
