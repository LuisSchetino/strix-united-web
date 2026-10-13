-- LOCAL ONLY until reviewed. Do not apply against remote Supabase automatically.
-- Additive and idempotent. The site works without this migration; what it unlocks:
--   * "Horário mudou": a match remembers its previous kick-off when the time changes
--     (whoever changes it: an edit in the Agenda or the competition sync);
--   * Library: moments marked inside a video and who a material is mainly for;
--   * "Recado da diretoria": one short notice pinned on the Central;
--   * "Histórico de mudanças": who changed a line-up, a match or the night list, and when.
-- No existing column is removed or retyped. Existing RLS and grants are unchanged.

begin;

-- ---------------------------------------------------------------- 1. reschedule
alter table public.agenda_matches
  add column if not exists previous_scheduled_at timestamptz,
  add column if not exists rescheduled_at timestamptz;

create or replace function private.track_agenda_reschedule()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at then
    new.previous_scheduled_at := old.scheduled_at;
    new.rescheduled_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.track_agenda_reschedule() from public, anon, authenticated;

drop trigger if exists agenda_matches_reschedule on public.agenda_matches;
create trigger agenda_matches_reschedule
before update of scheduled_at on public.agenda_matches
for each row execute function private.track_agenda_reschedule();

-- ------------------------------------------------- 2. library markers and focus
-- markers: [{ "t": 83, "label": "Saída de bola" }, ...]   (seconds from the start)
-- focus_positions: who the material is mainly for ("ZAG", "ATA"...). It never hides the
-- material from anyone; it only says who should watch it first.
alter table public.library_items
  add column if not exists markers jsonb not null default '[]'::jsonb,
  add column if not exists focus_positions text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.library_items'::regclass and conname = 'library_items_markers_is_array'
  ) then
    alter table public.library_items
      add constraint library_items_markers_is_array check (jsonb_typeof(markers) = 'array');
  end if;
end
$$;

-- ------------------------------------------------------------- 3. club notice
create table if not exists public.club_notices (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(trim(body)) between 1 and 280),
  is_active boolean not null default true,
  expires_at timestamptz,
  author_name text not null default 'Diretoria',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists club_notices_active_idx on public.club_notices (is_active, created_at desc);

create or replace function private.set_club_notice_author()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  select coalesce(nullif(trim(member.display_name), ''), 'Diretoria')
    into new.author_name
  from public.team_members member
  where member.user_id = (select auth.uid()) and member.is_active;
  new.author_name := coalesce(new.author_name, 'Diretoria');
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_club_notice_author() from public, anon, authenticated;

drop trigger if exists club_notices_author on public.club_notices;
create trigger club_notices_author
before insert or update on public.club_notices
for each row execute function private.set_club_notice_author();

alter table public.club_notices enable row level security;
grant select, insert, update on public.club_notices to authenticated;
revoke delete on public.club_notices from authenticated;

drop policy if exists "members read club notices" on public.club_notices;
create policy "members read club notices"
on public.club_notices for select to authenticated
using (is_active or (select private.has_minimum_tier('diretoria')));

