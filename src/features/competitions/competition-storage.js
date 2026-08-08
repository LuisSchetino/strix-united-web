import { normalizeName } from "../matches/import-core.js";

const ensure = (result) => {
  if (result.error) throw result.error;
  return result.data;
};

const editionLabel = (preview) => {
  const year = String(preview.startsOn || "").match(/20\d{2}/)?.[0] || new Date().getFullYear();
  return `${year} · Edição atual`;
};

async function upsertCompetition(client, profile, preview, palette, accent) {
  const current = ensure(await client.from("competitions").select("*").eq("normalized_name", String(preview.name).trim().toLowerCase().replace(/\s+/g, " ")).maybeSingle());
  const payload = {
    name: preview.name,
    organization: preview.organization || null,
    logo_url: preview.logo || null,
    palette: palette || [],
    accent_color: accent || palette?.[0] || "#168cff",
    is_active: true,
    updated_by: profile.user_id,
  };
  if (current) return ensure(await client.from("competitions").update(payload).eq("id", current.id).select().single());
  return ensure(await client.from("competitions").insert({ ...payload, created_by: profile.user_id }).select().single());
}

async function upsertEdition(client, profile, competition, preview) {
  const current = ensure(await client.from("competition_editions").select("*").eq("competition_id", competition.id).in("status", ["draft", "active"]).order("updated_at", { ascending: false }).limit(1).maybeSingle());
  const format = preview.phase === "groups" ? "groups" : preview.phase === "knockout" ? "knockout" : preview.phase === "league" ? "league" : "unknown";
  const payload = { format, status: "active", starts_on: parseProviderDate(preview.startsOn), updated_by: profile.user_id };
  if (current) return ensure(await client.from("competition_editions").update(payload).eq("id", current.id).select().single());
  return ensure(await client.from("competition_editions").insert({ ...payload, competition_id: competition.id, label: editionLabel(preview), created_by: profile.user_id }).select().single());
}

const parseProviderDate = (value) => {
  const match = String(value || "").match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2]}-${match[1]}`;
};

async function upsertSource(client, profile, edition, preview) {
  const current = ensure(await client.from("competition_sources").select("*").eq("edition_id", edition.id).eq("source_url", preview.source).maybeSingle());
  const payload = {
    provider: preview.provider,
    source_kind: preview.sourceKind,
    source_url: preview.source,
    external_competition_id: preview.externalCompetitionId,
    external_group_id: preview.externalGroupId,
    last_synced_at: preview.fetchedAt,
    sync_status: "ok",
    sync_error: null,
    snapshot: preview,
    updated_by: profile.user_id,
  };
  if (current) return ensure(await client.from("competition_sources").update(payload).eq("id", current.id).select().single());
  return ensure(await client.from("competition_sources").insert({ ...payload, edition_id: edition.id, created_by: profile.user_id }).select().single());
}

async function normalizeStandings(client, edition, preview) {
  if (!preview.groups?.length) return;
  const stageName = preview.groups.length > 1 ? "Fase de grupos" : "Classificação";
  const stageType = preview.groups.length > 1 ? "group" : "league";
  const stage = ensure(await client.from("competition_stages").upsert({ edition_id: edition.id, name: stageName, stage_type: stageType, status: "active", order_index: 0 }, { onConflict: "edition_id,name" }).select().single());
  const groupRows = preview.groups.map((group, index) => ({ edition_id: edition.id, stage_id: stage.id, name: group.name, external_id: group.name.match(/\d+/)?.[0] || null, is_strix_group: group.isStrixGroup, order_index: index }));
  ensure(await client.from("competition_groups").upsert(groupRows, { onConflict: "edition_id,name" }));
  const groups = ensure(await client.from("competition_groups").select("*").eq("edition_id", edition.id));
  const uniqueTeams = new Map();
  for (const group of preview.groups) for (const row of group.standings) uniqueTeams.set(normalizeName(row.team), { edition_id: edition.id, name: row.team, logo_url: row.logo || null, is_strix: row.isStrix, metadata: {} });
  ensure(await client.from("competition_teams").upsert([...uniqueTeams.values()], { onConflict: "edition_id,normalized_name" }));
  const teams = ensure(await client.from("competition_teams").select("*").eq("edition_id", edition.id));
  const standingRows = preview.groups.flatMap((group) => {
    const groupRecord = groups.find((item) => item.name === group.name);
    return group.standings.map((row) => ({
      edition_id: edition.id,
      group_id: groupRecord?.id || null,
      team_id: teams.find((team) => normalizeName(team.name) === normalizeName(row.team))?.id,
      position: row.position, points: row.points, played: row.played, wins: row.wins,
      draws: row.draws, losses: row.losses, goals_for: row.goalsFor,
      goals_against: row.goalsAgainst, form: row.form || [], updated_at: new Date().toISOString(),
    })).filter((row) => row.team_id);
  });
  if (standingRows.length) ensure(await client.from("competition_standings").upsert(standingRows, { onConflict: "edition_id,group_id,team_id" }));
}

async function normalizeKnockout(client, edition, preview) {
  if (!preview.knockout?.stages?.length) return;
  const type = (name) => /oitava/i.test(name) ? "round_of_16" : /quarta/i.test(name) ? "quarterfinal" : /semi/i.test(name) ? "semifinal" : /^final/i.test(name) ? "final" : "other";
  ensure(await client.from("competition_stages").upsert(preview.knockout.stages.map((name, index) => ({ edition_id: edition.id, name, stage_type: type(name), order_index: index + 10, status: "active" })), { onConflict: "edition_id,name" }));
  if (preview.knockout.teams?.length) ensure(await client.from("competition_teams").upsert(preview.knockout.teams.map((name) => ({ edition_id: edition.id, name, is_strix: /\bstrix\b/i.test(name), metadata: {} })), { onConflict: "edition_id,normalized_name" }));
}

export async function saveCompetitionPreview(client, profile, preview, palette, accent) {
  const competition = await upsertCompetition(client, profile, preview, palette, accent);
  const edition = await upsertEdition(client, profile, competition, preview);
  const source = await upsertSource(client, profile, edition, preview);
  await normalizeStandings(client, edition, preview);
  await normalizeKnockout(client, edition, preview);
  ensure(await client.from("competition_audit_log").insert({ competition_id: competition.id, edition_id: edition.id, actor_user_id: profile.user_id, action: source.created_at === source.updated_at ? "competition_imported" : "competition_synced", result: { provider: preview.provider, source: preview.source, groups: preview.groups?.length || 0, teams: preview.teamCount || 0 } }));
  return { competition, edition, source };
}

export async function archiveCompetitionEdition(client, profile, edition, outcome) {
  const updated = ensure(await client.from("competition_editions").update({ status: "historical", archived_at: new Date().toISOString(), outcome, updated_by: profile.user_id }).eq("id", edition.id).select().single());
  ensure(await client.from("competition_audit_log").insert({ competition_id: edition.competition_id, edition_id: edition.id, actor_user_id: profile.user_id, action: "competition_archived", result: { outcome } }));
  return updated;
}
