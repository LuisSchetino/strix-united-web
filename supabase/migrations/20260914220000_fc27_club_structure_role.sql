-- Official club structure on the roster. Discord access_tier remains login
-- permission only and cannot describe Manager/Staff or the squad itself.

alter table public.club_players
  add column if not exists structure_role text not null default 'jogador';

alter table public.club_players
  drop constraint if exists club_players_structure_role_check;

alter table public.club_players
  add constraint club_players_structure_role_check
  check (structure_role in ('jogador', 'staff', 'diretoria', 'conselho', 'manager'));

create index if not exists club_players_structure_role_idx
  on public.club_players (structure_role)
  where is_active;
