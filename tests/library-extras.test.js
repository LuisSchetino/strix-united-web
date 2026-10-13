import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LIBRARY_POSITIONS, normalizeFocus, saveLibraryExtras } from "../src/features/library/library-core.js";

test("the focus keeps only real positions, in the roster's order", () => {
  assert.deepEqual(normalizeFocus(["ata", "ZAG", "xyz", "ZAG"]), ["ZAG", "ATA"]);
  assert.deepEqual(normalizeFocus(null), []);
  assert.ok(LIBRARY_POSITIONS.includes("GOL"));
});

const client = (answer) => {
  const calls = [];
  return {
    calls,
    from: (table) => ({
      update: (patch) => ({ eq: (column, value) => ({ select: async () => { calls.push({ table, patch, column, value }); return answer; } }) }),
    }),
  };
};
const director = { user_id: "u1", access_tier: "diretoria" };

test("saving who a material is for writes only that, by whoever manages the Library", async () => {
  const api = client({ data: [{ id: "l1", focus_positions: ["GOL", "ATA"] }], error: null });
  const saved = await saveLibraryExtras(api, director, { id: "l1" }, { focus: ["ata", "gol"] });
  assert.deepEqual(api.calls[0].patch, { updated_by: "u1", focus_positions: ["GOL", "ATA"] });
  assert.equal(api.calls[0].value, "l1");
  assert.deepEqual(saved.focus_positions, ["GOL", "ATA"]);
  await assert.rejects(() => saveLibraryExtras(api, { user_id: "u2", access_tier: "player" }, { id: "l1" }, { focus: [] }), /permissão/);
});

test("before the migration the database says the column is missing and that is said plainly", async () => {
  const api = client({ data: null, error: { code: "PGRST204", message: "Could not find the 'focus_positions' column of 'library_items' in the schema cache" } });
  await assert.rejects(() => saveLibraryExtras(api, director, { id: "l1" }, { focus: ["ZAG"] }), /migration/);
  const other = client({ data: null, error: { code: "42501", message: "permission denied for table library_items" } });
  await assert.rejects(() => saveLibraryExtras(other, director, { id: "l1" }, { focus: [] }), (cause) => /permission denied/.test(cause.message), "any other failure is passed on as it came");
});

test("the Library has no marked moments, the Central has no library or marks block, and media is generated only in Mídia", async () => {
  const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
  const [page, home, matches, list] = await Promise.all([
    read("../src/features/library/LibraryPage.jsx"), read("../src/features/home/HomePage.jsx"),
    read("../src/features/matches/MatchesPage.jsx"), read("../src/features/agenda/NightRelatedEditor.jsx"),
  ]);
  assert.doesNotMatch(page, /library-markers|Marcar este momento/);
  assert.match(page, /Link em \$\{timeLabel\(second\)\}/, "the link at the minute on screen stays");
  assert.doesNotMatch(home, /LibraryBlock|Marcos da semana|Gerar vídeo/);
  assert.doesNotMatch(matches, /GERAR VÍDEO/);
  assert.doesNotMatch(list, /RODÍZIO|rotation/);
});
