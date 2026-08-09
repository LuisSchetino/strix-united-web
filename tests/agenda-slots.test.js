import assert from "node:assert/strict";
import test from "node:test";
import { nextAgendaSlot } from "../src/features/agenda/agenda-slots.js";

const entry = (date, time, status = "scheduled") => ({ date, time, status });

test("manual agenda picks the first free 30-minute slot for the selected day", () => {
  const games = [
    entry("09/08/2026", "21:10"),
    entry("09/08/2026", "22:10"),
  ];
  assert.equal(nextAgendaSlot(games, "09/08/2026"), "21:40");
  assert.equal(nextAgendaSlot(games, "10/08/2026"), "21:10");
});

test("manual agenda fills the standard night grid and reuses a deleted gap", () => {
  const games = ["21:10", "21:40", "22:10", "22:40", "23:10", "23:40"]
    .map((time) => entry("2026-08-09", time));
  assert.equal(nextAgendaSlot(games, "2026-08-09"), "00:10");
  assert.equal(nextAgendaSlot(games.filter((game) => game.time !== "21:40"), "2026-08-09"), "21:40");
});

test("cancelled slots are free and provider timestamps remain read-only inputs", () => {
  const games = [
    { scheduled_at: "2026-08-10T21:10:00-03:00", status: "scheduled" },
    { scheduled_at: "2026-08-10T21:40:00-03:00", status: "cancelled" },
  ];
  assert.equal(nextAgendaSlot(games, "10/08/2026"), "21:40");
  assert.equal(games[0].scheduled_at, "2026-08-10T21:10:00-03:00");
});
