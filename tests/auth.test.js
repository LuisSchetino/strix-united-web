import test from "node:test";
import assert from "node:assert/strict";
import { requireTier, roleTier } from "../functions/_lib/auth.js";

test("Discord usa sempre o cargo de maior acesso mapeado", () => {
  assert.equal(roleTier(["player-role", "board-role"], {
    "player-role": "player",
    "board-role": "diretoria",
  }), "diretoria");
});

test("cargo desconhecido nao concede acesso", () => {
  assert.equal(roleTier(["unknown"], { "player-role": "player" }), "");
});

test("matriz de niveis preserva a hierarquia FC27", () => {
  assert.equal(requireTier({ tier: "dev" }, "dev"), true);
  assert.equal(requireTier({ tier: "diretoria" }, "conselho"), true);
  assert.equal(requireTier({ tier: "conselho" }, "diretoria"), false);
  assert.equal(requireTier({ tier: "player" }, "conselho"), false);
  assert.equal(requireTier({ tier: "teste" }, "player"), false);
});
