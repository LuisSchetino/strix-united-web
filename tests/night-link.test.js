import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isNightToken, nightDayOf, nightDays, nightPath, nightToken, nightWindow, parseNightPath, publicNight } from "../shared/night-link.js";
import { onRequestGet as publicNightRoute } from "../functions/api/public/night/[token].js";

const SECRET = "server-key-for-tests";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const lineup = (...names) => Array.from({ length: 11 }, (_, index) => names[index] || "");

test("the link of a night is derived from the day: stable today, another one tomorrow, unforgeable", async () => {
  const today = await nightToken(SECRET, "2026-10-05");
  assert.ok(isNightToken(today));
  assert.equal(today, await nightToken(SECRET, "2026-10-05"), "asking again gives the same link");
  assert.notEqual(today, await nightToken(SECRET, "2026-10-06"));
  assert.notEqual(today, await nightToken("another-key", "2026-10-05"));
  assert.equal(await nightToken("", "2026-10-05"), "");
  assert.equal(await nightToken(SECRET, "05/10/2026"), "");
  assert.equal(parseNightPath(nightPath(today)), today);
  assert.equal(parseNightPath("/noite/short"), "");
  assert.equal(parseNightPath(`/agenda/${today}`), "");
  assert.equal(parseNightPath(`/noite/${today}/extra`), "");
});

test("a link answers on its day and until the night ends, never after", async () => {
  const token = await nightToken(SECRET, "2026-10-05");
  assert.equal(await nightDayOf(SECRET, token, new Date("2026-10-05T18:40:00-03:00")), "2026-10-05");
  assert.equal(await nightDayOf(SECRET, token, new Date("2026-10-06T00:40:00-03:00")), "2026-10-05", "a game after midnight still belongs to the night");
  assert.equal(await nightDayOf(SECRET, token, new Date("2026-10-06T09:00:00-03:00")), "", "the morning after, the link is dead");
  assert.equal(await nightDayOf(SECRET, token, new Date("2026-10-04T22:00:00-03:00")), "", "and it never opens the day before");
  assert.equal(await nightDayOf(SECRET, "x".repeat(24), new Date("2026-10-05T18:40:00-03:00")), "");
  assert.deepEqual(nightDays(new Date("2026-10-05T18:40:00-03:00")), ["2026-10-05"]);
  assert.deepEqual(nightWindow("2026-10-05"), { from: "2026-10-05T03:00:00.000Z", to: "2026-10-06T03:00:00.000Z" });
});

test("the public night carries the day's games and only who is in a line-up; no line-up, no night", () => {
  const players = [
    { id: "p1", display_name: "Dornelas", positions: ["ZAG"], avatar_path: "players/a/d.png", is_active: true, member_type: "complete", shirt_number: 4 },
    { id: "p2", display_name: "Nunes", positions: ["ATA"], external_avatar_url: "https://cdn.example/n.png", is_active: true, member_type: "teste" },
    { id: "p3", display_name: "Fora da Noite", positions: ["GOL"], is_active: true },
  ];
  const agenda = [
    { id: "m2", opponent_name: "Scout Team", competition_name: "P11 - SEASON KICKOFF", scheduled_at: "2026-10-05T21:40:00-03:00", status: "scheduled", lineup: lineup(), opponent_team_id: "t1" },
    { id: "m1", opponent_name: "Desagregados SC", competition_name: "P11 - SEASON KICKOFF", scheduled_at: "2026-10-05T21:10:00-03:00", status: "scheduled", lineup: lineup("Nunes", "", "", "", "", "", "", "Dornelas"), opponent_logos: { storage_path: "opponents/x/d.png" } },
    { id: "m3", opponent_name: "Cancelado", scheduled_at: "2026-10-05T22:10:00-03:00", status: "cancelled", lineup: lineup("Nunes") },
    { id: "m4", opponent_name: "Amanhã", scheduled_at: "2026-10-06T21:10:00-03:00", status: "scheduled", lineup: lineup("Nunes") },
  ];
  const night = publicNight({ day: "2026-10-05", agenda, players, teams: [{ id: "t1", logo_url: "https://provider.example/scout.png" }], assetUrl: (path) => `https://assets/${path}` });
  assert.deepEqual(night.matches.map((match) => match.id), ["m1", "m2"], "in kick-off order, without the cancelled game or tomorrow's");
  assert.equal(night.matches[0].logo, "https://assets/opponents/x/d.png");
  assert.equal(night.matches[1].logo, "https://provider.example/scout.png", "a crest known only through the competition");
  assert.equal(night.matches[0].filled, 2);
  assert.equal(night.matches[1].filled, 0);
  assert.deepEqual(night.players.map((player) => player.display_name).sort(), ["Dornelas", "Nunes"]);
  assert.deepEqual(Object.keys(night.players[0]).sort(), ["display_name", "photo", "positions", "test"], "nothing else about a player leaves the site");
  assert.equal(night.players.find((player) => player.display_name === "Dornelas").photo, "https://assets/players/a/d.png");

  const cleared = agenda.map((match) => ({ ...match, lineup: lineup() }));
  assert.equal(publicNight({ day: "2026-10-05", agenda: cleared, players }), null, "clearing every line-up kills the link");
  assert.equal(publicNight({ day: "2026-10-07", agenda, players }), null);
});

test("the public route says the same thing for a wrong, old or emptied link, and needs no session", async () => {
  const env = { SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: SECRET };
  const request = new Request("https://strixunited.com.br/api/public/night/x");
  const wrong = await publicNightRoute({ request, env, params: { token: "x".repeat(24) } });
  assert.equal(wrong.status, 404);
  assert.equal((await wrong.json()).error, "night_link_inactive");
  const unconfigured = await publicNightRoute({ request, env: {}, params: { token: "x".repeat(24) } });
  assert.equal(unconfigured.status, 503);

  const [route, link, main, robots] = await Promise.all([
    read("../functions/api/public/night/[token].js"), read("../functions/api/night-link.js"), read("../src/main.jsx"), read("../public/robots.txt"),
  ]);
  assert.doesNotMatch(route, /authenticateDiscordMember/);
  assert.match(link, /requireTier\(session, "diretoria"\)/, "only who builds the night gets the link");
  assert.match(main, /if \(nightToken\) return <PublicNight token=\{nightToken\} \/>;/);
  assert.ok(main.indexOf("if (launchDecision !== \"app\")") < main.indexOf("if (nightToken) return <PublicNight"), "the Launch Gate stays in front of the public page");
  assert.match(robots, /Disallow: \/noite\//);
});
