import React, { useMemo, useState } from "react";
import { IconArrowDownRight, IconArrowUpRight, IconArrowsExchange, IconBallFootball, IconHandStop, IconMinus, IconShieldCheck, IconTargetArrow } from "@tabler/icons-react";
import { AnimatedNumber } from "../../ui/motion/motion.jsx";
import { buildAnalysis, comparePeriods, selectAnalysisPeriod } from "./analysis-core.js";
import "./analysis.css";

const allowed = new Set(["conselho", "diretoria", "dev"]);
const Trend = ({ value }) => value === "up" ? <span className="is-up"><IconArrowUpRight/>MELHORA</span> : value === "down" ? <span className="is-down"><IconArrowDownRight/>QUEDA</span> : <span><IconMinus/>ESTÁVEL</span>;

function Metric({ icon: Icon, label, value, suffix = "", note, tooltip, trend }) {
  return <article className="analysis-metric" title={tooltip || undefined}><header><Icon size={20}/><small>{label}</small>{trend && <Trend value={trend}/>}</header><strong>{typeof value === "number" ? <AnimatedNumber id={`analysis-${label}-${value}`} value={value} suffix={suffix}/> : value ?? "—"}</strong><p>{note}</p></article>;
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
  return <section className="data-page page-enter analysis-v2"><header className="data-page-header"><div><span>ANÁLISE · CONSELHO</span><h1>O que o jogo está dizendo.</h1><p>Leituras determinísticas para apoiar decisões, sem completar lacunas com suposições.</p></div></header><div className="analysis-filters"><button className={period === "last5" ? "selected" : ""} onClick={() => setPeriod("last5")}>ÚLTIMOS 5</button><button className={period === "last10" ? "selected" : ""} onClick={() => setPeriod("last10")}>ÚLTIMOS 10</button><button className={period === "season" ? "selected" : ""} onClick={() => setPeriod("season")}>TEMPORADA</button>{competitions.length > 0 && <select value={period.startsWith("competition:") ? period : ""} onChange={(event) => event.target.value && setPeriod(event.target.value)} aria-label="Filtrar por competição"><option value="">COMPETIÇÃO</option>{competitions.map((competition) => <option key={competition} value={`competition:${competition}`}>{competition}</option>)}</select>}</div><section className="analysis-context"><IconArrowsExchange/><div><span>RECORTE ATUAL</span><strong>{team.games} partida(s)</strong></div><p>{trends ? "Comparação com o período imediatamente anterior." : "Sem amostra anterior suficiente para tendência."}</p></section>{team.games ? <><section className="analysis-groups">{groups.map(([title, Icon, metrics]) => <article className="analysis-group" key={title}><header><Icon/><div><span>LEITURA</span><h2>{title}</h2></div></header><div>{metrics.filter(([, value]) => value !== null && value !== undefined).map(([label, value, suffix, note, tooltip, trend]) => <Metric key={label} icon={Icon} label={label} value={value} suffix={suffix} note={note} tooltip={tooltip} trend={trend}/>)}</div></article>)}</section><section className="analysis-insights"><header><span>INSIGHTS DO PERÍODO</span><h2>Leitura objetiva.</h2></header>{insights.map((insight) => <p key={insight}>{insight}</p>)}</section></> : <div className="analysis-empty">Não há partidas suficientes neste recorte.</div>}</section>;
}

export default AnalysisPage;
