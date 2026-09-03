-- Post-apply hardening for FC27 competition data.
-- Keeps application CRUD grants while removing table-level operations that bypass
-- row-level policies or are not used by the frontend.

create index if not exists competition_audit_log_actor_user_id_idx
  on public.competition_audit_log (actor_user_id);

create index if not exists competition_standings_group_id_idx
  on public.competition_standings (group_id);

revoke delete, truncate, references, trigger
  on public.competitions,
     public.competition_editions,
     public.competition_sources,
     public.competition_stages,
     public.competition_groups,
     public.competition_teams,
     public.competition_standings,
     public.competition_fixtures
  from authenticated;

revoke update, delete, truncate, references, trigger
  on public.competition_audit_log
  from authenticated;

revoke truncate, references, trigger
  on public.gameday_projects,
     public.gameday_player_assets
  from authenticated;;
