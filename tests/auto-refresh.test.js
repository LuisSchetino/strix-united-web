import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { STALE_MINUTES, STALE_MINUTES_NEAR_GAME, dueSources } from "../src/features/competitions/auto-refresh-core.js";
import { finishTour, resetTour, shouldShowTour, tourCardPosition, tourSteps } from "../src/features/onboarding/tour-core.js";
import { nightChecklist } from "../src/features/home/home-core.js";

const NOW = new Date("2026-10-04T23:20:00Z");
const minutesAgo = (minutes) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

test("a competition is read again when its last reading is old, sooner when a Strix game is near", () => {
  const editions = [{ id: "e1", status: "active" }, { id: "e2", status: "active" }, { id: "e3", status: "historical" }, { id: "e4", status: "active" }];
  const sources = [
    { id: "s1", edition_id: "e1", source_kind: "standings", source_url: "https://clubs.example/a", last_synced_at: minutesAgo(20) },
    { id: "s2", edition_id: "e2", source_kind: "standings", source_url: "https://clubs.example/b", last_synced_at: minutesAgo(70) },
    { id: "s2k", edition_id: "e2", source_kind: "knockout", source_url: "https://clubs.example/bk", last_synced_at: minutesAgo(500) },
    { id: "s3", edition_id: "e3", source_kind: "standings", source_url: "https://clubs.example/c", last_synced_at: minutesAgo(9000) },
    { id: "s4", edition_id: "e4", source_kind: "standings", source_url: "", last_synced_at: null },
  ];
  const fixtures = [{ edition_id: "e1", home_team_name: "Strix United", away_team_name: "Rival", status: "scheduled", scheduled_at: new Date(NOW.getTime() + 3 * 3_600_000).toISOString() }];
  const due = dueSources({ sources, editions, fixtures, now: NOW });
  // e1 has a game in three hours: 20 minutes is already old for it. e2 is past the hour. e3 is history, e4 has no address.
  assert.deepEqual(due.map((item) => [item.source.id, item.near]), [["s2", false], ["s1", true]]);
  assert.ok(STALE_MINUTES > STALE_MINUTES_NEAR_GAME);
  assert.deepEqual(dueSources({ sources, editions, fixtures: [], now: NOW }).map((item) => item.source.id), ["s2"], "without a near game e1 waits its hour");
  const attempted = new Map([["s2", NOW.getTime() - 60_000], ["s1", NOW.getTime() - 60_000]]);
  assert.deepEqual(dueSources({ sources, editions, fixtures, now: NOW, attempted }), [], "an attempt just made is not repeated");
  // The server stamps last_checked_at before it reads anything: only a saved reading counts.
  const stamped = [{ id: "s9", edition_id: "e2", source_kind: "standings", source_url: "https://clubs.example/z", last_synced_at: minutesAgo(300), last_checked_at: minutesAgo(2) }];
  assert.deepEqual(dueSources({ sources: stamped, editions, fixtures: [], now: NOW }).map((item) => item.source.id), ["s9"]);
  assert.deepEqual(dueSources({}), []);
});

test("the first-visit walk has four steps and is taken once per member on a device", () => {
  const steps = tourSteps({ firstName: "Dornellas" });
  assert.deepEqual(steps.map((step) => step.id), ["central", "agenda", "biblioteca", "avisos"]);
  assert.equal(steps[0].title, "Bem-vindo, Dornellas.");
  assert.equal(tourSteps()[0].title, "Bem-vindo ao Strix.");
  for (const step of steps) assert.ok(step.targets.length >= 1 && step.text.length > 20);
  const data = new Map();
  const storage = { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  assert.equal(shouldShowTour(storage, "u1"), true);
  finishTour(storage, "u1");
  assert.equal(shouldShowTour(storage, "u1"), false);
  assert.equal(shouldShowTour(storage, "u2"), true, "another member on the same device still sees it");
  resetTour(storage, "u1");
  assert.equal(shouldShowTour(storage, "u1"), true);
  assert.equal(shouldShowTour(storage, ""), false);
  assert.equal(shouldShowTour({ getItem: () => { throw new Error("blocked"); } }, "u1"), false, "a blocked storage never traps the member in the walk");
});

test("the walk's card stays on screen next to the control it explains", () => {
  const desktop = { width: 1375, height: 900 };
  const card = { width: 340, height: 220 };
  const nav = { left: 12, top: 107, right: 235, bottom: 147, width: 223, height: 40 };
  assert.deepEqual(tourCardPosition(nav, desktop, card), { left: 249, top: 107, width: 340, placement: "right" });
  const bell = { left: 1196, top: 12, right: 1240, bottom: 56, width: 44, height: 44 };
  const belowBell = tourCardPosition(bell, desktop, card);
  assert.equal(belowBell.placement, "below");
  assert.ok(belowBell.left + belowBell.width <= desktop.width - 12);
  const phone = { width: 390, height: 844 };
  const tab = { left: 78, top: 780, right: 156, bottom: 836, width: 78, height: 56 };
  const aboveTab = tourCardPosition(tab, phone, card);
  assert.equal(aboveTab.placement, "above");
  assert.ok(aboveTab.top >= 12 && aboveTab.left >= 12 && aboveTab.left + aboveTab.width <= phone.width - 12);
  assert.equal(tourCardPosition(null, phone, card).placement, "center");
  assert.equal(tourCardPosition(null, { width: 300, height: 600 }, card).width, 276, "a narrow screen narrows the card");
});

test("the night checklist counts the complete line-ups and the results that are due", () => {
  const lineup = Array(11).fill("Alguém");
  const tonight = [
    { id: "a1", scheduled_at: "2026-10-04T22:00:00Z", lineup },           // kicked off 80 minutes ago: result due
    { id: "a2", scheduled_at: "2026-10-05T00:10:00Z", lineup: ["A"] },    // later tonight, incomplete
  ];
  const list = nightChecklist({ tonight, played: [{ id: "a0" }], now: NOW });
  assert.deepEqual(list, { games: 3, lineups: { ready: 1, total: 2 }, results: { imported: 1, due: 2 } });
  assert.equal(nightChecklist({ tonight: [], played: [], now: NOW }), null);
  assert.equal("list" in list, false, "the media list is not part of preparing the night on the Central");
});

test("the shell wires what was built: bell, walk, install, links and the background reader", async () => {
  const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  for (const needle of ["NotificationCenter", "<Tour ", "useCompetitionAutoRefresh", "useLibraryGlance", "strix-navigate", "data-tour=\"tab-more\"", "sidebar-install"]) {
    assert.ok(main.includes(needle), `main.jsx wires ${needle}`);
  }
  const install = await readFile(new URL("../src/ui/install-app.js", import.meta.url), "utf8");
  assert.match(install, /beforeinstallprompt/);
  assert.match(install, /display-mode: standalone/);
});
