import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconArrowRight, IconArrowsLeftRight, IconBallFootball, IconChartBar, IconHandStop,
  IconPlayerPlay, IconShieldCheck, IconShoe, IconStar, IconTargetArrow, IconTrophy,
  IconScale, IconUsers, IconX,
} from "@tabler/icons-react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { useDialog } from "../../ui/useDialog.js";
import { STRIX_BRAND } from "../../brand.js";
import { AnimatedNumber, SegmentedControl } from "../../ui/motion/motion.jsx";
import { RastroDataSignature } from "../../ui/RastroBrand.jsx";
import { SelectControl } from "../../ui/SelectControl.jsx";
import { aggregatePlayerStatistics, aggregateTeamStatistics, buildRanking } from "./statistics-core.js";
import "./statistics.css";

const metricIcons = {
  games: IconPlayerPlay, efficiency: IconTrophy, goalsFor: IconBallFootball, goalsAgainst: IconShieldCheck,
  cleanSheets: IconShieldCheck, goalDifference: IconScale, averageGoalsFor: IconTargetArrow,
  averageGoalsAgainst: IconShieldCheck, averageRating: IconStar, passesMade: IconArrowsLeftRight,
  passAccuracy: IconTargetArrow, shots: IconShoe, tackles: IconShieldCheck, saves: IconHandStop,
};
const display = (value, suffix = "") => value === null || value === undefined ? "—" : `${value}${suffix}`;

function StatCard({ metric, label, value, suffix = "", note, tooltip, index = 0 }) {
  const Icon = metricIcons[metric] || IconChartBar;
  const numeric = typeof value === "number";
  return <article className="statistics-stat-card" style={{ "--delay": `${Math.min(index, 8) * 35}ms` }} title={tooltip || undefined}>
    <span><Icon size={20} stroke={1.7}/></span><small>{label}</small>
    <strong>{numeric ? <AnimatedNumber id={`stats-${metric}-${value}`} value={value} suffix={suffix}/> : display(value, suffix)}</strong>
    {note && <p>{note}</p>}
  </article>;
}

function RankingModal({ ranking, metric, title, suffix = "", close }) {
  const dialogRef = useDialog(close);
  const leader = Number(ranking[0]?.[metric] || 0);
  return createPortal(<div className="statistics-modal-layer" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section ref={dialogRef} tabIndex={-1} className="statistics-ranking-modal" role="dialog" aria-modal="true" aria-label={`Ranking completo de ${title}`}>
      <header><div><span>ESTATÍSTICAS · FC27</span><h2>Ranking completo</h2><p>{title}</p><RastroDataSignature label="Analytics by" /></div><CloseButton onClick={close} /></header>
      <div className="statistics-ranking-list">{ranking.map((player, index) => <article className={index < 3 ? `is-top is-top-${index + 1}` : ""} key={player.handle}>
        <strong>{index + 1}</strong><div><b>{player.name}</b>{player.handle !== player.name && <small>@{player.handle}</small>}<em>{player.positions?.join(" · ") || "EA FC"}{player.memberType ? ` · ${player.memberType}` : ""}</em></div><div className="statistics-ranking-value"><span>{display(player[metric], suffix)}</span>{index > 0 && leader > Number(player[metric] || 0) && <small>-{Number((leader - Number(player[metric] || 0)).toFixed(1))} do líder</small>}</div>
      </article>)}</div>
    </section>
  </div>, document.body);
}

function RankingCard({ title, metric, players, icon: Icon, suffix = "", criterion }) {
  const [open, setOpen] = useState(false);
  const ranking = buildRanking(players, metric);
  const top = ranking.slice(0, 5);
  return <article className="statistics-ranking-card">
    <header><span><Icon size={19} stroke={1.7}/></span><div><small>RANKING</small><h3>{title}</h3></div></header>
    {top.length ? <ol>{top.map((player, index) => <li key={player.handle}><em>{index + 1}</em><div><b>{player.name}</b><small>{player.handle !== player.name ? `@${player.handle}` : `${player.games} jogo(s)`}</small></div><strong>{display(player[metric], suffix)}</strong></li>)}</ol> : <p className="statistics-no-data">Amostra insuficiente.</p>}
    {criterion && <p className="statistics-criterion">{criterion}</p>}
    {ranking.length > 5 && <button type="button" onClick={() => setOpen(true)}>VER RANKING <IconArrowRight size={15}/></button>}
    {open && <RankingModal ranking={ranking} metric={metric} title={title} suffix={suffix} close={() => setOpen(false)}/>}
  </article>;
}

