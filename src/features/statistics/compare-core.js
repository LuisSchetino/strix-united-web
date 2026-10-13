// Two players of the roster side by side: which numbers are compared, in the order they are
// read. A value without a sample stays empty (null), never a zero.
const one = (value) => (value == null || !Number.isFinite(Number(value)) ? null : Number(Number(value).toFixed(1)));
const percent = (value) => (value == null ? "—" : `${value}%`);

/** `[label, valueOfA, valueOfB, format?]` rows for two statistics players. */
export function compareRows(a, b) {
  const sampled = (player, metric) => (player.metricSamples?.[metric] > 0 ? one(player[metric]) : null);
  const both = (metric) => [sampled(a, metric), sampled(b, metric)];
  const keepers = a.goalkeeper && b.goalkeeper;
  const rows = [
    ["JOGOS", one(a.validGames ?? a.games), one(b.validGames ?? b.games)],
    ["NOTA MÉDIA", one(a.averageRating), one(b.averageRating)],
  ];
  if (keepers) {
    rows.push(["DEFESAS", ...both("saves")], ["DEFESAS / JOGO", a.goalkeeperGames > 0 ? one(a.savesPerGame) : null, b.goalkeeperGames > 0 ? one(b.savesPerGame) : null], ["SEM SOFRER GOL", one(a.cleanSheets), one(b.cleanSheets)]);
  } else {
    rows.push(["GOLS", ...both("goals")], ["ASSISTÊNCIAS", ...both("assists")], ["FINALIZAÇÕES", ...both("shots")], ["DESARMES", ...both("tackles")]);
  }
  rows.push(["PRECISÃO DE PASSE", a.passAttempts > 0 ? one(a.passAccuracy) : null, b.passAttempts > 0 ? one(b.passAccuracy) : null, percent], ["MELHOR EM CAMPO", one(a.mom), one(b.mom)]);
  return rows;
}

export const compareValue = one;
