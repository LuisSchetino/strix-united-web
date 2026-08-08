import { normalizeName } from "../../src/features/matches/import-core.js";

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

export function agendaMutationForFixture(current, fixture, { competition, edition, actorUserId, now = new Date() }) {
  const opponentName = opponentFor(fixture);
  const providerStatus = ["cancelled", "live", "completed"].includes(fixture.status)
    ? fixture.status
    : "scheduled";
  const base = {
    opponent_name: opponentName,
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
