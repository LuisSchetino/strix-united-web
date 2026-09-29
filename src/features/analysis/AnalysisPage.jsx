import React, { useEffect, useMemo, useState } from "react";
import { IconArrowDownRight, IconArrowUpRight, IconArrowsExchange, IconBallFootball, IconChartBar, IconHandStop, IconMinus, IconRadar2, IconShieldCheck, IconShoe, IconStar, IconTargetArrow } from "@tabler/icons-react";
import { AnimatedNumber, SegmentedControl } from "../../ui/motion/motion.jsx";
import { canViewAnalysis } from "../../access.js";
import { AccessDenied } from "../../ui/AccessDenied.jsx";
import { RastroDataSignature } from "../../ui/RastroBrand.jsx";
import { SelectControl } from "../../ui/SelectControl.jsx";
import { analysisInsightKind, buildAnalysis, buildPlayerComparison, comparePeriods, playerComparisonState, selectAnalysisPeriod } from "./analysis-core.js";
import "./analysis.css";

const radarColors = ["#2F80FF", "#78ADFF", "#c8ccd0", "#245FAF"];
const metricIcons = {
  "GOLS / JOGO": IconBallFootball, "CHUTES / JOGO": IconShoe, "CONVERSÃO": IconTargetArrow,
  PRECISÃO: IconTargetArrow, "PASSES CERTOS / JOGO": IconArrowsExchange, "VOLUME / JOGO": IconChartBar,
  "GOLS SOFRIDOS / JOGO": IconShieldCheck, "DESARMES / JOGO": IconShieldCheck, "CLEAN SHEETS": IconShieldCheck,
  DEFESAS: IconHandStop, "NOTA MÉDIA": IconStar,
};
const Trend = ({ value }) => value === "up" ? <span className="is-up"><IconArrowUpRight/>MELHORA</span> : value === "down" ? <span className="is-down"><IconArrowDownRight/>QUEDA</span> : <span><IconMinus/>ESTÁVEL</span>;

function Metric({ icon: Icon, label, value, suffix = "", note, tooltip, trend }) {
  return <article className="analysis-metric" title={tooltip || undefined}><header><Icon size={20}/><small>{label}</small>{trend && <Trend value={trend}/>}</header><strong>{typeof value === "number" ? <AnimatedNumber id={`analysis-${label}-${value}`} value={value} suffix={suffix}/> : value ?? "—"}</strong><p>{note}</p></article>;
}

function InsightLine({ children }) {
  const kind = analysisInsightKind(children);
  const Icon = kind === "passing" ? IconArrowsExchange : kind === "attacking" ? IconBallFootball : IconShieldCheck;
  const parts = String(children).split(/(\d+(?:[,.]\d+)?%?)/g);
  return <p className={`analysis-insight-${kind}`}><Icon size={15} aria-hidden="true" />{parts.map((part, index) => /^\d/.test(part) ? <strong key={index}>{part}</strong> : part)}</p>;
}

const polygonPoints = (values, radius = 112, center = 145) => values.map((value, index) => {
  const angle = -Math.PI / 2 + index * (Math.PI * 2 / values.length);
  const distance = radius * (value / 100);
  return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
}).join(" ");

function RadarChart({ comparison }) {
  const count = comparison.axes.length;
  const axisPoints = comparison.axes.map((_, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / count);
    return { x: 145 + Math.cos(angle) * 112, y: 145 + Math.sin(angle) * 112, labelX: 145 + Math.cos(angle) * 135, labelY: 145 + Math.sin(angle) * 135 };
  });
  return <div className="analysis-radar-shell"><svg className="analysis-radar" viewBox="0 0 290 290" role="img" aria-label={`Comparação de ${comparison.players.map((player) => player.name).join(", ")}`}>
    {[25, 50, 75, 100].map((level) => <polygon key={level} points={polygonPoints(Array(count).fill(level))} className="radar-grid"/>)}
    {axisPoints.map((point, index) => <g key={comparison.axes[index]}><line x1="145" y1="145" x2={point.x} y2={point.y} className="radar-axis"/><text x={point.labelX} y={point.labelY} textAnchor={point.labelX < 125 ? "end" : point.labelX > 165 ? "start" : "middle"}>{comparison.axes[index]}</text></g>)}
    {comparison.players.map((player, index) => <polygon key={player.playerId || player.handle} points={polygonPoints(player.values)} style={{ "--radar-color": radarColors[index] }} className="radar-player"/>)}
  </svg><div className="analysis-radar-legend">{comparison.players.map((player, index) => <article key={player.playerId || player.handle} style={{ "--radar-color": radarColors[index] }}><header><i/><div><b>{player.name}</b><span>{player.games} jogo(s)</span></div></header><dl>{comparison.axes.map((axis, axisIndex) => <div key={axis}><dt>{axis}</dt><dd>{player.rawValues[axisIndex]}</dd></div>)}</dl></article>)}</div></div>;
}

