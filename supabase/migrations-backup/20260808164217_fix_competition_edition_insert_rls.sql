-- Allow INSERT ... RETURNING on active competition editions.
--
-- The previous SELECT policy called a helper that queried the row being
-- returned. During INSERT ... RETURNING that self-lookup cannot see the new
-- tuple yet, so PostgREST reported the INSERT as an RLS violation even though
-- the dev actor fields and tier were valid. Evaluate the visible row directly
-- instead; historical editions remain restricted to Conselho and above.

drop policy if exists "members read permitted competition editions"
  on public.competition_editions;

create policy "members read permitted competition editions"
on public.competition_editions
for select
to authenticated
using (
  status <> 'historical'
  or (select private.has_minimum_tier('conselho'))
);
