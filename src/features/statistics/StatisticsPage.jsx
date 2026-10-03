import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { aggregatePlayerStatistics, aggregateTeamStatistics, buildPlayerProfile, buildPlayerProfileChoices, buildPositionContext, buildRanking, formatPlayerHandle, saoPauloDay, summarizeNight } from "./statistics-core.js";
import { FC27_CLUB } from "../../../shared/fc27-club.js";
import { describeEaArchetype } from "./ea-archetypes.js";
import { PlayerProfile, SheetIcon, display, observed } from "../players/PlayerProfile.jsx";
import "./statistics.css";
import { PageHeader } from "../../ui/PageHeader.jsx";

const metricIcons = {
  games: IconPlayerPlay, efficiency: IconTrophy, goalsFor: IconBallFootball, goalsAgainst: IconShieldCheck,
  cleanSheets: IconShieldCheck, goalDifference: IconScale, averageGoalsFor: IconTargetArrow,
  averageGoalsAgainst: IconShieldCheck, averageRating: IconStar, passesMade: IconArrowsLeftRight,
  passAccuracy: IconTargetArrow, shots: IconShoe, tackles: IconShieldCheck, saves: IconHandStop,
};
const displayHandle = formatPlayerHandle;

function StatCard({ metric, label, value, suffix = "", note, tooltip, index = 0 }) {
  const numeric = typeof value === "number";
  return <article className="statistics-stat-card" style={{ "--delay": `${Math.min(index, 8) * 35}ms` }} title={tooltip || undefined}>
    <small>{label}</small>
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
        <strong>{index + 1}</strong><div><b>{player.name}</b>{player.handle !== player.name && <small>{displayHandle(player.handle)}</small>}<em>{player.positions?.join(" · ") || "EA FC"}{player.memberType ? ` · ${player.memberType}` : ""}</em></div><div className="statistics-ranking-value"><span><RatingValue metric={metric} value={player[metric]} suffix={suffix}/></span>{index > 0 && leader > Number(player[metric] || 0) && <small>-{Number((leader - Number(player[metric] || 0)).toFixed(1))} do líder</small>}</div>
      </article>)}</div>
    </section>
  </div>, document.body);
}

const RatingValue = ({ metric, value, suffix }) => metric === "averageRating" && value !== null && value !== undefined
  ? <span className="statistics-rating-value"><IconStar size={13} stroke={1.9} aria-hidden="true" focusable="false"/>{display(value, suffix)}</span>
  : display(value, suffix);

function RankingCard({ title, metric, players, icon: Icon, suffix = "", criterion }) {
  const [open, setOpen] = useState(false);
  const ranking = buildRanking(players, metric);
  const top = ranking.slice(0, 5);
  return <article className="statistics-ranking-card">
    <header><div><h3>{title}</h3>{criterion && <p className="statistics-criterion">{criterion}</p>}</div></header>
    {top.length ? <ol>{top.map((player, index) => <li key={player.handle}><em>{index + 1}</em><div><b>{player.name}</b><small>{player.handle !== player.name ? displayHandle(player.handle) : `${player.games} jogo(s)`}</small></div><strong><RatingValue metric={metric} value={player[metric]} suffix={suffix}/></strong></li>)}</ol> : <p className="statistics-no-data">Amostra insuficiente.</p>}
    {ranking.length > 5 && <button type="button" onClick={() => setOpen(true)}>VER RANKING <IconArrowRight size={15}/></button>}
    {open && <RankingModal ranking={ranking} metric={metric} title={title} suffix={suffix} close={() => setOpen(false)}/>}
  </article>;
}

