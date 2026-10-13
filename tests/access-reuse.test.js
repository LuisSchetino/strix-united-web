import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { authenticateDiscordMember } from "../functions/_lib/auth.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const env = {
  SUPABASE_URL: "https://db.example", SUPABASE_PUBLISHABLE_KEY: "pk", SUPABASE_SERVICE_ROLE_KEY: "service",
  DISCORD_GUILD_ID: "1", DISCORD_BOT_TOKEN: "bot", DISCORD_ROLE_TIER_MAP: JSON.stringify({ "role-dev": "dev", "role-teste": "teste" }),
};
const requestAs = (token) => new Request("https://strixunited.com.br/api/competitions/page?url=x", { headers: { authorization: `Bearer ${token}` } });

/** Discord and the database played by counters: how many times each was asked. */
function world({ roles = ["role-dev"], discordStatus = 200 } = {}) {
  const asked = { discord: 0, user: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (address.endsWith("/auth/v1/user")) { asked.user += 1; return new Response(JSON.stringify({ id: "user-1", identities: [{ provider: "discord", identity_data: { provider_id: "123456789012345678" } }] }), { status: 200 }); }
    if (address.includes("discord.com/api")) { asked.discord += 1; return discordStatus === 200 ? new Response(JSON.stringify({ roles, user: { username: "x" } }), { status: 200 }) : new Response("{}", { status: discordStatus }); }
    return new Response("", { status: 204 });
  };
  return { asked, restore: () => { globalThis.fetch = original; } };
}

test("reading a competition asks Discord about the member once, not once per page", async () => {
  const live = world();
  try {
    for (let page = 0; page < 14; page += 1) {
      const session = await authenticateDiscordMember(requestAs("token-a"), env, { reuseMs: 60_000 });
      assert.equal(session.tier, "dev");
    }
    assert.equal(live.asked.discord, 1, "fourteen pages, one question to Discord");
    assert.equal(live.asked.user, 1);
    // Another session is another question; the sign-in route never reuses an answer.
    await authenticateDiscordMember(requestAs("token-b"), env, { reuseMs: 60_000 });
    assert.equal(live.asked.discord, 2);
    await authenticateDiscordMember(requestAs("token-a"), env);
    assert.equal(live.asked.discord, 3, "without asking for reuse, Discord is always asked");
  } finally { live.restore(); }
});

test("a refusal or a Discord outage is never kept", async () => {
  const down = world({ discordStatus: 429 });
  try {
    const first = await authenticateDiscordMember(requestAs("token-c"), env, { reuseMs: 60_000 });
    assert.equal((await first.error.json()).error, "discord_lookup_unavailable");
    await authenticateDiscordMember(requestAs("token-c"), env, { reuseMs: 60_000 });
    assert.equal(down.asked.discord, 2, "a failed check is asked again");
  } finally { down.restore(); }
  const trial = world({ roles: ["role-teste"] });
  try {
    await authenticateDiscordMember(requestAs("token-d"), env, { reuseMs: 60_000 });
    const again = await authenticateDiscordMember(requestAs("token-d"), env, { reuseMs: 60_000 });
    assert.equal((await again.error.json()).error, "trial_access_closed");
    assert.equal(trial.asked.discord, 2);
  } finally { trial.restore(); }
});

test("only the page-by-page route reuses the answer, and its refusals are said in words", async () => {
  const [page, session, client] = await Promise.all([
    read("../functions/api/competitions/page.js"), read("../functions/api/auth/session.js"), read("../src/features/competitions/provider-client.js"),
  ]);
  assert.match(page, /authenticateDiscordMember\(request, env, \{ reuseMs: 60_000 \}\)/);
  assert.match(session, /authenticateDiscordMember\(request, env\);/, "signing in always asks Discord");
  assert.match(client, /discord_lookup_unavailable: "O Discord não respondeu à conferência de acesso agora\./);
});
