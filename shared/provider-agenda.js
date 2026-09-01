const strixFixture = (fixture) => /\bstrix\b/i.test(
  `${fixture?.home_team_name || ""} ${fixture?.away_team_name || ""}`,
);

export const saoPauloDay = (value) => new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Sao_Paulo",
}).format(new Date(value));

export function providerAgendaEligibility(fixture, now = new Date()) {
  if (!strixFixture(fixture)) return { eligible: false, reason: "not_strix" };
  if (!fixture?.scheduled_at) return { eligible: false, reason: "missing_date" };
  if (fixture.agenda_match_id) return { eligible: true, reason: "already_linked" };
  if (["completed", "cancelled"].includes(fixture.status)) {
    return { eligible: false, reason: fixture.status };
  }
  if (saoPauloDay(fixture.scheduled_at) < saoPauloDay(now)) {
    return { eligible: false, reason: "past" };
  }
  return { eligible: true, reason: "upcoming" };
}

export function selectProviderAgendaFixtures(fixtures = [], now = new Date()) {
  return fixtures.filter((fixture) => providerAgendaEligibility(fixture, now).eligible);
}

const opponentFor = (fixture) => /\bstrix\b/i.test(fixture.home_team_name)
  ? fixture.away_team_name
  : fixture.home_team_name;

const opponentTeamIdFor = (fixture) => /\bstrix\b/i.test(fixture.home_team_name)
  ? fixture.away_team_id
  : fixture.home_team_id;

export function agendaMutationForFixture(current, fixture, {
  competition,
  edition,
  actorUserId,
  now = new Date(),
}) {
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

export async function syncProviderAgenda(client, {
  competition,
  edition,
  actorUserId,
  fixtures = [],
  now = new Date(),
}) {
  const official = selectProviderAgendaFixtures(fixtures, now);
  const ignored = fixtures.reduce((summary, fixture) => {
    const result = providerAgendaEligibility(fixture, now);
    if (!result.eligible) summary[result.reason] = (summary[result.reason] || 0) + 1;
    return summary;
  }, {});
  if (!official.length) return { created: 0, updated: 0, unchanged: 0, eligible: 0, ignored };

  const ids = official.map((fixture) => fixture.id);
  const { data: existing = [], error: readError } = await client
    .from("agenda_matches")
    .select("*")
    .in("source_fixture_id", ids);
  if (readError) throw readError;
  const byFixture = new Map(existing.map((entry) => [entry.source_fixture_id, entry]));
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const pendingAgenda = [];
  for (const fixture of official) {
    const current = byFixture.get(fixture.id);
    const mutation = agendaMutationForFixture(current, fixture, {
      competition,
      edition,
      actorUserId,
      now,
    });
    if (mutation.action === "insert") created += 1;
    else if (mutation.action === "update") updated += 1;
    else unchanged += 1;
    if (mutation.action !== "unchanged") pendingAgenda.push({
      ...mutation.payload,
      source_fixture_id: fixture.id,
      created_by: current?.created_by || actorUserId,
    });
  }

  if (pendingAgenda.length) {
    const write = await client.from("agenda_matches")
      .upsert(pendingAgenda, { onConflict: "source_fixture_id" })
      .select("id,source_fixture_id");
    if (write.error) throw write.error;
    for (const entry of write.data || []) byFixture.set(entry.source_fixture_id, entry);
  }

  const pendingLinks = official.filter((fixture) => {
    const agenda = byFixture.get(fixture.id);
    return agenda?.id && fixture.agenda_match_id !== agenda.id;
  }).map((fixture) => ({
    ...fixture,
    agenda_match_id: byFixture.get(fixture.id).id,
  }));
  if (pendingLinks.length) {
    const link = await client.from("competition_fixtures").upsert(pendingLinks, { onConflict: "id" });
    if (link.error) throw link.error;
  }
  return { created, updated, unchanged, eligible: official.length, ignored };
}
