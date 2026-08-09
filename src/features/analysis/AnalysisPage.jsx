import React, { useEffect, useMemo, useState } from "react";
import { IconArrowDownRight, IconArrowUpRight, IconArrowsExchange, IconBallFootball, IconHandStop, IconMinus, IconRadar2, IconShieldCheck, IconTargetArrow } from "@tabler/icons-react";
import { AnimatedNumber } from "../../ui/motion/motion.jsx";
import { buildAnalysis, buildPlayerComparison, comparePeriods, selectAnalysisPeriod } from "./analysis-core.js";
import "./analysis.css";

const allowed = new Set(["conselho", "diretoria", "dev"]);
const radarColors = ["#54d2ff", "#ffca68", "#8d7cff", "#63dfa9"];
const Trend = ({ value }) => value === "up" ? <span className="is-up"><IconArrowUpRight/>MELHORA</span> : value === "down" ? <span className="is-down"><IconArrowDownRight/>QUEDA</span> : <span><IconMinus/>ESTÁVEL</span>;

function Metric({ icon: Icon, label, value, suffix = "", note, tooltip, trend }) {
  return <article className="analysis-metric" title={tooltip || undefined}><header><Icon size={20}/><small>{label}</small>{trend && <Trend value={trend}/>}</header><strong>{typeof value === "number" ? <AnimatedNumber id={`analysis-${label}-${value}`} value={value} suffix={suffix}/> : value ?? "—"}</strong><p>{note}</p></article>;
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
  const availableIds = available.players.map((player) => player.playerId).filter(Boolean).join("|");
  useEffect(() => {
    const ids = availableIds ? availableIds.split("|") : [];
    setPlayerIds((current) => {
      const valid = current.filter((id) => ids.includes(id)).slice(0, 4);
      for (const id of ids) if (valid.length < Math.min(2, ids.length) && !valid.includes(id)) valid.push(id);
      return valid;
    });
  }, [availableIds]);
  const comparison = useMemo(() => buildPlayerComparison(matches, { ...baseOptions, playerIds }), [matches, period, competition, kind, playerIds, workspace.players, workspace.aliases]);
  const togglePlayer = (id) => setPlayerIds((current) => current.includes(id) ? (current.length > 2 ? current.filter((item) => item !== id) : current) : (current.length < 4 ? [...current, id] : current));
  return <section className="analysis-xray"><header><div><span>RAIO-X DO ELENCO</span><h2>Comparação de jogadores.</h2><p>Métricas normalizadas dentro do recorte; os valores reais continuam visíveis ao lado.</p></div><IconRadar2 size={34}/></header>
    <div className="analysis-xray-filters"><div className="analysis-xray-toggle"><button className={kind === "line" ? "selected" : ""} onClick={() => setKind("line")}>LINHA</button><button className={kind === "goalkeeper" ? "selected" : ""} onClick={() => setKind("goalkeeper")}>GOLEIROS</button></div><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Período do Raio-X"><option value="7days">7 DIAS</option><option value="30days">30 DIAS</option><option value="90days">90 DIAS</option><option value="season">TEMPORADA</option><option value="all">TODO O PERÍODO</option></select><select value={competition} onChange={(event) => setCompetition(event.target.value)} aria-label="Competição do Raio-X"><option value="">TODAS AS COMPETIÇÕES</option>{competitions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    <div className="analysis-player-picker" aria-label="Jogadores comparados">{available.players.map((player, index) => <button key={player.playerId || player.handle} className={playerIds.includes(player.playerId) ? "selected" : ""} style={{ "--player-color": radarColors[Math.max(0, playerIds.indexOf(player.playerId))] || radarColors[index % radarColors.length] }} onClick={() => togglePlayer(player.playerId)}><i/><span>{player.name}</span><small>{player.games}J</small></button>)}</div>
    {comparison.matches === 0 ? <div className="analysis-empty">Nenhuma partida neste recorte.</div> : comparison.players.length < 2 ? <div className="analysis-empty">A comparação precisa de ao menos dois jogadores ativos com amostra registrada.</div> : <RadarChart comparison={comparison}/>}
  </section>;
}

