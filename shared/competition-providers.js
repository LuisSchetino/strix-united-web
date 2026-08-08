const PROVIDERS = Object.freeze({
  "ccbclubs.com.br": { id: "ccb", organization: "CCB Clubs" },
  "www.ccbclubs.com.br": { id: "ccb", organization: "CCB Clubs" },
  "lbesports.com": { id: "lb_esports", organization: "LB Esports" },
  "www.lbesports.com": { id: "lb_esports", organization: "LB Esports" },
});

const entities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
export const decodeHtml = (value = "") => String(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);

export const htmlText = (value = "") => decodeHtml(String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ")
  .trim();

export function validateCompetitionUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("URL inválida."); }
  if (url.protocol !== "https:") throw new Error("Somente URLs HTTPS são aceitas.");
  if (url.username || url.password || (url.port && url.port !== "443")) throw new Error("URL com credenciais ou porta não permitida.");
  const provider = PROVIDERS[url.hostname.toLowerCase()];
  if (!provider) throw new Error("Provider não suportado.");
  if (!/\/fifa\.php$/i.test(url.pathname)) throw new Error("Página não suportada pelo provider.");
  const file = url.searchParams.get("file");
  if (!["classificacao", "eliminatoria"].includes(file)) throw new Error("Tipo de página não suportado.");
  const competitionId = url.searchParams.get("campeonato");
  const groupId = url.searchParams.get("grupo");
  if (!/^\d{1,10}$/.test(competitionId || "")) throw new Error("Identificador do campeonato inválido.");
  if (groupId && !/^\d{1,10}$/.test(groupId)) throw new Error("Identificador de grupo inválido.");
  url.hash = "";
  return {
    url: url.toString(), provider: provider.id, organization: provider.organization,
    kind: file === "eliminatoria" ? "knockout" : "standings",
    competitionId, groupId: groupId || null,
  };
}

export function validateProviderAssetUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("URL de asset inválida."); }
  if (url.protocol !== "https:") throw new Error("Somente assets HTTPS são aceitos.");
  if (url.username || url.password || (url.port && url.port !== "443")) throw new Error("Asset com credenciais ou porta não permitida.");
  if (!PROVIDERS[url.hostname.toLowerCase()]) throw new Error("Host de asset não suportado.");
  if (!/\.(?:png|jpe?g|webp|gif)(?:$|\?)/i.test(`${url.pathname}${url.search}`)) throw new Error("Formato de asset não suportado.");
  url.hash = "";
  return url.toString();
}

const absoluteUrl = (base, candidate) => {
  try { return new URL(decodeHtml(candidate), base).toString(); } catch { return ""; }
};

function hero(html, context) {
  const headingPatterns = context.provider === "ccb"
    ? [/<h1[^>]*>([\s\S]*?)<\/h1>/i]
    : [/<h2[^>]*class="[^"]*card-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i, /<h1[^>]*>([\s\S]*?)<\/h1>/i];
  const name = headingPatterns.map((pattern) => htmlText(html.match(pattern)?.[1])).find(Boolean)
    || `${context.organization} ${context.competitionId}`;
  const headingIndex = html.search(headingPatterns.find((pattern) => pattern.test(html)) || /<h1/i);
  const near = html.slice(Math.max(0, headingIndex - 1800), headingIndex + 1200);
  const image = near.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1] || "";
  const type = htmlText(near.match(/Tipo:<\/strong>\s*([^<]+)/i)?.[1] || near.match(/Tipo<br>\s*<strong>([^<]+)/i)?.[1]);
  const startsOn = htmlText(near.match(/In[ií]cio:<\/strong>\s*([^<]+)/i)?.[1] || near.match(/In[ií]cio<br>\s*<strong>([^<]+)/i)?.[1]);
  return { name, logo: absoluteUrl(context.url, image), type, startsOn };
}

function tableBlocks(html) {
  return [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => ({ html: match[0], index: match.index }));
}

