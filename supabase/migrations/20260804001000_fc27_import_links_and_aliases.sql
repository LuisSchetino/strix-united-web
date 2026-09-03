-- FC 27: import review keeps a durable connection to the Agenda and to EA
-- player names.  A nickname is linked once, then future imports reuse it.

alter table public.club_matches
  add column if not exists agenda_match_id uuid references public.agenda_matches(id) on delete set null;
create unique index if not exists club_matches_agenda_match_id_unique
  on public.club_matches (agenda_match_id)
  where agenda_match_id is not null;
create table if not exists public.club_player_aliases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.club_players(id) on delete cascade,
  ea_name text not null check (char_length(trim(ea_name)) between 1 and 120),
  normalized_name text generated always as (lower(regexp_replace(trim(ea_name), '\\s+', ' ', 'g'))) stored,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);
create index if not exists club_player_aliases_player_id_idx
  on public.club_player_aliases (player_id);
drop trigger if exists club_player_aliases_touch on public.club_player_aliases;
create trigger club_player_aliases_touch before update on public.club_player_aliases
for each row execute function private.touch_updated_at();
alter table public.club_player_aliases enable row level security;
grant select, insert, update, delete on public.club_player_aliases to authenticated;
create policy "authenticated members read FC27 player aliases" on public.club_player_aliases
for select to authenticated using (true);
create policy "directors manage FC27 player aliases" on public.club_player_aliases
for all to authenticated using (private.has_minimum_tier('diretoria'))
with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'club_player_aliases'
     ) then
    alter publication supabase_realtime add table public.club_player_aliases;
  end if;
end $$;
