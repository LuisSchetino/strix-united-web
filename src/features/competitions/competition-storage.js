import { canManageCompetitions, permissionDenied } from "../../access.js";
import { normalizeName } from "../matches/import-core.js";
import { expandKnockoutSlots, selectPreferredKnockoutPreview } from "../../../shared/bracket-slots.js";
import { dedupeCompetitionRows, fixtureConflictKey, teamConflictKey } from "../../../shared/competition-sync-rows.js";
import { syncProviderAgenda } from "../../../shared/provider-agenda.js";
import { COMPETITION_LOGO_BUCKET, competitionLogoStem, logoAfterSync } from "../../../shared/competition-logo.js";
import { logoThumbnail } from "./competition-logo-image.js";

const ensure = (result) => {
  if (result.error) throw result.error;
  return result.data;
};

const editionLabel = (preview) => {
  const year = String(preview.startsOn || "").match(/20\d{2}/)?.[0] || new Date().getFullYear();
  return `${year} · Edição atual`;
};

/**
 * The provider's logo as a small copy in the club's storage (the originals run
 * past a megabyte). A copy already made from the same original is reused. When
 * the copy cannot be made, the provider's own address is kept, as before.
 */
async function storedCompetitionLogo(client, preview, current) {
  if (!preview.logo) return null;
  const stem = competitionLogoStem(preview.provider, preview.externalCompetitionId, preview.logo);
  if (current?.logo_url?.includes(stem)) return current.logo_url;
  try {
    const blob = await logoThumbnail(client, preview.logo);
    const path = `${stem}.${blob.type === "image/webp" ? "webp" : "png"}`;
    const storage = client.storage.from(COMPETITION_LOGO_BUCKET);
    const { error } = await storage.upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "31536000" });
    if (error) throw error;
    return storage.getPublicUrl(path).data.publicUrl || null;
  } catch (cause) {
    console.warn("[competitions] logo copy not stored; keeping the provider's address", cause);
    return null;
  }
}

async function upsertCompetition(client, profile, preview) {
  const current = ensure(await client.from("competitions").select("*").eq("normalized_name", String(preview.name).trim().toLowerCase().replace(/\s+/g, " ")).maybeSingle());
  const storedLogo = await storedCompetitionLogo(client, preview, current);
  const payload = {
    name: preview.name,
    organization: preview.organization || null,
    logo_url: storedLogo || logoAfterSync(current?.logo_url, preview.logo),
    is_active: true,
    updated_by: profile.user_id,
  };
  if (current) return ensure(await client.from("competitions").update(payload).eq("id", current.id).select().single());
  return ensure(await client.from("competitions").insert({ ...payload, created_by: profile.user_id }).select().single());
}

async function upsertEdition(client, profile, competition, preview, targetEditionId = "") {
  const current = targetEditionId
    ? ensure(await client.from("competition_editions").select("*").eq("id", targetEditionId).eq("competition_id", competition.id).maybeSingle())
    : ensure(await client.from("competition_editions").select("*").eq("competition_id", competition.id).in("status", ["draft", "active"]).order("updated_at", { ascending: false }).limit(1).maybeSingle());
  const format = preview.phase === "groups" ? "groups" : preview.phase === "knockout" ? "knockout" : preview.phase === "league" ? "league" : "unknown";
  const detectedSlots = Number(preview.qualificationRule?.slots) || null;
  const payload = {
    format, status: current?.status || "active", starts_on: parseProviderDate(preview.startsOn), updated_by: profile.user_id,
    ...(detectedSlots ? {
      qualification_slots: detectedSlots,
      metadata: { ...(current?.metadata || {}), qualificationRule: preview.qualificationRule },
    } : {}),
  };
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
  const slots = Number(preview.qualificationRule?.slots) || edition.qualification_slots || null;
  const rule = preview.qualificationRule || (slots ? { slots, kind: "top", source: "edition" } : {});
  const groupRows = preview.groups.map((group, index) => ({ edition_id: edition.id, stage_id: stage.id, name: group.name, external_id: group.name.match(/\d+/)?.[0] || null, is_strix_group: group.isStrixGroup, order_index: index, qualification_slots: slots, qualification_rule: rule }));
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
  const currentType = type(preview.knockout.currentStage || "");
  const stageNames = preview.knockout.rounds?.length ? preview.knockout.rounds.map((round) => round.name) : preview.knockout.stages;
  ensure(await client.from("competition_stages").upsert(stageNames.map((name, index) => {
    const itemType = type(name);
    const currentOrder = ["round_of_16", "quarterfinal", "semifinal", "final"].indexOf(currentType);
    const itemOrder = ["round_of_16", "quarterfinal", "semifinal", "final"].indexOf(itemType);
    return { edition_id: edition.id, name, stage_type: itemType, order_index: index + 10, status: itemType === currentType ? "active" : itemOrder >= 0 && itemOrder < currentOrder ? "completed" : "upcoming" };
  }), { onConflict: "edition_id,name" }));
  if (preview.knockout.teams?.length) {
    const teamRows = preview.knockout.teams.map((name) => ({ edition_id: edition.id, name, logo_url: preview.knockout.teamEntries?.find((team) => team.name === name)?.logo || null, is_strix: /\bstrix\b/i.test(name), metadata: {} }));
    const unique = dedupeCompetitionRows(teamRows, (row) => teamConflictKey(row, normalizeName));
    ensure(await client.from("competition_teams").upsert(unique.rows, { onConflict: "edition_id,normalized_name" }));
  }
}

