import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Sidebar, CentralLive, AgendaLive, SquadPageV3, DataPage } from "./main.jsx";
import { workspace as fixture, profile, client } from "./visual-test.jsx";
import { MatchesPage } from "./features/matches/MatchesPage.jsx";
import { CompetitionsPage } from "./features/competitions/CompetitionsPage.jsx";
import { STRIX_BRAND } from "./brand.js";
import { ClubLogo } from "./ui/ClubLogo.jsx";
import { ToastViewport } from "./ui/motion/motion.jsx";
import { saveRosterPlayer } from "./features/squad/player-save.js";
import { createRosterFixtureClient } from "./dev/roster-fixture-client.js";

// Development-only fixture surface. No authentication bypass, live client or writes.
function LogoReview() {
  const [version, setVersion] = useState(0);
  const [recovered, setRecovered] = useState(false);
  const examples = [
    ["Strix responsivo", STRIX_BRAND.logo],
    ["PNG transparente", "/brand/strix/strix-united-fc27.png"],
    ["Tudo Nosso EC · CCB", "https://ccbclubs.com.br/src/image/proclubs/escudodostimes/Background%20Eraser.png"],
    ["Asset remoto", "https://strix-united-fc27.pages.dev/brand/strix/strix-united-fc27-512.webp"],
    ["Sem logo", ""],
    ["Recuperação por nova URL", recovered ? STRIX_BRAND.logo : "/qa-inexistente.png"],
    ["Retrato", "/brand/strix/portrait-joao.png", "photo"],
  ];
  return <section><h1>Logos · regressão e cache</h1><p>Fixtures visuais; sem dados remotos privados.</p><div style={{display:"flex",gap:12,flexWrap:"wrap"}}><button className="secondary" onClick={() => setVersion(value=>value+1)}>Remontar imagens em cache</button><button className="secondary" onClick={() => setRecovered(true)}>Trocar URL quebrada por válida</button></div><div key={version} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:24,marginTop:32}}>{examples.map(([name,url,kind])=><figure key={name} style={{margin:0}}><div style={{width:96,height:96,display:"grid"}}><ClubLogo name={name} url={url} kind={kind || "logo"} className="qa-logo-sample" priority /></div><figcaption style={{marginTop:12,fontSize:13}}>{name}</figcaption></figure>)}</div></section>;
}

function Review() {
  const [rosterClient] = useState(() => createRosterFixtureClient(localStorage, "strix-quality-roster-v2", fixture.players.map((player, index) => ({ ...player, external_avatar_url: index === 0 ? "/brand/strix/portrait-ygo.png" : index === 1 ? "/brand/strix/portrait-joao.png" : "" }))));
  const [players, setPlayers] = useState(() => rosterClient.rows());
  const [emptyAgenda, setEmptyAgenda] = useState(false);
  const [active, setActive] = useState(() => new URLSearchParams(window.location.search).get("page") === "midia" ? "midia" : "central");
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agenda, setAgenda] = useState(() => [0, 1, 2].map((index) => ({
    ...fixture.agenda[0], id: `qa-${index}`, opponent_name: ["Tudo Nosso EC", "CLUBE DO POVO", "ADVERSÁRIO SEM ESCUDO"][index],
    scheduled_at: new Date(Date.now() + index * 86400000).toISOString(),
    lineup: Array(11).fill(""), resolved_opponent_logo_url: index === 0 ? "https://ccbclubs.com.br/src/image/proclubs/escudodostimes/Background%20Eraser.png" : "",
  })));
  const workspace = { ...fixture, agenda: emptyAgenda ? [] : agenda, nightRelated: [], players,
    savePlayer: async (player, file) => { const result = await saveRosterPlayer(rosterClient, profile.user_id, player, file, async () => { throw new Error("Fotos não são enviadas no QA isolado."); }); setPlayers(rosterClient.rows()); return result; },
    removePlayer: async id => { const { error } = await rosterClient.from("club_players").update({is_active:false}).eq("id",id); if(error) throw error; setPlayers(rosterClient.rows()); },
    matches: fixture.matches.map(match => ({ ...match, played_at: new Date().toISOString() })),
    saveAgenda: async (entry, mode, original) => { setAgenda(items => items.map(item => item.id === original?.id ? {...item,lineup:entry.lineup} : item)); },
    saveNightRelated: async () => {},
  };
  const navigate = (id) => { setActive(id); setMobileOpen(false); };
  return <div className={`app-shell ${compact ? "compact" : ""}`}>
    <Sidebar {...{active,navigate,compact,setCompact,mobileOpen,setMobileOpen,profile}} signOut={() => {}} />
    <main className="workspace"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Abrir menu">☰</button><small>REVISÃO LOCAL · DADOS DE TESTE</small><button className="secondary" onClick={()=>navigate("logos")}>Auditar logos</button></header>
      {active === "central" && <button className="secondary" style={{marginBottom:16}} onClick={()=>setEmptyAgenda(value=>!value)}>{emptyAgenda ? "QA: mostrar jogos" : "QA: agenda vazia"}</button>}
      {active === "elenco" && <details style={{marginBottom:16,fontSize:12}}><summary>QA · registros locais persistentes ({players.length})</summary>{players.map(player=><p key={player.id}>{player.display_name} · {player.is_active ? "ATIVO" : "ARQUIVADO"} · ID {player.id}</p>)}</details>}
      {active === "logos" ? <LogoReview/> : active === "central" ? <CentralLive workspace={workspace} navigate={navigate}/> : active === "agenda" ? <AgendaLive {...{workspace,profile,navigate}}/> : active === "elenco" ? <SquadPageV3 {...{workspace,profile}}/> : active === "partidas" ? <MatchesPage {...{workspace,profile,client}}/> : active === "campeonatos" ? <CompetitionsPage {...{workspace,profile,client}}/> : <DataPage id={active} {...{workspace,profile,client}}/>}
    </main><ToastViewport/>
  </div>;
}
if (import.meta.env.DEV) createRoot(document.getElementById("quality-root")).render(<Review/>);
