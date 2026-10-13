import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deepLinkPath, parseDeepLink, parseTimeParam, shareUrl, timeLabel } from "../src/deep-link.js";
import { SHARE_BANNER, describePreview, injectPreview, isPreviewBot, libraryBannerPath, previewQuery, youtubeId } from "../shared/link-preview.js";
import { serveLinkPreview } from "../functions/_lib/link-preview.js";

const ID = "3f0b6c1e-8a57-4c1d-9d35-0f6a2b7c9e11";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("an address names one item of a page, and a library link may name a minute", () => {
  assert.deepEqual(parseDeepLink({ pathname: `/biblioteca/${ID}`, search: "?t=83" }), { page: "biblioteca", id: ID, params: { t: 83 } });
  assert.deepEqual(parseDeepLink({ pathname: `/agenda/${ID}`, search: "?t=83" }), { page: "agenda", id: ID, params: {} });
  assert.equal(parseDeepLink({ pathname: "/agenda" }), null);
  assert.equal(parseDeepLink({ pathname: "/midia/abc" }), null, "pages without items have no direct link");
  assert.equal(parseDeepLink({ pathname: "/agenda/a b" }), null);
  assert.equal(parseDeepLink({ pathname: "/agenda/%E0%A4%A" }), null);
  assert.equal(deepLinkPath("biblioteca", ID, { t: 83 }), `/biblioteca/${ID}?t=83`);
  assert.equal(deepLinkPath("agenda", ID, { t: 83 }), `/agenda/${ID}`);
  assert.equal(deepLinkPath("agenda", ""), "/agenda");
  assert.equal(deepLinkPath("midia", ID), "/midia");
  assert.equal(shareUrl("https://strixunited.com.br/", "elenco", ID), `https://strixunited.com.br/elenco/${ID}`);
});

test("the minute of a link reads the forms people paste", () => {
  assert.equal(parseTimeParam("83"), 83);
  assert.equal(parseTimeParam("1m23s"), 83);
  assert.equal(parseTimeParam("1:23"), 83);
  assert.equal(parseTimeParam("1:02:03"), 3723);
  assert.equal(parseTimeParam("2h"), 7200);
  assert.equal(parseTimeParam("abc"), 0);
  assert.equal(parseTimeParam("-5"), 0);
  assert.equal(parseTimeParam("999999"), 0);
  assert.equal(timeLabel(83), "1:23");
  assert.equal(timeLabel(3723), "1:02:03");
});

test("chat apps get a card, people get the app", () => {
  assert.equal(isPreviewBot("WhatsApp/2.23.20.0"), true);
  assert.equal(isPreviewBot("facebookexternalhit/1.1"), true);
  assert.equal(isPreviewBot("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"), true);
  assert.equal(isPreviewBot("TelegramBot (like TwitterBot)"), true);
  assert.equal(isPreviewBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"), false);
  assert.equal(isPreviewBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), false);
  assert.equal(isPreviewBot(""), false);
});

test("a material's card carries its title, its kind, the minute and its image", () => {
  const target = { page: "biblioteca", id: ID, params: { t: 83 } };
  const row = { id: ID, title: "Saída de bola pelo lado", category: "jogada", description: "Triangulação com o volante.", thumbnail_url: "", source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", status: "active" };
  const card = describePreview(target, row, { origin: "https://strixunited.com.br" });
  assert.equal(card.title, "Saída de bola pelo lado");
  assert.equal(card.description, "Jogada · Começa em 1:23 · Triangulação com o volante.");
  assert.equal(card.image, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  assert.equal(describePreview(target, { ...row, thumbnail_url: "https://cdn.example/capa.jpg" }, {}).image, "https://cdn.example/capa.jpg");
  assert.equal(describePreview(target, row, { banner: "https://x.supabase.co/banner.jpg" }).image, "https://x.supabase.co/banner.jpg", "a published banner wins");
  const archived = describePreview(target, { ...row, status: "archived" }, { origin: "https://strixunited.com.br" });
  assert.equal(archived.title, "Biblioteca do Strix United", "an archived material is not named");
  assert.equal(archived.image, `https://strixunited.com.br${SHARE_BANNER}`);
  const reserved = describePreview(target, { ...row, minimum_access_tier: "diretoria" }, { origin: "https://strixunited.com.br", banner: "https://x.supabase.co/banner.jpg" });
  assert.equal(reserved.title, "Biblioteca do Strix United", "a material reserved for a higher tier is not named to whoever holds the link");
  assert.equal(reserved.image, `https://strixunited.com.br${SHARE_BANNER}`);
  assert.equal(describePreview(target, { ...row, minimum_access_tier: "player" }, {}).title, "Saída de bola pelo lado");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=3"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://drive.google.com/file/d/abc/view"), "");
  assert.equal(libraryBannerPath(ID), `library/share/v2/${ID}.jpg`);
});

