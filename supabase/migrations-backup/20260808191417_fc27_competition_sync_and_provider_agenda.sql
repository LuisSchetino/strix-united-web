-- Additive automation state for FC27 competition polling and provider-backed Agenda.
-- Existing snapshots, standings, fixtures, agenda entries and internal lineup data are preserved.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

alter table public.competition_sources
  add column if not exists content_fingerprint text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists next_sync_at timestamptz not null default now(),
  add column if not exists consecutive_failures integer not null default 0
    check (consecutive_failures >= 0);

alter table public.competition_stages
  add column if not exists qualification_slots integer
    check (qualification_slots is null or qualification_slots > 0),
  add column if not exists qualification_rule jsonb not null default '{}'::jsonb;

alter table public.competition_groups
  add column if not exists qualification_slots integer
    check (qualification_slots is null or qualification_slots > 0),
  add column if not exists qualification_rule jsonb not null default '{}'::jsonb;

alter table public.agenda_matches
  add column if not exists source_fixture_id uuid
    references public.competition_fixtures(id) on delete set null;

create unique index if not exists agenda_matches_source_fixture_unique_idx
  on public.agenda_matches (source_fixture_id)
  where source_fixture_id is not null;

create index if not exists competition_sources_due_sync_idx
  on public.competition_sources (next_sync_at)
  where sync_status <> 'error' or consecutive_failures < 6;

create table if not exists public.competition_sync_log (
  id bigint generated always as identity primary key,
  competition_id uuid references public.competitions(id) on delete set null,
  edition_id uuid references public.competition_editions(id) on delete set null,
  source_id uuid references public.competition_sources(id) on delete set null,
  provider text not null check (provider in ('ccb', 'lb_esports')),
  status text not null check (status in ('changed', 'error')),
  fingerprint_before text,
  fingerprint_after text,
  fixtures_created integer not null default 0 check (fixtures_created >= 0),
  fixtures_updated integer not null default 0 check (fixtures_updated >= 0),
  agenda_created integer not null default 0 check (agenda_created >= 0),
  agenda_updated integer not null default 0 check (agenda_updated >= 0),
  error_message text,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists competition_sync_log_edition_created_idx
  on public.competition_sync_log (edition_id, completed_at desc);
create index if not exists competition_sync_log_source_id_idx
  on public.competition_sync_log (source_id);
create index if not exists competition_sync_log_competition_id_idx
  on public.competition_sync_log (competition_id);

alter table public.competition_sync_log enable row level security;
grant select on public.competition_sync_log to authenticated;
revoke insert, update, delete on public.competition_sync_log from authenticated;

create policy "developers read competition sync log"
on public.competition_sync_log for select to authenticated
using ((select private.has_minimum_tier('dev')));

create or replace function private.invoke_fc27_competition_sync()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, vault
as $$
declare
  sync_secret text;
  request_id bigint;
begin
  select decrypted_secret
    into sync_secret
  from vault.decrypted_secrets
  where name = 'fc27_competition_sync_secret'
  order by created_at desc
  limit 1;

  if sync_secret is null or length(sync_secret) < 32 then
    return null;
  end if;

  select net.http_post(
    url := 'https://strix-united-fc27.pages.dev/api/internal/competition-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || sync_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function private.invoke_fc27_competition_sync() from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'fc27-competition-sync-15m';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'fc27-competition-sync-15m',
    '*/15 * * * *',
    'select private.invoke_fc27_competition_sync()'
  );
end;
$$;
