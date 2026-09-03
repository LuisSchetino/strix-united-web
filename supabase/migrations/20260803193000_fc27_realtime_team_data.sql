-- FC 27 operational data.  These tables are intentionally separate from FC 26.
-- They are the single source of truth for agenda, squad and match history, so
-- a phone and a desktop never have competing local-only versions.

alter table public.agenda_matches
  add column if not exists lineup jsonb not null default '[]'::jsonb,
  add column if not exists previous_opponent_name text,
  add column if not exists previous_opponent_logo_id uuid references public.opponent_logos(id) on delete set null,
  add column if not exists cancelled_at timestamptz;
create table if not exists public.club_players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  normalized_name text generated always as (lower(regexp_replace(trim(display_name), '\\s+', ' ', 'g'))) stored,
  avatar_path text,
  positions text[] not null default '{}',
  member_type text not null default 'complete' check (member_type in ('teste', 'complete')),
  trial_expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);
create table if not exists public.club_matches (
  id uuid primary key default gen_random_uuid(),
  external_match_id text unique,
  source text not null default 'manual' check (source in ('manual', 'ea_api', 'local_bridge')),
  played_at timestamptz not null,
  opponent_name text not null check (char_length(trim(opponent_name)) between 1 and 120),
  opponent_logo_id uuid references public.opponent_logos(id) on delete set null,
  competition_name text not null default 'AMISTOSO',
  strix_score integer not null default 0 check (strix_score >= 0),
  opponent_score integer not null default 0 check (opponent_score >= 0),
  raw_ea jsonb not null default '{}'::jsonb,
  performance jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists club_players_active_idx on public.club_players (is_active, display_name);
create index if not exists club_matches_played_at_idx on public.club_matches (played_at desc);
create index if not exists club_matches_competition_idx on public.club_matches (competition_name, played_at desc);
drop trigger if exists club_players_touch on public.club_players;
create trigger club_players_touch before update on public.club_players
for each row execute function private.touch_updated_at();
drop trigger if exists club_matches_touch on public.club_matches;
create trigger club_matches_touch before update on public.club_matches
for each row execute function private.touch_updated_at();
alter table public.club_players enable row level security;
alter table public.club_matches enable row level security;
grant select on public.club_players, public.club_matches to authenticated;
grant insert, update, delete on public.club_players, public.club_matches to authenticated;
create policy "authenticated members read FC27 squad" on public.club_players
for select to authenticated using (true);
create policy "directors manage FC27 squad" on public.club_players
for all to authenticated using (private.has_minimum_tier('diretoria'))
with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "authenticated members read FC27 matches" on public.club_matches
for select to authenticated using (true);
create policy "directors manage FC27 matches" on public.club_matches
for all to authenticated using (private.has_minimum_tier('diretoria'))
with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
do $$
declare
  table_name text;
begin
  foreach table_name in array array['agenda_matches', 'opponent_logos', 'club_players', 'club_matches']
  loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
