-- Relacionados da Noite: one saved list per Sao Paulo calendar day.
-- Player IDs only. Lineups remain a convenience, not the source of truth.

create table if not exists public.night_related (
  night_date date primary key,
  player_ids uuid[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists night_related_updated_at_idx
  on public.night_related (updated_at desc);

drop trigger if exists night_related_touch on public.night_related;
create trigger night_related_touch before update on public.night_related
for each row execute function private.touch_updated_at();

alter table public.night_related enable row level security;
grant select, insert, update, delete on public.night_related to authenticated;

create policy "authenticated members read night related"
on public.night_related for select to authenticated using (true);

create policy "directors create night related"
on public.night_related for insert to authenticated with check (
  private.has_minimum_tier('diretoria')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "directors update night related"
on public.night_related for update to authenticated
using (private.has_minimum_tier('diretoria'))
with check (private.has_minimum_tier('diretoria') and updated_by = (select auth.uid()));

create policy "directors delete night related"
on public.night_related for delete to authenticated
using (private.has_minimum_tier('diretoria'));
