import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { materialDraftOf, materialPatch } from "../src/features/library/library-core.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const item = {
  id: "i1", title: "Saída de bola pelo lado esquerdo", category: "jogada", description: "Triangulação.",
  source_type: "youtube", source_url: "https://youtu.be/dQw4w9WgXcQ", thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  tags: ["saida de bola", "bola parada"], focus_positions: ["ZAG"], minimum_access_tier: "teste", status: "active",
  created_by: "author", created_at: "2026-10-03T12:00:00Z",
};

test("a material opens in the sheet as it is", () => {
  const draft = materialDraftOf(item);
  assert.equal(draft.title, "Saída de bola pelo lado esquerdo");
  assert.equal(draft.category, "jogada");
  assert.deepEqual(draft.themes, ["construcao"], "its theme is read back from its tags");
  assert.deepEqual(draft.focus_positions, ["ZAG"]);
  assert.equal(draft.thumbnail_url, "", "the video's own picture stays automatic");
  assert.equal(draft.minimum_access_tier, "player", "an audience that no longer exists falls back to every player");
  assert.equal(materialDraftOf({ ...item, thumbnail_url: "https://img/capa.jpg" }).thumbnail_url, "https://img/capa.jpg");
});

test("an edit writes the title and the section, keeps hand-written tags, and touches nothing else", () => {
  const draft = { ...materialDraftOf(item), title: "  Saída curta com o goleiro ", category: "review", themes: ["pressao"], focus_positions: [] };
  const patch = materialPatch(draft, item, "editor");
  assert.equal(patch.title, "Saída curta com o goleiro");
  assert.equal(patch.category, "review");
  assert.deepEqual(patch.tags, ["pressão", "bola parada"], "the old theme leaves, the new one enters, the hand-written tag stays");
  assert.deepEqual(patch.focus_positions, [], "clearing the positions is an edit too");
  assert.equal(patch.updated_by, "editor");
  for (const field of ["id", "status", "created_by", "created_at"]) assert.equal(field in patch, false, `${field} is not rewritten`);
  assert.equal(patch.source_url, item.source_url);
  assert.equal(patch.thumbnail_url, item.thumbnail_url, "the cover is left as it was");

  // A material shown with its shelf's illustration keeps it when only the title changes...
  const plain = { ...item, thumbnail_url: null };
  assert.equal(materialPatch({ ...materialDraftOf(plain), title: "Outro título" }, plain, "editor").thumbnail_url, null);
  // ...takes the new video's picture when the link changes, and a typed cover always wins.
  assert.equal(materialPatch({ ...materialDraftOf(plain), source_url: "https://youtu.be/aaaaaaaaaaa" }, plain, "editor").thumbnail_url, "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg");
  assert.equal(materialPatch({ ...materialDraftOf(plain), thumbnail_url: "https://img/capa.jpg" }, plain, "editor").thumbnail_url, "https://img/capa.jpg");

  // A material from before the positions column: nothing is sent for it unless positions are chosen.
  const { focus_positions: _omitted, ...older } = item;
  assert.equal("focus_positions" in materialPatch(materialDraftOf(older), older, "editor"), false);
  assert.deepEqual(materialPatch({ ...materialDraftOf(older), focus_positions: ["ATA"] }, older, "editor").focus_positions, ["ATA"]);
});

test("the card's menu offers Editar, and the sheet saves over the material", async () => {
  const [page, sheet] = await Promise.all([read("../src/features/library/LibraryPage.jsx"), read("../src/features/library/AddMaterial.jsx")]);
  assert.match(page, /\{ id: "edit", icon: "edit", label: "Editar material", onSelect: \(\) => setEditingItem\(item\) \}/);
  assert.match(page, /\{editingItem && canManage && <AddMaterial key=\{editingItem\.id\} item=\{editingItem\}/);
  assert.match(sheet, /client\.from\("library_items"\)\.update\(materialPatch\(draft, item, profile\.user_id\)\)\.eq\("id", item\.id\)/);
  assert.match(sheet, /const titleTyped = useRef\(editing\);/, "the title of a material being edited is never replaced by the video's");
  assert.match(sheet, /"SALVAR ALTERAÇÕES"/);
});
