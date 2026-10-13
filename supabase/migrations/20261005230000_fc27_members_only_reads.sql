-- LOCAL ONLY until reviewed. Do not apply against remote Supabase automatically.
-- Additive and idempotent. No table, column or row of club data is changed.
--
-- WHY. Signing in creates a database session for ANY Discord account that goes through the
-- login, before the site checks the server and the role. The site then refuses whoever is
-- not a member with a mapped role, but these tables were readable by any such session
-- (`using (true)`): someone outside the club, or a player on trial, could read the Agenda,
-- the roster and the matches straight from the API without ever seeing a screen.
--
-- WHAT. Reading now requires what writing already required: an active row in team_members
-- (written only by the server, after Discord confirms the role) at "player" level or above.
-- Players on trial ("teste") do not enter the site, so their rows are closed here too.
-- Writes, the public "link da noite" and the link cards are unaffected (they never used
-- these policies: writes have their own, the other two read with the server key).

begin;

-- ------------------------------------------------------------ 1. member-only reads
do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('agenda_matches', 'authenticated members read agenda'),
      ('club_matches', 'authenticated members read FC27 matches'),
      ('club_match_players', 'authenticated members read FC27 match players'),
      ('club_players', 'authenticated members read FC27 squad'),
      ('club_player_aliases', 'authenticated members read FC27 player aliases'),
      ('competitions', 'authenticated members read competitions'),
      ('opponent_logos', 'authenticated members read opponent logos'),
      ('night_related', 'authenticated members read night related'),
      ('gameday_projects', 'authenticated members read Game Day projects'),
      ('gameday_player_assets', 'authenticated members read Game Day player assets')
    ) as listed(table_name, open_policy)
  loop
    if to_regclass('public.' || item.table_name) is null then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', item.open_policy, item.table_name);
    execute format('drop policy if exists %I on public.%I', 'club members read ' || item.table_name, item.table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.has_minimum_tier(''player'')))',
      'club members read ' || item.table_name, item.table_name
    );
  end loop;
end
$$;

-- Competition tables read through this function: a current edition was open to any session.
create or replace function private.can_read_competition_edition(target_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select private.has_minimum_tier('player') and exists (
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

-- The notice pinned on the Central (present only after its own migration): an active notice
-- was readable by any session.
do $$
begin
  if to_regclass('public.club_notices') is not null then
    drop policy if exists "members read club notices" on public.club_notices;
    create policy "members read club notices"
    on public.club_notices for select to authenticated
    using (
      (is_active and (select private.has_minimum_tier('player')))
      or (select private.has_minimum_tier('diretoria'))
    );
  end if;
end
$$;

-- ------------------------------------------------------- 2. players on trial stay out
-- The "teste" role marks a player on trial in Discord and on the roster; it is not a pass to
-- the site. Accounts that entered while it was one are closed. A player who receives the
-- player role is opened again by the server on the next sign-in.
update public.team_members
set is_active = false
where access_tier = 'teste' and is_active;

commit;