test("matches, results, players and competitions say what they are; unknown rows say only the area", () => {
  const origin = "https://strixunited.com.br";
  const match = describePreview({ page: "agenda", id: ID, params: {} }, { opponent_name: "Desagregados SC", competition_name: "P11 - SEASON KICKOFF", scheduled_at: "2026-10-06T00:10:00Z", status: "scheduled" }, { origin });
  assert.equal(match.title, "Strix United × Desagregados SC");
  assert.match(match.description, /seg 05\/10 às 21:10 · P11 - SEASON KICKOFF/);
  const result = describePreview({ page: "partidas", id: ID, params: {} }, { opponent_name: "Maquina FC", competition_name: "Copa Yeshua", strix_score: 3, opponent_score: 0, played_at: "2026-10-05T01:10:00Z" }, { origin });
  assert.equal(result.title, "Strix United 3 × 0 Maquina FC");
  assert.match(result.description, /^Resultado · Copa Yeshua · /);
  const player = describePreview({ page: "elenco", id: ID, params: {} }, { display_name: "Dornellas", positions: ["ZAG", "VOL"], shirt_number: 4, is_active: true }, { origin });
  assert.equal(player.title, "Dornellas · Strix United");
  assert.equal(player.description, "ZAG · VOL · #04 · Elenco FC27");
  assert.equal(describePreview({ page: "elenco", id: ID, params: {} }, { display_name: "Saiu", is_active: false }, { origin }).title, "Elenco do Strix United");
  const competition = describePreview({ page: "campeonatos", id: ID, params: {} }, { label: "2026 · Edição atual", competitions: { name: "P11 - SEASON KICKOFF", organization: "CCB Clubs" } }, { origin });
  assert.equal(competition.title, "P11 - SEASON KICKOFF");
  assert.equal(competition.description, "Campanha do Strix United · 2026 · Edição atual · CCB Clubs");
  const unknown = describePreview({ page: "agenda", id: ID, params: {} }, null, { origin });
  assert.equal(unknown.title, "Agenda do Strix United");
  assert.equal(unknown.image, `${origin}${SHARE_BANNER}`);
  assert.equal(previewQuery({ page: "agenda", id: "not-a-uuid" }), null, "only real row ids are read");
  assert.equal(previewQuery({ page: "biblioteca", id: ID }).table, "library_items");
});

test("the card replaces the page's own head tags and escapes what it writes", async () => {
  const html = await read("../index.html");
  const out = injectPreview(html, { title: 'Jogada "A" <1>', description: "Texto & tal", image: "https://strixunited.com.br/x.jpg", url: `https://strixunited.com.br/biblioteca/${ID}` });
  assert.equal((out.match(/<title>/g) || []).length, 1);
  assert.equal((out.match(/property="og:title"/g) || []).length, 1);
  assert.equal((out.match(/property="og:image"/g) || []).length, 1);
  assert.equal((out.match(/name="description"/g) || []).length, 1);
  assert.match(out, /<title>Jogada &quot;A&quot; &lt;1&gt;<\/title>/);
  assert.match(out, /content="Texto &amp; tal"/);
  assert.doesNotMatch(out, /rel="canonical"/);
  assert.match(out, /<div id="root"><\/div>/, "the app itself is untouched");
  assert.match(out, /rel="manifest"/);
});

test("the site's own card uses the banner on the official address", async () => {
  const html = await read("../index.html");
  assert.match(html, /property="og:image" content="https:\/\/strixunited\.com\.br\/brand\/strix\/strix-united-fc27-share\.jpg"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /rel="canonical" href="https:\/\/strixunited\.com\.br\/"/);
  const routes = JSON.parse(await read("../public/_routes.json"));
  for (const page of ["agenda", "partidas", "elenco", "campeonatos", "biblioteca"]) assert.ok(routes.include.includes(`/${page}/*`));
  const manifest = JSON.parse(await read("../public/manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable" && icon.sizes === "512x512"));
});

const PAGE = '<!doctype html><html><head><title>Strix United | FC 27</title><meta property="og:title" content="Strix United | FC27" /></head><body><div id="root"></div></body></html>';
const context = ({ agent, path, rows = [], banner = false }) => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/storage/v1/object/public/")) return new Response(null, { status: banner ? 200 : 404 });
    return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
  };
  return {
    calls,
    restore: () => { globalThis.fetch = original; },
    context: {
      request: new Request(`https://strixunited.com.br${path}`, { headers: { "user-agent": agent } }),
      env: { SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: "service", ASSETS: { fetch: async () => new Response(PAGE, { headers: { "content-type": "text/html" } }) } },
      next: async () => new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } }),
    },
  };
};

test("a person opening a direct link gets the app untouched and no database read", async () => {
  const run = context({ agent: "Mozilla/5.0 Chrome/140.0", path: `/biblioteca/${ID}` });
  try {
    const response = await serveLinkPreview(run.context);
    assert.equal(await response.text(), PAGE);
    assert.equal(run.calls.length, 0);
  } finally { run.restore(); }
});

test("a chat app gets the item's card; a missing row or a failure still serves the page", async () => {
  const run = context({ agent: "WhatsApp/2.23", path: `/biblioteca/${ID}?t=83`, rows: [{ id: ID, title: "Escanteio curto", category: "jogada", description: "", thumbnail_url: "", source_url: "https://youtu.be/dQw4w9WgXcQ", status: "active" }], banner: true });
  try {
    const response = await serveLinkPreview(run.context);
    const html = await response.text();
    assert.match(html, /<title>Escanteio curto<\/title>/);
    assert.match(html, /content="Jogada · Começa em 1:23"/);
    assert.match(html, new RegExp(`og:image" content="https://db.example/storage/v1/object/public/fc27-team-assets/library/share/v2/${ID}.jpg"`));
    assert.match(html, new RegExp(`og:url" content="https://strixunited.com.br/biblioteca/${ID}\\?t=83"`));
    assert.match(run.calls[0], /library_items\?id=eq\./);
  } finally { run.restore(); }

  const empty = context({ agent: "WhatsApp/2.23", path: `/agenda/${ID}`, rows: [] });
  try {
    const html = await (await serveLinkPreview(empty.context)).text();
    assert.match(html, /<title>Agenda do Strix United<\/title>/);
  } finally { empty.restore(); }

  const broken = context({ agent: "WhatsApp/2.23", path: `/agenda/${ID}` });
  broken.restore();
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    const html = await (await serveLinkPreview(broken.context)).text();
    assert.match(html, /<title>Agenda do Strix United<\/title>/, "the read failed: the card names the area");
  } finally { globalThis.fetch = original; }
});
