const SPORTS_SUFFIXES = new Set(["fc", "ec", "sc", "esports", "esport", "club", "clube"]);

export function normalizeTeamIdentityName(value) {
  const words = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && SPORTS_SUFFIXES.has(words.at(-1))) words.pop();
  return words.join(" ");
}

const teamAliases = (team) => [
  ...(Array.isArray(team?.metadata?.aliases) ? team.metadata.aliases : []),
  team?.metadata?.short_name,
  team?.metadata?.abbreviation,
].filter(Boolean);

export function resolveTeamIdentity({ teamId, editionId, name, teams = [], logos = [] } = {}) {
  const byId = teamId ? teams.find((team) => team.id === teamId) : null;
  const normalized = normalizeTeamIdentityName(name);
  const pool = editionId ? teams.filter((team) => team.edition_id === editionId) : teams;
  const exact = normalized
    ? pool.filter((team) => normalizeTeamIdentityName(team.name) === normalized)
    : [];
  const alias = normalized
    ? pool.filter((team) => teamAliases(team).some((candidate) => normalizeTeamIdentityName(candidate) === normalized))
    : [];
  const team = byId || (exact.length === 1 ? exact[0] : null) || (alias.length === 1 ? alias[0] : null);
  const catalog = normalized
    ? logos.filter((logo) => normalizeTeamIdentityName(logo.canonical_name) === normalized)
    : [];
  const logo = team?.logo_url || (catalog.length === 1 ? catalog[0].public_url || "" : "") || "";
  return {
    id: team?.id || teamId || null,
    name: team?.name || name || "Adversário",
    abbreviation: team?.metadata?.abbreviation || team?.metadata?.short_name || "",
    logo,
    source: byId ? "team_id" : team ? (exact.length === 1 ? "edition_name" : "alias") : catalog.length === 1 ? "logo_catalog" : "fallback",
  };
}

export function resolveFixtureOpponentIdentity(fixture, { teams = [], logos = [] } = {}) {
  if (!fixture) return resolveTeamIdentity({ teams, logos });
  const home = teams.find((team) => team.id === fixture.home_team_id);
  const away = teams.find((team) => team.id === fixture.away_team_id);
  const homeIsStrix = home?.is_strix || /\bstrix\b/i.test(fixture.home_team_name || "");
  const opponent = homeIsStrix
    ? { id: fixture.away_team_id, name: fixture.away_team_name, team: away }
    : { id: fixture.home_team_id, name: fixture.home_team_name, team: home };
  return resolveTeamIdentity({
    teamId: opponent.id,
    editionId: fixture.edition_id,
    name: opponent.name,
    teams,
    logos,
  });
}

export function resolveAgendaTeamIdentity(agendaMatch, { fixtures = [], teams = [], logos = [] } = {}) {
  const fixture = agendaMatch?.source_fixture_id
    ? fixtures.find((item) => item.id === agendaMatch.source_fixture_id)
    : null;
  if (fixture) return resolveFixtureOpponentIdentity(fixture, { teams, logos });
  return resolveTeamIdentity({
    teamId: agendaMatch?.opponent_team_id,
    editionId: agendaMatch?.competition_edition_id,
    name: agendaMatch?.opponent_name,
    teams,
    logos,
  });
}
