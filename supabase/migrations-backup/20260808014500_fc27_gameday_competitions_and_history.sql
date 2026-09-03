-- FC27 integrated competition and Game Day model.
-- Additive only: legacy competition_name fields remain available while records
-- are progressively linked to first-class competitions and editions.

alter table public.club_players
  add column if not exists shirt_number smallint check (shirt_number between 0 and 99);

create unique index if not exists club_players_active_shirt_number_unique
  on public.club_players (shirt_number)
  where is_active and shirt_number is not null;

create or replace function private.preserve_created_by()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.preserve_created_by() from public;

-- Replace the original broad ALL policies with operation-specific policies.
-- This keeps SELECT evaluation singular and lets directors maintain records
-- across managers without allowing created_by/updated_by to be forged.
drop policy if exists "directors manage FC27 squad" on public.club_players;
create policy "directors create FC27 squad"
on public.club_players for insert to authenticated with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "directors update FC27 squad"
on public.club_players for update to authenticated
using (private.has_minimum_tier('diretoria'))
with check (private.has_minimum_tier('diretoria') and updated_by = (select auth.uid()));
create policy "directors delete FC27 squad"
on public.club_players for delete to authenticated using (private.has_minimum_tier('diretoria'));

drop policy if exists "directors manage FC27 matches" on public.club_matches;
create policy "directors create FC27 matches"
on public.club_matches for insert to authenticated with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "directors update FC27 matches"
on public.club_matches for update to authenticated
using (private.has_minimum_tier('diretoria'))
with check (private.has_minimum_tier('diretoria') and updated_by = (select auth.uid()));
create policy "directors delete FC27 matches"
on public.club_matches for delete to authenticated using (private.has_minimum_tier('diretoria'));

drop policy if exists "directors manage FC27 player aliases" on public.club_player_aliases;
create policy "directors create FC27 player aliases"
on public.club_player_aliases for insert to authenticated with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "directors update FC27 player aliases"
on public.club_player_aliases for update to authenticated
using (private.has_minimum_tier('diretoria'))
with check (private.has_minimum_tier('diretoria') and updated_by = (select auth.uid()));
create policy "directors delete FC27 player aliases"
on public.club_player_aliases for delete to authenticated using (private.has_minimum_tier('diretoria'));

drop policy if exists "directors manage opponent logos" on public.opponent_logos;
create policy "directors create opponent logos"
on public.opponent_logos for insert to authenticated with check (
  private.has_minimum_tier('diretoria') and created_by = (select auth.uid())
);
create policy "directors update opponent logos"
on public.opponent_logos for update to authenticated
using (private.has_minimum_tier('diretoria'))
with check (private.has_minimum_tier('diretoria'));
create policy "directors delete opponent logos"
on public.opponent_logos for delete to authenticated using (private.has_minimum_tier('diretoria'));

create table if not exists public.gameday_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  template_id text not null,
  project jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gameday_player_assets (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  nickname text,
  position text not null default 'MC',
  original_path text,
  cutout_path text,
  uniform_path text,
  poses jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gameday_projects_updated_at_idx
  on public.gameday_projects (updated_at desc);
create index if not exists gameday_player_assets_name_idx
  on public.gameday_player_assets (is_active, display_name);

drop trigger if exists gameday_projects_touch on public.gameday_projects;
create trigger gameday_projects_touch before update on public.gameday_projects
for each row execute function private.touch_updated_at();

drop trigger if exists gameday_player_assets_touch on public.gameday_player_assets;
create trigger gameday_player_assets_touch before update on public.gameday_player_assets
for each row execute function private.touch_updated_at();

alter table public.gameday_projects enable row level security;
alter table public.gameday_player_assets enable row level security;
grant select, insert, update, delete on public.gameday_projects, public.gameday_player_assets to authenticated;

create policy "authenticated members read Game Day projects"
on public.gameday_projects for select to authenticated using (true);
create policy "directors create Game Day projects"
on public.gameday_projects for insert to authenticated with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "directors update Game Day projects"
on public.gameday_projects for update to authenticated
using (private.has_minimum_tier('diretoria'))
with check (private.has_minimum_tier('diretoria') and updated_by = (select auth.uid()));
create policy "directors delete Game Day projects"
on public.gameday_projects for delete to authenticated
using (private.has_minimum_tier('diretoria'));

create policy "authenticated members read Game Day player assets"
on public.gameday_player_assets for select to authenticated using (true);
create policy "directors create Game Day player assets"
on public.gameday_player_assets for insert to authenticated with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "directors update Game Day player assets"
on public.gameday_player_assets for update to authenticated
using (private.has_minimum_tier('diretoria'))
with check (private.has_minimum_tier('diretoria') and updated_by = (select auth.uid()));
create policy "directors delete Game Day player assets"
on public.gameday_player_assets for delete to authenticated
using (private.has_minimum_tier('diretoria'));

create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  normalized_name text generated always as (lower(regexp_replace(trim(name), '\\s+', ' ', 'g'))) stored,
  organization text,
  logo_url text,
  accent_color text not null default '#168cff' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  palette jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

create table if not exists public.competition_editions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  label text not null default 'Edição atual',
  season text,
  format text not null default 'unknown' check (format in ('unknown', 'league', 'groups', 'knockout', 'mixed')),
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'historical')),
  qualification_slots integer check (qualification_slots is null or qualification_slots > 0),
  tie_break_rules jsonb not null default '[]'::jsonb,
  starts_on date,
  ends_on date,
  final_position integer check (final_position is null or final_position > 0),
  final_stage text,
  outcome text,
  eliminated_by text,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, label)
);