function PlayerComparison({ matches, workspace, competitions }) {
  const [period, setPeriod] = useState("30days");
  const [competition, setCompetition] = useState("");
  const [kind, setKind] = useState("line");
  const [playerIds, setPlayerIds] = useState([]);
  const baseOptions = { period, competition, kind, players: workspace.players, aliases: workspace.aliases };
  const available = useMemo(() => buildPlayerComparison(matches, baseOptions), [matches, period, competition, kind, workspace.players, workspace.aliases]);
  const availableIds = available.roster.map((player) => player.playerId).filter(Boolean).join("|");
  useEffect(() => {
    const ids = availableIds ? availableIds.split("|") : [];
    setPlayerIds((current) => current.filter((id) => ids.includes(id)));
  }, [availableIds]);
  const comparison = useMemo(() => buildPlayerComparison(matches, { ...baseOptions, playerIds }), [matches, period, competition, kind, playerIds, workspace.players, workspace.aliases]);
  const comparisonState = playerComparisonState(comparison, playerIds);
  const togglePlayer = (id) => setPlayerIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <section className="analysis-xray"><header><div><span>RAIO-X DO ELENCO</span><h2>Comparação de jogadores.</h2><p>Métricas normalizadas dentro do recorte; os valores reais continuam visíveis ao lado.</p></div><IconRadar2 size={34}/></header>
    <div className="analysis-xray-filters"><SegmentedControl className="analysis-xray-toggle" items={[["line", "LINHA"], ["goalkeeper", "GOLEIROS"]]} active={kind} onChange={setKind} label="Posição dos jogadores comparados"/><SelectControl value={period} onChange={setPeriod} label="Período do Raio-X" options={[["7days", "7 DIAS"], ["30days", "30 DIAS"], ["90days", "90 DIAS"], ["season", "TEMPORADA"], ["all", "TODO O PERÍODO"]]} /><SelectControl value={competition} onChange={setCompetition} label="Competição do Raio-X" options={[["", "TODAS AS COMPETIÇÕES"], ...competitions.map((item) => [item, item])]} /></div>
    <div className="analysis-player-picker" aria-label="Jogadores do elenco ativo">{available.roster.map((player, index) => <button type="button" key={player.playerId} className={playerIds.includes(player.playerId) ? "selected" : ""} aria-pressed={playerIds.includes(player.playerId)} style={{ "--player-color": radarColors[Math.max(0, playerIds.indexOf(player.playerId))] || radarColors[index % radarColors.length] }} onClick={() => togglePlayer(player.playerId)}><i/><span>{player.name}</span><small>{player.hasSample ? `${player.validGames}J` : "SEM AMOSTRA"}</small></button>)}</div>
    {comparisonState === "no-sample" ? <div className="analysis-empty"><span>SEM AMOSTRA NESTE RECORTE</span><p>Os selecionados não têm dados de partida neste período e competição.</p></div> : comparisonState === "choose" ? <div className="analysis-empty"><span>ESCOLHA JOGADORES PARA COMPARAR</span><p>Os jogadores sem amostra continuam disponíveis; escolha quem deseja comparar.</p></div> : comparisonState === "needs-more" ? <div className="analysis-empty"><span>COMPARAÇÃO INDISPONÍVEL</span><p>Selecione ao menos dois jogadores com dados válidos neste recorte.</p></div> : <RadarChart comparison={comparison}/>}
  </section>;
}

