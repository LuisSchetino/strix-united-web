import { TOURNAMENT_LISTS, parseTournamentList, scanStandingsPage, validateCompetitionUrl } from "./competition-providers.js";
import { selectPreferredKnockoutPreview } from "./bracket-slots.js";

// Reading an edition means reading several provider pages (each group, each
// round, the bracket). How a page is fetched is the caller's business: the
// server fetches it directly, the browser asks for one page at a time. This
// module only decides which pages to read and how they fold into one preview.

const mergeByKey = (items, keyOf) => items.filter((item, index, all) => all.findIndex((candidate) => keyOf(candidate) === keyOf(item)) === index);
// Groups read in their natural order (Grupo 1, 2, 3…), whichever page was the entry.
const groupOrder = (group) => Number(String(group.name || "").match(/(\d+)/)?.[1] || 0);

/** Runs `task` over `items`, at most `size` at a time, in order. */
async function inBatches(items, size, task) {
  const results = [];
  for (let index = 0; index < items.length; index += size) {
    results.push(...await Promise.all(items.slice(index, index + size).map(task)));
  }
  return results;
}

/**
 * One edition as a single preview: the entry page plus every related page of
 * the same competition. `loadPreview(url)` resolves to that page already parsed.
 * A page that fails gets one more try, one at a time: a missing group page must
 * not silently turn a four-group edition into "Grupo 1" only. What still fails
 * is reported in `sourceReport`, never hidden.
 */
export async function assembleCompetitionBundle(rawUrl, loadPreview, { concurrency = 3, onProgress } = {}) {
  const entry = validateCompetitionUrl(rawUrl).url;
  const primary = await loadPreview(entry);
  const urls = primary.relatedSourceUrls || [];
  const total = urls.length + 1;
  let done = 1;
  onProgress?.({ done, total });
  const failed = [];
  const related = await inBatches(urls, concurrency, async (url) => {
    try { return await loadPreview(url); } catch { failed.push(url); return null; } finally { done += 1; onProgress?.({ done: Math.min(done, total), total }); }
  });
  const stillFailed = [];
  for (const url of failed) {
    try { related.push(await loadPreview(url)); } catch { stillFailed.push(url); }
  }
  const sameKind = related.filter(Boolean)
    .filter((preview) => preview.externalCompetitionId === primary.externalCompetitionId)
    .filter((preview) => preview.sourceKind === primary.sourceKind);
  const groups = mergeByKey([...(primary.groups || []), ...sameKind.flatMap((preview) => preview.groups || [])], (group) => group.name)
    .sort((left, right) => groupOrder(left) - groupOrder(right));
  const teams = new Set(groups.flatMap((group) => (group.standings || []).map((row) => String(row.team || "").toLowerCase()))).size;
  const mergedPrimary = {
    ...primary,
    groups,
    // The entry page shows one group; the edition is what all its pages say together.
    phase: primary.phase === "standings" && groups.length > 1 ? "groups" : primary.phase,
    teamCount: teams || primary.teamCount,
    fixtures: mergeByKey([...(primary.fixtures || []), ...sameKind.flatMap((preview) => preview.fixtures || [])], (fixture) => fixture.externalMatchId),
    relatedSourceUrls: mergeByKey([...(primary.relatedSourceUrls || []), ...sameKind.flatMap((preview) => preview.relatedSourceUrls || [])], (url) => url),
  };
  const relatedCandidates = related
    .filter(Boolean)
    .filter((preview) => preview.externalCompetitionId === primary.externalCompetitionId)
    .filter((preview) => preview.sourceKind !== primary.sourceKind)
    .filter((preview) => preview.sourceKind !== "knockout" || preview.knockout?.hasStrix);
  const preferredKnockout = selectPreferredKnockoutPreview(relatedCandidates);
  const relatedPreviews = relatedCandidates
    .filter((preview) => preview.sourceKind !== "knockout")
    .filter((preview, index, all) => all.findIndex((item) => item.sourceKind === preview.sourceKind) === index);
  if (preferredKnockout) relatedPreviews.push(preferredKnockout);
  return { ...mergedPrimary, relatedPreviews, sourceReport: { expected: total, failed: stillFailed.length, failedUrls: stillFailed } };
}

const MAX_DISCOVERED = 12;
const groupNumber = (value) => String(value || "").match(/(\d+)/)?.[1] || "";

/** Where Strix plays in one tournament, reading as few pages as possible. `loadPage(url)` resolves to the page's HTML. */
async function locateStrix(tournament, loadPage) {
  const first = scanStandingsPage(await loadPage(tournament.url), tournament.url);
  let listed = first.groups.reduce((sum, group) => sum + group.teams, 0);
  const seen = new Set(first.groups.map((group) => groupNumber(group.name)).filter(Boolean));
  const urlFor = (name) => first.groupUrls.find((url) => new URL(url).searchParams.get("grupo") === groupNumber(name)) || tournament.url;
  let hit = first.groups.find((group) => group.found);
  if (hit) return { strix: true, strixGroup: hit.name, strixUrl: urlFor(hit.name), teamsListed: listed };
  for (const url of first.groupUrls) {
    if (seen.has(new URL(url).searchParams.get("grupo"))) continue;
    const page = scanStandingsPage(await loadPage(url), url);
    listed += page.groups.reduce((sum, group) => sum + group.teams, 0);
    hit = page.groups.find((group) => group.found);
    if (hit) return { strix: true, strixGroup: hit.name, strixUrl: url, teamsListed: listed };
  }
  // An empty table says nothing about who plays: that is "unknown", not "absent".
  return { strix: listed ? false : null, strixGroup: null, strixUrl: null, teamsListed: listed };
}

/**
 * Tournaments in progress on the provider, each checked for the club: `strix`
 * is true when Strix appears in one of its groups (`strixUrl` is that group's
 * page), false when the tables were read and Strix is not there, null when
 * they could not be read. Light on purpose: one page per tournament, plus its
 * other groups only until Strix is found.
 */
export async function discoverTournaments(provider, loadPage, { concurrency = 2 } = {}) {
  const listUrl = TOURNAMENT_LISTS[provider];
  if (!listUrl) throw new Error("Provider não suportado.");
  const tournaments = parseTournamentList(await loadPage(listUrl), listUrl).slice(0, MAX_DISCOVERED);
  const checked = await inBatches(tournaments, concurrency, async (tournament) => {
    try {
      return { ...tournament, ...(await locateStrix(tournament, loadPage)) };
    } catch {
      return { ...tournament, strix: null, strixGroup: null, strixUrl: null, teamsListed: 0 };
    }
  });
  return { provider, source: listUrl, fetchedAt: new Date().toISOString(), tournaments: checked };
}
