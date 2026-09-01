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

const uniqueLogo = (rows, readLogo) => {
  const urls = [...new Set(rows.map(readLogo).filter(Boolean))];
  return urls.length === 1 ? urls[0] : "";
};

export function resolveTeamIdentity({
  teamId,
  editionId,
  name,
  directLogo = "",
  teams = [],
  logos = [],
  history = [],
} = {}) {
  const byId = teamId ? teams.find((team) => team.id === teamId) : null;
  const normalized = normalizeTeamIdentityName(name);
  const pool = editionId ? teams.filter((team) => team.edition_id === editionId) : teams;
  const exact = normalized
    ? pool.filter((team) => normalizeTeamIdentityName(team.name) === normalized)
    : [];
  const alias = normalized
    ? pool.filter((team) => teamAliases(team).some((candidate) => normalizeTeamIdentityName(candidate) === normalized))
    : [];
  const scopedTeam = (exact.length === 1 ? exact[0] : null) || (alias.length === 1 ? alias[0] : null);
  const globalExact = normalized
    ? teams.filter((team) => normalizeTeamIdentityName(team.name) === normalized)
    : [];
  const globalAlias = normalized
    ? teams.filter((team) => teamAliases(team).some((candidate) => normalizeTeamIdentityName(candidate) === normalized))
    : [];
  const globalCandidates = globalExact.length ? globalExact : globalAlias;
  const sharedGlobalLogo = uniqueLogo(globalCandidates, (team) => team.logo_url);
  const globalTeam = globalCandidates.length === 1 || sharedGlobalLogo ? globalCandidates[0] : null;
  const team = byId || scopedTeam || globalTeam;
  const catalog = normalized
    ? logos.filter((logo) => normalizeTeamIdentityName(logo.canonical_name) === normalized)
    : [];
  const historical = normalized
    ? history.filter((item) => normalizeTeamIdentityName(item.name || item.opponent_name) === normalized)
    : [];
  const historicalLogo = uniqueLogo(historical, (item) => item.logo || item.resolved_opponent_logo_url || item.public_url);
  const logo = directLogo
    || byId?.logo_url
    || scopedTeam?.logo_url
    || sharedGlobalLogo
    || historicalLogo
    || (catalog.length === 1 ? catalog[0].public_url || "" : "")
    || "";
  const source = directLogo
    ? "direct"
    : byId
      ? "team_id"
      : scopedTeam
        ? (exact.length === 1 ? "edition_name" : "alias")
        : sharedGlobalLogo
          ? "global_name"
          : historicalLogo
            ? "history"
            : catalog.length === 1
              ? "logo_catalog"
              : "fallback";
  return {
    id: team?.id || teamId || null,
    name: team?.name || name || "Adversário",
    abbreviation: team?.metadata?.abbreviation || team?.metadata?.short_name || "",
    logo,
    source,
  };
}

export function resolveFixtureOpponentIdentity(fixture, { teams = [], logos = [], history = [] } = {}) {
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
    history,
  });
}

export function resolveAgendaTeamIdentity(agendaMatch, { fixtures = [], teams = [], logos = [], history = [] } = {}) {
  const directLogo = agendaMatch?.opponent_logos?.public_url || agendaMatch?.opponent_logos?.logo || "";
  const fixture = agendaMatch?.source_fixture_id
    ? fixtures.find((item) => item.id === agendaMatch.source_fixture_id)
    : null;
  if (fixture) {
    const resolved = resolveFixtureOpponentIdentity(fixture, { teams, logos, history });
    return directLogo ? { ...resolved, logo: directLogo, source: "direct" } : resolved;
  }
  return resolveTeamIdentity({
    teamId: agendaMatch?.opponent_team_id,
    editionId: agendaMatch?.competition_edition_id,
    name: agendaMatch?.opponent_name,
    directLogo,
    teams,
    logos,
    history,
  });
}
