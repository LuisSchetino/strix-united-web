import test from "node:test";
import assert from "node:assert/strict";
import { ARCHIVE_KEEP_DAYS, ARCHIVE_VISIBLE, rendersToPrune } from "../src/features/media/render-archive.js";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-04T12:00:00Z");
const row = (id, template, daysAgo) => ({ id, template, createdAt: new Date(NOW - daysAgo * DAY).toISOString() });

test("the archive keeps the newest pieces of each kind and drops the old rest", () => {
  const rows = [
    row("a1", "announce", 1), row("a2", "announce", 9), row("a3", "announce", 10), row("a4", "announce", 20), row("a5", "announce", 30),
    row("s1", "summary", 40), row("s2", "summary", 50),
  ];
  // Announce: a1..a3 are the newest three; a4 and a5 are old and outside them. Summary has only two.
  assert.deepEqual(rendersToPrune(rows, NOW).sort(), ["a4", "a5"]);
});

test("a recent piece outside the newest stays until it ages", () => {
  const rows = [row("r1", "related", 0), row("r2", "related", 1), row("r3", "related", 2), row("r4", "related", 3), row("r5", "related", ARCHIVE_KEEP_DAYS + 1)];
  assert.equal(ARCHIVE_VISIBLE, 3);
  assert.deepEqual(rendersToPrune(rows, NOW), ["r5"]);
});

test("rows without a readable date count as old, rows without an id are ignored", () => {
  const rows = [row("x1", "x", 0), row("x2", "x", 0), row("x3", "x", 0), { id: "x4", template: "x", createdAt: "" }, { template: "x" }];
  assert.deepEqual(rendersToPrune(rows, NOW), ["x4"]);
});
