-- LOCAL ONLY until reviewed. Do not apply against remote Supabase automatically.
-- Additive and idempotent. Library tracking learns two real facts it could not store:
--   * that a member opened the material outside the site (YouTube / Drive in a new tab);
--   * the member's Discord avatar, copied by the same trigger that already copies the name.
-- No column is removed or retyped; RLS and grants are unchanged.

begin;

alter table public.library_view_progress
  add column if not exists external_open_count integer not null default 0 check (external_open_count >= 0),
  add column if not exists last_external_open_at timestamptz,
  add column if not exists viewer_avatar_url text;

-- Same identity rule as before (the row belongs to auth.uid(), the name comes from
-- team_members); the avatar now travels with it.
create or replace function private.set_library_progress_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  new.user_id := (select auth.uid());
  select coalesce(nullif(trim(member.display_name), ''), 'Membro'), nullif(trim(member.avatar_url), '')
    into new.viewer_display_name, new.viewer_avatar_url
  from public.team_members member
  where member.user_id = new.user_id and member.is_active;
  new.viewer_display_name := coalesce(new.viewer_display_name, 'Membro');
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_library_progress_identity() from public, anon, authenticated;

commit;
