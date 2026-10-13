// What a competition match is worth, in one sentence for the card of that match ("Vitória
// garante a vaga; derrota elimina."). It is the Cenários tab's own calculation, read for the
// next game only: nothing here estimates, it reports what every combination of the remaining
// games says.
import { deriveCompetitionView, qualificationScenarioInput } from "./competition-core.js";
import { qualificationOutlook } from "./scenario-engine.js";
import { normalizeName } from "../matches/import-core.js";

// The card must stay instant: with more open games than this the Cenários tab does the full count.
const CARD_MAX_LEAVES = 60_000;

const always = (entry) => Boolean(entry) && entry.total > 0 && entry.in === entry.total;
const never = (entry) => Boolean(entry) && entry.total > 0 && entry.out === entry.total;
const sentence = (parts) => {
  const text = parts.join("; ");
  return text ? `${text.charAt(0).toLocaleUpperCase("pt-BR")}${text.slice(1)}.` : "";
};

/**
 * The sentence for the next game of an outlook (see scenario-engine.js). `byResult` counts, for
 * each result of that game, in how many combinations of everything else Strix ends in, level
 * on points at the cut line, or out. Empty when the outlook has nothing certain to say.
 */
export function stakeSentence(outlook) {
  if (!outlook) return "";
  if (outlook.status === "guaranteed") return outlook.cutoffPosition ? `Vaga já garantida entre os ${outlook.cutoffPosition} que passam${outlook.finish?.worst ? `: no pior cenário termina em ${outlook.finish.worst}º` : ""}.` : "Vaga já garantida.";
  if (outlook.status === "impossible") return "Sem chance matemática de classificação.";
  if (outlook.status !== "possible" || !outlook.nextMatch) return "";
  const by = Object.fromEntries((outlook.nextMatch.byResult || []).map((entry) => [entry.result, entry]));
  const parts = [];
  if (always(by.D)) parts.push("vaga garantida mesmo com derrota");
  else if (always(by.E)) parts.push("empate garante a vaga");
  else if (always(by.V)) parts.push("vitória garante a vaga");
  if (never(by.E) && never(by.D) && !never(by.V)) parts.push("só a vitória mantém a chance");
  else if (never(by.D) && !never(by.E)) parts.push("derrota elimina");
  return sentence(parts);
}

/**
 * The stake sentence for one game of a competition view (see deriveCompetitionView), against
 * `opponentName`. A sentence about results is only given for the game it was computed for
 * (Strix's next one in its group); "already in" and "already out" hold for any game.
 */
export function viewStake(view, opponentName) {
  if (!view || view.hasKnockout) return { text: "", status: "" };
  const input = qualificationScenarioInput(view.standings, view.qualificationSlots);
  if (!input) return { text: "", status: "" };
  const outlook = qualificationOutlook({ ...input, qualificationSlots: view.qualificationSlots, maxLeaves: CARD_MAX_LEAVES });
  const settled = outlook.status === "guaranteed" || outlook.status === "impossible";
  const isNext = Boolean(outlook.nextMatch) && normalizeName(outlook.nextMatch.opponent) === normalizeName(opponentName);
  return { text: settled || isNext ? stakeSentence(outlook) : "", status: outlook.status };
}

const cache = new Map();
const remember = (key, value) => {
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
};

/**
 * The stake of one Agenda match: `{ text, editionId, status }`, or null when the match is not
 * part of a group table with a published rule, or when nothing certain can be said about it yet.
 */
export function matchStake(match, { editions = [], sources = [], fixtures = [] } = {}) {
  const editionId = match?.competition_edition_id;
  if (!editionId) return null;
  const edition = editions.find((item) => item.id === editionId);
  if (!edition || edition.status === "historical") return null;
  const ownSources = sources.filter((source) => source.edition_id === editionId);
  const ownFixtures = fixtures.filter((fixture) => fixture.edition_id === editionId);
  const stamp = [editionId, edition.updated_at, ownSources.map((source) => source.last_synced_at || source.updated_at).join(","), ownFixtures.length, normalizeName(match.opponent_name)].join("|");
  if (cache.has(stamp)) return cache.get(stamp);
  const { text, status } = viewStake(deriveCompetitionView(ownSources, ownFixtures, edition), match.opponent_name);
  return remember(stamp, text ? { text, editionId, status } : null);
}
