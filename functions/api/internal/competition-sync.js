import { createClient } from "@supabase/supabase-js";
import { fetchCompetitionBundle } from "../../_lib/competition-providers.js";
import { competitionFingerprint, countFixtureChanges, nextSyncAt, persistCompetitionSync, syncTodayProviderAgenda } from "../../_lib/competition-sync.js";

const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

async function digest(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function validSecret(request, expected) {
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!supplied || !expected) return false;
  const [left, right] = await Promise.all([digest(supplied), digest(expected)]);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) mismatch |= (left[index] || 0) ^ (right[index] || 0);
  return mismatch === 0;
}

async function syncSource(client, source, edition, competition) {
  const startedAt = new Date();
  const actor = edition.updated_by || edition.created_by;
  const claimUntil = new Date(startedAt.getTime() + 5 * 60 * 1000).toISOString();
  const claim = await client.from("competition_sources").update({ next_sync_at: claimUntil, last_checked_at: startedAt.toISOString() })
    .eq("id", source.id).lte("next_sync_at", startedAt.toISOString()).select("id").maybeSingle();
  if (claim.error) throw claim.error;
  if (!claim.data) return { status: "skipped", sourceId: source.id };

  const { data: before = [], error: beforeError } = await client.from("competition_fixtures").select("*").eq("edition_id", edition.id);
  if (beforeError) throw beforeError;
  try {
    const preview = await fetchCompetitionBundle(source.source_url);
    const fingerprint = await competitionFingerprint(preview);
    if (fingerprint === source.content_fingerprint) {
      const { error } = await client.from("competition_sources").update({
        last_checked_at: startedAt.toISOString(),
        next_sync_at: nextSyncAt(before, startedAt),
        consecutive_failures: 0,
        sync_status: "ok",
        sync_error: null,
      }).eq("id", source.id);
      if (error) throw error;
      return { status: "unchanged", sourceId: source.id };
    }

    await persistCompetitionSync(client, { competition, edition, actorUserId: actor, preview });
    const { data: after = [], error: afterError } = await client.from("competition_fixtures").select("*").eq("edition_id", edition.id);
    if (afterError) throw afterError;
    const fixtureChanges = countFixtureChanges(before, after);
    const agendaChanges = await syncTodayProviderAgenda(client, {
      competition, edition, actorUserId: actor, fixtures: after, now: startedAt,
    });
    const { error: stateError } = await client.from("competition_sources").update({
      content_fingerprint: fingerprint,
      last_checked_at: startedAt.toISOString(),
      last_synced_at: startedAt.toISOString(),
      next_sync_at: nextSyncAt(after, startedAt),
      consecutive_failures: 0,
      sync_status: "ok",
      sync_error: null,
    }).eq("id", source.id);
    if (stateError) throw stateError;
    const { error: logError } = await client.from("competition_sync_log").insert({
      competition_id: competition.id,
      edition_id: edition.id,
      source_id: source.id,
      provider: source.provider,
      status: "changed",
      fingerprint_before: source.content_fingerprint,
      fingerprint_after: fingerprint,
      fixtures_created: fixtureChanges.created,
      fixtures_updated: fixtureChanges.updated,
      agenda_created: agendaChanges.created,
      agenda_updated: agendaChanges.updated,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      details: { sources: 1 + (preview.relatedPreviews?.length || 0), groups: preview.groups?.length || 0 },
    });
    if (logError) throw logError;
    return { status: "changed", sourceId: source.id, fixtures: fixtureChanges, agenda: agendaChanges };
  } catch (error) {
    const failures = Number(source.consecutive_failures || 0) + 1;
    await client.from("competition_sources").update({
      last_checked_at: startedAt.toISOString(),
      next_sync_at: nextSyncAt(before, startedAt, failures),
      consecutive_failures: failures,
      sync_status: "error",
      sync_error: String(error?.message || error).slice(0, 500),
    }).eq("id", source.id);
    await client.from("competition_sync_log").insert({
      competition_id: competition.id,
      edition_id: edition.id,
      source_id: source.id,
      provider: source.provider,
      status: "error",
      fingerprint_before: source.content_fingerprint,
      error_message: String(error?.message || error).slice(0, 500),
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
    });
    return { status: "error", sourceId: source.id, error: String(error?.message || error) };
  }
}

export async function onRequestPost({ request, env }) {
  if (!await validSecret(request, env.FC27_SYNC_SECRET)) return response({ error: "authentication_required" }, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return response({ error: "backend_configuration_missing" }, 503);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const now = new Date().toISOString();
  const { data: sources = [], error } = await client.from("competition_sources").select("*")
    .eq("source_kind", "standings").lte("next_sync_at", now).order("next_sync_at").limit(6);
  if (error) return response({ error: "sync_state_unavailable", message: error.message }, 500);
  const results = [];
  for (const source of sources) {
    const { data: edition, error: editionError } = await client.from("competition_editions").select("*").eq("id", source.edition_id).eq("status", "active").maybeSingle();
    if (editionError) return response({ error: "edition_lookup_failed", message: editionError.message }, 500);
    if (!edition) continue;
    const { data: competition, error: competitionError } = await client.from("competitions").select("*").eq("id", edition.competition_id).eq("is_active", true).maybeSingle();
    if (competitionError) return response({ error: "competition_lookup_failed", message: competitionError.message }, 500);
    if (!competition) continue;
    results.push(await syncSource(client, source, edition, competition));
  }
  return response({ ok: true, checked: results.length, results, completedAt: new Date().toISOString() });
}
