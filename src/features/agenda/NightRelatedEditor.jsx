import React, { useEffect, useMemo, useState } from "react";
import { saoPauloDay } from "./agenda-time.js";
import { describeTonightRelated } from "../media/related-night-core.js";
import "./night-related.css";

export function NightRelatedEditor({ workspace, profile, compact = false }) {
  const canEdit = ["diretoria", "dev"].includes(profile?.access_tier);
  const snapshot = useMemo(
    () => describeTonightRelated(workspace),
    [workspace.nightRelated, workspace.agenda, workspace.players],
  );
  const [selected, setSelected] = useState(() => (
    snapshot.saved
      ? snapshot.players.map((player) => player.id)
      : snapshot.suggestion.map((player) => player.id)
  ));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (snapshot.saved) {
      setSelected(snapshot.players.map((player) => player.id));
      setDirty(false);
    } else if (!dirty) {
      setSelected(snapshot.suggestion.map((player) => player.id));
    }
  }, [snapshot.saved, snapshot.players, snapshot.suggestion, dirty]);

  const roster = (workspace.players || []).filter((player) => player.is_active);
  const selectedSet = new Set(selected);
  const selectedPlayers = roster.filter((player) => selectedSet.has(player.id));
  const available = roster.filter((player) => !selectedSet.has(player.id));

  const toggle = (id) => {
    setDirty(true);
    setSelected((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
    setMessage("");
  };

  const fillFromLineups = () => {
    setDirty(true);
    setSelected(snapshot.suggestion.map((player) => player.id));
    setMessage(snapshot.suggestion.length
      ? "Sugestão das escalações. Revise e salve para virar a lista oficial."
      : "Nenhuma escalação de hoje para sugerir.");
  };

  const addMissing = () => {
    setDirty(true);
    setSelected((current) => [...new Set([
      ...current,
      ...snapshot.missingFromSaved.map((player) => player.id),
    ])]);
    setMessage("Jogadores das escalações adicionados. Salve para confirmar.");
  };

  const save = async () => {
    if (!canEdit || !workspace.saveNightRelated) return;
    setBusy(true);
    setMessage("");
    try {
      await workspace.saveNightRelated(snapshot.day || saoPauloDay(), selected);
      setMessage("Relacionados da noite salvos.");
    } catch (error) {
      setMessage(error.message || "Não foi possível salvar os relacionados.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`night-related${compact ? " is-compact" : ""}`}>
      <header>
        <div>
          <span>RELACIONADOS DA NOITE</span>
          <h2>{snapshot.saved ? `${snapshot.players.length} salvos` : "Sugestão ainda não salva"}</h2>
          <p>{snapshot.saved
            ? "Esta lista é a fonte oficial da mídia."
            : "As escalações só sugerem. Salve para gerar o vídeo."}</p>
        </div>
        <b>{selected.length}</b>
      </header>
      {snapshot.saved && snapshot.missingFromSaved.length > 0 && (
        <div className="night-related-warn">
          <p>Escalação contém {snapshot.missingFromSaved.map((player) => player.name).join(", ")} fora desta lista.</p>
          {canEdit && (
            <button type="button" className="secondary" onClick={addMissing}>ADICIONAR À LISTA</button>
          )}
        </div>
      )}
      <div className="night-related-selected">
        {selectedPlayers.length ? selectedPlayers.map((player) => (
          <button key={player.id} type="button" className="is-on" disabled={!canEdit} onClick={() => toggle(player.id)}>
            {player.display_name}
            <small>{(player.positions || []).join(" · ") || "—"}</small>
          </button>
        )) : <p>Nenhum jogador selecionado.</p>}
      </div>
      {canEdit && available.length > 0 && (
        <div className="night-related-pool">
          {available.map((player) => (
            <button key={player.id} type="button" onClick={() => toggle(player.id)}>
              {player.display_name}
            </button>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="night-related-actions">
          <button type="button" className="secondary" onClick={fillFromLineups}>PREENCHER PELAS ESCALAÇÕES</button>
          <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
            {busy ? "SALVANDO…" : "SALVAR"}
          </button>
        </div>
      )}
      {message && <p className="night-related-note">{message}</p>}
    </section>
  );
}
