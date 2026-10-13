import React, { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { canManageMedia } from "../../access.js";
import { GROUP_ORDER, describeTonightRelated, positionGroup } from "../media/related-night-core.js";
import { saoPauloDay } from "./agenda-time.js";
import "./night-related.css";

const GROUP_LABEL = Object.freeze({ GOL: "GOLEIROS", DEF: "DEFESA", MEI: "MEIO-CAMPO", ATA: "ATAQUE" });
const idsOf = (players) => players.map((player) => player.id);

/**
 * The night's list: the whole squad, by sector, each name a switch. Tapping a
 * name puts it in or takes it out; the list on screen is a draft until SALVAR.
 */
export function NightRelatedEditor({ workspace, profile, compact = false }) {
  const canEdit = canManageMedia(profile);
  const snapshot = useMemo(
    () => describeTonightRelated(workspace),
    [workspace.nightRelated, workspace.agenda, workspace.players],
  );
  const savedIds = snapshot.saved ? idsOf(snapshot.players) : [];
  const suggestionIds = idsOf(snapshot.suggestion);
  const savedKey = snapshot.saved ? `saved:${savedIds.join(",")}` : "";
  const suggestionKey = suggestionIds.join(",");
  const [selected, setSelected] = useState(() => (snapshot.saved ? savedIds : suggestionIds));
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // A saved list replaces the draft only when the saved list itself changes (first
  // load, a save, someone else saving). An edit in progress is never overwritten by
  // the same saved list arriving again — that used to undo every tap after a save.
  useEffect(() => {
    if (!snapshot.saved) return;
    setSelected(savedIds);
    setDirty(false);
  }, [savedKey]);
  useEffect(() => {
    if (!snapshot.saved && !dirtyRef.current) setSelected(suggestionIds);
  }, [suggestionKey, snapshot.saved]);

  const roster = (workspace.players || []).filter((player) => player.is_active);
  const selectedSet = new Set(selected);
  const groups = GROUP_ORDER.map((id) => ({
    id,
    players: roster
      .filter((player) => (positionGroup((player.positions || [])[0] || "") || "MEI") === id)
      .sort((left, right) => String(left.display_name).localeCompare(String(right.display_name), "pt-BR")),
  })).filter((group) => group.players.length);
  const count = roster.filter((player) => selectedSet.has(player.id)).length;

  const edit = (next, note = "") => {
    setDirty(true);
    setSelected(next);
    setMessage(note);
  };
  const toggle = (id) => edit(selectedSet.has(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const fillFromLineups = () => edit(suggestionIds, suggestionIds.length
    ? "Sugestão das escalações de hoje. Revise e salve."
    : "Nenhuma escalação de hoje para sugerir.");
  const addMissing = () => edit([...new Set([...selected, ...idsOf(snapshot.missingFromSaved)])], "Jogadores das escalações adicionados. Salve para confirmar.");

  const save = async () => {
    if (!canEdit || !workspace.saveNightRelated) return;
    setBusy(true);
    setMessage("");
    try {
      await workspace.saveNightRelated(snapshot.day || saoPauloDay(new Date()), selected);
      setDirty(false);
      setMessage("Lista da noite salva.");
    } catch (error) {
      setMessage(error.message || "Não foi possível salvar a lista.");
    } finally {
      setBusy(false);
    }
  };

  const state = dirty ? "Alterações não salvas" : snapshot.saved ? "Lista salva" : "Rascunho";
  return (
    <section className={`night-list${compact ? " is-compact" : ""}`}>
      <header>
        <div>
          {!compact && <span>RELACIONADOS DA NOITE · {snapshot.day || saoPauloDay(new Date())}</span>}
          <p><b>{String(count).padStart(2, "0")}</b> {count === 1 ? "nome na lista" : "nomes na lista"}</p>
        </div>
        <em className={dirty ? "is-dirty" : ""}>{state}</em>
      </header>
      {snapshot.saved && snapshot.missingFromSaved.length > 0 && (
        <div className="night-list-warn" role="status">
          <p>A escalação de hoje tem {snapshot.missingFromSaved.map((player) => player.name).join(", ")} fora desta lista.</p>
          {canEdit && <button type="button" className="secondary" onClick={addMissing}>ADICIONAR À LISTA</button>}
        </div>
      )}
      {groups.length ? groups.map((group) => (
        <fieldset key={group.id} className="night-list-group">
          <legend>{GROUP_LABEL[group.id]}<small>{group.players.filter((player) => selectedSet.has(player.id)).length}/{group.players.length}</small></legend>
          <div>
            {group.players.map((player) => {
              const on = selectedSet.has(player.id);
              return (
                <button key={player.id} type="button" className={on ? "is-on" : ""} aria-pressed={on} disabled={!canEdit} onClick={() => toggle(player.id)}>
                  <i aria-hidden="true">{on ? <IconCheck size={13} stroke={2.6} /> : <IconPlus size={13} stroke={2.2} />}</i>
                  <b>{player.display_name}</b>
                  <small>{(player.positions || []).join(" · ") || "—"}</small>
                </button>
              );
            })}
          </div>
        </fieldset>
      )) : <p className="night-list-note">Nenhum jogador ativo no elenco.</p>}
      {canEdit && (
        <footer>
          <button type="button" className="night-list-link" onClick={fillFromLineups}>PREENCHER PELAS ESCALAÇÕES</button>
          <button type="button" className="night-list-link" onClick={() => edit([])} disabled={!count}>LIMPAR</button>
          <button type="button" className="primary" disabled={busy || (!dirty && snapshot.saved)} onClick={() => void save()}>
            {busy ? "SALVANDO…" : "SALVAR LISTA"}
          </button>
        </footer>
      )}
      {(message || (canEdit && (dirty || !snapshot.saved))) && <p className="night-list-note" role="status">{message || "Salve a lista para gerar o vídeo."}</p>}
    </section>
  );
}
