import test from "node:test";
import assert from "node:assert/strict";
import { describeEaArchetype, officialArchetypes, verifiedEaArchetypeIdMap } from "../src/features/statistics/ea-archetypes.js";

test("catálogo oficial não implica mapeamento numérico não verificado nem símbolo inventado", () => {
  assert.equal(Object.keys(officialArchetypes).length, 13);
  assert.deepEqual(verifiedEaArchetypeIdMap, {});
  assert.deepEqual(describeEaArchetype(12), { id: "12", name: "ARQUÉTIPO 12", specialties: [], verified: false, symbol: null });
});