create table if not exists public.competition_sources (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.competition_editions(id) on delete cascade,
  provider text not null check (provider in ('ccb', 'lb_esports')),
  source_kind text not null check (source_kind in ('standings', 'knockout', 'fixtures', 'results')),
  source_url text not null,
  external_competition_id text,
  external_group_id text,
  last_synced_at timestamptz,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'ok', 'warning', 'error')),
  sync_error text,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, source_url)
);

create table if not exists public.competition_stages (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.competition_editions(id) on delete cascade,
  name text not null,
  stage_type text not null check (stage_type in ('league', 'group', 'round_of_16', 'quarterfinal', 'semifinal', 'final', 'other')),
  order_index integer not null default 0,
  status text not null default 'active' check (status in ('upcoming', 'active', 'completed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, name)
);

create table if not exists public.competition_groups (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.competition_editions(id) on delete cascade,
  stage_id uuid references public.competition_stages(id) on delete cascade,
  external_id text,
  name text not null,
  is_strix_group boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, name)
);

create table if not exists public.competition_teams (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.competition_editions(id) on delete cascade,
  external_id text,
  name text not null,
  normalized_name text generated always as (lower(regexp_replace(trim(name), '\\s+', ' ', 'g'))) stored,
  logo_url text,
  is_strix boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, normalized_name)
);

create table if not exists public.competition_standings (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.competition_editions(id) on delete cascade,
  group_id uuid references public.competition_groups(id) on delete cascade,
  team_id uuid not null references public.competition_teams(id) on delete cascade,
  position integer not null check (position > 0),
  points integer not null default 0,
  played integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  goal_difference integer generated always as (goals_for - goals_against) stored,
  form jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (edition_id, group_id, team_id)
);

create table if not exists public.competition_fixtures (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.competition_editions(id) on delete cascade,
  source_id uuid references public.competition_sources(id) on delete set null,
  stage_id uuid references public.competition_stages(id) on delete set null,
  group_id uuid references public.competition_groups(id) on delete set null,
  external_match_id text,
  round_label text,
  scheduled_at timestamptz,
  home_team_id uuid references public.competition_teams(id) on delete set null,
  away_team_id uuid references public.competition_teams(id) on delete set null,
  home_team_name text not null,
  away_team_name text not null,
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  club_match_id uuid references public.club_matches(id) on delete set null,
  agenda_match_id uuid references public.agenda_matches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (edition_id, external_match_id)
);

