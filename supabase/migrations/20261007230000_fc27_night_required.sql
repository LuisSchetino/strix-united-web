-- "Obrigatório da noite": the plays the board marks for one day, what each member watched of
-- them, and the days each member opened the site.
--
-- Members can read these tables but never write what they watched: that is written only by
-- the server (functions/api/night/required.js, with the service role), which counts time on
-- its own clock. So nobody can mark a play as watched from the browser.
-- Safe to run more than once.

create table if not exists public.night_required_items (
  day date not null,
  item_id uuid not null references public.library_items(id) on delete cascade,
  position smallint not null default 0,
  duration_seconds integer not null check (duration_seconds between 3 and 14400),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (day, item_id)
);

create table if not exists public.night_required_progress (
  day date not null,
  item_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  watched_seconds numeric(8,2) not null default 0 check (watched_seconds >= 0),
  last_ping_at timestamptz,
  opened_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (day, item_id, user_id),
  foreign key (day, item_id) references public.night_required_items(day, item_id) on delete cascade
);

create table if not exists public.member_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists night_required_progress_day_idx on public.night_required_progress (day, user_id);
create index if not exists member_visits_day_idx on public.member_visits (day);

-- At most three plays a day.
create or replace function private.limit_night_required()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (select count(*) from public.night_required_items where day = new.day and item_id <> new.item_id) >= 3 then
    raise exception 'night_required_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_night_required() from public, anon, authenticated;
drop trigger if exists night_required_limit on public.night_required_items;
create trigger night_required_limit
before insert on public.night_required_items
for each row execute function private.limit_night_required();

alter table public.night_required_items enable row level security;
alter table public.night_required_progress enable row level security;
alter table public.member_visits enable row level security;

revoke all on public.night_required_items from anon, authenticated;
revoke all on public.night_required_progress from anon, authenticated;
revoke all on public.member_visits from anon, authenticated;
grant select, insert, delete on public.night_required_items to authenticated;
grant select on public.night_required_progress to authenticated;
grant select on public.member_visits to authenticated;

drop policy if exists "members read night required items" on public.night_required_items;
create policy "members read night required items"
on public.night_required_items for select to authenticated
using ((select private.has_minimum_tier('player')));

drop policy if exists "directors mark night required items" on public.night_required_items;
create policy "directors mark night required items"
on public.night_required_items for insert to authenticated
with check ((select private.has_minimum_tier('diretoria')) and created_by = (select auth.uid()));

drop policy if exists "directors unmark night required items" on public.night_required_items;
create policy "directors unmark night required items"
on public.night_required_items for delete to authenticated
using ((select private.has_minimum_tier('diretoria')));

drop policy if exists "members read own night required progress" on public.night_required_progress;
create policy "members read own night required progress"
on public.night_required_progress for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_minimum_tier('conselho')));

drop policy if exists "members read own visits" on public.member_visits;
create policy "members read own visits"
on public.member_visits for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_minimum_tier('conselho')));