function GoalkeeperCard({ player }) {
  const sampled = (metric) => player.metricSamples?.[metric] > 0;
  const headline = [
    ["DEFESAS", player.saves, sampled("saves")],
    ["DEFESAS / JOGO", player.savesPerGame, sampled("saves") && player.goalkeeperGames > 0],
    ["GOLS SOFRIDOS", player.goalsAgainst, player.goalsAgainstSamples > 0],
    ["NOTA MÉDIA", player.averageRating, player.ratings > 0],
  ];
  const record = [
    ["SEM SOFRER GOL", player.cleanSheetsGk, sampled("cleansheetsgk")],
    ["SEM SOFRER GOL · DEF", player.cleanSheetsDef, sampled("cleansheetsdef")],
    ["MOTM", player.mom, sampled("mom")],
    ["CARTÕES VERMELHOS", player.redcards, sampled("redcards")],
  ].filter(([, , present]) => present);
  const subtypes = [
    ["REFLEXO", player.reflexSaves, sampled("reflexSaves"), "reflex"],
    ["DIREÇÃO BOA", player.goodDirectionSaves, sampled("goodDirectionSaves"), "direction"],
    ["CRUZAMENTO", player.crossSaves, sampled("crossSaves"), "cross"],
    ["MERGULHO", player.ballDiveSaves, sampled("ballDiveSaves"), "dive"],
    ["ESPALMO", player.parrySaves, sampled("parrySaves"), "parry"],
    ["SOCO", player.punchSaves, sampled("punchSaves"), "punch"],
  ].filter(([, , present]) => present);
  return <article className="statistics-goalkeeper-card">
    <header><span><IconHandStop size={23}/></span><div><small>GOLEIROS · FC27</small><h3>{player.name}</h3>{player.handle !== player.name && <p>{displayHandle(player.handle)}</p>}</div></header>
    <dl className="statistics-keeper-headline">{headline.map(([label, value, present]) => <div key={label} className={present ? "" : "is-empty"}><dt>{label}</dt><dd>{present ? display(value) : "—"}</dd></div>)}</dl>
    {record.length > 0 && <dl className="statistics-keeper-record">{record.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl>}
    {subtypes.length > 0 && <section className="statistics-keeper-subtypes" aria-label="Subtipos de defesa">
      <ul>{subtypes.map(([label, value]) => <li key={label}><span>{label}</span><b>{display(value)}</b></li>)}</ul>
    </section>}
  </article>;
}

function NightSummary({ matches, workspace }) {
  const days = [...new Set((matches || []).map((match) => saoPauloDay(match.played_at || match.date)).filter(Boolean))].sort().reverse();
  const [selectedDate, setSelectedDate] = useState(days[0] || "");
  const [open, setOpen] = useState(false);
  const availableDate = days.includes(selectedDate) ? selectedDate : days[0] || "";
  const summary = useMemo(() => availableDate ? summarizeNight(matches, availableDate, { players: workspace.players, aliases: workspace.aliases }) : null, [availableDate, matches, workspace.players, workspace.aliases]);
  const leaderLabels = [["goals", "ARTILHARIA", "gols", "goals"], ["assists", "ASSISTÊNCIAS", "assistências", "assists"], ["rating", "MAIOR NOTA MÉDIA", "", "rating"], ["passes", "PASSES CERTOS", "passes", "passes"], ["tackles", "DESARMES", "desarmes", "tackles"], ["saves", "DEFESAS", "defesas", "saves"], ["mom", "MOTM", "MOTM", "mom"]];
  if (!days.length) return null;
  return <section className="statistics-night-summary">
    <header><div><span>JOGOS CONCLUÍDOS</span><h2>Resumo da noite</h2><p>Recorte dos resultados e estatísticas já importados. Não representa confirmação de encerramento da Agenda.</p></div><div className="statistics-night-controls"><SelectControl value={availableDate} onChange={setSelectedDate} options={days.map((day) => [day, new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium" }).format(new Date(`${day}T12:00:00-03:00`))])} label="Data do resumo da noite"/><button type="button" className="secondary" onClick={() => setOpen((value) => !value)}>{open ? "OCULTAR RESUMO" : "VER RESUMO DA NOITE"}</button></div></header>
    {open && summary && <div className="statistics-night-body">
      <div className="statistics-night-scoreline"><article><small>JOGOS</small><strong>{summary.games}</strong></article><article><small>CAMPANHA</small><strong>{summary.wins}V · {summary.draws}E · {summary.losses}D</strong></article><article><small>GOLS</small><strong>{summary.goalsFor}–{summary.goalsAgainst}</strong></article><article><small>CLEAN SHEETS</small><strong>{summary.cleanSheets}</strong></article></div>
      <div className="statistics-night-leaders">{leaderLabels.map(([key, label, unit, icon]) => { const leader = summary.leaders[key]; return leader ? <article key={key}><small><SheetIcon name={icon}/>{label}</small><div>{leader.names.map((name) => <span key={name}><b>{name}</b><strong>{leader.value}{unit ? ` ${unit}` : ""}</strong></span>)}</div></article> : null; })}</div>
    </div>}
  </section>;
}

function Summary({ team, players, matches, workspace }) {
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
    ["GOLS + ASSISTÊNCIAS", "goalAssists", IconArrowsLeftRight], ["MOTM", "mom", IconStar],
  ];
  const keepers = players.filter((player) => player.active !== false && player.goalkeeper).sort((a, b) => b.games - a.games);
  return <div className="statistics-panel-enter"><NightSummary matches={matches} workspace={workspace}/><section className="statistics-overview-grid">{cards.map(([metric, label, value, suffix, note], index) => <StatCard key={metric} metric={metric} label={label} value={value} suffix={suffix} note={note} index={index}/>)}</section><section className="statistics-section-heading"><div><span>DESTAQUES DA TEMPORADA</span><h2>Quem está produzindo.</h2></div><p>Jogadores desconectados são preservados no histórico, mas não distorcem os rankings.</p></section><section className="statistics-rankings-grid">{rankings.map(([title, metric, Icon, suffix, criterion]) => <RankingCard key={metric} title={title} metric={metric} players={players} icon={Icon} suffix={suffix} criterion={criterion}/>)}</section>{keepers.length > 0 && <section className="statistics-keeper-grid">{keepers.map((player) => <GoalkeeperCard key={player.handle} player={player}/>)}</section>}</div>;
}

function TeamData({ team }) {
  const cards = [
    ["passesMade", "PASSES CERTOS", team.metricSamples?.passesMade ? team.passesMade : null, "", team.metricSamples?.passesMade && team.metricSamples?.passAttempts ? `${team.passesMade} / ${team.passAttempts}` : "Sem dados registrados"],
    ["passAccuracy", "PRECISÃO DE PASSE", team.passAccuracy, "%", "certos ÷ tentados", "Passes certos ÷ passes tentados"],
    ["shots", "FINALIZAÇÕES", team.metricSamples?.shots ? team.shots : null, "", team.shotsPerGame == null ? "Sem dados registrados" : `${team.shotsPerGame} por jogo`],
    ["tackles", "DESARMES", team.metricSamples?.tackles ? team.tackles : null, "", team.tacklesPerGame == null ? "Sem dados registrados" : `${team.tacklesPerGame} por jogo`],
    ["saves", "DEFESAS DO GOLEIRO", team.metricSamples?.saves ? team.saves : null, "", team.savesPerGame == null ? "Sem dados registrados" : `${team.savesPerGame} por jogo`],
    ["averageRating", "NOTA MÉDIA", team.averageRating, "", "amostra registrada pela EA"],
  ];
  return <div className="statistics-panel-enter"><section className="statistics-team-identity"><ClubLogo name="Strix United" url={STRIX_BRAND.logo} sizes="(max-width:700px) 96px, 150px"/><div><span>DADOS DO TIME</span><h2>STRIX UNITED</h2><p>Club ID · {FC27_CLUB.clubId} <i aria-hidden="true">·</i> {FC27_CLUB.platform}</p></div></section><section className="statistics-team-grid">{cards.map(([metric, label, value, suffix, note, tooltip], index) => <StatCard key={metric} metric={metric} label={label} value={value} suffix={suffix} note={note} tooltip={tooltip} index={index}/>)}</section></div>;
}

function PlayersData({ players, matches, workspace }) {
  const [sort, setSort] = useState("averageRating");
  const eligibleProfiles = useMemo(() => buildPlayerProfileChoices(players, workspace.players, workspace.aliases), [players, workspace.players, workspace.aliases]);
  const profileKey = (player) => String(player.playerId || player.eaPlayerIds?.[0] || player.handle);
  const [selectedPlayerKey, setSelectedPlayerKey] = useState("");
  const selectedPlayer = eligibleProfiles.find((player) => profileKey(player) === selectedPlayerKey) || null;
  const profileRef = useRef(null);
  useEffect(() => {
    if (selectedPlayerKey) profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedPlayerKey]);
  const line = players.filter((player) => player.active !== false && !player.goalkeeper).sort((a, b) => Number(b[sort] || 0) - Number(a[sort] || 0) || b.games - a.games);
  const keepers = players.filter((player) => player.active !== false && player.goalkeeper);
  const sortOptions = [["averageRating", "Nota"], ["goals", "Gols"], ["assists", "Assistências"], ["goalAssists", "G+A"], ["mom", "MOTM"], ["passesMade", "Passes certos"], ["passAccuracy", "Precisão"], ["shots", "Finalizações"], ["shotConversion", "Conversão"], ["tackles", "Desarmes"], ["tackleAccuracy", "Eficiência desarme"]];
  return <div className="statistics-panel-enter"><section className="statistics-individual-roster"><header><div><span>FICHA DO ELENCO</span><h2>Leitura individual.</h2><p>Todo o elenco ativo, com ou sem atuação registrada. Abra uma ficha para ver forma e recordes.</p></div><small>{eligibleProfiles.length} jogadores ativos</small></header><div className="statistics-roster-list" aria-label="Elenco ativo — dados individuais">{eligibleProfiles.map((player) => { const key = profileKey(player); const position = player.positions?.join(" · ") || player.eaPositions?.join(" · ") || "Posição não definida"; const sample = player.noSample ? "Sem amostra" : `${player.validGames || 0} jogos válidos`; return <button type="button" key={key} className={`statistics-roster-row${profileKey(selectedPlayer || {}) === key ? " is-selected" : ""}`} aria-pressed={profileKey(selectedPlayer || {}) === key} onClick={() => setSelectedPlayerKey(key)}><span className="statistics-roster-name"><b>{player.name}</b><small>{position}</small></span><span className={`statistics-roster-sample${player.noSample ? " is-empty" : ""}`}>{sample}</span><span className="statistics-roster-data"><small>NOTA</small><b>{display(player.averageRating)}</b></span><span className="statistics-roster-data"><small>{player.goalkeeper ? "DEFESAS" : "G · A"}</small><b>{player.goalkeeper ? observed(player, "saves") : `${observed(player, "goals")} · ${observed(player, "assists")}`}</b></span><span className="statistics-roster-open" aria-hidden="true"><IconArrowRight size={18}/></span></button>; })}</div></section>{selectedPlayer && <div ref={profileRef} className="statistics-profile-anchor"><PlayerProfile player={selectedPlayer} players={eligibleProfiles} matches={matches} workspace={workspace} onClose={() => setSelectedPlayerKey("")}/></div>}<div className="statistics-sort"><div><span>ORDENAR JOGADORES DE LINHA</span><RastroDataSignature label="Data by" /></div><SelectControl value={sort} onChange={setSort} options={sortOptions} label="Ordenar jogadores de linha" /></div><section className="statistics-player-table"><header><span>JOGADOR</span><span>EA ID</span><span>J</span><span>NOTA</span><span>GOLS</span><span>ASSIST.</span><span>G+A</span><span>CHUTES</span><span>CONV.</span><span>PASSES</span><span>PRECISÃO</span><span>DESARMES</span><span>TENTATIVAS</span><span>EFIC.</span><span>MOTM</span><span>% MOTM</span><span>VERMELHOS</span><span>CS DEF</span><span>ARQUÉTIPO RECENTE</span></header>{line.length ? line.map((player) => { const recentArchetype = player.archetypeSnapshots?.at(-1); const archetype = recentArchetype ? describeEaArchetype(recentArchetype.archetypeId) : null; const passesKnown = player.metricSamples?.passesMade > 0 && player.metricSamples?.passesAttempts > 0; const tackleEfficiencyKnown = player.metricSamples?.tackleAttempts > 0 && player.metricSamples?.tackles > 0; const conversionKnown = player.metricSamples?.shots > 0 && player.metricSamples?.goals > 0; return <article className={player.disconnected ? "is-disconnected" : ""} key={player.handle}><b>{player.name}<small>{player.handle !== player.name ? displayHandle(player.handle) : player.positions?.join(" · ")}</small>{player.disconnected && <em>CAIU DA PARTIDA</em>}</b><span data-label="EA ID" title={player.eaPlayerIds?.join(", ") || undefined}>{player.eaPlayerIds?.join(", ") || "—"}</span><span data-label="JOGOS">{player.games}</span><span data-label="NOTA">{display(player.averageRating)}</span><span data-label="GOLS">{observed(player, "goals")}</span><span data-label="ASSIST.">{observed(player, "assists")}</span><span data-label="G+A">{player.metricSamples?.goals > 0 && player.metricSamples?.assists > 0 ? player.goalAssists : "—"}</span><span data-label="CHUTES">{observed(player, "shots")}</span><span data-label="CONV.">{conversionKnown ? display(player.shotConversion, "%") : "—"}</span><span data-label="PASSES">{passesKnown ? `${player.passesMade}/${player.passAttempts}` : "—"}</span><span data-label="PRECISÃO">{passesKnown ? display(player.passAccuracy, "%") : "—"}</span><span data-label="DESARMES">{observed(player, "tackles")}</span><span data-label="TENTATIVAS">{observed(player, "tackleAttempts")}</span><span data-label="EFIC.">{tackleEfficiencyKnown ? display(player.tackleAccuracy, "%") : "—"}</span><span data-label="MOTM">{observed(player, "mom")}</span><span data-label="% MOTM">{player.metricSamples?.mom > 0 ? display(player.motmPercentage, "%") : "—"}</span><span data-label="VERMELHOS">{observed(player, "redcards")}</span><span data-label="CS DEF">{observed(player, "cleansheetsdef", player.cleanSheetsDef)}</span><span data-label="ARQUÉTIPO RECENTE">{archetype ? <span className="statistics-archetype" title={recentArchetype.playedAt ? `Snapshot da partida · ${recentArchetype.playedAt}` : "Snapshot de partida"}>{archetype.name}</span> : "—"}</span></article>; }) : <p className="statistics-no-data">Importe partidas com dados individuais para montar esta leitura.</p>}</section>{keepers.length > 0 && <><section className="statistics-section-heading"><div><span>LEITURA POR POSIÇÃO</span><h2>Goleiros.</h2></div><p>Métricas específicas, sem priorizar chutes ou desarmes.</p></section><section className="statistics-keeper-grid">{keepers.map((player) => <GoalkeeperCard key={player.handle} player={player}/>)}</section></>}</div>;
}

export function StatisticsPage({ workspace, matches = workspace.matches || [] }) {
  const [tab, setTab] = useState("summary");
  const team = useMemo(() => aggregateTeamStatistics(matches, workspace.players || []), [matches, workspace.players]);
  const players = useMemo(() => aggregatePlayerStatistics(matches, { players: workspace.players, aliases: workspace.aliases }), [matches, workspace.players, workspace.aliases]);
  return <section className="data-page page-enter statistics-v3"><PageHeader title="O jogo em perspectiva." description="Produção, eficiência e contexto calculados apenas com dados reais reconciliados." aside={<RastroDataSignature label="Analytics by" />} /><SegmentedControl className="statistics-tabs-v3" items={[["summary", "RESUMO"], ["team", "DADOS DO TIME"], ["players", "DADOS INDIVIDUAIS"]]} active={tab} onChange={setTab} label="Dados estatísticos"/>{tab === "summary" ? <Summary team={team} players={players} matches={matches} workspace={workspace}/> : tab === "team" ? <TeamData team={team}/> : <PlayersData players={players} matches={matches} workspace={workspace}/>}</section>;
}

export default StatisticsPage;
