-- Canonical team identity for provider Agenda entries and stable knockout slots.
-- Additive and non-destructive: ambiguous duplicate fixtures are retained and marked.

alter table public.agenda_matches
  add column if not exists opponent_team_id uuid
    references public.competition_teams(id) on delete set null;
alter table public.competition_fixtures
  add column if not exists bracket_slot_key text,
  add column if not exists bracket_position integer,
  add column if not exists winner_to_slot_key text,
  add column if not exists winner_to_slot smallint;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.competition_fixtures'::regclass
      and conname = 'competition_fixtures_bracket_position_check'
  ) then
    alter table public.competition_fixtures
      add constraint competition_fixtures_bracket_position_check
      check (bracket_position is null or bracket_position >= 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.competition_fixtures'::regclass
      and conname = 'competition_fixtures_winner_to_slot_check'
  ) then
    alter table public.competition_fixtures
      add constraint competition_fixtures_winner_to_slot_check
      check (winner_to_slot is null or winner_to_slot in (1, 2)) not valid;
  end if;
end $$;
-- Pick one canonical record per existing round/position. Linked and completed rows win;
-- the remaining records are preserved for audit, but no longer participate in the tree.
with ranked as (
  select
    fixture.id,
    fixture.edition_id,
    (case
      when fixture.round_label ~* 'oitav|round.?of.?16' then 'round_of_16'
      when fixture.round_label ~* 'quarta|quarter' then 'quarterfinal'
      when fixture.round_label ~* 'semi' then 'semifinal'
      when fixture.round_label ~* 'final' then 'final'
      else lower(regexp_replace(trim(fixture.round_label), '[^a-zA-Z0-9]+', '_', 'g'))
    end)
      || ':' || (fixture.metadata->>'bracketPosition') as slot_key,
    (fixture.metadata->>'bracketPosition')::integer as slot_position,
    first_value(fixture.id) over slot_partition as canonical_id,
    row_number() over slot_partition as slot_rank
  from public.competition_fixtures fixture
  where fixture.round_label is not null
    and fixture.round_label ~* 'oitav|round.?of.?16|quarta|quarter|semi|final'
    and fixture.metadata->>'bracketPosition' ~ '^\d+$'
    and coalesce(fixture.metadata->>'superseded', 'false') <> 'true'
  window slot_partition as (
    partition by fixture.edition_id,
      (case
        when fixture.round_label ~* 'oitav|round.?of.?16' then 'round_of_16'
        when fixture.round_label ~* 'quarta|quarter' then 'quarterfinal'
        when fixture.round_label ~* 'semi' then 'semifinal'
        when fixture.round_label ~* 'final' then 'final'
        else lower(regexp_replace(trim(fixture.round_label), '[^a-zA-Z0-9]+', '_', 'g'))
      end),
      fixture.metadata->>'bracketPosition'
    order by
      (fixture.club_match_id is not null or fixture.agenda_match_id is not null) desc,
      (fixture.status = 'completed') desc,
      fixture.updated_at desc,
      fixture.id
  )
), canonical as (
  update public.competition_fixtures fixture
  set bracket_slot_key = ranked.slot_key,
      bracket_position = ranked.slot_position,
      winner_to_slot_key = case
        when fixture.round_label ~* 'oitav|round.?of.?16' then 'quarterfinal:' || floor(ranked.slot_position / 2.0)::integer
        when fixture.round_label ~* 'quarta|quarter' then 'semifinal:' || floor(ranked.slot_position / 2.0)::integer
        when fixture.round_label ~* 'semi' then 'final:' || floor(ranked.slot_position / 2.0)::integer
        else null
      end,
      winner_to_slot = case
        when fixture.round_label ~* 'oitav|round.?of.?16|quarta|quarter|semi' then (ranked.slot_position % 2) + 1
        else null
      end,
      metadata = fixture.metadata - 'superseded' - 'supersededReason' - 'canonicalFixtureId'
  from ranked
  where fixture.id = ranked.id and ranked.slot_rank = 1
  returning fixture.id
)
update public.competition_fixtures fixture
set metadata = fixture.metadata || jsonb_build_object(
  'superseded', true,
  'supersededReason', 'duplicate_bracket_slot',
  'canonicalFixtureId', ranked.canonical_id
)
from ranked
where fixture.id = ranked.id and ranked.slot_rank > 1;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.competition_fixtures'::regclass
      and conname = 'competition_fixtures_edition_bracket_slot_key_key'
  ) then
    alter table public.competition_fixtures
      add constraint competition_fixtures_edition_bracket_slot_key_key
      unique (edition_id, bracket_slot_key);
  end if;
end $$;
create index if not exists agenda_matches_opponent_team_id_idx
  on public.agenda_matches (opponent_team_id);
create index if not exists competition_fixtures_winner_to_slot_key_idx
  on public.competition_fixtures (edition_id, winner_to_slot_key)
  where winner_to_slot_key is not null;
-- Existing automatic Agenda rows inherit the canonical opponent without recreation.
update public.agenda_matches agenda
set opponent_team_id = case
  when fixture.home_team_name ~* '\mstrix\M' then fixture.away_team_id
  when fixture.away_team_name ~* '\mstrix\M' then fixture.home_team_id
  else agenda.opponent_team_id
end
from public.competition_fixtures fixture
where agenda.source_fixture_id = fixture.id
  and agenda.opponent_team_id is null;
alter table public.competition_fixtures
  validate constraint competition_fixtures_bracket_position_check;
alter table public.competition_fixtures
  validate constraint competition_fixtures_winner_to_slot_check;
comment on column public.agenda_matches.opponent_team_id is
  'Canonical competition team used to resolve the opponent identity dynamically.';
comment on column public.competition_fixtures.bracket_slot_key is
  'Stable round/position identity. Team changes update this slot instead of creating another match.';
comment on column public.competition_fixtures.winner_to_slot_key is
  'Stable destination slot for the winner of this match.';
