import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { STRIX_BRAND } from "./brand.js";
import "./styles.css";
import "./fc27-polish.css";
import "./partidas.css";
import "./fc27-data.css";
import "./fc27-fixes.css";
import "./agenda.css";
import "./agenda-final.css";
import "./gameday/gameday.css";
import "./gameday/gameday-controls.css";
import "./visual-test.css";
import { MatchesPage } from "./features/matches/MatchesPage.jsx";
import { CompetitionsPage } from "./features/competitions/CompetitionsPage.jsx";
import { LibraryPage } from "./features/library/LibraryPage.jsx";
import { DeveloperPage } from "./features/developer/DeveloperPage.jsx";
import { StatisticsPage } from "./features/statistics/StatisticsPage.jsx";
import { AnalysisPage } from "./features/analysis/AnalysisPage.jsx";
import { RosterTools } from "./features/squad/RosterTools.jsx";
import { notify, ToastViewport } from "./ui/motion/motion.jsx";
import { GameDayCanvas } from "./gameday/GameDayCanvas.jsx";
import { GameDayEditor } from "./gameday/GameDayEditor.jsx";
import { createDefaultProject } from "./gameday/defaults.js";
import "./fc27-brand.css";
import "./round-discovery.css";

const now = new Date("2026-08-08T22:10:00-03:00").toISOString();
const profile = { user_id: "visual", access_tier: "dev", display_name: "Visual QA" };
const snapshot = { phase: "Fase de grupos", teamCount: 8, strixGroup: "Grupo A", groups: [{ name: "Grupo A", standings: [
  { position: 1, team: "STRIX UNITED", points: 16, played: 7, wins: 5, draws: 1, losses: 1, goalsFor: 18, goalsAgainst: 7, goalDifference: 11, form: ["V", "V", "E", "V", "D"], isStrix: true },
  { position: 2, team: "POA CITY", points: 14, played: 7, wins: 4, draws: 2, losses: 1, goalsFor: 15, goalsAgainst: 8, goalDifference: 7, form: ["V", "E", "V", "V", "E"] },
  { position: 3, team: "CLUBE DO POVO", points: 10, played: 7, wins: 3, draws: 1, losses: 3, goalsFor: 11, goalsAgainst: 12, goalDifference: -1, form: ["D", "V", "D", "E", "V"] },
] }] };
const workspace = {
  error: "", schemaPending: false,
  players: [{ id: "p1", display_name: "YGO", positions: ["ZAG"], member_type: "elenco", is_active: true }, { id: "p2", display_name: "JOÃO GAMER", positions: ["GOL"], member_type: "complete", is_active: true }, { id: "p3", display_name: "OBEN", positions: ["MC"], member_type: "elenco", is_active: true }, { id: "p4", display_name: "NUNES", positions: ["MC"], member_type: "elenco", is_active: true }, { id: "p5", display_name: "KESTOL", positions: ["ALA"], member_type: "complete", is_active: true }, { id: "p6", display_name: "CEDRAZ", positions: ["ZAG"], member_type: "elenco", is_active: true }, { id: "p7", display_name: "SANTOZZ", positions: ["ATA"], member_type: "elenco", is_active: true }], aliases: [{ ea_name: "39ygo", player_id: "p1", club_players: { display_name: "YGO" } }, { ea_name: "JOAO", player_id: "p2", club_players: { display_name: "JOÃO GAMER" } }, { ea_name: "OBEEN", player_id: "p3", club_players: { display_name: "OBEN" } }, { ea_name: "NUNES", player_id: "p4", club_players: { display_name: "NUNES" } }, { ea_name: "KESTOL", player_id: "p5", club_players: { display_name: "KESTOL" } }, { ea_name: "CEDRAZ", player_id: "p6", club_players: { display_name: "CEDRAZ" } }, { ea_name: "SANTOZZ", player_id: "p7", club_players: { display_name: "SANTOZZ" } }], logos: [],
  agenda: [{ id: "a1", scheduled_at: now, opponent_name: "POA CITY", status: "scheduled", competition_name: "Copa Yeshua", competition_id: "c1", competition_edition_id: "e1" }, { id: "a2", scheduled_at: new Date("2026-08-07T00:10:00-03:00").toISOString(), opponent_name: "POA CITY", status: "scheduled", competition_name: "Copa Yeshua", competition_id: "c1", competition_edition_id: "e1" }],
  matches: [
    { id: "m1", played_at: now, opponent_name: "POA CITY", strix_score: 3, opponent_score: 1, competition_name: "Copa Yeshua", competition_id: "c1", competition_edition_id: "e1", source: "ea_api", performance: { possession: 57, shots: 12, passes: "88/102", tackles: 9, goalkeeperSaves: 4, averageRating: 8.4, players: [{ eaName: "39ygo", rating: 8.7, goals: 2, assists: 1, passes: "31/34", passesMade: 31, passesAttempts: 34, shots: 4, tackles: 3, saves: 0 }, { eaName: "OBEEN", rating: 8.1, goals: 1, assists: 0, passes: "24/28", passesMade: 24, passesAttempts: 28, shots: 2, tackles: 5, saves: 0 }, { eaName: "NUNES", rating: 7.8, goals: 0, assists: 1, passesMade: 22, passesAttempts: 27, shots: 1, tackles: 2 }, { eaName: "KESTOL", rating: 7.5, goals: 0, assists: 0, passesMade: 19, passesAttempts: 24, shots: 1, tackles: 4 }, { eaName: "CEDRAZ", rating: 7.3, goals: 0, assists: 0, passesMade: 18, passesAttempts: 23, shots: 0, tackles: 5 }, { eaName: "SANTOZZ", rating: 7.2, goals: 0, assists: 0, passesMade: 14, passesAttempts: 20, shots: 3, tackles: 1 }, { eaName: "JOAO", position: "GOL", rating: 7.9, passesMade: 18, passesAttempts: 22, saves: 4 }, { eaName: "Caiu cedo", rating: 3, goals: 0, assists: 0, passes: "0/0", passesMade: 0, shots: 0, tackles: 0, saves: 0 }] } },
    { id: "m2", played_at: now, opponent_name: "SEM ESCUDO", strix_score: 2, opponent_score: 2, competition_name: "Amistoso", source: "local_bridge", performance: {} },
    { id: "m3", played_at: now, opponent_name: "ESCUDO GRANDE", strix_score: 2, opponent_score: 3, competition_name: "Master League", source: "local_bridge", opponent_logos: { storage_path: STRIX_BRAND.logo }, performance: {} },
  ],
  competitions: [{ id: "c1", name: "Copa Yeshua", organization: "CCB", accent_color: "#7f44ff", palette: ["#7f44ff", "#f2b928"], logo_url: "", is_active: true }, { id: "c2", name: "7 * SUPERLIGA YESHUA", organization: "CCB", accent_color: "#ff8a30", palette: ["#ff8a30"], logo_url: "", is_active: true }, { id: "c3", name: "VPR ELITE - VYPERIUM", organization: "VPR", accent_color: "#2bb7ff", palette: ["#2bb7ff"], logo_url: "", is_active: true }],
  competitionEditions: [{ id: "e1", competition_id: "c1", label: "2026 · Temporada 6", format: "groups", status: "active", qualification_slots: 4, tie_break_rules: ["points", "goal_difference"] }, { id: "e2", competition_id: "c2", label: "2026 · Edição atual", format: "groups", status: "active", qualification_slots: 8, tie_break_rules: ["points"] }, { id: "e3", competition_id: "c3", label: "2026 · Edição atual", format: "rounds", status: "active", qualification_slots: 4, tie_break_rules: ["points"] }],
  competitionSources: [{ id: "s1", edition_id: "e1", source_kind: "standings", source_url: "https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=100", last_synced_at: now, snapshot }, { id: "s2", edition_id: "e1", source_kind: "knockout", source_url: "https://ccbclubs.com.br/fifa.php?file=eliminatoria&campeonato=100&grupo=12", last_synced_at: now, snapshot: { phase: "knockout", knockout: { currentStage: "Quartas de final", rounds: [{ name: "Oitavas de final", scheduledAt: null }, { name: "Quartas de final", scheduledAt: "2026-08-10T23:10:00-03:00" }, { name: "Semifinais", scheduledAt: null }, { name: "Final", scheduledAt: null }] } } }],
  competitionFixtures: [
    ["SUMMIT ES", "NEW ERA E - SPORTS", "q1"], ["VIKINGS TEAM", "TRAFEGO DO RJ", "q2"], ["HANNIBALL ESPORTS", "ITUANO FV", "q3"], ["XUMBREGA SC", "STRIX UNITED", "q4"],
  ].map(([home_team_name, away_team_name, external_match_id]) => ({ edition_id: "e1", external_match_id, round_label: "Quartas de final", scheduled_at: "2026-08-10T23:10:00-03:00", home_team_name, away_team_name, home_logo: STRIX_BRAND.logo, away_logo: STRIX_BRAND.logo, status: "scheduled" })),
  assetUrl: (path) => path || "", refresh: async () => {}, savePlayerAliases: async () => {}, removePlayerAlias: async () => {}, importLegacyRoster: async (players) => ({ created: players.length, merged: 0, aliases: players.length, conflicts: [] }), upsertClubMatches: async () => {}, upsertClubMatch: async () => {}, removeClubMatch: async () => {},
};
const libraryFixtures = [
  { id: "l1", title: "Saída sob pressão", category: "jogada", description: "Referência curta para a construção do Strix.", source_type: "youtube", source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", published_at: now, tags: ["saída", "pressão"] },
  { id: "l2", title: "Review da rodada", category: "review", description: "Leitura coletiva dos principais momentos.", source_type: "drive", source_url: "https://drive.google.com/file/d/demo/view", published_at: now, tags: ["review"] },
];
const progressFixtures = [{ item_id: "l1", user_id: "visual", viewer_display_name: "Visual QA", progress_percent: 42, last_position_seconds: 134, last_accessed_at: now }];
const emptyQuery = (data = []) => { const query = { select:()=>query, order:()=>query, update:()=>query, insert:()=>query, delete:()=>query, eq:()=>query, single:()=>query, maybeSingle:()=>query, then:(resolve)=>resolve({ data, error:null }) }; return query; };
const client = {
  auth: { getSession: async () => ({ data: { session: { access_token: "visual" } } }) },
  from: (table) => emptyQuery(table === "library_items" ? libraryFixtures : table === "library_view_progress" ? progressFixtures : []),
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: () => {},
  storage: { from: () => ({ getPublicUrl: (path) => ({ data: { publicUrl: path } }) }) },
};
const page = new URLSearchParams(location.search).get("screen") || "competitions";
let content;
const TestIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" fill="none" stroke="currentColor" strokeWidth="2"/></svg>;
function ToastFixture() { useEffect(() => { notify("Agenda sincronizada."); notify("Novo confronto disponível.", "warning"); notify("Importação concluída."); }, []); return <><section className="data-page"><header className="data-page-header"><div><span>MOTION QA</span><h1>Toast stack.</h1></div></header></section><ToastViewport/></>; }
if (page === "agenda-menu") content = <section className="data-page"><header className="data-page-header"><div><span>AGENDA DE PARTIDAS</span><h1>Próximos jogos.</h1></div></header><section className="agenda-list"><article className="agenda-game"><time>22H10</time><div className="agenda-match"><div className="avatar">PC</div><div><small>STRIX UNITED VS</small><b>POA CITY FC</b></div></div><span className="game-competition">COPA YESHUA</span><em className="soon">EM BREVE</em><button>•••</button><div className="agenda-actions"><button><TestIcon/>Editar partida</button><button><TestIcon/>Trocar adversário</button><button className="danger"><TestIcon/>Cancelar jogo</button><button className="danger delete"><TestIcon/>Excluir partida</button></div></article></section></section>;
else if (page === "toasts") content = <ToastFixture/>;
else if (page === "player-modal") content = <div className="match-manual-backdrop"><form className="match-manual-modal squad-modal-v2"><header><div><span>ELENCO · EDITAR PERFIL</span><h2>Editar jogador</h2><p>O preview acompanha a ficha antes de entrar no elenco.</p></div><button type="button" className="icon-button">×</button></header><div className="squad-editor"><section className="manual-form-grid"><label className="manual-full">NOME DE EXIBIÇÃO<input value="YGO" readOnly/></label><label>NÚMERO<input value="10" readOnly/></label><label className="manual-full logo-drop"><span>FOTO DO JOGADOR</span></label><fieldset className="position-picker manual-full"><legend>POSIÇÕES EM QUE JOGA</legend>{["GOL","ZAG","ALA","VOL","MC","MEI","ATA"].map((position)=><button type="button" className={position==="MC"?"selected":""} key={position}>{position}</button>)}</fieldset><fieldset className="member-picker member-picker-three manual-full"><legend>VÍNCULO COM O TIME</legend><button type="button" className="selected"><b>ELENCO</b><small>Jogador do elenco</small></button><button type="button"><b>TESTE</b><small>Em avaliação</small></button><button type="button"><b>COMPLETE</b><small>Fixo no time</small></button></fieldset></section><aside className="squad-preview"><span>PREVIEW DO ELENCO</span><div className="avatar">Y</div><small>MC</small><h3>YGO</h3><p>Jogador do elenco</p></aside></div><footer><button type="button" className="secondary">CANCELAR</button><button className="primary">SALVAR ALTERAÇÕES</button></footer></form></div>;
else if (page === "matches") content = <MatchesPage profile={profile} workspace={workspace} client={client}/>;
else if (page === "library") content = <LibraryPage profile={profile} client={client}/>;
else if (page === "statistics") content = <StatisticsPage profile={profile} workspace={workspace} matches={workspace.matches}/>;
else if (page === "analysis") content = <AnalysisPage profile={profile} workspace={workspace} matches={workspace.matches}/>;
else if (page === "roster-tools") content = <section className="data-page"><header className="data-page-header"><div><span>ELENCO FC27</span><h1>Ferramentas do elenco.</h1></div><RosterTools workspace={workspace}/></header></section>;
else if (page === "developer") content = <DeveloperPage profile={profile} workspace={{ ...workspace, competitionSyncLogs: [], competitionAuditLogs: [], systemFlags: [{ key: "site_maintenance", label: "Modo manutenção", description: "Pausa o acesso dos demais tiers.", enabled: false }] }} client={client}/>;
else if (page === "gameday-editor") content = <GameDayEditor profile={profile} workspace={workspace} client={client}/>;
else if (page === "gameday") {
  const project = createDefaultProject();
  Object.assign(project, { opponentName: "POA CITY", matchTime: "22:10", championshipName: "COPA YESHUA", visualSettings: { ...project.visualSettings, showGuides: false } });
  if (new URLSearchParams(location.search).get("mode") === "agenda") {
    project.mode = "agenda";
    project.competitionLogos = ["YESHUA", "MASTER LEAGUE", "VPR ELITE", "SUPERLIGA", "AMISTOSO"].map((name, index) => ({ id: String(index), name, url: index < 2 ? STRIX_BRAND.logo : "" }));
    project.dailyGames = [
      ["21:10", "VIBE ES", "AMISTOSO"], ["21:40", "WINNER ELEVENS", "SUPERLIGA YESHUA"],
      ["22:10", "TKV", "MASTER LEAGUE"], ["22:40", "RB UNIDOS", "AMISTOSO"],
      ["23:10", "ITUANO FV", "COPA YESHUA"], ["23:40", "POA CITY", "VPR ELITE"],
    ].map(([time, opponent, competition], index) => ({ id: String(index), time, opponent, competition, opponentLogo: "" }));
    project.elements = { ...project.elements, mainLogo: { ...project.elements.mainLogo, x: 650, y: 1320, scale: .5 }, timeCard: { ...project.elements.timeCard, x: 88, y: 455, scale: 1.08 }, group: { ...project.elements.group, visible: false }, dailyGames: { ...project.elements.dailyGames, x: 88, y: 700, scale: 1, visible: true } };
  }
  content = <main className="visual-gameday"><GameDayCanvas project={project} selectedId="" onSelect={() => {}} onLayerChange={() => {}} exportMode/></main>;
} else content = <CompetitionsPage profile={profile} workspace={workspace} client={client}/>;
createRoot(document.getElementById("root")).render(<div className="app-shell"><main className="content visual-content">{content}</main></div>);
