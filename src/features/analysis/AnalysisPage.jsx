import React, { useEffect, useMemo, useState } from "react";
import { IconArrowsExchange, IconBallFootball, IconHandStop, IconRadar2, IconShieldCheck } from "@tabler/icons-react";
import { AnimatedNumber, SegmentedControl } from "../../ui/motion/motion.jsx";
import { canViewAnalysis } from "../../access.js";
import { AccessDenied } from "../../ui/AccessDenied.jsx";
import { RastroDataSignature } from "../../ui/RastroBrand.jsx";
import { DataTrend } from "../../ui/DataTrend.jsx";
import { SelectControl } from "../../ui/SelectControl.jsx";
import { analysisInsightKind, buildAnalysis, buildPlayerComparison, comparePeriods, playerComparisonState, selectAnalysisPeriod } from "./analysis-core.js";
import "./analysis.css";
import { PageHeader } from "../../ui/PageHeader.jsx";

// The first series carries the data colour; the rest are told apart by luminance and line pattern.
const radarColors = ["var(--data)", "#f5f5f5", "#a9b0b8", "#757d86"];
const radarDashes = ["0", "7 4", "2 4", "12 4 2 4"];

const TREND_UNIT = { goals: "", conceded: "", passing: "p.p.", rating: "" };

function Metric({ label, value, suffix = "", note, tooltip, trendKey, trends, index }) {
  const trend = value == null || !trendKey || !trends ? null : trends[trendKey];
  return <article className="analysis-metric data-arrive" style={{ "--i": index }} title={tooltip || undefined}>
    <header><small>{label}</small>{trend && <DataTrend trend={trend} delta={trends.deltas?.[trendKey]} unit={TREND_UNIT[trendKey]} against={`${trends.window} anteriores`} />}</header>
    <strong className={value == null ? "is-empty" : "data-value"}>{typeof value === "number" ? <AnimatedNumber id={`analysis-${label}-${value}`} value={value} suffix={suffix}/> : value ?? "—"}</strong>
    <p>{value == null ? "Sem dados registrados" : note}</p>
  </article>;
}

/** Every reading block opens the same way: its mark in a hairline ring, then the title. */
function GroupMark({ icon: Icon }) {
  return <span className="analysis-group-mark" aria-hidden="true"><Icon size={18} stroke={1.6} /></span>;
}

function InsightLine({ children }) {
  const kind = analysisInsightKind(children);
  const Icon = kind === "passing" ? IconArrowsExchange : kind === "attacking" ? IconBallFootball : IconShieldCheck;
  const parts = String(children).split(/(\d+(?:[,.]\d+)?%?)/g);
  return <p className={`analysis-insight-${kind}`}><Icon size={15} aria-hidden="true" /><span>{parts.map((part, index) => /^\d/.test(part) ? <strong className="data-value" key={index}>{part}</strong> : part)}</span></p>;
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
    {comparison.players.map((player, index) => <polygon key={player.playerId || player.handle} points={polygonPoints(player.values)} style={{ "--radar-color": radarColors[index], "--radar-dash": radarDashes[index] }} className="radar-player"/>)}
  </svg><div className="analysis-radar-legend">{comparison.players.map((player, index) => <article key={player.playerId || player.handle} style={{ "--radar-color": radarColors[index] }}><header><i/><div><b>{player.name}</b><span>{player.games} jogo(s)</span></div></header><dl>{comparison.axes.map((axis, axisIndex) => <div key={axis}><dt>{axis}</dt><dd className="data-value">{player.rawValues[axisIndex]}</dd></div>)}</dl></article>)}</div></div>;
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
  return <section className="analysis-xray"><header><GroupMark icon={IconRadar2} /><div><h2>Raio-X do elenco</h2><p>Métricas normalizadas dentro do recorte; os valores reais continuam visíveis ao lado.</p></div></header>
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
    ["OFENSIVO", IconBallFootball, [["GOLS / JOGO", team.averageGoalsFor, "", `${team.goalsFor} gols no período`, null, "goals"], ["CHUTES / JOGO", team.shotsPerGame, "", `${team.shots} finalizações registradas`], ["CONVERSÃO", team.shotConversion, "%", "gols ÷ finalizações", "Gols marcados ÷ finalizações registradas"]]],
    ["POSSE E PASSE", IconArrowsExchange, [["PRECISÃO", team.passAccuracy, "%", `${team.passesMade} / ${team.passAttempts}`, "Passes certos ÷ passes tentados", "passing"], ["PASSES CERTOS / JOGO", team.metricSamples?.passesMade ? team.passesMadePerGame : null, "", `${team.passesMade} no período`], ["VOLUME / JOGO", team.metricSamples?.passAttempts ? team.passAttemptsPerGame : null, "", "passes tentados"]]],
    ["DEFENSIVO", IconShieldCheck, [["GOLS SOFRIDOS / JOGO", team.averageGoalsAgainst, "", `${team.goalsAgainst} no período`, null, "conceded"], ["DESARMES / JOGO", team.tacklesPerGame, "", `${team.tackles} ações registradas`], ["CLEAN SHEETS", team.cleanSheets, "", `${team.matchesConceding2Plus} jogo(s) sofrendo 2+`]]],
    ["GOLEIRO E NOTA", IconHandStop, [["DEFESAS", team.metricSamples?.saves ? team.saves : null, "", "defesas registradas"], ["DEFESAS / JOGO", team.metricSamples?.saves ? team.savesPerGame : null, "", "média por partida"], ["NOTA MÉDIA · TIME", team.averageRating, "", "partidas com nota EA", null, "rating"]]],
  ];
  const periodLabel = ({ last5: "Últimos 5 jogos", last10: "Últimos 10 jogos", season: "Temporada" })[period] || period.replace("competition:", "");
  return <section className="data-page page-enter analysis-v2">
    <PageHeader title="O que o jogo está dizendo." description="Leituras determinísticas para apoiar decisões, sem completar lacunas com suposições." aside={<RastroDataSignature label="Data by" />} />
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
    <section className="analysis-context"><div role="status" aria-live="polite"><span>{periodLabel}</span><strong><b className="data-value">{team.games}</b> {team.games === 1 ? "partida" : "partidas"}</strong></div><p>{trends ? `Tendências comparam com os ${trends.window} jogos anteriores.` : "Sem amostra anterior suficiente para tendência."}</p></section>
    <div id="analysis-results" className="analysis-results" key={period}>
      {team.games ? <><section className="analysis-groups">{groups.map(([title, Icon, metrics], groupIndex) => <article className="analysis-group" key={title}><header><GroupMark icon={Icon} /><h2>{title}</h2></header><div className="analysis-group-metrics">{metrics.map(([label, value, suffix, note, tooltip, trendKey], index) => <Metric key={label} label={label} value={value} suffix={suffix} note={note} tooltip={tooltip} trendKey={trendKey} trends={trends} index={groupIndex * 3 + index}/>)}</div></article>)}</section><section className="analysis-insights"><header><h2>Leitura do período</h2><RastroDataSignature label="Analytics by" /></header>{insights.map((insight) => <InsightLine key={insight}>{insight}</InsightLine>)}</section></> : <div className="analysis-empty">Não há partidas suficientes neste recorte. Escolha outro período ou competição.</div>}
    </div>
    <PlayerComparison matches={matches} workspace={{ ...workspace, players: activePlayers, aliases }} competitions={competitions}/>
  </section>;
}

export default AnalysisPage;