drop policy if exists "directors create club notices" on public.club_notices;
create policy "directors create club notices"
on public.club_notices for insert to authenticated
with check (
  (select private.has_minimum_tier('diretoria'))
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists "directors update club notices" on public.club_notices;
create policy "directors update club notices"
on public.club_notices for update to authenticated
using ((select private.has_minimum_tier('diretoria')))
with check (
  (select private.has_minimum_tier('diretoria'))
  and updated_by = (select auth.uid())
);

-- ------------------------------------------------------------ 4. activity log
create table if not exists public.club_activity_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'Sistema',
  entity text not null check (entity in ('agenda', 'night_list', 'library', 'notice')),
  entity_id text,
  action text not null,
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists club_activity_log_created_idx on public.club_activity_log (created_at desc);
create index if not exists club_activity_log_entity_idx on public.club_activity_log (entity, entity_id, created_at desc);

alter table public.club_activity_log enable row level security;
grant select on public.club_activity_log to authenticated;
revoke insert, update, delete on public.club_activity_log from authenticated;

drop policy if exists "directors read club activity" on public.club_activity_log;
create policy "directors read club activity"
on public.club_activity_log for select to authenticated
using ((select private.has_minimum_tier('diretoria')));

-- One writer for every tracked table. It runs after the change and can never block it:
-- any failure inside is swallowed, the change itself is already done.
create or replace function private.log_club_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor uuid := (select auth.uid());
  actor_label text;
  filled_before integer;
  filled_after integer;
begin
  begin
    select coalesce(nullif(trim(member.display_name), ''), 'Membro')
      into actor_label
    from public.team_members member
    where member.user_id = actor;
    actor_label := coalesce(actor_label, case when actor is null then 'Sincronização automática' else 'Membro' end);

    if tg_table_name = 'agenda_matches' then
      if tg_op = 'INSERT' then
        insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary)
        values (actor, actor_label, 'agenda', new.id::text, 'created', 'Jogo contra ' || new.opponent_name || ' adicionado à Agenda');
      elsif tg_op = 'DELETE' then
        insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary)
        values (actor, actor_label, 'agenda', old.id::text, 'deleted', 'Jogo contra ' || old.opponent_name || ' excluído da Agenda');
      else
        if new.lineup is distinct from old.lineup then
          select count(*) into filled_before from jsonb_array_elements_text(coalesce(old.lineup, '[]'::jsonb)) as slot(value) where trim(slot.value) <> '';
          select count(*) into filled_after from jsonb_array_elements_text(coalesce(new.lineup, '[]'::jsonb)) as slot(value) where trim(slot.value) <> '';
          insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary, details)
          values (actor, actor_label, 'agenda', new.id::text, 'lineup_changed',
            'Escalação contra ' || new.opponent_name || ' alterada (' || filled_after || '/11)',
            jsonb_build_object('before', coalesce(old.lineup, '[]'::jsonb), 'after', coalesce(new.lineup, '[]'::jsonb), 'filled_before', filled_before, 'filled_after', filled_after));
        end if;
        if new.scheduled_at is distinct from old.scheduled_at then
          insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary, details)
          values (actor, actor_label, 'agenda', new.id::text, 'rescheduled',
            'Horário do jogo contra ' || new.opponent_name || ' alterado',
            jsonb_build_object('before', old.scheduled_at, 'after', new.scheduled_at));
        end if;
        if new.status is distinct from old.status and new.status = 'cancelled' then
          insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary)
          values (actor, actor_label, 'agenda', new.id::text, 'cancelled', 'Jogo contra ' || new.opponent_name || ' cancelado');
        elsif new.status is distinct from old.status and old.status = 'cancelled' then
          insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary)
          values (actor, actor_label, 'agenda', new.id::text, 'reactivated', 'Jogo contra ' || new.opponent_name || ' reativado');
        end if;
        if new.opponent_name is distinct from old.opponent_name then
          insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary, details)
          values (actor, actor_label, 'agenda', new.id::text, 'opponent_changed',
            'Adversário trocado: ' || old.opponent_name || ' → ' || new.opponent_name,
            jsonb_build_object('before', old.opponent_name, 'after', new.opponent_name));
        end if;
      end if;
    elsif tg_table_name = 'night_related' then
      insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary, details)
      values (actor, actor_label, 'night_list', new.night_date::text, 'saved',
        'Lista da noite de ' || to_char(new.night_date, 'DD/MM') || ' salva com ' || coalesce(array_length(new.player_ids, 1), 0) || ' nomes',
        jsonb_build_object('player_ids', to_jsonb(new.player_ids)));
    elsif tg_table_name = 'library_items' then
      if tg_op = 'INSERT' then
        insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary)
        values (actor, actor_label, 'library', new.id::text, 'added', 'Material "' || new.title || '" adicionado à Biblioteca');
      elsif new.status is distinct from old.status and new.status = 'archived' then
        insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary)
        values (actor, actor_label, 'library', new.id::text, 'archived', 'Material "' || new.title || '" removido da Biblioteca');
      elsif new.status is distinct from old.status and old.status = 'archived' then
        insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary)
        values (actor, actor_label, 'library', new.id::text, 'restored', 'Material "' || new.title || '" voltou para a Biblioteca');
      end if;
    elsif tg_table_name = 'club_notices' then
      insert into public.club_activity_log (actor_user_id, actor_name, entity, entity_id, action, summary)
      values (actor, actor_label, 'notice', new.id::text, case when tg_op = 'INSERT' then 'published' when new.is_active then 'updated' else 'removed' end,
        case when tg_op = 'INSERT' then 'Recado publicado na Central' when new.is_active then 'Recado da Central atualizado' else 'Recado retirado da Central' end);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;
revoke all on function private.log_club_activity() from public, anon, authenticated;

drop trigger if exists agenda_matches_activity on public.agenda_matches;
create trigger agenda_matches_activity
after insert or update or delete on public.agenda_matches
for each row execute function private.log_club_activity();

drop trigger if exists night_related_activity on public.night_related;
create trigger night_related_activity
after insert or update on public.night_related
for each row execute function private.log_club_activity();

drop trigger if exists library_items_activity on public.library_items;
create trigger library_items_activity
after insert or update on public.library_items
for each row execute function private.log_club_activity();

drop trigger if exists club_notices_activity on public.club_notices;
create trigger club_notices_activity
after insert or update on public.club_notices
for each row execute function private.log_club_activity();

-- ------------------------------------------------------------------ realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'club_notices'
    ) then
    alter publication supabase_realtime add table public.club_notices;
  end if;
end
$$;

commit;
