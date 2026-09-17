-- LOCAL ONLY in this round. Do not apply against remote Supabase automatically.
-- Tightens existing private.has_minimum_tier checks:
--   * photo/number of an existing club_player are DEV-only
--   * hard-delete of club_players is DEV-only (archive remains Diretoria+)
--   * club_matches insert/update/delete become DEV-only
--   * night_related writes become DEV-only (Mídia is DEV-only)
-- Agenda create/update/delete stays Diretoria+. Library manage stays Diretoria+.
-- Additive and idempotent.

begin;

create or replace function private.guard_club_player_locked_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE'
     and old.is_active
     and (
       new.avatar_path is distinct from old.avatar_path
       or new.shirt_number is distinct from old.shirt_number
     )
     and not private.has_minimum_tier('dev') then
    raise exception 'player_photo_or_number_locked'
      using errcode = '42501',
            hint = 'Somente Desenvolvimento altera foto e número de um jogador existente.';
  end if;
  return new;
end;
$$;

drop trigger if exists club_players_lock_identity on public.club_players;
create trigger club_players_lock_identity
before update on public.club_players
for each row execute function private.guard_club_player_locked_fields();

drop policy if exists "directors delete FC27 squad" on public.club_players;
drop policy if exists "developers delete FC27 squad" on public.club_players;
create policy "developers delete FC27 squad"
on public.club_players for delete to authenticated
using (private.has_minimum_tier('dev'));

drop policy if exists "directors create FC27 matches" on public.club_matches;
drop policy if exists "directors update FC27 matches" on public.club_matches;
drop policy if exists "directors delete FC27 matches" on public.club_matches;
drop policy if exists "developers create FC27 matches" on public.club_matches;
drop policy if exists "developers update FC27 matches" on public.club_matches;
drop policy if exists "developers delete FC27 matches" on public.club_matches;
create policy "developers create FC27 matches"
on public.club_matches for insert to authenticated
with check (
  private.has_minimum_tier('dev')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "developers update FC27 matches"
on public.club_matches for update to authenticated
using (private.has_minimum_tier('dev'))
with check (
  private.has_minimum_tier('dev')
  and updated_by = (select auth.uid())
);
create policy "developers delete FC27 matches"
on public.club_matches for delete to authenticated
using (private.has_minimum_tier('dev'));

drop policy if exists "directors create night related" on public.night_related;
drop policy if exists "directors update night related" on public.night_related;
drop policy if exists "directors delete night related" on public.night_related;
drop policy if exists "developers create night related" on public.night_related;
drop policy if exists "developers update night related" on public.night_related;
drop policy if exists "developers delete night related" on public.night_related;
create policy "developers create night related"
on public.night_related for insert to authenticated
with check (
  private.has_minimum_tier('dev')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);
create policy "developers update night related"
on public.night_related for update to authenticated
using (private.has_minimum_tier('dev'))
with check (
  private.has_minimum_tier('dev')
  and updated_by = (select auth.uid())
);
create policy "developers delete night related"
on public.night_related for delete to authenticated
using (private.has_minimum_tier('dev'));

commit;