function GoalkeeperCard({ player }) {
  return <article className="statistics-goalkeeper-card"><header><span><IconHandStop size={23}/></span><div><small>GOLEIRO</small><h3>{player.name}</h3>{player.handle !== player.name && <p>@{player.handle}</p>}</div></header><dl><div><dt>DEFESAS</dt><dd>{player.saves}</dd></div><div><dt>NOTA</dt><dd>{display(player.averageRating)}</dd></div><div><dt>CLEAN SHEETS</dt><dd>{player.cleanSheets}</dd></div><div><dt>PRECISÃO</dt><dd>{display(player.passAccuracy, "%")}</dd></div><div><dt>GOLS SOFRIDOS</dt><dd>{player.goalsAgainst}</dd></div></dl></article>;
}

function Summary({ team, players }) {
  const cards = [
    ["games", "JOGOS", team.games, "", `${team.wins}V · ${team.draws}E · ${team.losses}D`],
    ["efficiency", "APROVEITAMENTO", team.efficiency, "%", "pontos conquistados"],
    ["goalsFor", "GOLS PRÓ", team.goalsFor, "", `${team.averageGoalsFor} por jogo`],
    ["goalsAgainst", "GOLS CONTRA", team.goalsAgainst, "", `${team.averageGoalsAgainst} por jogo`],
    ["cleanSheets", "CLEAN SHEETS", team.cleanSheets, "", "jogos sem sofrer gols"],
    ["goalDifference", "SALDO", team.goalDifference, "", "gols pró − gols contra"],
    ["averageRating", "NOTA MÉDIA", team.averageRating, "", "partidas com nota EA"],
  ];
  const rankings = [
    ["ARTILHARIA", "goals", IconBallFootball], ["ASSISTÊNCIAS", "assists", IconUsers],
    ["MELHORES NOTAS", "averageRating", IconStar], ["PRECISÃO DE PASSE", "passAccuracy", IconTargetArrow, "%", "Mínimo de 10 passes tentados"],
    ["MAIS PASSES CERTOS", "passesMade", IconArrowsLeftRight], ["PASSES TENTADOS", "passAttempts", IconChartBar],
    ["FINALIZAÇÕES", "shots", IconShoe], ["DESARMES CERTOS", "tackles", IconShieldCheck],
  ];
  const keepers = players.filter((player) => player.active !== false && player.goalkeeper).sort((a, b) => b.games - a.games);
  return <div className="statistics-panel-enter"><section className="statistics-overview-grid">{cards.map(([metric, label, value, suffix, note], index) => <StatCard key={metric} metric={metric} label={label} value={value} suffix={suffix} note={note} index={index}/>)}</section><section className="statistics-section-heading"><div><span>DESTAQUES DA TEMPORADA</span><h2>Quem está produzindo.</h2></div><p>Jogadores desconectados são preservados no histórico, mas não distorcem os rankings.</p></section><section className="statistics-rankings-grid">{rankings.map(([title, metric, Icon, suffix, criterion]) => <RankingCard key={metric} title={title} metric={metric} players={players} icon={Icon} suffix={suffix} criterion={criterion}/>)}</section>{keepers.length > 0 && <section className="statistics-keeper-grid">{keepers.map((player) => <GoalkeeperCard key={player.handle} player={player}/>)}</section>}</div>;
}

function TeamData({ team }) {
  const cards = [
    ["passesMade", "PASSES CERTOS", team.passesMade, "", `${team.passesMade} / ${team.passAttempts || "—"}`],
    ["passAccuracy", "PRECISÃO DE PASSE", team.passAccuracy, "%", "certos ÷ tentados", "Passes certos ÷ passes tentados"],
    ["shots", "FINALIZAÇÕES", team.shots, "", `${team.shotsPerGame} por jogo`],
    ["tackles", "DESARMES", team.tackles, "", `${team.tacklesPerGame} por jogo`],
    ["saves", "DEFESAS DO GOLEIRO", team.saves, "", `${team.savesPerGame} por jogo`],
    ["averageRating", "NOTA MÉDIA", team.averageRating, "", "amostra registrada pela EA"],
  ];
  return <div className="statistics-panel-enter"><section className="statistics-team-identity"><ClubLogo name="Strix United" url={STRIX_BRAND.logo} sizes="(max-width:700px) 96px, 150px"/><div><span>DADOS DO TIME</span><h2>STRIX UNITED</h2><p>Club ID · 625257</p></div></section><section className="statistics-team-grid">{cards.map(([metric, label, value, suffix, note, tooltip], index) => <StatCard key={metric} metric={metric} label={label} value={value} suffix={suffix} note={note} tooltip={tooltip} index={index}/>)}</section></div>;
}

