export const campaignLevel = (edition) => {
  const outcome = String(edition.outcome || edition.final_stage || "").toLowerCase();
  if (/^campe[aã]o$/.test(outcome.trim())) return 100;
  if (outcome.includes("vice")) return 82;
  if (outcome.includes("semi")) return 65;
  if (outcome.includes("quarta")) return 48;
  if (outcome.includes("oitava")) return 34;
  if (outcome.includes("final")) return 82;
  if (edition.final_position) return Math.max(10, 72 - Number(edition.final_position) * 5);
  return 20;
};

export const campaignState = (edition) => {
  const outcome = String(edition?.outcome || edition?.final_stage || "").toLocaleLowerCase("pt-BR");
  if (/campe[aã]o/.test(outcome) && !/vice/.test(outcome)) return "champion";
  if (/vice|final/.test(outcome)) return "finalist";
  if (/elimin|oitava|quarta|semi/.test(outcome)) return "eliminated";
  return "ended";
};

export function aggregateCompetitionHistory(editions = []) {
  const groups = new Map();
  for (const edition of editions) {
    const key = edition.competition_id || edition.competition?.id || edition.competition_name || edition.name;
    const current = groups.get(key) || {
      competitionId: key,
      name: edition.competition?.name || edition.competition_name || edition.name || "Competição",
      editions: [], games: 0, wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0, titles: 0, finals: 0,
    };
    const stats = edition.stats || edition.metadata?.stats || {};
    current.editions.push({ ...edition, campaignLevel: campaignLevel(edition) });
    current.games += Number(stats.games) || 0;
    current.wins += Number(stats.wins) || 0;
    current.draws += Number(stats.draws) || 0;
    current.losses += Number(stats.losses) || 0;
    current.goalsFor += Number(stats.goalsFor ?? stats.goals_for) || 0;
    current.goalsAgainst += Number(stats.goalsAgainst ?? stats.goals_against) || 0;
    if (/^campe[aã]o$/i.test(String(edition.outcome || "").trim())) current.titles += 1;
    if (/^(campe[aã]o|vice-campe[aã]o)$/i.test(String(edition.outcome || "").trim()) || /^final$/i.test(String(edition.final_stage || "").trim())) current.finals += 1;
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    goalDifference: group.goalsFor - group.goalsAgainst,
    efficiency: group.games ? Math.round(((group.wins * 3 + group.draws) / (group.games * 3)) * 100) : 0,
    editions: group.editions.sort((a, b) => new Date(a.starts_on || a.created_at || 0) - new Date(b.starts_on || b.created_at || 0)),
  }));
}

const normalizedTeam = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR");

export function competitionStatsFromFixtures(fixtures = [], strixName = "STRIX UNITED") {
  const strix = normalizedTeam(strixName);
  const unique = new Map();
  for (const fixture of fixtures) {
    const key = fixture.bracket_slot_key || fixture.external_match_id || fixture.id;
    if (!key || unique.has(key)) continue;
    const homeName = normalizedTeam(fixture.home_team_name || fixture.homeTeamName);
    const awayName = normalizedTeam(fixture.away_team_name || fixture.awayTeamName);
    if (!homeName.includes(strix) && !awayName.includes(strix)) continue;
    const homeScore = fixture.home_score ?? fixture.homeScore;
    const awayScore = fixture.away_score ?? fixture.awayScore;
    if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) continue;
    unique.set(key, { homeName, awayName, homeScore: Number(homeScore), awayScore: Number(awayScore) });
  }
  const stats = { games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const fixture of unique.values()) {
    const isHome = fixture.homeName.includes(strix);
    const goalsFor = isHome ? fixture.homeScore : fixture.awayScore;
    const goalsAgainst = isHome ? fixture.awayScore : fixture.homeScore;
    stats.games += 1;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;
    if (goalsFor > goalsAgainst) stats.wins += 1;
    else if (goalsFor < goalsAgainst) stats.losses += 1;
    else stats.draws += 1;
  }
  return stats;
}

export function competitionHistoryStats(edition, fixtures = []) {
  const stored = edition?.stats || edition?.metadata?.stats || {};
  return Number(stored.games) > 0 ? stored : competitionStatsFromFixtures(fixtures);
}

export function detectParticipationEnd({ edition, fixtures = [], strixName = "STRIX UNITED" }) {
  const normalized = (value) => String(value || "").toLowerCase();
  const strix = normalized(strixName);
  const completed = fixtures.filter((fixture) => fixture.status === "completed" && [fixture.home_team_name, fixture.away_team_name].some((name) => normalized(name).includes(strix)));
  const last = completed.at(-1);
  if (!last) return { ended: false, confidence: "none" };
  const home = normalized(last.home_team_name).includes(strix);
  const strixScore = home ? last.home_score : last.away_score;
  const opponentScore = home ? last.away_score : last.home_score;
  const stage = normalized(last.stage_type || last.round_label || edition?.final_stage);
  if (Number(strixScore) < Number(opponentScore) && /oitava|quarta|semi|final/.test(stage)) {
    const outcome = stage.includes("quarta") ? "Eliminado nas quartas de final"
      : stage.includes("oitava") ? "Eliminado nas oitavas de final"
        : stage.includes("semi") ? "Eliminado na semifinal"
          : "Vice-campeão";
    return { ended: true, confidence: "high", outcome, fixture: last };
  }
  if (Number(strixScore) > Number(opponentScore) && /(^|\s)final($|\s)/.test(stage) && !/oitava|quarta|semi/.test(stage)) {
    return { ended: true, confidence: "high", outcome: "Campeão", fixture: last };
  }
  return { ended: false, confidence: "low", message: "Participação aparentemente encerrada. Enviar ao histórico?" };
}
