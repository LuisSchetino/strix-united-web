import { normalizeName } from "../../src/features/matches/import-core.js";
import { expandKnockoutSlots } from "../../shared/bracket-slots.js";

const volatileKeys = new Set(["fetchedAt", "security", "relatedSourceUrls"]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).filter((key) => !volatileKeys.has(key)).sort().map((key) => [key, canonical(value[key])]));
}

export async function competitionFingerprint(preview) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(preview)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const saoPauloDay = (value) => new Intl.DateTimeFormat("sv-SE", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo",
}).format(new Date(value));

export function nextSyncAt(fixtures = [], now = new Date(), failures = 0) {
  const nowMs = new Date(now).getTime();
  const immediate = fixtures.some((fixture) => {
    const time = new Date(fixture.scheduled_at || fixture.scheduledAt || 0).getTime();
    return /\bstrix\b/i.test(`${fixture.home_team_name || fixture.homeTeamName} ${fixture.away_team_name || fixture.awayTeamName}`)
      && !["completed", "cancelled"].includes(fixture.status)
      && time >= nowMs - 60 * 60 * 1000
      && time <= nowMs + 36 * 60 * 60 * 1000;
  });
  const baseMinutes = immediate ? 15 : 60;
  const backoff = Math.min(240, baseMinutes * (2 ** Math.min(3, failures)));
  return new Date(nowMs + backoff * 60 * 1000).toISOString();
}

const opponentFor = (fixture) => /\bstrix\b/i.test(fixture.home_team_name)
  ? fixture.away_team_name
  : fixture.home_team_name;

const opponentTeamIdFor = (fixture) => /\bstrix\b/i.test(fixture.home_team_name)
  ? fixture.away_team_id
  : fixture.home_team_id;

export function agendaMutationForFixture(current, fixture, { competition, edition, actorUserId, now = new Date() }) {
  const opponentName = opponentFor(fixture);
  const providerStatus = ["cancelled", "live", "completed"].includes(fixture.status)
    ? fixture.status
    : "scheduled";
  const base = {
    opponent_name: opponentName,
    opponent_team_id: opponentTeamIdFor(fixture) || null,
    competition_name: competition.name,
    competition_id: competition.id,
    competition_edition_id: edition.id,
    scheduled_at: fixture.scheduled_at,
    source: "competition_import",
    source_fixture_id: fixture.id,
    updated_by: actorUserId,
  };
  if (!current) return {
    action: "insert",
    payload: {
      ...base,
      status: providerStatus,
      created_by: actorUserId,
      ...(fixture.status === "cancelled" ? { cancelled_at: new Date(now).toISOString() } : {}),
    },
  };
  const status = current.status === "completed" ? "completed" : providerStatus;
  const changed = current.opponent_name !== opponentName
    || (current.opponent_team_id || null) !== base.opponent_team_id
    || current.competition_id !== competition.id
    || new Date(current.scheduled_at).getTime() !== new Date(fixture.scheduled_at).getTime()
    || current.status !== status;
  return {
    action: changed ? "update" : "unchanged",
    payload: {
      ...base,
      status,
      ...(fixture.status === "cancelled" ? { cancelled_at: current.cancelled_at || new Date(now).toISOString() } : {}),
    },
  };
}

const ensureData = (result) => {
  if (result.error) throw result.error;
  return result.data;
};

const competitionFormat = (preview, knockout) => {
  if (knockout) return "knockout";
  if (preview.phase === "groups") return "groups";
  if (preview.phase === "league") return "league";
  return "unknown";
};

