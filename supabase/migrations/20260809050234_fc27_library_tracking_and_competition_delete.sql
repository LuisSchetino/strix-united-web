-- FC27 Library, honest playback progress and developer maintenance controls.
-- This migration is additive. Competition deletion uses the existing cascade / set-null
-- graph and remains restricted to the Dev tier.

begin;

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 180),
  category text not null check (category in ('jogada', 'review')),
  description text not null default '',
  thumbnail_url text,
  source_type text not null check (source_type in ('youtube', 'drive', 'direct')),
  source_url text not null check (source_url ~ '^https?://'),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  tags text[] not null default '{}'::text[],
  published_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  minimum_access_tier public.access_tier not null default 'player',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.library_view_progress (
  item_id uuid not null references public.library_items(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  viewer_display_name text not null default 'Membro',
  opened_at timestamptz not null default now(),
  started_at timestamptz,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  last_accessed_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create table if not exists public.system_flags (
  key text primary key check (key ~ '^[a-z0-9_]{3,64}$'),
  label text not null,
  description text not null default '',
  enabled boolean not null default false,
  public_to_members boolean not null default false,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index if not exists library_items_status_published_idx
  on public.library_items (status, published_at desc);
create index if not exists library_view_progress_user_access_idx
  on public.library_view_progress (user_id, last_accessed_at desc);
create index if not exists library_view_progress_item_percent_idx
  on public.library_view_progress (item_id, progress_percent desc);

drop trigger if exists library_items_touch on public.library_items;
create trigger library_items_touch
before update on public.library_items
for each row execute function private.touch_updated_at();

drop trigger if exists system_flags_touch on public.system_flags;
create trigger system_flags_touch
before update on public.system_flags
for each row execute function private.touch_updated_at();

create or replace function private.set_library_progress_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  new.user_id := (select auth.uid());
  select coalesce(nullif(trim(member.display_name), ''), 'Membro')
    into new.viewer_display_name
  from public.team_members member
  where member.user_id = new.user_id and member.is_active;
  new.viewer_display_name := coalesce(new.viewer_display_name, 'Membro');
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_library_progress_identity() from public, anon, authenticated;

drop trigger if exists library_progress_identity on public.library_view_progress;
create trigger library_progress_identity
before insert or update on public.library_view_progress
for each row execute function private.set_library_progress_identity();

alter table public.library_items enable row level security;
alter table public.library_view_progress enable row level security;
alter table public.system_flags enable row level security;

grant select, insert, update, delete on public.library_items to authenticated;
grant select, insert, update on public.library_view_progress to authenticated;
revoke delete on public.library_view_progress from authenticated;
grant select, insert, update on public.system_flags to authenticated;
revoke delete on public.system_flags from authenticated;

create policy "members read permitted library items"
on public.library_items for select to authenticated
using (
  (
    status = 'active'
    and (select private.has_minimum_tier(minimum_access_tier))
  )
  or (select private.has_minimum_tier('diretoria'))
);

create policy "directors create library items"
on public.library_items for insert to authenticated
with check (
  (select private.has_minimum_tier('diretoria'))
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "directors update library items"
on public.library_items for update to authenticated
using ((select private.has_minimum_tier('diretoria')))
with check (
  (select private.has_minimum_tier('diretoria'))
  and updated_by = (select auth.uid())
);

create policy "directors delete library items"
on public.library_items for delete to authenticated
using ((select private.has_minimum_tier('diretoria')));

create policy "members read own library progress"
on public.library_view_progress for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_minimum_tier('conselho'))
);

create policy "members create own library progress"
on public.library_view_progress for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "members update own library progress"
on public.library_view_progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "members read public system flags"
on public.system_flags for select to authenticated
using (public_to_members or (select private.has_minimum_tier('dev')));

create policy "developers create system flags"
on public.system_flags for insert to authenticated
with check (
  (select private.has_minimum_tier('dev'))
  and updated_by = (select auth.uid())
);

create policy "developers update system flags"
on public.system_flags for update to authenticated
using ((select private.has_minimum_tier('dev')))
with check (
  (select private.has_minimum_tier('dev'))
  and updated_by = (select auth.uid())
);

-- Deleting an edition cascades only provider-owned rows. Agenda and club matches keep
-- their own records because their competition foreign keys are ON DELETE SET NULL.
grant delete on public.competition_editions, public.competitions to authenticated;

create policy "developers delete competition editions"
on public.competition_editions for delete to authenticated
using ((select private.has_minimum_tier('dev')));

create policy "developers delete competitions"
on public.competitions for delete to authenticated
using ((select private.has_minimum_tier('dev')));

do $$
begin
  if not exists (select 1 from public.system_flags where key = 'site_maintenance') then
    insert into public.system_flags (key, label, description, enabled, public_to_members, updated_by)
    select 'site_maintenance', 'Manutenção do site', 'Exibe a tela de manutenção para membros, mantendo o acesso Dev.', false, true, user_id
    from public.team_members
    where access_tier = 'dev' and is_active
    order by created_at
    limit 1;
  end if;
  if not exists (select 1 from public.system_flags where key = 'provider_sync_paused') then
    insert into public.system_flags (key, label, description, enabled, public_to_members, updated_by)
    select 'provider_sync_paused', 'Pausar sincronização', 'Sinal operacional para manutenção dos providers.', false, false, user_id
    from public.team_members
    where access_tier = 'dev' and is_active
    order by created_at
    limit 1;
  end if;
end $$;

do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['library_items', 'library_view_progress', 'system_flags'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;

commit;
