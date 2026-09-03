-- Additive metadata used to reconcile the published FC26 roster with FC27.
-- Existing players remain untouched; nullable columns keep every current row valid.
alter table public.club_players
  add column if not exists source_system text,
  add column if not exists source_player_id uuid,
  add column if not exists source_order smallint,
  add column if not exists external_avatar_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.club_players'::regclass
      and conname = 'club_players_source_system_check'
  ) then
    alter table public.club_players
      add constraint club_players_source_system_check
      check (source_system is null or source_system in ('fc26'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.club_players'::regclass
      and conname = 'club_players_external_avatar_url_check'
  ) then
    alter table public.club_players
      add constraint club_players_external_avatar_url_check
      check (external_avatar_url is null or external_avatar_url ~ '^https://');
  end if;
end $$;

create unique index if not exists club_players_source_identity_key
  on public.club_players (source_system, source_player_id);

create index if not exists club_players_source_order_idx
  on public.club_players (source_order)
  where source_order is not null;

comment on column public.club_players.source_system is
  'Optional source used for safe, idempotent roster reconciliation.';
comment on column public.club_players.source_player_id is
  'Stable identifier from the source system; it is not a cross-project foreign key.';
