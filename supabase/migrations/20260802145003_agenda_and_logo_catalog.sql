-- Agenda and opponent-logo catalog for the FC 27 project only.
-- No data is copied from FC 26 here: imports are explicit and auditable.

create table if not exists public.opponent_logos (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (char_length(trim(canonical_name)) between 1 and 120),
  normalized_name text generated always as (lower(regexp_replace(trim(canonical_name), '\\s+', ' ', 'g'))) stored,
  storage_path text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

create table if not exists public.agenda_matches (
  id uuid primary key default gen_random_uuid(),
  opponent_name text not null check (char_length(trim(opponent_name)) between 1 and 120),
  opponent_logo_id uuid references public.opponent_logos(id) on delete set null,
  competition_name text not null default 'AMISTOSO' check (char_length(trim(competition_name)) between 1 and 160),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'competition_import')),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agenda_matches_scheduled_at_idx on public.agenda_matches (scheduled_at);
create index if not exists agenda_matches_status_scheduled_at_idx on public.agenda_matches (status, scheduled_at);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public;

drop trigger if exists opponent_logos_touch on public.opponent_logos;
create trigger opponent_logos_touch before update on public.opponent_logos
for each row execute function private.touch_updated_at();

drop trigger if exists agenda_matches_touch on public.agenda_matches;
create trigger agenda_matches_touch before update on public.agenda_matches
for each row execute function private.touch_updated_at();

alter table public.opponent_logos enable row level security;
alter table public.agenda_matches enable row level security;

grant select on public.opponent_logos to authenticated;
grant select on public.agenda_matches to authenticated;
grant insert, update, delete on public.opponent_logos to authenticated;
grant insert, update, delete on public.agenda_matches to authenticated;

create policy "authenticated members read opponent logos" on public.opponent_logos
for select to authenticated using (true);
create policy "directors manage opponent logos" on public.opponent_logos
for all to authenticated using (private.has_minimum_tier('diretoria'))
with check (private.has_minimum_tier('diretoria'));

create policy "authenticated members read agenda" on public.agenda_matches
for select to authenticated using (true);
create policy "directors create agenda" on public.agenda_matches
for insert to authenticated with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "directors update agenda" on public.agenda_matches
for update to authenticated using (private.has_minimum_tier('diretoria'))
with check (
  private.has_minimum_tier('diretoria')
  and updated_by = (select auth.uid())
);
create policy "directors delete agenda" on public.agenda_matches
for delete to authenticated using (private.has_minimum_tier('diretoria'));

insert into storage.buckets (id, name, public)
values ('fc27-team-assets', 'fc27-team-assets', true)
on conflict (id) do update set public = excluded.public;

create policy "authenticated members read FC27 assets" on storage.objects
for select to authenticated using (bucket_id = 'fc27-team-assets');
create policy "directors upload FC27 assets" on storage.objects
for insert to authenticated with check (
  bucket_id = 'fc27-team-assets'
  and private.has_minimum_tier('diretoria')
);
create policy "directors update FC27 assets" on storage.objects
for update to authenticated using (
  bucket_id = 'fc27-team-assets' and private.has_minimum_tier('diretoria')
) with check (
  bucket_id = 'fc27-team-assets' and private.has_minimum_tier('diretoria')
);
create policy "directors delete FC27 assets" on storage.objects
for delete to authenticated using (
  bucket_id = 'fc27-team-assets' and private.has_minimum_tier('diretoria')
);