export function AnalysisPage({ workspace, profile, matches = workspace.matches || [] }) {
  matches = Array.isArray(matches) ? matches : [];
  const activePlayers = Array.isArray(workspace.players) ? workspace.players : [];
  const aliases = Array.isArray(workspace.aliases) ? workspace.aliases : [];
  const [period, setPeriod] = useState("last5");
  matches = matches.filter((match) => match && typeof match === "object");
  const competitions = [...new Set(matches.map((match) => match.competition_name || "Amistoso"))].sort();
  const selected = useMemo(() => selectAnalysisPeriod(matches, period), [matches, period]);
  const { team, insights } = useMemo(() => buildAnalysis(selected, activePlayers), [selected, activePlayers]);
  const trends = useMemo(() => comparePeriods(matches, period), [matches, period]);
  if (!canViewAnalysis(profile)) return <AccessDenied page="analise" />;
  const groups = [
    ["OFENSIVO", IconBallFootball, [["GOLS / JOGO", team.averageGoalsFor, "", `${team.goalsFor} gols no período`, null, trends?.goals], ["CHUTES / JOGO", team.shotsPerGame, "", `${team.shots} finalizações registradas`], ["CONVERSÃO", team.shotConversion, "%", "gols ÷ finalizações", "Gols marcados ÷ finalizações registradas"]]],
    ["POSSE E PASSE", IconTargetArrow, [["PRECISÃO", team.passAccuracy, "%", team.passAccuracy == null ? "Sem dados registrados" : `${team.passesMade} / ${team.passAttempts}`, "Passes certos ÷ passes tentados", trends?.passing], ["PASSES CERTOS / JOGO", team.metricSamples?.passesMade ? team.passesMadePerGame : null, "", team.metricSamples?.passesMade ? `${team.passesMade} no período` : "Sem dados registrados"], ["VOLUME / JOGO", team.metricSamples?.passAttempts ? team.passAttemptsPerGame : null, "", team.metricSamples?.passAttempts ? "passes tentados" : "Sem dados registrados"]]],
    ["DEFENSIVO", IconShieldCheck, [["GOLS SOFRIDOS / JOGO", team.averageGoalsAgainst, "", `${team.goalsAgainst} no período`, null, trends?.conceded], ["DESARMES / JOGO", team.tacklesPerGame, "", `${team.tackles} ações registradas`], ["CLEAN SHEETS", team.cleanSheets, "", `${team.matchesConceding2Plus} jogo(s) sofrendo 2+`]]],
    ["GOLEIRO", IconHandStop, [["DEFESAS", team.metricSamples?.saves ? team.saves : null, "", team.savesPerGame == null ? "Sem dados registrados" : `${team.savesPerGame} por jogo`], ["NOTA MÉDIA", team.averageRating, "", "partidas com nota EA", null, trends?.rating]]],
  ];
  const periodLabel = ({ last5: "Últimos 5 jogos", last10: "Últimos 10 jogos", season: "Temporada" })[period] || period.replace("competition:", "");
  return <section className="data-page page-enter analysis-v2">
    <header className="data-page-header"><div><span>ANÁLISE · CONSELHO</span><h1>O que o jogo está dizendo.</h1><p>Leituras determinísticas para apoiar decisões, sem completar lacunas com suposições.</p></div><RastroDataSignature label="Data by" /></header>
    <div className="analysis-filters">
      <SegmentedControl
        className="statistics-tabs-v3"
        items={[["last5", "ÚLTIMOS 5"], ["last10", "ÚLTIMOS 10"], ["season", "TEMPORADA"]]}
        active={["last5", "last10", "season"].includes(period) ? period : "season"}
        onChange={setPeriod}
        label="Recorte da análise"
      />
      {competitions.length > 0 && <SelectControl value={period.startsWith("competition:") ? period : ""} onChange={(value) => value && setPeriod(value)} label="Filtrar por competição" options={[["", "COMPETIÇÃO"], ...competitions.map((competition) => [`competition:${competition}`, competition])]} />}
    </div>
    <section className="analysis-context"><IconArrowsExchange/><div role="status" aria-live="polite"><span>{periodLabel}</span><strong>{team.games} partida(s)</strong></div><p>{trends ? "Comparação com o período imediatamente anterior." : "Sem amostra anterior suficiente para tendência."}</p></section>
    <div id="analysis-results" className="analysis-results" key={period}>
      {team.games ? <><section className="analysis-groups">{groups.map(([title, Icon, metrics]) => <article className="analysis-group" key={title}><header><Icon/><div><span>LEITURA</span><h2>{title}</h2></div></header><div>{metrics.map(([label, value, suffix, note, tooltip, trend]) => <Metric key={label} icon={metricIcons[label] || Icon} label={label} value={value} suffix={suffix} note={value == null ? "Sem dados registrados" : note} tooltip={tooltip} trend={value == null ? null : trend}/>)}</div></article>)}</section><section className="analysis-insights"><header><span>INSIGHTS DO PERÍODO</span><h2>Leitura objetiva.</h2><RastroDataSignature label="Analytics by" /></header>{insights.map((insight) => <InsightLine key={insight}>{insight}</InsightLine>)}</section></> : <div className="analysis-empty">Não há partidas suficientes neste recorte. Escolha outro período ou competição.</div>}
    </div>
    <PlayerComparison matches={matches} workspace={{ ...workspace, players: activePlayers, aliases }} competitions={competitions}/>
  </section>;
}

export default AnalysisPage;