create table if not exists public.competition_audit_log (
  id bigint generated always as identity primary key,
  competition_id uuid references public.competitions(id) on delete set null,
  edition_id uuid references public.competition_editions(id) on delete set null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists competition_editions_status_idx on public.competition_editions (status, updated_at desc);
create index if not exists competition_sources_sync_idx on public.competition_sources (edition_id, last_synced_at desc);
create index if not exists competition_groups_edition_idx on public.competition_groups (edition_id, order_index);
create index if not exists competition_teams_strix_idx on public.competition_teams (edition_id, is_strix);
create index if not exists competition_standings_group_position_idx on public.competition_standings (edition_id, group_id, position);
create index if not exists competition_fixtures_schedule_idx on public.competition_fixtures (edition_id, scheduled_at);
create index if not exists competition_audit_log_edition_idx on public.competition_audit_log (edition_id, created_at desc);
create index if not exists gameday_projects_created_by_idx on public.gameday_projects (created_by);
create index if not exists gameday_projects_updated_by_idx on public.gameday_projects (updated_by);
create index if not exists gameday_player_assets_created_by_idx on public.gameday_player_assets (created_by);
create index if not exists gameday_player_assets_updated_by_idx on public.gameday_player_assets (updated_by);
create index if not exists competitions_created_by_idx on public.competitions (created_by);
create index if not exists competitions_updated_by_idx on public.competitions (updated_by);
create index if not exists competition_editions_created_by_idx on public.competition_editions (created_by);
create index if not exists competition_editions_updated_by_idx on public.competition_editions (updated_by);
create index if not exists competition_sources_created_by_idx on public.competition_sources (created_by);
create index if not exists competition_sources_updated_by_idx on public.competition_sources (updated_by);
create index if not exists competition_groups_stage_id_idx on public.competition_groups (stage_id);
create index if not exists competition_standings_team_id_idx on public.competition_standings (team_id);
create index if not exists competition_fixtures_source_id_idx on public.competition_fixtures (source_id);
create index if not exists competition_fixtures_stage_id_idx on public.competition_fixtures (stage_id);
create index if not exists competition_fixtures_group_id_idx on public.competition_fixtures (group_id);
create index if not exists competition_fixtures_home_team_id_idx on public.competition_fixtures (home_team_id);
create index if not exists competition_fixtures_away_team_id_idx on public.competition_fixtures (away_team_id);
create index if not exists competition_fixtures_club_match_id_idx on public.competition_fixtures (club_match_id);
create index if not exists competition_fixtures_agenda_match_id_idx on public.competition_fixtures (agenda_match_id);
create index if not exists competition_audit_log_competition_id_idx on public.competition_audit_log (competition_id);
create index if not exists opponent_logos_created_by_idx on public.opponent_logos (created_by);
create index if not exists agenda_matches_opponent_logo_id_idx on public.agenda_matches (opponent_logo_id);
create index if not exists agenda_matches_previous_logo_id_idx on public.agenda_matches (previous_opponent_logo_id);
create index if not exists agenda_matches_created_by_idx on public.agenda_matches (created_by);
create index if not exists agenda_matches_updated_by_idx on public.agenda_matches (updated_by);
create index if not exists club_players_created_by_idx on public.club_players (created_by);
create index if not exists club_players_updated_by_idx on public.club_players (updated_by);
create index if not exists club_matches_opponent_logo_id_idx on public.club_matches (opponent_logo_id);
create index if not exists club_matches_created_by_idx on public.club_matches (created_by);
create index if not exists club_matches_updated_by_idx on public.club_matches (updated_by);
create index if not exists club_player_aliases_created_by_idx on public.club_player_aliases (created_by);
create index if not exists club_player_aliases_updated_by_idx on public.club_player_aliases (updated_by);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'opponent_logos', 'agenda_matches', 'club_players', 'club_matches',
    'club_player_aliases', 'gameday_projects', 'gameday_player_assets',
    'competitions', 'competition_editions', 'competition_sources'
  ] loop
    execute format('drop trigger if exists fc27_preserve_created_by on public.%I', table_name);
    execute format('create trigger fc27_preserve_created_by before update on public.%I for each row execute function private.preserve_created_by()', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'competitions', 'competition_editions', 'competition_sources',
    'competition_stages', 'competition_groups', 'competition_teams',
    'competition_standings', 'competition_fixtures'
  ] loop
    execute format('drop trigger if exists %I_touch on public.%I', table_name, table_name);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function private.can_read_competition_edition(target_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.competition_editions edition
    where edition.id = target_id
      and (
        edition.status <> 'historical'
        or private.has_minimum_tier('conselho')
      )
  );
$$;
revoke all on function private.can_read_competition_edition(uuid) from public;
grant execute on function private.can_read_competition_edition(uuid) to authenticated;

alter table public.competitions enable row level security;
alter table public.competition_editions enable row level security;
alter table public.competition_sources enable row level security;
alter table public.competition_stages enable row level security;
alter table public.competition_groups enable row level security;
alter table public.competition_teams enable row level security;
alter table public.competition_standings enable row level security;
alter table public.competition_fixtures enable row level security;
alter table public.competition_audit_log enable row level security;

grant select on public.competitions, public.competition_editions, public.competition_sources,
  public.competition_stages, public.competition_groups, public.competition_teams,
  public.competition_standings, public.competition_fixtures to authenticated;
grant insert, update on public.competitions, public.competition_editions, public.competition_sources,
  public.competition_stages, public.competition_groups, public.competition_teams,
  public.competition_standings, public.competition_fixtures to authenticated;
revoke delete on public.competitions, public.competition_editions, public.competition_sources,
  public.competition_stages, public.competition_groups, public.competition_teams,
  public.competition_standings, public.competition_fixtures from authenticated;
grant select, insert on public.competition_audit_log to authenticated;
grant usage, select on sequence public.competition_audit_log_id_seq to authenticated;

create policy "authenticated members read competitions"
on public.competitions for select to authenticated using (true);
create policy "members read permitted competition editions"
on public.competition_editions for select to authenticated
using (private.can_read_competition_edition(id));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'competition_sources', 'competition_stages', 'competition_groups',
    'competition_teams', 'competition_standings', 'competition_fixtures'
  ] loop
    execute format(
      'create policy "members read permitted %1$s" on public.%1$I for select to authenticated using (private.can_read_competition_edition(edition_id))',
      table_name
    );
  end loop;
