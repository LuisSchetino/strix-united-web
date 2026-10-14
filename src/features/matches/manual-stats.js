// Gols e assistências postos à mão numa partida: quando a EA zera os números de alguém (caiu da
// partida, o jogo não registrou) ou a partida nem tem dados da EA. Ficam guardados à parte em
// `performance.manualStats` e passam por cima dos números da EA em toda leitura (o site refaz os
// números a partir do registro bruto da EA, então só gravar em `players` não bastaria).

const key = (value) => String(value || "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const count = (value) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, 99) : 0;
};

/** The entries as saved: `[{ key, name, playerId, goals, assists }]`, without empty or repeated ones. */
export function cleanManualStats(entries = []) {
  const seen = new Set();
  const out = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const id = key(entry?.key || entry?.name);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ key: id, name: String(entry.name || "").trim(), playerId: entry.playerId || null, goals: count(entry.goals), assists: count(entry.assists) });
  }
  return out;
}

/**
 * The performance with the hand-set numbers over the EA's: the player's row takes the goals and
 * the assists given (a rating of 0, what the EA writes when it zeroes someone, stops counting);
 * a player the EA has no row for gets one of his own. The goal list follows the rows.
 */
export function withManualStats(performance = {}) {
  const manual = cleanManualStats(performance?.manualStats);
  if (!manual.length) return performance;
  const players = (Array.isArray(performance.players) ? performance.players : []).map((row) => ({ ...row }));
  for (const entry of manual) {
    const at = players.findIndex((row) => key(row.eaName || row.name) === entry.key);
    if (at >= 0) {
      const row = players[at];
      players[at] = {
        ...row,
        goals: entry.goals,
        assists: entry.assists,
        rating: Number(row.rating) > 0 ? row.rating : null,
        secondsPlayed: Number(row.secondsPlayed) > 0 ? row.secondsPlayed : null,
        manual: true,
      };
    } else {
      players.push({ id: `manual:${entry.key}`, eaName: entry.name, name: entry.name, goals: entry.goals, assists: entry.assists, manual: true });
    }
  }
  const goalScorers = players.flatMap((row) => Array.from({ length: count(row.goals) }, () => row.name || row.eaName)).filter(Boolean);
  return { ...performance, players, goalScorers };
}

/**
 * The editor's rows: everyone the match has (by the name the club knows him by), with his goals
 * and assists as they count now, plus whoever was added by hand. `display(name)` gives the
 * roster's name for an EA name (or the name itself).
 */
export function manualStatsRows(performance = {}, display = (name) => name) {
  const applied = withManualStats(performance);
  return (Array.isArray(applied.players) ? applied.players : [])
    .filter((row) => row && (row.eaName || row.name))
    .map((row) => ({
      key: key(row.eaName || row.name),
      name: row.eaName || row.name,
      label: display(row.eaName || row.name) || row.eaName || row.name,
      goals: count(row.goals),
      assists: count(row.assists),
      manual: Boolean(row.manual),
    }));
}
