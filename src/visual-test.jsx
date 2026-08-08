import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./fc27-polish.css";
import "./partidas.css";
import "./fc27-data.css";
import "./fc27-fixes.css";
import "./gameday/gameday.css";
import "./visual-test.css";
import { MatchesPage } from "./features/matches/MatchesPage.jsx";
import { CompetitionsPage } from "./features/competitions/CompetitionsPage.jsx";
import { GameDayCanvas } from "./gameday/GameDayCanvas.jsx";
import { createDefaultProject } from "./gameday/defaults.js";

const now = new Date("2026-08-08T22:10:00-03:00").toISOString();
const profile = { user_id: "visual", access_tier: "dev", display_name: "Visual QA" };
const snapshot = { phase: "Fase de grupos", teamCount: 8, strixGroup: "Grupo A", groups: [{ name: "Grupo A", standings: [
  { position: 1, team: "STRIX UNITED", points: 16, played: 7, wins: 5, draws: 1, losses: 1, goalsFor: 18, goalsAgainst: 7, goalDifference: 11, form: ["V", "V", "E", "V", "D"], isStrix: true },
  { position: 2, team: "POA CITY", points: 14, played: 7, wins: 4, draws: 2, losses: 1, goalsFor: 15, goalsAgainst: 8, goalDifference: 7, form: ["V", "E", "V", "V", "E"] },
  { position: 3, team: "CLUBE DO POVO", points: 10, played: 7, wins: 3, draws: 1, losses: 3, goalsFor: 11, goalsAgainst: 12, goalDifference: -1, form: ["D", "V", "D", "E", "V"] },
] }] };
const workspace = {
  error: "", schemaPending: false,
  players: [{ id: "p1", display_name: "YGO", is_active: true }], aliases: [], logos: [],
  agenda: [{ id: "a1", scheduled_at: now, opponent_name: "POA CITY", status: "scheduled", competition_name: "Copa Yeshua", competition_id: "c1", competition_edition_id: "e1" }],
  matches: [{ id: "m1", played_at: now, opponent_name: "POA CITY", strix_score: 3, opponent_score: 1, competition_name: "Copa Yeshua", competition_id: "c1", competition_edition_id: "e1", source: "ea_api", performance: { possession: 57, shots: 12, passes: 88, tackles: 9, players: [{ eaName: "39ygo", rating: 8.7, goalAssists: 2, passes: 31 }] } }],
  competitions: [{ id: "c1", name: "Copa Yeshua", organization: "CCB", accent_color: "#7f44ff", palette: ["#7f44ff", "#f2b928"], logo_url: "", is_active: true }],
  competitionEditions: [{ id: "e1", competition_id: "c1", label: "2026 · Temporada 6", format: "groups", status: "active", qualification_slots: 4, tie_break_rules: ["points", "goal_difference"] }],
  competitionSources: [{ id: "s1", edition_id: "e1", source_kind: "standings", source_url: "https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=100", last_synced_at: now, snapshot }],
  assetUrl: () => "", refresh: async () => {}, savePlayerAliases: async () => {}, upsertClubMatches: async () => {}, upsertClubMatch: async () => {}, removeClubMatch: async () => {},
};
const client = { auth: { getSession: async () => ({ data: { session: { access_token: "visual" } } }) } };
const page = new URLSearchParams(location.search).get("screen") || "competitions";
let content;
if (page === "matches") content = <MatchesPage profile={profile} workspace={workspace} client={client}/>;
else if (page === "gameday") {
  const project = createDefaultProject();
  Object.assign(project, { opponentName: "POA CITY", matchTime: "22:10", championshipName: "COPA YESHUA", visualSettings: { ...project.visualSettings, showGuides: false } });
  content = <main className="visual-gameday"><GameDayCanvas project={project} selectedId="" onSelect={() => {}} onLayerChange={() => {}} exportMode/></main>;
} else content = <CompetitionsPage profile={profile} workspace={workspace} client={client}/>;
createRoot(document.getElementById("root")).render(<div className="app-shell"><main className="content visual-content">{content}</main></div>);
