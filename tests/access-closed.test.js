import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { authenticateDiscordMember } from "../functions/_lib/auth.js";
import { classifyAuthFailure } from "../src/ui/special-state/classify-auth-failure.js";
import { LIBRARY_TIERS, materialRow } from "../src/features/library/library-core.js";
import { lineupDiff } from "../src/features/agenda/lineup-diff.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const env = {
  SUPABASE_URL: "https://db.example", SUPABASE_PUBLISHABLE_KEY: "pk", SUPABASE_SERVICE_ROLE_KEY: "service",
  DISCORD_GUILD_ID: "1", DISCORD_BOT_TOKEN: "bot",
  DISCORD_ROLE_TIER_MAP: JSON.stringify({ "role-teste": "teste", "role-player": "player", "role-dir": "diretoria" }),
};
const request = new Request("https://strixunited.com.br/api/auth/session", { headers: { authorization: "Bearer token" } });

/** Runs the server's check with Discord and the database played by a table of answers. */
async function check({ roles = [], inServer = true } = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const address = String(url);
    calls.push({ url: address, method: init.method || "GET", body: init.body || "" });
    if (address.endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "user-1", identities: [{ provider: "discord", identity_data: { provider_id: "123456789012345678" } }] }), { status: 200 });
    }
    if (address.includes("discord.com/api")) {
      return inServer ? new Response(JSON.stringify({ roles, user: { username: "x" } }), { status: 200 }) : new Response("{}", { status: 404 });
    }
    return new Response("", { status: 204 });
  };
  try {
    const result = await authenticateDiscordMember(request, env);
    return { result, calls, closed: calls.filter((call) => call.method === "PATCH" && call.url.includes("/rest/v1/team_members?user_id=eq.user-1")) };
  } finally {
    globalThis.fetch = original;
  }
}

test("a player on trial does not enter the site, and the refusal says so", async () => {
  const trial = await check({ roles: ["role-teste"] });
  assert.equal(trial.result.error.status, 403);
  assert.equal((await trial.result.error.json()).error, "trial_access_closed");
  assert.equal(trial.closed.length, 1, "the database row is closed too");
  assert.match(trial.closed[0].body, /"is_active":false/);

  const promoted = await check({ roles: ["role-teste", "role-player"] });
  assert.equal(promoted.result.tier, "player", "with the player role the same person enters");
  assert.equal(promoted.closed.length, 0);
  assert.equal((await check({ roles: ["role-dir"] })).result.tier, "diretoria");
});

test("whoever the site refuses loses the database row it would still be trusted by", async () => {
  const outsider = await check({ inServer: false });
  assert.equal((await outsider.result.error.json()).error, "not_in_team_server");
  assert.equal(outsider.closed.length, 1);
  const noRole = await check({ roles: ["some-other-role"] });
  assert.equal((await noRole.result.error.json()).error, "discord_role_unmapped");
  assert.equal(noRole.closed.length, 1);
});

test("the refusal is shown in words and is not mistaken for an expired session", async () => {
  assert.equal(classifyAuthFailure({ message: "trial_access_closed", status: 403 }, { hadSession: true }), "");
  const main = await read("../src/main.jsx");
  assert.match(main, /trial_access_closed: "Jogadores em teste ainda não têm acesso ao site\./);
  assert.match(main, /\{message \|\| LOGIN_REFUSALS\[error\] \|\| error\}/);
});

test("nothing is offered to players on trial any more", () => {
  assert.equal(LIBRARY_TIERS.some((tier) => tier.id === "teste"), false);
  assert.equal(materialRow({ source_url: "https://youtu.be/dQw4w9WgXcQ", title: "x", minimum_access_tier: "teste" }, "u").minimum_access_tier, "player");
});

test("reading the club's tables requires a member's row, not just any signed-in account", async () => {
  const sql = await read("../supabase/migrations/20261005230000_fc27_members_only_reads.sql");
  for (const table of ["agenda_matches", "club_matches", "club_match_players", "club_players", "club_player_aliases", "competitions", "opponent_logos", "night_related"]) {
    assert.match(sql, new RegExp(`\\('${table}', '[^']+'\\)`), `${table} is closed to non-members`);
  }
  assert.match(sql, /using \(\(select private\.has_minimum_tier\(''player''\)\)\)/);
  assert.match(sql, /select private\.has_minimum_tier\('player'\) and exists/, "competition tables too");
  assert.match(sql, /set is_active = false\s+where access_tier = 'teste' and is_active/);
  assert.doesNotMatch(sql, /drop table|drop column|delete from|truncate/i, "no club data is removed");
});

test("a line-up change is read as who came in, who left and who moved", () => {
  // ATA ATA ALA MC MC ALA VOL ZAG ZAG ZAG GOL
  const before = ["Vini", "Santozz", "Guita", "Bitten", "Felipe", "Nunes", "Rangel", "Dornellas", "GB", "Serol", "Obeen"];
  const after = ["Yuri", "Santozz", "Guita", "Nunes", "Felipe", "", "Rangel", "Dornellas", "Serol", "GB", "Obeen"];
  const diff = lineupDiff(before, after);
  assert.deepEqual(diff.swaps, [{ position: "ATA", in: "Yuri", out: "Vini" }], "Yuri took the place Vini held");
  assert.deepEqual(diff.left, [{ position: "MC", name: "Bitten" }], "Bitten went out and nobody new took that place");
  assert.deepEqual(diff.moved, [{ name: "Nunes", from: "ALA", to: "MC" }]);
  assert.deepEqual(diff.entered, []);
  assert.deepEqual([diff.filledBefore, diff.filledAfter, diff.changed], [11, 10, true]);

  const filled = lineupDiff(["", "", "", "", "", "", "", "", "", "", ""], ["Yuri", "", "", "", "", "", "", "", "", "", "Obeen"]);
  assert.deepEqual(filled.entered, [{ position: "ATA", name: "Yuri" }, { position: "GOL", name: "Obeen" }]);
  assert.equal(lineupDiff(before, before).changed, false);
  assert.equal(lineupDiff(before, before.map((name) => name.toUpperCase())).changed, false, "the same player written in capitals is the same player");
  assert.equal(lineupDiff(null, undefined).changed, false);
});

test("the history opens a line that kept what changed", async () => {
  const list = await read("../src/ui/ActivityList.jsx");
  assert.match(list, /aria-expanded=\{open\}/);
  assert.match(list, /row\.action === "lineup_changed"/);
  assert.match(list, /<LineupChange before=\{row\.details\.before\} after=\{row\.details\.after\} \/>/);
  assert.match(list, /<KickoffChange before=\{row\.details\.before\} after=\{row\.details\.after\} \/>/);
  const css = await read("../src/ui/activity-list.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
});
