-- FC 27: "Reportar problema". Any member reports what went wrong; the site attaches where it
-- happened (page, device, recent errors) and, optionally, a picture. Dev reads every report and
-- moves it through aberto → vendo → resolvido; each member reads only their own.

create table if not exists public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reporter_name text not null default '' check (char_length(reporter_name) <= 120),
  message text not null check (char_length(trim(message)) between 3 and 2000),
  page text not null default '' check (char_length(page) <= 400),
  device jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  screenshot_path text check (screenshot_path is null or char_length(screenshot_path) <= 300),
  status text not null default 'open' check (status in ('open', 'seeing', 'resolved')),
  resolution_note text not null default '' check (char_length(resolution_note) <= 600),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists problem_reports_created_idx on public.problem_reports (created_at desc);
create index if not exists problem_reports_reporter_idx on public.problem_reports (reporter_user_id, created_at desc);

drop trigger if exists problem_reports_touch on public.problem_reports;
create trigger problem_reports_touch before update on public.problem_reports
for each row execute function private.touch_updated_at();

alter table public.problem_reports enable row level security;
grant select, insert on public.problem_reports to authenticated;
grant update (status, resolution_note, resolved_at, resolved_by) on public.problem_reports to authenticated;

drop policy if exists "members report problems" on public.problem_reports;
create policy "members report problems" on public.problem_reports
for insert to authenticated
with check (
  reporter_user_id = (select auth.uid())
  and status = 'open'
  and (select private.has_minimum_tier('teste'))
);

drop policy if exists "members read own problems, dev reads all" on public.problem_reports;
create policy "members read own problems, dev reads all" on public.problem_reports
for select to authenticated
using (reporter_user_id = (select auth.uid()) or (select private.has_minimum_tier('dev')));

drop policy if exists "dev moves problems" on public.problem_reports;
create policy "dev moves problems" on public.problem_reports
for update to authenticated
using ((select private.has_minimum_tier('dev')))
with check ((select private.has_minimum_tier('dev')));

-- Pictures: a private bucket, one folder per member (<user id>/<file>). The member uploads into
-- their own folder and reads it back; dev reads everything. Nothing here is public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fc27-problem-reports', 'fc27-problem-reports', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload problem pictures" on storage.objects;
create policy "members upload problem pictures" on storage.objects
for insert to authenticated with check (
  bucket_id = 'fc27-problem-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "members and dev read problem pictures" on storage.objects;
create policy "members and dev read problem pictures" on storage.objects
for select to authenticated using (
  bucket_id = 'fc27-problem-reports'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.has_minimum_tier('dev')))
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'problem_reports'
     ) then
    alter publication supabase_realtime add table public.problem_reports;
  end if;
end $$;
