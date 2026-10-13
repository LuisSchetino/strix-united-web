// A match's date and time as the review form shows and edits them: São Paulo's wall clock, the
// two fields independent of each other. (Reading the date from the UTC instant made every game
// after 21:00 show the next day, and each change of the hour pushed the date one day further.)
import { matchNightDay } from "../agenda/agenda-time.js";

const ZONE = "America/Sao_Paulo";
const part = (parts, type) => parts.find((item) => item.type === type)?.value || "";

/** `{ date: "YYYY-MM-DD", time: "HH:MM" }` of an instant, in São Paulo. Empty strings for a bad value. */
export function matchClock(value) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  return { date: `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`, time: `${part(parts, "hour")}:${part(parts, "minute")}` };
}

/**
 * The instant (ISO) after one field of the form changes: `key` is "date" or "time", `value` what
 * the input holds. The other field stays exactly as it was shown. An empty or unreadable value
 * changes nothing.
 */
export function withMatchClock(current, key, value) {
  const clock = matchClock(current);
  const next = { ...clock, [key === "date" ? "date" : "time"]: String(value || "") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date) || !/^\d{2}:\d{2}$/.test(next.time)) return current;
  // São Paulo keeps one offset all year.
  const instant = new Date(`${next.date}T${next.time}:00-03:00`);
  return Number.isNaN(instant.getTime()) ? current : instant.toISOString();
}

/**
 * For a game played in the small hours, the night it counts for ("YYYY-MM-DD"); "" otherwise.
 * The form says it, so nobody moves the date by hand to "fix" it.
 */
export function smallHoursNight(value) {
  const { date } = matchClock(value), night = matchNightDay(value);
  return date && night && night !== date ? night : "";
}
