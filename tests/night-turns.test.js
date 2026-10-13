import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deriveCompetitionView } from "../src/features/competitions/competition-core.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const fixture = (id, opponent, at, extra = {}) => ({ id, edition_id: "e1", home_team_name: "STRIX UNITED", away_team_name: opponent, scheduled_at: at, status: "scheduled", round_label: `Rodada ${id}`, ...extra });

test("the next game is the earliest one, whatever order the source published them in", () => {
  // The source lists round 2 before round 1: the card used to show the 21:40 game and hide the 21:10 one.
  const fixtures = [
    fixture("2", "GORILLAS TEAM", "2026-10-05T21:40:00-03:00"),
    fixture("1", "Desagregados SC", "2026-10-05T21:10:00-03:00"),
    fixture("3", "EC SINTONIA", "2026-10-06T21:10:00-03:00"),
    { id: "x", edition_id: "e1", home_team_name: "Scout Team", away_team_name: "Roma", scheduled_at: "2026-10-05T20:00:00-03:00", status: "scheduled" },
  ];
  const view = deriveCompetitionView([], fixtures, { status: "active" });
  assert.equal(view.strixFixture.id, "1");
  assert.deepEqual(view.strixNightFixtures.map((item) => item.id), ["1", "2"], "both games of the night, in kick-off order; tomorrow's is not part of it");
});

test("a night with one game is one game; a played or cancelled one leaves the turn", () => {
  const one = deriveCompetitionView([], [fixture("1", "Desagregados SC", "2026-10-05T21:10:00-03:00")], { status: "active" });
  assert.deepEqual(one.strixNightFixtures.map((item) => item.id), ["1"]);

  const afterFirst = deriveCompetitionView([], [
    fixture("1", "Desagregados SC", "2026-10-05T21:10:00-03:00", { status: "completed", home_score: 2, away_score: 1 }),
    fixture("2", "GORILLAS TEAM", "2026-10-05T21:40:00-03:00"),
    fixture("4", "Cancelado", "2026-10-05T22:10:00-03:00", { status: "cancelled" }),
  ], { status: "active" });
  assert.deepEqual(afterFirst.strixNightFixtures.map((item) => item.id), ["2"]);

  const undated = deriveCompetitionView([], [fixture("9", "A definir", null), fixture("1", "Desagregados SC", "2026-10-05T21:10:00-03:00")], { status: "active" });
  assert.equal(undated.strixFixture.id, "1", "a game without a date never comes first");
  assert.deepEqual(deriveCompetitionView([], [], { status: "active" }).strixNightFixtures, []);
  assert.deepEqual(deriveCompetitionView([], [fixture("1", "Desagregados SC", "2026-10-05T21:10:00-03:00")], { status: "historical" }).strixNightFixtures, []);
});

test("the card takes turns by itself on one steady clock, never by itself with reduced motion, and can be picked", async () => {
  const [views, css] = await Promise.all([read("../src/features/competitions/competition-views.jsx"), read("../src/features/competitions/competition-page.css")]);
  assert.match(views, /const night = view\.strixNightFixtures\?\.length \? view\.strixNightFixtures : view\.strixFixture \? \[view\.strixFixture\] : \[\];/);
  assert.match(views, /const turning = count > 1 && !reduced;/);
  assert.doesNotMatch(views, /onPointerEnter|setPaused/, "a pointer resting on the card does not freeze it");
  assert.match(views, /window\.setInterval\(\(\) => \{\s*if \(document\.visibilityState === "visible"\) go\(\(current\.current \+ 1\) % count\);/, "one interval, read from a ref: a refresh of the page's data cannot restart or starve it");
  assert.match(views, /\}, \[turning, count, cycle\]\);/);
  assert.match(views, /aria-label=\{`Mostrar o jogo contra \$\{rivalOf\}/);
  assert.match(views, /onClick=\{\(\) => turns\.show\(index\)\}/);
  assert.match(css, /\.cx-next\.is-leaving/);
  assert.match(css, /\.cx-next\.has-turns \.faceoff-side\.is-home \{ animation: none; \}/, "Strix stays where it is while the opponent changes");
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.cx-next\.has-turns \*/);
});