async function normalizeFixtures(client, edition, source, preview) {
  const fixtures = preview.sourceKind === "knockout"
    ? expandKnockoutSlots(preview)
    : (preview.fixtures || []);
  if (!fixtures.length) return;
  const realFixtures = fixtures.filter((fixture) => !fixture.metadata?.placeholder);
  if (realFixtures.length) {
    const teamRows = realFixtures.flatMap((fixture) => [
      { edition_id: edition.id, name: fixture.homeTeamName, logo_url: fixture.homeLogo || null, is_strix: /\bstrix\b/i.test(fixture.homeTeamName), metadata: {} },
      { edition_id: edition.id, name: fixture.awayTeamName, logo_url: fixture.awayLogo || null, is_strix: /\bstrix\b/i.test(fixture.awayTeamName), metadata: {} },
    ]);
    const unique = dedupeCompetitionRows(teamRows, (row) => teamConflictKey(row, normalizeName));
    ensure(await client.from("competition_teams").upsert(unique.rows, { onConflict: "edition_id,normalized_name" }));
  }
  const teams = ensure(await client.from("competition_teams").select("*").eq("edition_id", edition.id));
  const stages = ensure(await client.from("competition_stages").select("*").eq("edition_id", edition.id));
  const rows = fixtures.map((fixture) => ({
    edition_id: edition.id,
    source_id: source.id,
    stage_id: stages.find((stage) => stage.name === fixture.roundLabel)?.id || null,
    external_match_id: fixture.externalMatchId,
    round_label: fixture.roundLabel || null,
    scheduled_at: fixture.scheduledAt || null,
    home_team_id: teams.find((team) => normalizeName(team.name) === normalizeName(fixture.homeTeamName))?.id || null,
    away_team_id: teams.find((team) => normalizeName(team.name) === normalizeName(fixture.awayTeamName))?.id || null,
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
      provider: preview.provider,
      organization: preview.organization,
      source: preview.source,
      homeLogo: fixture.homeLogo || teams.find((team) => normalizeName(team.name) === normalizeName(fixture.homeTeamName))?.logo_url || "",
      awayLogo: fixture.awayLogo || teams.find((team) => normalizeName(team.name) === normalizeName(fixture.awayTeamName))?.logo_url || "",
      bracketPosition: fixture.bracketPosition ?? fixture.metadata?.bracketPosition ?? null,
      feedsIntoPosition: fixture.feedsIntoPosition ?? fixture.metadata?.feedsIntoPosition ?? null,
      ...(fixture.metadata || {}),
    },
  }));
  const uniqueRows = dedupeCompetitionRows(rows, fixtureConflictKey).rows;
  const bracketRows = uniqueRows.filter((fixture) => fixture.bracket_slot_key);
  const regularRows = uniqueRows.filter((fixture) => !fixture.bracket_slot_key);
  if (bracketRows.length) ensure(await client.from("competition_fixtures").upsert(bracketRows, { onConflict: "edition_id,bracket_slot_key" }));
  if (regularRows.length) ensure(await client.from("competition_fixtures").upsert(regularRows, { onConflict: "edition_id,external_match_id" }));
}

