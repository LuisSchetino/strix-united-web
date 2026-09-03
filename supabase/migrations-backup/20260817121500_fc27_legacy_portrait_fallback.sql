-- The FC26 source of truth contains both hosted portraits and small embedded PNG/JPEG
-- fallbacks. Keep the original bytes intact when no hosted source exists.
alter table public.club_players
  drop constraint if exists club_players_external_avatar_url_check;

alter table public.club_players
  add constraint club_players_external_avatar_url_check
  check (
    external_avatar_url is null
    or external_avatar_url ~ '^https://'
    or external_avatar_url ~ '^data:image/(png|jpeg|webp);base64,'
  );
