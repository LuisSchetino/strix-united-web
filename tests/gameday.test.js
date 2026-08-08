import test from "node:test";
import assert from "node:assert/strict";
import { canManageGameDay, createDefaultProject, safeFileName } from "../src/gameday/defaults.js";

test("projeto Game Day nasce pronto para Story e Feed sem perder vinculos", () => {
  const project = createDefaultProject();
  assert.equal(project.templateId, "strix-collage-2026");
  assert.equal(project.opponentName, "ADVERSÁRIO");
  assert.equal(project.players.length, 3);
  assert.equal(project.groupTeams.length, 4);
  assert.ok(project.createdAt);
});

test("Game Day respeita a permissao de Diretoria e Dev", () => {
  assert.equal(canManageGameDay({ access_tier: "diretoria" }), true);
  assert.equal(canManageGameDay({ access_tier: "dev" }), true);
  assert.equal(canManageGameDay({ access_tier: "conselho" }), false);
});

test("nomes de assets ficam seguros e previsiveis", () => {
  assert.equal(safeFileName("Camisa São João 01.PNG"), "camisa-sao-joao-01.png");
});