end $$;

create policy "developers create competitions"
on public.competitions for insert to authenticated
with check (
  private.has_minimum_tier('dev')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "developers update competitions"
on public.competitions for update to authenticated
using (private.has_minimum_tier('dev'))
with check (private.has_minimum_tier('dev') and updated_by = (select auth.uid()));

create policy "developers create competition editions"
on public.competition_editions for insert to authenticated
with check (
  private.has_minimum_tier('dev')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "developers update competition editions"
on public.competition_editions for update to authenticated
using (private.has_minimum_tier('dev'))
with check (private.has_minimum_tier('dev') and updated_by = (select auth.uid()));

create policy "developers create competition sources"
on public.competition_sources for insert to authenticated
with check (
  private.has_minimum_tier('dev')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "developers update competition sources"
on public.competition_sources for update to authenticated
using (private.has_minimum_tier('dev'))
with check (private.has_minimum_tier('dev') and updated_by = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'competition_stages', 'competition_groups', 'competition_teams',
    'competition_standings', 'competition_fixtures'
  ] loop
    execute format(
      'create policy "developers create %1$s" on public.%1$I for insert to authenticated with check (private.has_minimum_tier(''dev''))',
      table_name
    );
    execute format(
      'create policy "developers update %1$s" on public.%1$I for update to authenticated using (private.has_minimum_tier(''dev'')) with check (private.has_minimum_tier(''dev''))',
      table_name
    );
  end loop;
end $$;

create policy "developers read competition audit"
on public.competition_audit_log for select to authenticated
using (private.has_minimum_tier('dev'));
create policy "developers append competition audit"
on public.competition_audit_log for insert to authenticated
with check (private.has_minimum_tier('dev') and actor_user_id = (select auth.uid()));

alter table public.agenda_matches
  add column if not exists competition_id uuid references public.competitions(id) on delete set null,
  add column if not exists competition_edition_id uuid references public.competition_editions(id) on delete set null;

alter table public.club_matches
  add column if not exists competition_id uuid references public.competitions(id) on delete set null,
  add column if not exists competition_edition_id uuid references public.competition_editions(id) on delete set null;

create index if not exists agenda_matches_competition_idx
  on public.agenda_matches (competition_id, scheduled_at);
create index if not exists club_matches_competition_id_idx
  on public.club_matches (competition_id, played_at desc);
create index if not exists agenda_matches_competition_edition_idx
  on public.agenda_matches (competition_edition_id);
create index if not exists club_matches_competition_edition_idx
  on public.club_matches (competition_edition_id);

-- Preserve legacy names by creating one first-class record per distinct existing
-- non-friendly competition. No match or agenda row is deleted or rewritten.
with source_names as (
  select competition_name as name, min(created_by::text)::uuid as actor
  from public.agenda_matches
  where trim(competition_name) <> '' and upper(trim(competition_name)) <> 'AMISTOSO'
  group by competition_name
  union all
  select competition_name as name, min(created_by::text)::uuid as actor
  from public.club_matches
  where trim(competition_name) <> '' and upper(trim(competition_name)) <> 'AMISTOSO'
  group by competition_name
), rolled as (
  select name, min(actor::text)::uuid as actor
  from source_names
  group by name
)
insert into public.competitions (name, created_by, updated_by)
select name, actor, actor from rolled
on conflict (normalized_name) do nothing;

insert into public.competition_editions (competition_id, label, season, created_by, updated_by)
select id, 'Edição atual', extract(year from current_date)::text, created_by, created_by
from public.competitions
on conflict (competition_id, label) do nothing;

update public.agenda_matches agenda
set competition_id = competition.id,
    competition_edition_id = edition.id
from public.competitions competition
join public.competition_editions edition on edition.competition_id = competition.id and edition.label = 'Edição atual'
where agenda.competition_id is null
  and lower(regexp_replace(trim(agenda.competition_name), '\\s+', ' ', 'g')) = competition.normalized_name;

update public.club_matches match
set competition_id = competition.id,
    competition_edition_id = edition.id
from public.competitions competition
join public.competition_editions edition on edition.competition_id = competition.id and edition.label = 'Edição atual'
where match.competition_id is null
  and lower(regexp_replace(trim(match.competition_name), '\\s+', ' ', 'g')) = competition.normalized_name;

do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'gameday_projects', 'gameday_player_assets', 'competitions',
      'competition_editions', 'competition_sources', 'competition_stages',
      'competition_groups', 'competition_teams', 'competition_standings',
      'competition_fixtures'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
