-- Additive FC27 EA sync support. The browser remains read-only for service-role data;
-- this RPC is callable only by the server-side service role.

alter table public.club_players
  add column if not exists ea_player_id text,
  add column if not exists discord_id text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists club_players_ea_player_id_key
  on public.club_players (ea_player_id) where ea_player_id is not null;
create unique index if not exists club_players_discord_id_key
  on public.club_players (discord_id) where discord_id is not null;

alter table public.library_items
  add column if not exists source_system text,
  add column if not exists source_item_id text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists library_items_source_identity_key
  on public.library_items (source_system, source_item_id)
  where source_system is not null and source_item_id is not null;

create table if not exists public.club_match_players (
  id uuid primary key default gen_random_uuid(),
  club_match_id uuid not null references public.club_matches(id) on delete cascade,
  external_player_id text not null,
  ea_name text not null,
  normalized_ea_name text generated always as (lower(regexp_replace(trim(ea_name), '\\s+', ' ', 'g'))) stored,
  canonical_player_id uuid references public.club_players(id) on delete set null,
  position text,
  stats jsonb not null default '{}'::jsonb,
  raw_ea jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_match_id, external_player_id)
);

create index if not exists club_match_players_canonical_player_idx
  on public.club_match_players (canonical_player_id, club_match_id);

drop trigger if exists club_match_players_touch on public.club_match_players;
create trigger club_match_players_touch before update on public.club_match_players
for each row execute function private.touch_updated_at();

alter table public.club_match_players enable row level security;
revoke all on public.club_match_players from anon;
grant select on public.club_match_players to authenticated;
grant all on public.club_match_players to service_role;

drop policy if exists "authenticated members read FC27 match players" on public.club_match_players;
create policy "authenticated members read FC27 match players"
on public.club_match_players for select to authenticated using (true);

create or replace function public.sync_fc27_ea_matches(p_matches jsonb, p_actor uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  player jsonb;
  target_match_id uuid;
  target_player_id uuid;
  was_existing boolean;
  inserted_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
  player_count integer := 0;
  agenda_count integer := 0;
  agenda_id uuid;
  external_id text;
  player_external_id text;
  player_name text;
begin
  if p_actor is null or jsonb_typeof(coalesce(p_matches, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_ea_sync_payload';
  end if;

  for item in select value from jsonb_array_elements(p_matches)
  loop
    external_id := nullif(trim(item->>'id'), '');
    if external_id is null or nullif(trim(item->>'opponent'), '') is null or nullif(item->>'date', '') is null then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    select exists(select 1 from public.club_matches where external_match_id = external_id)
      into was_existing;
    agenda_id := nullif(item->>'agendaId', '')::uuid;

    insert into public.club_matches (
      external_match_id, source, played_at, opponent_name, competition_name,
      strix_score, opponent_score, agenda_match_id, raw_ea, performance,
      created_by, updated_by
    ) values (
      external_id, 'ea_api', (item->>'date')::timestamptz, trim(item->>'opponent'),
      coalesce(nullif(trim(item->>'competition'), ''), 'AMISTOSO'),
      greatest(0, coalesce((item->>'strixScore')::integer, 0)),
      greatest(0, coalesce((item->>'opponentScore')::integer, 0)),
      agenda_id, coalesce(item->'raw', '{}'::jsonb), coalesce(item->'performance', '{}'::jsonb),
      p_actor, p_actor
    )
    on conflict (external_match_id) do update set
      played_at = excluded.played_at,
      opponent_name = excluded.opponent_name,
      competition_name = excluded.competition_name,
      strix_score = excluded.strix_score,
      opponent_score = excluded.opponent_score,
      agenda_match_id = coalesce(excluded.agenda_match_id, public.club_matches.agenda_match_id),
      raw_ea = excluded.raw_ea,
      performance = excluded.performance,
      updated_by = excluded.updated_by
    returning id into target_match_id;

    if was_existing then updated_count := updated_count + 1;
    else inserted_count := inserted_count + 1;
    end if;

    for player in select value from jsonb_array_elements(coalesce(item#>'{performance,players}', '[]'::jsonb))
    loop
      player_name := coalesce(nullif(trim(player->>'eaName'), ''), nullif(trim(player->>'name'), ''));
      if player_name is null then continue; end if;
      player_external_id := coalesce(nullif(trim(player->>'id'), ''), lower(regexp_replace(player_name, '\\s+', ' ', 'g')));
      target_player_id := null;
      select cp.id into target_player_id
      from public.club_players cp
      left join public.club_player_aliases alias on alias.player_id = cp.id
      where cp.is_active
        and (cp.ea_player_id = player_external_id
          or alias.normalized_name = lower(regexp_replace(trim(player_name), '\\s+', ' ', 'g'))
          or cp.normalized_name = lower(regexp_replace(trim(player_name), '\\s+', ' ', 'g')))
      order by (cp.ea_player_id = player_external_id) desc, (alias.id is not null) desc
      limit 1;

      insert into public.club_match_players (
        club_match_id, external_player_id, ea_name, canonical_player_id, position, stats, raw_ea
      ) values (
        target_match_id, player_external_id, player_name, target_player_id,
        nullif(player->>'position', ''), player - 'raw', coalesce(player->'raw', player)
      )
      on conflict (club_match_id, external_player_id) do update set
        ea_name = excluded.ea_name,
        canonical_player_id = coalesce(excluded.canonical_player_id, public.club_match_players.canonical_player_id),
        position = excluded.position,
        stats = excluded.stats,
        raw_ea = excluded.raw_ea;
      player_count := player_count + 1;
    end loop;

    if agenda_id is not null then
      update public.agenda_matches set status = 'completed', updated_by = p_actor
      where id = agenda_id and status <> 'completed';
      if found then agenda_count := agenda_count + 1; end if;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'skipped', skipped_count,
    'player_rows', player_count,
    'agenda_linked', agenda_count
  );
end;
$$;

revoke all on function public.sync_fc27_ea_matches(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.sync_fc27_ea_matches(jsonb, uuid) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'club_match_players'
     ) then
    alter publication supabase_realtime add table public.club_match_players;
  end if;
end $$;

comment on function public.sync_fc27_ea_matches(jsonb, uuid) is
  'Server-only, idempotent persistence for normalized EA matches and player rows.';

;
