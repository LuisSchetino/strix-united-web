import test from "node:test";
import assert from "node:assert/strict";
import { activeLegacyRoster, normalizeLegacyName, previewLegacyReconciliation } from "../shared/legacy-reconcile.js";

test("fonte FC26 filtra teste expirado sem hardcode de elenco", () => {
  const source = [
    { n: "JOÃO", ri: 2, status: "ATIVO" },
    { n: "PERDUGAS", ri: 23, status: "COMPLETE", expiresAt: "2027-07-25" },
    { n: "POSTURA", ri: 32, status: "TESTE", expiresAt: "2026-08-01" },
  ];
  const active = activeLegacyRoster(source, new Date("2026-08-17T00:00:00Z"));
  assert.deepEqual(active.map((row) => row.n), ["JOÃO", "PERDUGAS"]);
  assert.equal(normalizeLegacyName("  João  "), "joao");
});

test("prévia é idempotente por ordem/nome e marca extras FC26 para inativação", () => {
  const source = [{ n: "JOÃO", ri: 2, status: "ATIVO" }, { n: "YGO", ri: 3, status: "ATIVO" }];
  const current = [
    { id: "target", source_system: "fc26", source_order: 2, display_name: "Nome customizado", is_active: true },
    { id: "name-target", source_system: "fc26", source_order: 99, display_name: "ygo", is_active: true },
    { id: "extra", source_system: "fc26", source_order: 4, display_name: "EXTRA", is_active: true },
  ];
  const preview = previewLegacyReconciliation(source, current, new Date("2026-08-17T00:00:00Z"));
  assert.deepEqual(preview.active.map((item) => item.action), ["merge", "merge"]);
  assert.deepEqual(preview.deactivate.map((player) => player.id), ["extra"]);
});
