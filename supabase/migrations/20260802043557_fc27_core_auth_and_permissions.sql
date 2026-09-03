-- FC 27 starts with a separate, normalized identity core. Discord is the
-- authorization source; an email or phone number is never required here.
create extension if not exists pgcrypto;
do $$
begin
  create type public.access_tier as enum ('teste', 'player', 'conselho', 'diretoria', 'dev');
exception
  when duplicate_object then null;
end $$;
create table if not exists public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_id text not null unique check (discord_id ~ '^[0-9]{15,25}$'),
  display_name text not null check (char_length(display_name) between 1 and 120),
  discord_username text,
  avatar_url text,
  access_tier public.access_tier not null default 'player',
  is_active boolean not null default true,
  discord_role_ids jsonb not null default '[]'::jsonb,
  permission_revision bigint not null default 1,
  last_discord_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_members_active_tier_idx
  on public.team_members (is_active, access_tier);
create index if not exists team_members_discord_sync_idx
  on public.team_members (last_discord_sync_at asc nulls first);
create schema if not exists private;
create or replace function private.tier_weight(tier public.access_tier)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case tier
    when 'teste'::public.access_tier then 10
    when 'player'::public.access_tier then 20
    when 'conselho'::public.access_tier then 30
    when 'diretoria'::public.access_tier then 40
    when 'dev'::public.access_tier then 50
  end;
$$;
-- This is deliberately server-owned. It uses only auth.uid(), takes no user
-- supplied identity and lives outside the API-exposed public schema.
create or replace function private.has_minimum_tier(required_tier public.access_tier)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
    from public.team_members member
    where member.user_id = (select auth.uid())
      and member.is_active
      and private.tier_weight(member.access_tier) >= private.tier_weight(required_tier)
  );
$$;
revoke all on function private.tier_weight(public.access_tier) from public;
revoke all on function private.has_minimum_tier(public.access_tier) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_minimum_tier(public.access_tier) to authenticated;
create or replace function private.touch_team_member()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and (
    old.access_tier is distinct from new.access_tier
    or old.is_active is distinct from new.is_active
    or old.discord_role_ids is distinct from new.discord_role_ids
  ) then
    new.permission_revision := old.permission_revision + 1;
  end if;
  return new;
end;
$$;
revoke all on function private.touch_team_member() from public;
drop trigger if exists team_members_touch on public.team_members;
create trigger team_members_touch
before update on public.team_members
for each row execute function private.touch_team_member();
alter table public.team_members enable row level security;
drop policy if exists "members read their own access state" on public.team_members;
create policy "members read their own access state"
on public.team_members
for select
to authenticated
using (user_id = (select auth.uid()));
-- There are intentionally no browser INSERT/UPDATE/DELETE policies. Role sync
-- is done only by a server route with a service key after Discord verification.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'team_members'
    ) then
    alter publication supabase_realtime add table public.team_members;
  end if;
end $$;