export async function persistCompetitionSync(client, { competition, edition, actorUserId, preview }) {
  const previews = [preview, ...(preview.relatedPreviews || [])]
    .filter((item, index, all) => item?.source && all.findIndex((candidate) => candidate?.source === item.source) === index);
  const identity = previews.find((item) => item.sourceKind === "standings") || preview;
  const knockout = previews.find((item) => item.sourceKind === "knockout");
  const inferredRule = !identity.qualificationRule?.slots && knockout?.knockout?.teams?.length
    ? { slots: knockout.knockout.teams.length, kind: "top", source: "knockout_team_count" }
    : null;
  const qualificationRule = identity.qualificationRule || inferredRule;
  const existingSources = ensureData(await client.from("competition_sources")
    .select("source_url,created_by").eq("edition_id", edition.id));
  const existingSourcesByUrl = new Map(existingSources.map((source) => [source.source_url, source]));
  const sourceRows = previews.map((item) => ({
    edition_id: edition.id,
    provider: item.provider,
    source_kind: item.sourceKind,
    source_url: item.source,
    external_competition_id: item.externalCompetitionId,
    external_group_id: item.externalGroupId,
    last_synced_at: item.fetchedAt,
    sync_status: "ok",
    sync_error: null,
    snapshot: item.sourceKind === "standings" && qualificationRule
      ? { ...item, qualificationRule }
      : item,
    created_by: existingSourcesByUrl.get(item.source)?.created_by || actorUserId,
    updated_by: actorUserId,
  }));
  const sources = ensureData(await client.from("competition_sources")
    .upsert(sourceRows, { onConflict: "edition_id,source_url" }).select("*"));

  ensureData(await client.from("competitions").update({
    organization: identity.organization || competition.organization,
    logo_url: identity.logo || competition.logo_url,
    updated_by: actorUserId,
  }).eq("id", competition.id));
  ensureData(await client.from("competition_editions").update({
    format: competitionFormat(identity, knockout),
    ...(qualificationRule?.slots ? {
      qualification_slots: Number(qualificationRule.slots),
      metadata: { ...(edition.metadata || {}), qualificationRule },
    } : {}),
    updated_by: actorUserId,
  }).eq("id", edition.id));

  const fixtureEntries = previews.flatMap((item) => {
    const fixtures = item.sourceKind === "knockout"
      ? expandKnockoutSlots(item)
      : [...(item.fixtures || []), ...(item.knockout?.fixtures || [])];
    return fixtures.map((fixture) => ({ fixture, item }));
  });
  if (!fixtureEntries.length) return { sources, fixtures: 0 };

  const teamMap = new Map();
  for (const { fixture } of fixtureEntries) {
    for (const [name, logo] of [
      [fixture.homeTeamName, fixture.homeLogo],
      [fixture.awayTeamName, fixture.awayLogo],
    ]) {
      if (!name || fixture.metadata?.placeholder) continue;
      const key = normalizeName(name);
      const current = teamMap.get(key);
      teamMap.set(key, {
        edition_id: edition.id,
        name,
        logo_url: logo || current?.logo_url || null,
        is_strix: /\bstrix\b/i.test(name),
        metadata: current?.metadata || {},
      });
    }
  }
  ensureData(await client.from("competition_teams")
    .upsert([...teamMap.values()], { onConflict: "edition_id,normalized_name" }));
  const teams = ensureData(await client.from("competition_teams").select("*").eq("edition_id", edition.id));
  const teamsByName = new Map(teams.map((team) => [normalizeName(team.name), team]));
  const sourcesByUrl = new Map(sources.map((source) => [source.source_url, source]));
  const fixtureRows = fixtureEntries.map(({ fixture, item }) => {
    const home = teamsByName.get(normalizeName(fixture.homeTeamName));
    const away = teamsByName.get(normalizeName(fixture.awayTeamName));
    return {
      edition_id: edition.id,
      source_id: sourcesByUrl.get(item.source)?.id || sources[0]?.id,
      external_match_id: fixture.externalMatchId,
      round_label: fixture.roundLabel || null,
      scheduled_at: fixture.scheduledAt || null,
      home_team_id: home?.id || null,
      away_team_id: away?.id || null,
      home_team_name: fixture.homeTeamName,
      away_team_name: fixture.awayTeamName,
      home_score: fixture.homeScore,
      away_score: fixture.awayScore,
      status: fixture.status || "scheduled",
      bracket_slot_key: fixture.bracketSlotKey || fixture.metadata?.bracketSlotKey || null,
      bracket_position: fixture.bracketPosition ?? fixture.metadata?.bracketPosition ?? null,
      winner_to_slot_key: fixture.winnerToSlotKey || fixture.metadata?.winnerToSlotKey || null,
      winner_to_slot: fixture.winnerToSlot ?? fixture.metadata?.winnerToSlot ?? null,
      metadata: {
        provider: item.provider,
        organization: item.organization,
        source: item.source,
        homeLogo: fixture.homeLogo || home?.logo_url || "",
        awayLogo: fixture.awayLogo || away?.logo_url || "",
        bracketPosition: fixture.bracketPosition ?? fixture.metadata?.bracketPosition ?? null,
        feedsIntoPosition: fixture.feedsIntoPosition ?? fixture.metadata?.feedsIntoPosition ?? null,
        ...(fixture.metadata || {}),
      },
    };
  });
  const bracketRows = fixtureRows.filter((fixture) => fixture.bracket_slot_key);
  const regularRows = fixtureRows.filter((fixture) => !fixture.bracket_slot_key);
  if (bracketRows.length) ensureData(await client.from("competition_fixtures")
    .upsert(bracketRows, { onConflict: "edition_id,bracket_slot_key" }));
  if (regularRows.length) ensureData(await client.from("competition_fixtures")
    .upsert(regularRows, { onConflict: "edition_id,external_match_id" }));
  return { sources, fixtures: fixtureRows.length };
}