function PlayersData({ players }) {
  const [sort, setSort] = useState("averageRating");
  const line = players.filter((player) => player.active !== false && !player.goalkeeper).sort((a, b) => Number(b[sort] || 0) - Number(a[sort] || 0) || b.games - a.games);
  const keepers = players.filter((player) => player.active !== false && player.goalkeeper);
  const sortOptions = [["averageRating", "Nota"], ["goals", "Gols"], ["assists", "Assistências"], ["passesMade", "Passes certos"], ["passAccuracy", "Precisão"], ["shots", "Finalizações"], ["tackles", "Desarmes"]];
  return <div className="statistics-panel-enter"><div className="statistics-sort"><div><span>ORDENAR JOGADORES DE LINHA</span><RastroDataSignature label="Data by" /></div><SelectControl value={sort} onChange={setSort} options={sortOptions} label="Ordenar jogadores de linha" /></div><section className="statistics-player-table"><header><span>JOGADOR</span><span>J</span><span>NOTA</span><span>GOLS</span><span>ASSIST.</span><span>PASSES</span><span>PRECISÃO</span><span>CHUTES</span><span>DESARMES</span></header>{line.length ? line.map((player) => <article className={player.disconnected ? "is-disconnected" : ""} key={player.handle}><b>{player.name}<small>{player.handle !== player.name ? `@${player.handle}` : player.positions?.join(" · ")}</small>{player.disconnected && <em>CAIU DA PARTIDA</em>}</b><span data-label="JOGOS">{player.games}</span><span data-label="NOTA">{display(player.averageRating)}</span><span data-label="GOLS">{player.goals}</span><span data-label="ASSIST.">{player.assists}</span><span data-label="PASSES">{player.passesMade}/{player.passAttempts || "—"}</span><span data-label="PRECISÃO">{display(player.passAccuracy, "%")}</span><span data-label="CHUTES">{player.shots}</span><span data-label="DESARMES">{player.tackles}</span></article>) : <p className="statistics-no-data">Importe partidas com dados individuais para montar esta leitura.</p>}</section>{keepers.length > 0 && <><section className="statistics-section-heading"><div><span>LEITURA POR POSIÇÃO</span><h2>Goleiros.</h2></div><p>Métricas específicas, sem priorizar chutes ou desarmes.</p></section><section className="statistics-keeper-grid">{keepers.map((player) => <GoalkeeperCard key={player.handle} player={player}/>)}</section></>}</div>;
}

export function StatisticsPage({ workspace, matches = workspace.matches || [] }) {
  const [tab, setTab] = useState("summary");
  const team = useMemo(() => aggregateTeamStatistics(matches, workspace.players || []), [matches, workspace.players]);
  const players = useMemo(() => aggregatePlayerStatistics(matches, { players: workspace.players, aliases: workspace.aliases }), [matches, workspace.players, workspace.aliases]);
  return <section className="data-page page-enter statistics-v3"><header className="data-page-header"><div><span>ESTATÍSTICAS FC27</span><h1>O jogo em perspectiva.</h1><p>Produção, eficiência e contexto calculados apenas com dados reais reconciliados.</p></div><RastroDataSignature label="Analytics by" /></header><SegmentedControl className="statistics-tabs-v3" items={[["summary", "RESUMO"], ["team", "DADOS DO TIME"], ["players", "DADOS INDIVIDUAIS"]]} active={tab} onChange={setTab} label="Dados estatísticos"/>{tab === "summary" ? <Summary team={team} players={players}/> : tab === "team" ? <TeamData team={team}/> : <PlayersData players={players}/>}</section>;
}

export default StatisticsPage;