export function AnalysisPage({ workspace, profile, matches = workspace.matches || [] }) {
  const [period, setPeriod] = useState("last5");
  if (!allowed.has(profile?.access_tier)) return <section className="placeholder page-enter"><span>ÁREA RESTRITA</span><h1>Análise</h1><p>A leitura estratégica está disponível para Conselho, Diretoria e Desenvolvimento.</p></section>;
  const competitions = [...new Set(matches.map((match) => match.competition_name || "Amistoso"))].sort();
  const selected = useMemo(() => selectAnalysisPeriod(matches, period), [matches, period]);
  const { team, insights } = useMemo(() => buildAnalysis(selected, workspace.players), [selected, workspace.players]);
  const trends = useMemo(() => comparePeriods(matches, period), [matches, period]);
  const groups = [
    ["OFENSIVO", IconBallFootball, [["GOLS / JOGO", team.averageGoalsFor, "", `${team.goalsFor} gols no período`, null, trends?.goals], ["CHUTES / JOGO", team.shotsPerGame, "", `${team.shots} finalizações registradas`], ["CONVERSÃO", team.shotConversion, "%", "gols ÷ finalizações", "Gols marcados ÷ finalizações registradas"]]],
    ["POSSE E PASSE", IconTargetArrow, [["PRECISÃO", team.passAccuracy, "%", `${team.passesMade} / ${team.passAttempts || "—"}`, "Passes certos ÷ passes tentados", trends?.passing], ["PASSES CERTOS / JOGO", team.passesMadePerGame, "", `${team.passesMade} no período`], ["VOLUME / JOGO", team.passAttemptsPerGame, "", "passes tentados"]]],
    ["DEFENSIVO", IconShieldCheck, [["GOLS SOFRIDOS / JOGO", team.averageGoalsAgainst, "", `${team.goalsAgainst} no período`, null, trends?.conceded], ["DESARMES / JOGO", team.tacklesPerGame, "", `${team.tackles} ações registradas`], ["CLEAN SHEETS", team.cleanSheets, "", `${team.matchesConceding2Plus} jogo(s) sofrendo 2+`]]],
    ["GOLEIRO", IconHandStop, [["DEFESAS", team.saves, "", `${team.savesPerGame} por jogo`], ["NOTA MÉDIA", team.averageRating, "", "partidas com nota EA", null, trends?.rating]]],
  ];
  return <section className="data-page page-enter analysis-v2"><header className="data-page-header"><div><span>ANÁLISE · CONSELHO</span><h1>O que o jogo está dizendo.</h1><p>Leituras determinísticas para apoiar decisões, sem completar lacunas com suposições.</p></div></header><div className="analysis-filters"><button className={period === "last5" ? "selected" : ""} onClick={() => setPeriod("last5")}>ÚLTIMOS 5</button><button className={period === "last10" ? "selected" : ""} onClick={() => setPeriod("last10")}>ÚLTIMOS 10</button><button className={period === "season" ? "selected" : ""} onClick={() => setPeriod("season")}>TEMPORADA</button>{competitions.length > 0 && <select value={period.startsWith("competition:") ? period : ""} onChange={(event) => event.target.value && setPeriod(event.target.value)} aria-label="Filtrar por competição"><option value="">COMPETIÇÃO</option>{competitions.map((competition) => <option key={competition} value={`competition:${competition}`}>{competition}</option>)}</select>}</div><section className="analysis-context"><IconArrowsExchange/><div><span>RECORTE ATUAL</span><strong>{team.games} partida(s)</strong></div><p>{trends ? "Comparação com o período imediatamente anterior." : "Sem amostra anterior suficiente para tendência."}</p></section>{team.games ? <><section className="analysis-groups">{groups.map(([title, Icon, metrics]) => <article className="analysis-group" key={title}><header><Icon/><div><span>LEITURA</span><h2>{title}</h2></div></header><div>{metrics.filter(([, value]) => value !== null && value !== undefined).map(([label, value, suffix, note, tooltip, trend]) => <Metric key={label} icon={Icon} label={label} value={value} suffix={suffix} note={note} tooltip={tooltip} trend={trend}/>)}</div></article>)}</section><section className="analysis-insights"><header><span>INSIGHTS DO PERÍODO</span><h2>Leitura objetiva.</h2></header>{insights.map((insight) => <p key={insight}>{insight}</p>)}</section></> : <div className="analysis-empty">Não há partidas suficientes neste recorte.</div>}<PlayerComparison matches={matches} workspace={workspace} competitions={competitions}/></section>;
}

export default AnalysisPage;
