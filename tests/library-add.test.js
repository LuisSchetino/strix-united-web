import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LIBRARY_THEMES, LIBRARY_TIERS, describeMaterialLink, libraryCategoriesOf, materialDraftIssue, materialRow } from "../src/features/library/library-core.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("a pasted link is read before anything is saved", () => {
  assert.equal(describeMaterialLink("").state, "empty");
  assert.equal(describeMaterialLink("youtube saída de bola").state, "invalid");
  assert.equal(describeMaterialLink("ftp://example.com/video.mp4").state, "invalid");

  const watch = describeMaterialLink(" https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s ");
  assert.deepEqual([watch.state, watch.type, watch.id], ["ok", "youtube", "dQw4w9WgXcQ"]);
  assert.equal(watch.thumbnail, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(describeMaterialLink("https://youtu.be/dQw4w9WgXcQ").id, "dQw4w9WgXcQ");
  assert.equal(describeMaterialLink("https://www.youtube.com/shorts/dQw4w9WgXcQ").id, "dQw4w9WgXcQ");
  assert.equal(describeMaterialLink("https://www.youtube.com/@strixunited").state, "invalid", "a channel is not a video");
  assert.equal(describeMaterialLink("https://www.youtube.com/playlist?list=PL123").state, "invalid");

  const file = describeMaterialLink("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing");
  assert.deepEqual([file.state, file.type, file.id], ["ok", "drive", "1AbCdEfGhIjKlMnOp"]);
  assert.match(file.note, /Qualquer pessoa com o link/);
  const folder = describeMaterialLink("https://drive.google.com/drive/folders/1AbCdEf");
  assert.equal(folder.state, "invalid");
  assert.match(folder.message, /pasta/);

  const direct = describeMaterialLink("https://cdn.example.com/lances/saida.mp4");
  assert.deepEqual([direct.state, direct.type], ["ok", "direct"]);
});

test("only the link and the title are required; the sheet says which one is missing", () => {
  assert.equal(materialDraftIssue({}), "Cole o link do vídeo.");
  assert.match(materialDraftIssue({ source_url: "https://drive.google.com/drive/folders/1AbCdEf", title: "x" }), /pasta/);
  assert.equal(materialDraftIssue({ source_url: "https://youtu.be/dQw4w9WgXcQ", title: "   " }), "Dê um título ao material.");
  assert.equal(materialDraftIssue({ source_url: "https://youtu.be/dQw4w9WgXcQ", title: "Saída de bola" }), "");
});

test("the saved row is the one the Library already reads", () => {
  const row = materialRow({
    source_url: " https://youtu.be/dQw4w9WgXcQ ", title: "  Pressão alta no tiro de meta ", category: "review",
    themes: ["pressao", "nao-existe"], description: " Linha sobe junto. ", focus_positions: ["vol", "ZAG", "xyz"], minimum_access_tier: "conselho",
  }, "user-1");
  assert.equal(row.title, "Pressão alta no tiro de meta");
  assert.equal(row.category, "review");
  assert.equal(row.source_type, "youtube");
  assert.equal(row.source_url, "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(row.thumbnail_url, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", "a YouTube video brings its own picture");
  assert.deepEqual(row.tags, ["pressão"]);
  assert.deepEqual(row.focus_positions, ["ZAG", "VOL"]);
  assert.equal(row.minimum_access_tier, "conselho");
  assert.deepEqual([row.status, row.created_by, row.updated_by], ["active", "user-1", "user-1"]);
  assert.deepEqual(libraryCategoriesOf(row).sort(), ["pressao", "reviews"], "the theme puts it on its shelf too");

  const plain = materialRow({ source_url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view", title: "Lance", minimum_access_tier: "dono" }, "user-2");
  assert.equal(plain.thumbnail_url, null);
  assert.equal(plain.category, "jogada");
  assert.equal(plain.minimum_access_tier, "player", "an unknown audience falls back to every player");
  assert.equal("focus_positions" in plain, false, "sent only when chosen");
  assert.equal(materialRow({ source_url: "https://youtu.be/dQw4w9WgXcQ", title: "x", thumbnail_url: "https://img/capa.jpg" }, "u").thumbnail_url, "https://img/capa.jpg", "a chosen cover wins");
  assert.ok(LIBRARY_THEMES.every((theme) => libraryCategoriesOf({ category: "jogada", tags: [theme.tag] }).includes(theme.id)), "every theme lands on its own shelf");
  assert.equal(LIBRARY_TIERS[0].id, "player");
});

test("the button opens the sheet, and only for who manages the Library", async () => {
  const [page, sheet] = await Promise.all([read("../src/features/library/LibraryPage.jsx"), read("../src/features/library/AddMaterial.jsx")]);
  assert.match(page, /\{adding && canManage && <AddMaterial client=\{client\} profile=\{profile\} close=\{\(\) => setAdding\(false\)\} refresh=\{refresh\} \/>\}/);
  assert.match(page, /onClick=\{\(\) => setAdding\(true\)\}/);
  assert.match(sheet, /role="dialog" aria-modal="true" aria-labelledby="add-material-title"/);
  assert.match(sheet, /useDialog\(/, "Escape closes it and focus stays inside");
  assert.match(sheet, /client\.from\("library_items"\)\.insert\(row\)/);
  assert.match(sheet, /canManageLibrary\(profile\)/);
});
