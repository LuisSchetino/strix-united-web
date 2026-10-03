import { isStrixClubId } from "../../../shared/fc27-club.js";
import { normalizeTeamIdentityName } from "./team-identity.js";

const clubEntries = (raw) => {
  const clubs = raw?.clubs || raw?.club || raw?.clubData;
  if (!clubs || typeof clubs !== "object") return [];
  return Array.isArray(clubs)
    ? clubs.map((club) => ({ ...(club || {}), _clubKey: String(club?.clubId || club?.id || "") }))
    : Object.entries(clubs).map(([key, club]) => ({ ...(club || {}), _clubKey: key }));
};

export function readOpponentClubId(raw) {
  const opponent = clubEntries(raw).find((club) => {
    const id = String(club.clubId || club.id || club._clubKey || "").trim();
    return id && !isStrixClubId(id);
  });
  if (!opponent) return "";
  return String(opponent.clubId || opponent.id || opponent._clubKey || "").trim();
}

export function isShieldProvider(organization) {
  const value = String(organization || "").toLocaleLowerCase("pt-BR");
  return value.includes("ccb") || value.includes("lb esport") || value.includes("lbesport");
}

function bindLogo(index, rejected, clubId, logo) {
  const id = String(clubId || "").trim();
  if (!id || !logo || rejected.has(id)) return;
  const previous = index.get(id);
  if (previous && previous !== logo) {
    index.delete(id);
    rejected.add(id);
    return;
  }
  index.set(id, logo);
}

/** EA club id → one CCB/LBE crest. A name links the id only when every matching shield agrees. */
export function buildEaClubLogoIndex({
  matches = [],
  teams = [],
  editions = [],
  competitions = [],
} = {}) {
  const providerCompetitions = new Set(
    competitions.filter((competition) => isShieldProvider(competition.organization)).map((competition) => competition.id),
  );
  const providerEditions = new Set(
    editions.filter((edition) => providerCompetitions.has(edition.competition_id)).map((edition) => edition.id),
  );
  const providerTeams = teams.filter((team) => team.logo_url && !team.is_strix && providerEditions.has(team.edition_id));
  const index = new Map();
  const rejected = new Set();
  providerTeams.forEach((team) => bindLogo(index, rejected, team.metadata?.ea_club_id, team.logo_url));
  matches.forEach((match) => {
    const clubId = readOpponentClubId(match.raw_ea || match.raw);
    const name = normalizeTeamIdentityName(match.opponent_name || match.opponent);
    if (!clubId || !name) return;
    const logos = [...new Set(
      providerTeams
        .filter((team) => normalizeTeamIdentityName(team.name) === name)
        .map((team) => team.logo_url)
        .filter(Boolean),
    )];
    if (logos.length === 1) bindLogo(index, rejected, clubId, logos[0]);
  });
  const nameToClub = new Map();
  const rejectedNames = new Set();
  matches.forEach((match) => {
    const clubId = readOpponentClubId(match.raw_ea || match.raw);
    const name = normalizeTeamIdentityName(match.opponent_name || match.opponent);
    if (!clubId || !name || !index.has(clubId) || rejectedNames.has(name)) return;
    const previous = nameToClub.get(name);
    if (previous && previous !== clubId) {
      nameToClub.delete(name);
      rejectedNames.add(name);
      return;
    }
    nameToClub.set(name, clubId);
  });
  return { byClubId: index, byName: nameToClub };
}

export function eaClubLogoFor(index, { clubId = "", name = "" } = {}) {
  if (!index) return "";
  const id = String(clubId || "").trim() || index.byName?.get(normalizeTeamIdentityName(name)) || "";
  return id ? index.byClubId?.get(id) || "" : "";
}