function rowBlocks(table) {
  return [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

function cellBlocks(row) {
  return [...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((match) => ({ html: match[1], text: htmlText(match[1]) }));
}

function parseStandingTable(block, prefix, baseUrl) {
  const rows = rowBlocks(block.html);
  const header = rows.map((row) => cellBlocks(row).map((cell) => cell.text).join(" ")).find((text) => /\bTime\b/i.test(text) && /\bJ\b/.test(text) && /\bV\b/.test(text));
  if (!header) return null;
  const groupMatches = [...prefix.matchAll(/Classifica[cç][aã]o\s*-?\s*(Grupo\s*\d+)?/gi)];
  const groupName = htmlText(groupMatches.at(-1)?.[1]) || "Classificação geral";
  const standings = [];
  for (const row of rows) {
    const cells = cellBlocks(row);
    if (cells.length < 9 || /\bTime\b/i.test(cells.map((cell) => cell.text).join(" "))) continue;
    const teamCell = cells[1];
    const teamName = htmlText(teamCell?.html.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1]
      || teamCell?.html.match(/class=["'][^"']*team-name-rank[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]
      || teamCell?.html.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
    if (!teamName) continue;
    const numberCells = cells.slice(2).map((cell) => Number(cell.text.replace(/[^\d-]/g, ""))).filter(Number.isFinite);
    if (numberCells.length < 8) continue;
    const stats = numberCells.length >= 9 && numberCells[0] === numberCells.at(-1) ? numberCells.slice(0, -1) : numberCells;
    const [points, played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference] = stats;
    const form = [...teamCell.html.matchAll(/(?:forma-[a-z]+|badge\s+bg-[a-z-]+)[^>]*[^>]*>(WO|V|E|D)</gi)].map((match) => match[1].toUpperCase()).slice(0, 5);
    const image = teamCell.html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
    standings.push({
      position: Number(cells[0].text.replace(/\D/g, "")), team: teamName,
      points, played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference,
      form, logo: absoluteUrl(baseUrl, image), isStrix: /\bstrix\b/i.test(teamName),
    });
  }
  return standings.length ? { name: groupName, standings, isStrixGroup: standings.some((row) => row.isStrix) } : null;
}

function parseGroups(html, context) {
  return tableBlocks(html).map((block) => parseStandingTable(block, html.slice(Math.max(0, block.index - 2500), block.index), context.url)).filter(Boolean);
}

const providerDateTime = (value) => {
  const match = String(value || "").match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:00-03:00`;
};

const stageType = (value) => /oitava/i.test(value) ? "round_of_16"
  : /quarta/i.test(value) ? "quarterfinal"
    : /semi/i.test(value) ? "semifinal"
      : /^final/i.test(value) ? "final" : "other";

const normalizeFixtureKey = (value) => htmlText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseKnockout(html, context) {
  const stages = [...html.matchAll(/(?:Oitavas|Quartas|Semifinais?|Final|Terceiro lugar|3º Lugar)(?:\s+de\s+final)?/gi)]
    .map((match) => htmlText(match[0]))
    .filter((value, index, all) => all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
  const teams = [...html.matchAll(/<a[^>]+(?:title=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => htmlText(match[1] || match[2]))
    .filter((team) => team && !/classifica|regulamento|ranking|goleiro|zagueiro|meia|atacante/i.test(team))
    .filter((team, index, all) => all.findIndex((item) => item.toLowerCase() === team.toLowerCase()) === index);
  const rounds = [...html.matchAll(/<td\b[^>]*>([\s\S]{0,500}?(?:Oitavas|Quartas|Semifinais?|Final)(?:\s+de\s+final)?[\s\S]{0,180}?)<\/td>/gi)]
    .map((match) => {
      const text = htmlText(match[1]);
      const name = text.match(/(?:Oitavas|Quartas|Semifinais?|Final)(?:\s+de\s+final)?/i)?.[0] || "";
      return { name, type: stageType(name), scheduledAt: providerDateTime(text) };
    })
    .filter((round, index, all) => round.name && all.findIndex((item) => item.name.toLowerCase() === round.name.toLowerCase()) === index);
  const currentRound = rounds.find((round) => round.scheduledAt)
    || rounds.find((round) => round.type !== "round_of_16")
    || rounds[0]
    || null;
  const fixtures = currentRound && teams.length >= 2
    ? Array.from({ length: Math.floor(teams.length / 2) }, (_, index) => {
      const home = teams[index * 2];
      const away = teams[index * 2 + 1];
      return {
        externalMatchId: `${context.competitionId}:${context.groupId || "main"}:${currentRound.type}:${index}:${normalizeFixtureKey(home)}:${normalizeFixtureKey(away)}`,
        roundLabel: currentRound.name,
        scheduledAt: currentRound.scheduledAt,
        homeTeamName: home,
        awayTeamName: away,
        homeScore: null,
        awayScore: null,
        status: "scheduled",
        isStrix: /\bstrix\b/i.test(`${home} ${away}`),
      };
    })
    : [];
  return { stages, teams, rounds, currentStage: currentRound?.name || null, fixtures, hasStrix: teams.some((team) => /\bstrix\b/i.test(team)) };
}

function relatedSourceUrls(html, context) {
  const urls = [...html.matchAll(/href=["']([^"']*fifa\.php\?[^"']*file=(?:classificacao|eliminatoria)[^"']*)["']/gi)]
    .map((match) => absoluteUrl(context.url, match[1]))
    .filter(Boolean)
    .filter((candidate) => {
      try {
        const related = validateCompetitionUrl(candidate);
        return related.provider === context.provider && related.competitionId === context.competitionId && related.url !== context.url;
      } catch { return false; }
    });
  return [...new Set(urls)].slice(0, 8);
}

export function parseCompetitionHtml(html, rawUrl) {
  const context = validateCompetitionUrl(rawUrl);
  if (typeof html !== "string" || html.length < 500) throw new Error("HTML inesperado ou incompleto.");
  const info = hero(html, context);
  const groups = parseGroups(html, context);
  const knockout = context.kind === "knockout" ? parseKnockout(html, context) : { stages: [], teams: [], rounds: [], currentStage: null, fixtures: [], hasStrix: false };
  const phase = knockout.stages.length ? "knockout"
    : groups.length > 1 ? "groups"
      : /pontos corridos/i.test(info.type) ? "league" : groups.length ? "standings" : "unknown";
  if (phase === "unknown") throw new Error("A estrutura da página não corresponde a uma competição suportada.");
  return {
    provider: context.provider,
    organization: context.organization,
    source: context.url,
    sourceKind: context.kind,
    externalCompetitionId: context.competitionId,
    externalGroupId: context.groupId,
    name: info.name,
    logo: info.logo,
    type: info.type,
    startsOn: info.startsOn,
    phase,
    groups,
    strixGroup: groups.find((group) => group.isStrixGroup)?.name || null,
    teamCount: new Set(groups.flatMap((group) => group.standings.map((row) => row.team.toLowerCase()))).size || knockout.teams.length,
    knockout,
    relatedSourceUrls: relatedSourceUrls(html, context),
    fetchedAt: new Date().toISOString(),
  };
}
