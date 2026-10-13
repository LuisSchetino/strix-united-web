import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OPENING_STILL_MS, OPENING_TOTAL_MS, ZERO_HOLD_MS, markOpeningLive, markOpeningSeen, shouldShowOpening } from "../src/features/launch/opening-core.js";

const memory = () => {
  const data = new Map();
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, value) };
};
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("a member sees the opening once, only after the launch", () => {
  const storage = memory();
  assert.equal(shouldShowOpening(storage, "u1", { unlocked: false }), false, "never before the launch");
  assert.equal(shouldShowOpening(storage, "u1", { unlocked: true }), true);
  markOpeningSeen(storage, "u1");
  assert.equal(shouldShowOpening(storage, "u1", { unlocked: true }), false, "once per member");
  assert.equal(shouldShowOpening(storage, "u2", { unlocked: true }), true, "another member on the same device still sees it");
  assert.equal(shouldShowOpening(storage, "", { unlocked: true }), false);
  assert.equal(shouldShowOpening({ getItem: () => { throw new Error("blocked"); } }, "u1", { unlocked: true }), false, "a blocked storage never loops the opening");
});

test("a device that watched the countdown reach zero does not play it again at sign-in", () => {
  const storage = memory();
  markOpeningLive(storage);
  assert.equal(shouldShowOpening(storage, "u1", { unlocked: true }), false);
});

test("the opening is short and has a still version", () => {
  assert.ok(OPENING_TOTAL_MS >= 2000 && OPENING_TOTAL_MS <= 3200, "about three seconds");
  assert.ok(OPENING_STILL_MS < OPENING_TOTAL_MS);
  assert.ok(ZERO_HOLD_MS >= 800 && ZERO_HOLD_MS <= 1600);
});

test("the gate rests on zero only for a countdown someone was watching, and the opening is never a countdown", async () => {
  const [gate, opening, css, main] = await Promise.all([
    read("../src/features/launch/LaunchGate.jsx"), read("../src/features/launch/SeasonOpening.jsx"),
    read("../src/features/launch/season-opening.css"), read("../src/main.jsx"),
  ]);
  assert.match(gate, /sawCountdown\.current = true/);
  assert.match(gate, /if \(!sawCountdown\.current\) \{ unlockRef\.current\?\.\(\); return; \}/, "a gate that mounts past the hour just lets the site in");
  assert.match(gate, /unlockRef\.current\?\.\(\{ live: true \}\)/);
  assert.match(gate, /\}, \[config, mode, reduced\]\);/, "a re-render of the shell does not restart the handover");
  assert.doesNotMatch(opening, /countdownParts|LaunchUnit|RollingDigit/, "no replayed countdown");
  assert.match(opening, /Pular/);
  assert.match(opening, /"Escape", "Enter", " "/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.season-opening\.is-still/);
  assert.match(main, /markOpeningSeen\(window\.localStorage, userId\);\s*setOpening\("member"\)/, "remembered when it starts");
  assert.match(main, /const tourOpen = !openingNode &&/, "the walk waits for the opening");
});
