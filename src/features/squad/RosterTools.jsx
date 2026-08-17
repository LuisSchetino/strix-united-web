import React, { useState } from "react";
import { IconLink, IconTrash, IconX } from "@tabler/icons-react";
import { notify } from "../../ui/motion/motion.jsx";
import "./roster-tools.css";

function ToolsDialog({ title, eyebrow, close, children, footer }) {
  return <div className="roster-tools-layer" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className="roster-tools-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <header><div><span>{eyebrow}</span><h2>{title}</h2></div><button type="button" onClick={close} aria-label="Fechar"><IconX size={20}/></button></header>
      <div className="roster-tools-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  </div>;
}

function AliasManager({ workspace, close }) {
  const [eaName, setEaName] = useState("");
  const [playerId, setPlayerId] = useState(workspace.players.find((player) => player.is_active)?.id || "");
  const [busy, setBusy] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    if (!eaName.trim() || !playerId) return;
    setBusy(true);
    try {
      await workspace.savePlayerAliases([{ eaName: eaName.trim(), playerId }]);
      setEaName("");
      notify("Alias canônico salvo.", "success");
    } catch (error) { notify(error.message || "Não foi possível salvar o alias.", "error"); }
    finally { setBusy(false); }
  };
  const activePlayers = (workspace.players || []).filter((player) => player.is_active);
  return <ToolsDialog title="Aliases de jogadores" eyebrow="EA → ELENCO CANÔNICO" close={close}>
    <p className="roster-tools-intro">O identificador original da EA é preservado, mas a interface usa o nome oficial do elenco em partidas, rankings e análises.</p>
    <form className="alias-create" onSubmit={save}><label>NOME RECEBIDO DA EA<input value={eaName} onChange={(event) => setEaName(event.target.value)} placeholder="Ex.: Obenzera"/></label><label>JOGADOR CANÔNICO<select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>{activePlayers.map((player) => <option value={player.id} key={player.id}>{player.display_name}</option>)}</select></label><button className="primary" disabled={busy || !eaName.trim() || !playerId}>VINCULAR</button></form>
    <div className="alias-list">{(workspace.aliases || []).map((alias) => <article key={alias.id}><IconLink size={16}/><div><b>{alias.ea_name}</b><span>→ {alias.club_players?.display_name || workspace.players.find((player) => player.id === alias.player_id)?.display_name || "Jogador"}</span></div><button type="button" onClick={() => void workspace.removePlayerAlias(alias.id).catch((error) => notify(error.message, "error"))} aria-label={`Remover alias ${alias.ea_name}`}><IconTrash size={16}/></button></article>)}</div>
  </ToolsDialog>;
}

export function RosterTools({ workspace }) {
  const [modal, setModal] = useState("");
  return <><div className="roster-tools-actions"><button type="button" className="secondary" onClick={() => setModal("aliases")}><IconLink size={16}/>ALIASES</button></div>{modal === "aliases" && <AliasManager workspace={workspace} close={() => setModal("")}/>}</>;
}