export async function syncTodayProviderAgenda(client, { competition, edition, actorUserId, fixtures, now = new Date() }) {
  const today = saoPauloDay(now);
  const official = fixtures.filter((fixture) => /\bstrix\b/i.test(`${fixture.home_team_name} ${fixture.away_team_name}`)
    && fixture.scheduled_at
    && saoPauloDay(fixture.scheduled_at) === today);
  if (!official.length) return { created: 0, updated: 0 };

  const ids = official.map((fixture) => fixture.id);
  const { data: existing = [], error: readError } = await client.from("agenda_matches").select("*").in("source_fixture_id", ids);
  if (readError) throw readError;
  const byFixture = new Map(existing.map((entry) => [entry.source_fixture_id, entry]));
  let created = 0;
  let updated = 0;

  for (const fixture of official) {
    const current = byFixture.get(fixture.id);
    const mutation = agendaMutationForFixture(current, fixture, { competition, edition, actorUserId, now });
    if (current) {
      if (mutation.action === "update") {
        const { error } = await client.from("agenda_matches").update(mutation.payload).eq("id", current.id);
        if (error) throw error;
        updated += 1;
      }
      if (fixture.agenda_match_id !== current.id) {
        const { error } = await client.from("competition_fixtures").update({ agenda_match_id: current.id }).eq("id", fixture.id);
        if (error) throw error;
      }
      continue;
    }
    const { data: inserted, error } = await client.from("agenda_matches").insert(mutation.payload).select("id").single();
    if (error) throw error;
    const { error: linkError } = await client.from("competition_fixtures").update({ agenda_match_id: inserted.id }).eq("id", fixture.id);
    if (linkError) throw linkError;
    created += 1;
  }
  return { created, updated };
}

export function countFixtureChanges(before = [], after = []) {
  const beforeById = new Map(before.map((fixture) => [fixture.external_match_id, fixture]));
  let created = 0;
  let updated = 0;
  for (const fixture of after) {
    const previous = beforeById.get(fixture.external_match_id);
    if (!previous) created += 1;
    else if (["scheduled_at", "home_score", "away_score", "status", "home_team_name", "away_team_name"]
      .some((key) => String(previous[key] ?? "") !== String(fixture[key] ?? ""))) updated += 1;
  }
  return { created, updated };
}

export function isSameOpponent(left, right) {
  return normalizeName(left) === normalizeName(right);
}
