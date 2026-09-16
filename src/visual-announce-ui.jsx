import React from "react";
import { createRoot } from "react-dom/client";
import { AnnounceStudio } from "./features/media/AnnounceStudio.jsx";
import "./fc27-brand.css";
import "./styles.css";
import "./features/media/media.css";
import "./ui/select-control.css";
import "./ui/motion/motion.css";

const workspace = {
  players: [
    { id: "p1", display_name: "OBEEN", positions: ["MC"], avatar_path: "/brand/strix/portrait-nunes.png?v=3", is_active: true, member_type: "elenco", structure_role: "diretoria" },
    { id: "p2", display_name: "Santozz", positions: ["ATA"], avatar_path: "/brand/strix/portrait-santozz.png?v=3", is_active: true, member_type: "elenco", structure_role: "jogador" },
    { id: "p3", display_name: "Cedraz", positions: ["ZAG"], is_active: true, member_type: "elenco", structure_role: "conselho" },
    { id: "p4", display_name: "Ceni", positions: ["GOL"], avatar_path: "/brand/strix/portrait-ceni.png?v=3", is_active: true, member_type: "elenco", structure_role: "staff" },
    { id: "p5", display_name: "YGO", positions: ["ZAG"], avatar_path: "/brand/strix/portrait-ygo.png?v=3", is_active: true, member_type: "elenco", structure_role: "jogador" },
    { id: "p6", display_name: "João Pedro", positions: ["GOL"], avatar_path: "/brand/strix/portrait-joao.png?v=3", is_active: true, member_type: "elenco", structure_role: "manager" },
  ],
  aliases: [{ player_id: "p1", ea_name: "OBEEN" }],
  assetUrl: (path) => path || "",
  saveStructureRole: async () => {},
};

createRoot(document.getElementById("root")).render(
  <main className="media-page" style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 20px 80px" }}>
    <header className="media-editorial-heading">
      <span>STRIX UNITED · MÍDIA</span>
      <h1>Central de conteúdo.</h1>
      <p>Fixture local da UI de Anúncios FC 27.</p>
    </header>
    <AnnounceStudio workspace={workspace} />
  </main>,
);
