import test from "node:test";
import assert from "node:assert/strict";
import {
  canAddManualMatch,
  canArchivePlayer,
  canChangeAccessTiers,
  canCreatePlayer,
  canEditLineup,
  canEditPlayerIdentity,
  canEditPlayerNumber,
  canEditPlayerPhoto,
  canHardDeletePlayer,
  canManageAgenda,
  canManageClubMatches,
  canManageCompetitions,
  canManageLibrary,
  canManageMedia,
  canSearchEa,
  canTrackLibrary,
  canUseDeveloperTools,
  canViewAnalysis,
  canViewMedia,
  canViewPage,
  locationForPage,
  normalizePageId,
  pageFromLocation,
  visibleNavItems,
} from "../src/access.js";
import { applyRosterWritePolicy } from "../src/features/squad/player-save.js";
import { commandItems } from "../src/command-palette.js";

const roles = {
  dev: { access_tier: "dev" },
  diretoria: { access_tier: "diretoria" },
  conselho: { access_tier: "conselho" },
  player: { access_tier: "player" },
  teste: { access_tier: "teste" },
};

test("tiers keep Discord weights and DEV is superuser", () => {
  assert.equal(canUseDeveloperTools(roles.dev), true);
  assert.equal(canViewMedia(roles.dev), true);
  assert.equal(canManageCompetitions(roles.dev), true);
  assert.equal(canHardDeletePlayer(roles.dev), true);
  assert.equal(canChangeAccessTiers(roles.dev), true);
  assert.equal(canEditPlayerPhoto(roles.dev), true);
  assert.equal(canEditPlayerNumber(roles.dev), true);
});

test("DIRETORIA sees the club and cannot open Mídia or Desenvolvedor", () => {
  const nav = visibleNavItems(roles.diretoria).map(([id]) => id);
  assert.deepEqual(nav, ["agenda", "partidas", "elenco", "campeonatos", "estatisticas", "analise", "biblioteca"]);
  assert.equal(canViewPage(roles.diretoria, "midia"), false);
  assert.equal(canViewPage(roles.diretoria, "desenvolvedor"), false);
  assert.equal(canViewPage(roles.diretoria, "analise"), true);
  assert.equal(canCreatePlayer(roles.diretoria), true);
  assert.equal(canArchivePlayer(roles.diretoria), true);
  assert.equal(canEditPlayerIdentity(roles.diretoria), true);
  assert.equal(canEditPlayerPhoto(roles.diretoria), false);
  assert.equal(canEditPlayerNumber(roles.diretoria), false);
  assert.equal(canHardDeletePlayer(roles.diretoria), false);
  assert.equal(canSearchEa(roles.diretoria), false);
  assert.equal(canAddManualMatch(roles.diretoria), false);
  assert.equal(canManageCompetitions(roles.diretoria), false);
  assert.equal(canManageAgenda(roles.diretoria), true);
  assert.equal(canEditLineup(roles.diretoria), true);
  assert.equal(canManageLibrary(roles.diretoria), true);
  assert.equal(canTrackLibrary(roles.diretoria), true);
  assert.equal(canManageMedia(roles.diretoria), false);
});

test("CONSELHO is read-only except Análise and Acompanhamento", () => {
  const nav = visibleNavItems(roles.conselho).map(([id]) => id);
  assert.ok(nav.includes("analise"));
  assert.equal(canTrackLibrary(roles.conselho), true);
  assert.equal(canCreatePlayer(roles.conselho), false);
  assert.equal(canArchivePlayer(roles.conselho), false);
  assert.equal(canEditPlayerIdentity(roles.conselho), false);
  assert.equal(canManageAgenda(roles.conselho), false);
  assert.equal(canEditLineup(roles.conselho), false);
  assert.equal(canManageLibrary(roles.conselho), false);
  assert.equal(canViewMedia(roles.conselho), false);
  assert.equal(canUseDeveloperTools(roles.conselho), false);
});

