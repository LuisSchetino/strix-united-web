// "Marcos" and "Minha semana": round numbers a player reaches (first goal, 10 goals, 50 games)
// and his last seven days against the seven before. Both are counted from his real appearances
// in imported matches (the rows statistics-core reconciles); nothing is projected.
import { saoPauloDay } from "../agenda/agenda-time.js";

const THRESHOLDS = Object.freeze({
  games: [1, 10, 25, 50, 100, 150, 200, 300],
  goals: [1, 10, 25, 50, 100, 150, 200],
  assists: [1, 10, 25, 50, 100, 150],
  cleanSheets: [1, 10, 25, 50],
});
const LABEL = Object.freeze({
  games: (value) => (value === 1 ? "Estreia pelo Strix" : `${value} jogos`),
  goals: (value) => (value === 1 ? "Primeiro gol" : `${value} gols`),
  assists: (value) => (value === 1 ? "Primeira assistência" : `${value} assistências`),
  cleanSheets: (value) => (value === 1 ? "Primeiro jogo sem sofrer gol" : `${value} jogos sem sofrer gol`),
});
const UNIT = Object.freeze({
  games: ["jogo", "jogos"],
  goals: ["gol", "gols"],
  assists: ["assistência", "assistências"],
  cleanSheets: ["jogo sem sofrer gol", "jogos sem sofrer gol"],
});
const DAY = 86_400_000;
const number = (value) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : 0);
const stamp = (row) => {
  const time = new Date(row?.match?.played_at || row?.match?.date || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};
const chronological = (appearances) => [...(Array.isArray(appearances) ? appearances : [])].sort((left, right) => stamp(left) - stamp(right));

/**
 * The marks a player has reached, oldest first, and the next one of each kind.
 * `appearances` are his rows (see buildPlayerProfile), each with its `match`.
 *   reached  — [{ id, kind, value, label, at, matchId, opponent }]
 *   upcoming — [{ kind, value, label, remaining }] (what is left to the next round number)
 *   totals   — { games, goals, assists, cleanSheets }
 */
export function playerMilestones(appearances = [], { goalkeeper = false } = {}) {
  const totals = { games: 0, goals: 0, assists: 0, cleanSheets: 0 };
  const reached = [];
  const kinds = goalkeeper ? ["games", "cleanSheets", "assists"] : ["games", "goals", "assists"];
  let ninePlus = false;
  let hatTrick = false;
  for (const row of chronological(appearances)) {
    const before = { ...totals };
    totals.games += 1;
    totals.goals += number(row.goals);
    totals.assists += number(row.assists);
    if (goalkeeper && number(row.cleansheetsgk) > 0) totals.cleanSheets += 1;
    const mark = (id, kind, value, label) => reached.push({ id, kind, value, label, at: row.match?.played_at || row.match?.date || "", matchId: row.match?.id || "", opponent: row.match?.opponent_name || "" });
    for (const kind of kinds) {
      for (const value of THRESHOLDS[kind]) {
        if (before[kind] < value && totals[kind] >= value) mark(`${kind}-${value}`, kind, value, LABEL[kind](value));
      }
    }
    if (!ninePlus && number(row.rating) >= 9) {
      ninePlus = true;
      mark("rating-9", "rating", 9, "Primeira nota 9");
    }
    if (!goalkeeper && !hatTrick && number(row.goals) >= 3) {
      hatTrick = true;
      mark("hat-trick", "hatTrick", 3, "Primeiro hat-trick");
    }
  }
  const upcoming = kinds
    .map((kind) => {
      // The first of a kind is not a countdown: it only appears once it happens.
      const value = THRESHOLDS[kind].find((threshold) => threshold > totals[kind]);
      if (!value || value === 1) return null;
      const remaining = value - totals[kind];
      return { kind, value, label: LABEL[kind](value), remaining, text: `${remaining === 1 ? "Falta" : "Faltam"} ${remaining} ${UNIT[kind][remaining === 1 ? 0 : 1]} para os ${value}` };
    })
    .filter(Boolean);
  return { reached, upcoming, totals };
}

/**
 * The player's last seven days and the seven before them (São Paulo calendar days, today
 * included): games, goals, assists and average rating. Null when he played in neither.
 */
export function playerWeek(appearances = [], now = new Date()) {
  const today = Date.parse(`${saoPauloDay(now)}T00:00:00Z`);
  const empty = () => ({ games: 0, goals: 0, assists: 0, ratingTotal: 0, rated: 0 });
  const current = empty();
  const previous = empty();
  for (const row of Array.isArray(appearances) ? appearances : []) {
    const played = row?.match?.played_at || row?.match?.date;
    if (!played) continue;
    const age = Math.round((today - Date.parse(`${saoPauloDay(played)}T00:00:00Z`)) / DAY);
    const bucket = age >= 0 && age < 7 ? current : age >= 7 && age < 14 ? previous : null;
    if (!bucket) continue;
    bucket.games += 1;
    bucket.goals += number(row.goals);
    bucket.assists += number(row.assists);
    if (number(row.rating) > 0) { bucket.ratingTotal += number(row.rating); bucket.rated += 1; }
  }
  if (!current.games && !previous.games) return null;
  const close = (bucket) => ({ games: bucket.games, goals: bucket.goals, assists: bucket.assists, rating: bucket.rated ? Number((bucket.ratingTotal / bucket.rated).toFixed(1)) : null });
  return { current: close(current), previous: close(previous) };
}

/**
 * Marks reached by anyone on the roster since `since`, newest first.
 * `profiles` are `[{ playerId, name, goalkeeper, appearances }]`.
 */
export function clubMilestones(profiles = [], { since = 0 } = {}) {
  const limit = new Date(since).getTime() || 0;
  return (Array.isArray(profiles) ? profiles : [])
    .flatMap((profile) => playerMilestones(profile.appearances, { goalkeeper: profile.goalkeeper }).reached
      .map((mark) => ({ ...mark, playerId: profile.playerId, name: profile.name })))
    .filter((mark) => new Date(mark.at).getTime() >= limit)
    .sort((left, right) => new Date(right.at) - new Date(left.at) || right.value - left.value);
}
