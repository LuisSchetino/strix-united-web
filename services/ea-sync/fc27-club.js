export const FC27_CLUB_ID = "30428";
export const FC27_PLATFORM = "common-gen5";
export const FC27_MATCH_TYPES = Object.freeze(["friendlyMatch", "leagueMatch", "playoffMatch"]);
export const FC27_MAX_RESULTS = 10;
export const FC27_EA_MATCHES_URL = "https://proclubs.ea.com/api/fc/clubs/matches";
export const FC27_LEGACY_CLUB_IDS = Object.freeze(["15686"]);

export const FC27_CLUB = Object.freeze({
  clubId: FC27_CLUB_ID,
  platform: FC27_PLATFORM,
  matchTypes: FC27_MATCH_TYPES,
  maxResultCount: FC27_MAX_RESULTS,
});

export function isStrixClubId(value) {
  const id = String(value ?? "").trim();
  return id === FC27_CLUB_ID || FC27_LEGACY_CLUB_IDS.includes(id);
}

export function readStrixKeyed(source, preferredId = FC27_CLUB_ID) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  if (source[preferredId] != null) return source[preferredId];
  const key = Object.keys(source).find((item) => isStrixClubId(item));
  return key ? source[key] : undefined;
}

export function parseEaMatchesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return null;
}

export function eaMatchesUrl({
  clubId = FC27_CLUB_ID,
  platform = FC27_PLATFORM,
  matchType = "friendlyMatch",
  maxResultCount = FC27_MAX_RESULTS,
} = {}) {
  const url = new URL(FC27_EA_MATCHES_URL);
  url.searchParams.set("platform", platform);
  url.searchParams.set("clubIds", clubId);
  url.searchParams.set("matchType", matchType);
  url.searchParams.set("maxResultCount", String(maxResultCount));
  return url.toString();
}