export async function saveCompetitionPreview(client, profile, preview, options = {}) {
  if (!canManageCompetitions(profile)) throw permissionDenied("A gestão estrutural de campeonatos é exclusiva de Desenvolvimento.");
  const candidates = [preview, ...(preview.relatedPreviews || [])];
  const preferredKnockout = selectPreferredKnockoutPreview(candidates);
  const previews = candidates.filter((item) => item.sourceKind !== "knockout" || item === preferredKnockout);
  const identity = previews.find((item) => item.sourceKind === "standings") || preview;
  const knockout = preferredKnockout;
  const inferredSlots = !identity.qualificationRule?.slots && knockout?.knockout?.teams?.length
    ? { slots: knockout.knockout.teams.length, kind: "top", source: "knockout_team_count" }
    : null;
  const composite = knockout
    ? { ...identity, qualificationRule: identity.qualificationRule || inferredSlots, phase: "knockout", knockout: knockout.knockout, relatedPreviews: preview.relatedPreviews }
    : identity;
  const competition = await upsertCompetition(client, profile, identity);
  const edition = await upsertEdition(client, profile, competition, composite, options.editionId || "");
  let source = null;
  for (const item of previews) {
    const savedSource = await upsertSource(client, profile, edition, item);
    source ||= savedSource;
    await normalizeStandings(client, edition, item.sourceKind === "standings" ? { ...item, qualificationRule: composite.qualificationRule } : item);
    await normalizeKnockout(client, edition, item);
    await normalizeFixtures(client, edition, savedSource, item);
  }
  const fixtures = ensure(await client.from("competition_fixtures").select("*").eq("edition_id", edition.id));
  await syncProviderAgenda(client, {
    competition,
    edition,
    actorUserId: profile.user_id,
    fixtures,
  });
  if (knockout) ensure(await client.from("competition_stages").update({ status: "completed" }).eq("edition_id", edition.id).in("stage_type", ["league", "group"]));
  ensure(await client.from("competition_audit_log").insert({ competition_id: competition.id, edition_id: edition.id, actor_user_id: profile.user_id, action: source.created_at === source.updated_at ? "competition_imported" : "competition_synced", result: { provider: preview.provider, sources: previews.map((item) => item.source), groups: identity.groups?.length || 0, teams: Math.max(...previews.map((item) => item.teamCount || 0)) } }));
  return { competition, edition, source };
}

export async function archiveCompetitionEdition(client, profile, edition, outcome) {
  if (!canManageCompetitions(profile)) throw permissionDenied("A gestão estrutural de campeonatos é exclusiva de Desenvolvimento.");
  const updated = ensure(await client.from("competition_editions").update({ status: "historical", archived_at: new Date().toISOString(), outcome, updated_by: profile.user_id }).eq("id", edition.id).select().single());
  ensure(await client.from("competition_audit_log").insert({ competition_id: edition.competition_id, edition_id: edition.id, actor_user_id: profile.user_id, action: "competition_archived", result: { outcome } }));
  return updated;
}

export async function deleteCompetitionEdition(client, profile, edition) {
  if (!canManageCompetitions(profile)) throw permissionDenied("A gestão estrutural de campeonatos é exclusiva de Desenvolvimento.");
  ensure(await client.from("competition_editions").delete().eq("id", edition.id));
  const remaining = ensure(await client.from("competition_editions").select("id", { count: "exact" }).eq("competition_id", edition.competition_id));
  const competitionGone = !remaining?.length;
  if (competitionGone) ensure(await client.from("competitions").delete().eq("id", edition.competition_id));
  // The record is written after the rows are gone, and never points at a row that
  // no longer exists (that was a foreign-key error on delete): the ids stay in the result.
  ensure(await client.from("competition_audit_log").insert({
    competition_id: competitionGone ? null : edition.competition_id,
    edition_id: null,
    actor_user_id: profile.user_id,
    action: "competition_deleted",
    result: { label: edition.label, status: edition.status, edition_id: edition.id, competition_id: edition.competition_id, competition_removed: competitionGone },
  }));
}
