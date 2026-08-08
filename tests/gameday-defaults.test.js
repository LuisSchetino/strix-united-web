import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProject, hydrateGameDayProject } from "../src/gameday/defaults.js";

test("Game Day mantém os modos e hidrata projetos anteriores", () => {
  const project = createDefaultProject();
  assert.equal(project.mode, "group");
  assert.equal(project.elements.dailyGames.id, "daily-games");
  assert.equal(project.elements.stamp.id, "stamp");
  assert.equal(project.players.length, 0);

  const legacy = hydrateGameDayProject({ championshipName: "Liga", championshipLogo: "/liga.png" });
  assert.equal(legacy.competitionLogos.length, 1);
  assert.equal(legacy.competitionLogos[0].url, "/liga.png");
  assert.equal(legacy.mode, "group");

  const legacyWithPlayer = hydrateGameDayProject({ players: [{ id: "player-main", role: "main", activeUrl: "/legacy.png" }] });
  assert.equal(legacyWithPlayer.players.length, 1);
  assert.equal(legacyWithPlayer.players[0].activeUrl, "/legacy.png");
});

test("Game Day limita agenda e logos aos limites visuais", () => {
  const many = Array.from({ length: 8 }, (_, index) => ({ id: String(index) }));
  const project = hydrateGameDayProject({ mode: "agenda", dailyGames: many, competitionLogos: many });
  assert.equal(project.mode, "agenda");
  assert.equal(project.dailyGames.length, 6);
  assert.equal(project.competitionLogos.length, 5);
});