test("PLAYER and TESTE inherit the same product visibility this round", () => {
  for (const role of [roles.player, roles.teste]) {
    const nav = visibleNavItems(role).map(([id]) => id);
    assert.equal(nav.includes("analise"), false);
    assert.equal(canViewAnalysis(role), false);
    assert.equal(canTrackLibrary(role), false);
    assert.equal(canViewMedia(role), false);
    assert.equal(canCreatePlayer(role), false);
    assert.equal(canManageAgenda(role), false);
    assert.equal(canSearchEa(role), false);
    assert.ok(canViewPage(role, "estatisticas"));
    assert.ok(canViewPage(role, "biblioteca"));
    assert.ok(canViewPage(role, "elenco"));
  }
  assert.equal(canViewPage(roles.teste, "partidas"), true);
});

test("deep-link aliases resolve and restricted pages stay denied", () => {
  assert.equal(normalizePageId("media"), "midia");
  assert.equal(normalizePageId("dev"), "desenvolvedor");
  assert.equal(normalizePageId("analysis"), "analise");
  assert.equal(locationForPage("analise"), "/analise");
  assert.equal(pageFromLocation({ pathname: "/midia", hash: "" }), "midia");
  assert.equal(pageFromLocation({ pathname: "/", hash: "#/dev" }), "desenvolvedor");
  assert.equal(canViewPage(roles.player, "analise"), false);
  assert.equal(canViewPage(roles.diretoria, "media"), false);
  assert.equal(canViewPage(roles.dev, "dev"), true);
});

test("edit photo/number policy blocks Diretoria after create, not during create", () => {
  const existing = { id: "p1", avatar_path: "old.png", shirt_number: 10 };
  const applied = applyRosterWritePolicy(roles.diretoria, {
    id: "p1",
    display_name: "IGOR",
    avatar_path: "hack.png",
    shirt_number: 99,
  }, { existing, file: { name: "new.png" } });
  assert.equal(applied.file, null);
  assert.equal(applied.player.avatar_path, "old.png");
  assert.equal(applied.player.shirt_number, 10);
  const created = applyRosterWritePolicy(roles.diretoria, { display_name: "NOVO", shirt_number: 7 }, { file: { name: "foto.png" } });
  assert.equal(created.player.shirt_number, 7);
  assert.equal(created.file.name, "foto.png");
  assert.throws(() => applyRosterWritePolicy(roles.conselho, { display_name: "X" }), /permissão/);
});

test("Ctrl+K derives from ACL and drops stale Game Day / EA for Diretoria", () => {
  const diretoria = commandItems({ profile: roles.diretoria, workspace: { players: [{ id: "gone", display_name: "Arquivado", is_active: false }, { id: "on", display_name: "Ativo", is_active: true }] }, navigate: () => {} }).map((item) => item.id);
  assert.ok(diretoria.includes("action-agenda"));
  assert.ok(diretoria.includes("action-player"));
  assert.ok(diretoria.includes("action-library"));
  assert.ok(!diretoria.includes("action-ea"));
  assert.ok(!diretoria.includes("action-manual"));
  assert.ok(!diretoria.includes("action-gameday"));
  assert.ok(!diretoria.includes("action-media"));
  assert.ok(!diretoria.includes("action-dev"));
  assert.ok(!diretoria.includes("action-competition"));
  assert.ok(!diretoria.includes("page-midia"));
  assert.ok(!diretoria.includes("page-desenvolvedor"));
  assert.ok(diretoria.includes("page-analise"));
  assert.ok(diretoria.includes("player-on"));
  assert.ok(!diretoria.includes("player-gone"));

  const player = commandItems({ profile: roles.player, workspace: {}, navigate: () => {} }).map((item) => item.id);
  assert.ok(!player.includes("page-analise"));
  assert.ok(!player.includes("action-agenda"));
  assert.ok(!player.includes("action-library"));

  const dev = commandItems({ profile: roles.dev, workspace: {}, navigate: () => {} }).map((item) => item.id);
  assert.ok(dev.includes("action-ea"));
  assert.ok(dev.includes("action-media"));
  assert.ok(dev.includes("page-desenvolvedor"));
});

test("club match mutations stay DEV-only", () => {
  assert.equal(canManageClubMatches(roles.diretoria), false);
  assert.equal(canManageClubMatches(roles.dev), true);
});
