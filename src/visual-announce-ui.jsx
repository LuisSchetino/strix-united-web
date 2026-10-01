import React from "react";
import { createRoot } from "react-dom/client";
import { MediaPage } from "./features/media/MediaPage.jsx";
import { ToastViewport } from "./ui/motion/motion.jsx";
import "./styles.css";
import "./fc27-polish.css";
import "./interaction-polish.css";
import "./field-polish.css";
import "./partidas.css";
import "./agenda.css";
import "./agenda-polish.css";
import "./formation-picker.css";
import "./agenda-final.css";
import "./agenda-sync.css";
import "./fc27-data.css";
import "./fc27-fixes.css";
import "./features/squad-cards.css";
import "./fc27-brand.css";
import "./round-discovery.css";
import "./performance-polish.css";
import "./quality-polish.css";
import "./ui-bugfix.css";
import "./mobile-safe.css";
import "./ui/strix-polish.css";
import "./ui/select-control.css";

// Local QA surface for the REAL MediaPage with a fixture workspace.
// ?related=0 → lista não salva (estado vazio) · ?games=0 → sem jogos hoje · ?summary=0 → sem resultados
const params = new URLSearchParams(location.search);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const at = (time) => `${today}T${time}:00-03:00`;
const profile = { user_id: "qa", access_tier: "dev", display_name: "QA" };

const players = [
  { id: "p1", display_name: "OBEEN", positions: ["MC"], shirt_number: 8, avatar_path: "/brand/strix/portrait-nunes.png?v=3", is_active: true, member_type: "elenco", structure_role: "diretoria" },
  { id: "p2", display_name: "Santozz", positions: ["ATA"], shirt_number: 9, avatar_path: "/brand/strix/portrait-santozz.png?v=3", is_active: true, member_type: "elenco", structure_role: "jogador" },
  { id: "p3", display_name: "Cedraz", positions: ["ZAG"], is_active: true, member_type: "elenco", structure_role: "conselho" },
  { id: "p4", display_name: "Ceni", positions: ["GOL"], shirt_number: 1, avatar_path: "/brand/strix/portrait-ceni.png?v=3", is_active: true, member_type: "elenco", structure_role: "staff" },
  { id: "p5", display_name: "YGO", positions: ["ZAG"], shirt_number: 4, avatar_path: "/brand/strix/portrait-ygo.png?v=3", is_active: true, member_type: "elenco", structure_role: "jogador" },
  { id: "p6", display_name: "Nunes", positions: ["MC"], shirt_number: 10, avatar_path: "/brand/strix/portrait-nunes.png?v=3", is_active: true, member_type: "elenco", structure_role: "jogador" },
];

const agenda = params.get("games") === "0" ? [] : [
  { id: "a1", scheduled_at: at("21:10"), opponent_name: "Maquina", status: "scheduled", competition_name: "Amistoso" },
  { id: "a2", scheduled_at: at("21:40"), opponent_name: "Sinceridade FC", status: "scheduled", competition_name: "Amistoso" },
  { id: "a3", scheduled_at: at("22:10"), opponent_name: "POA City", status: "scheduled", competition_name: "Copa Yeshua" },
];

const matches = params.get("summary") === "0" ? [] : [
  { id: "m1", played_at: at("21:10"), opponent_name: "POA City", strix_score: 2, opponent_score: 1, competition_name: "Copa Yeshua" },
  { id: "m2", played_at: at("22:10"), opponent_name: "Maquina FC", strix_score: 3, opponent_score: 0, competition_name: "Copa Yeshua" },
  { id: "m3", played_at: at("23:10"), opponent_name: "CTX Gamingg", strix_score: 1, opponent_score: 1, competition_name: "Yeshua League" },
];

const workspace = {
  players,
  agenda,
  matches,
  aliases: [{ player_id: "p1", ea_name: "OBEEN" }],
  competitions: [],
  competitionFixtures: [],
  nightRelated: params.get("related") === "0" ? [] : [{ night_date: today, player_ids: ["p4", "p5", "p1", "p2"] }],
  assetUrl: (path) => path || "",
  saveStructureRole: async () => {},
  saveNightRelated: async () => {},
};

createRoot(document.getElementById("root")).render(
  <div className="app-shell">
    <main className="workspace" style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 20px 80px" }}>
      <MediaPage profile={profile} client={null} workspace={workspace} />
    </main>
    <ToastViewport />
  </div>,
);
