-- FC27: preserve the existing squad records while restoring the three team
-- membership states used by the operational UI.
alter table public.club_players
  drop constraint if exists club_players_member_type_check;

alter table public.club_players
  add constraint club_players_member_type_check
  check (member_type in ('elenco', 'teste', 'complete'));

alter table public.club_players
  alter column member_type set default 'elenco';
