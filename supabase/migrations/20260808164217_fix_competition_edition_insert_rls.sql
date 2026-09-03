-- Allow INSERT ... RETURNING on active competition editions.
-- The previous SELECT policy used a nested edition-read helper.
-- That helper queried competition_editions again, so a row that passed the
-- INSERT policy could not be returned in the same statement.
drop policy if exists "members read permitted competition editions"
  on public.competition_editions;

create policy "members read permitted competition editions"
on public.competition_editions
for select
to authenticated
using (
  status <> 'historical'
  or (select private.has_minimum_tier('conselho'))
);;
