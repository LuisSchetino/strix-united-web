import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("robots.txt blocks sensitive paths without treating crawler rules as security", async () => {
  const [robots, sitemap] = await Promise.all([
    read("../public/robots.txt"),
    read("../public/sitemap.xml"),
  ]);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/desenvolvedor/);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Disallow: \/midia/);
  assert.match(robots, /Disallow: \/internal/);
  assert.match(robots, /crawler hint, not access control/);
  assert.doesNotMatch(robots, /Disallow: \/agenda/);
  assert.match(robots, /Sitemap: https:\/\/strixunited\.com\.br\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/strixunited\.com\.br\//);
  assert.doesNotMatch(sitemap, /\/desenvolvedor|\/api\//);
});

test("frontend and public assets do not ship service-role or bot secrets", async () => {
  const files = [
    "../src/main.jsx",
    "../src/launch.js",
    "../functions/api/public-config.js",
    "../src/features/launch/LaunchGate.jsx",
    "../index.html",
  ];
  const texts = await Promise.all(files.map(read));
  const joined = texts.join("\n");
  assert.doesNotMatch(joined, /SERVICE_ROLE/);
  assert.doesNotMatch(joined, /DISCORD_BOT_TOKEN/);
  assert.doesNotMatch(joined, /FC27_SYNC_SECRET/);
  assert.doesNotMatch(joined, /EA_SYNC_API_TOKEN/);
  assert.match(texts[1], /VITE_LAUNCH_AT/);
  assert.match(texts[2], /publishableKey: env\.SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(texts[2], /SERVICE_ROLE/);

  const publicRoot = new URL("../public/", import.meta.url);
  const names = await readdir(publicRoot);
  assert.ok(!names.some((name) => name.startsWith(".env")));
  const robots = await read("../public/robots.txt");
  assert.doesNotMatch(robots, /eyJ|sk-|service_role/i);
});
