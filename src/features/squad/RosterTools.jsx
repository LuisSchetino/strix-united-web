import React, { useMemo, useState } from "react";
import { IconArrowMerge, IconCheck, IconLink, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { notify } from "../../ui/motion/motion.jsx";
import { fc26Roster, normalizeRosterName, previewFc26Roster } from "./fc26-roster.js";
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

function ImportRoster({ workspace, close }) {
  const preview = useMemo(() => previewFc26Roster(workspace.players || []), [workspace.players]);
  const [selected, setSelected] = useState(() => new Set(fc26Roster.map((player) => player.sourcePlayerId)));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const confirm = async () => {
    setBusy(true);
    try {
      const imported = await workspace.importLegacyRoster(fc26Roster.filter((player) => selected.has(player.sourcePlayerId)));
      setResult(imported);
      notify(`${imported.created} jogador(es) criado(s) · ${imported.merged} conciliado(s).`, "success");
    } catch (error) {
      notify(error.message || "Não foi possível importar o elenco.", "error");
    } finally { setBusy(false); }
  };
  return <ToolsDialog title="Importar elenco do FC26" eyebrow="ELENCO · MIGRAÇÃO SEGURA" close={close} footer={<><button type="button" className="secondary" onClick={close}>FECHAR</button><button type="button" className="primary" disabled={busy || !selected.size || result} onClick={confirm}>{busy ? "CONCILIANDO…" : result ? "IMPORTAÇÃO CONCLUÍDA" : `IMPORTAR ${selected.size} JOGADORES`}</button></>}>
    <p className="roster-tools-intro">A prévia usa o elenco ativo publicado no FC26. Correspondências pelo identificador ou nome são conciliadas; nada é apagado.</p>
    <div className="roster-import-summary"><span><b>{preview.filter((item) => item.action === "create").length}</b> novos</span><span><b>{preview.filter((item) => item.action === "merge").length}</b> merges</span><span><b>{selected.size}</b> selecionados</span></div>
    {result && <div className="roster-import-result"><IconCheck/><div><b>Importação idempotente concluída</b><span>{result.aliases} aliases criados{result.conflicts.length ? ` · ${result.conflicts.length} conflito(s) preservado(s)` : " · sem conflitos"}.</span></div></div>}
    <div className="roster-import-list">{preview.map((player) => <label key={player.sourcePlayerId}>
      <input type="checkbox" checked={selected.has(player.sourcePlayerId)} disabled={Boolean(result)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(player.sourcePlayerId) ? next.delete(player.sourcePlayerId) : next.add(player.sourcePlayerId); return next; })}/>
      <span><b>{player.displayName}</b><small>{player.positions.join(" · ")} · {player.memberType}</small></span>
      <em className={player.action}>{player.action === "merge" ? <><IconArrowMerge size={14}/>CONCILIAR</> : <><IconUpload size={14}/>CRIAR</>}</em>
    </label>)}</div>
  </ToolsDialog>;
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
  return <><div className="roster-tools-actions"><button type="button" className="secondary" onClick={() => setModal("import")}><IconUpload size={16}/>IMPORTAR FC26</button><button type="button" className="secondary" onClick={() => setModal("aliases")}><IconLink size={16}/>ALIASES</button></div>{modal === "import" && <ImportRoster workspace={workspace} close={() => setModal("")}/>} {modal === "aliases" && <AliasManager workspace={workspace} close={() => setModal("")}/>}</>;
}

export { normalizeRosterName };
