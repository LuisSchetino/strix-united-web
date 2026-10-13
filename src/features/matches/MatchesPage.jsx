import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MatchDisplay } from "../../ui/MatchDisplay.jsx";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { useDialog } from "../../ui/useDialog.js";
import { STRIX_BRAND } from "../../brand.js";
import { RastroDataSignature, RastroWatermark } from "../../ui/RastroBrand.jsx";
import {
  RollingLabel,
  notify,
  useSheetDismiss,
  useSwipeActions,
} from "../../ui/motion/motion.jsx";
import {
  normalizeName,
  resolvePlayerAliases,
  resultLabel,
  validateImport,
  looksReplayed,
  matchGoalScorers,
  suggestAliasPlayer,
} from "./import-core.js";
import { IconListDetails, IconPencil, IconTrash } from "@tabler/icons-react";
import { ConfirmDialog } from "../../ui/ConfirmDialog.jsx";
import { matchClock, smallHoursNight, withMatchClock } from "./match-clock.js";
import { StatIcon } from "../../ui/StatIcon.jsx";
import { canonicalPlayerName, isStrixMotm } from "../statistics/statistics-core.js";
import { describeEaArchetype } from "../statistics/ea-archetypes.js";
import "./match-import.css";
import "./match-fixes.css";
import "../../partidas.css";

import { canAddManualMatch, canCreatePlayer, canSearchEa } from "../../access.js";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { readApiJson } from "../../lib/read-api-json.js";
import { PageHeader } from "../../ui/PageHeader.jsx";
import { clearTarget, openTarget, useDeepTarget } from "../../ui/useDeepTarget.js";
import { CopyLinkButton } from "../../ui/CopyLinkButton.jsx";
import { ErrorNote } from "../../ui/ErrorNote.jsx";
import { MatchStandings } from "../agenda/MatchView.jsx";
import { agendaStandingComparison } from "../agenda/agenda-standings.js";
const safeRows = (value) => Array.isArray(value) ? value : [];
const matchTypeLabel = (value) => ({ friendlyMatch: "AMISTOSO EA", leagueMatch: "LIGA EA", playoffMatch: "PLAYOFF EA" })[value] || String(value || "PARTIDA EA").toUpperCase();
const formatDate = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
// "2026-10-08" → "08/10", and the day after a "YYYY-MM-DD".
const brDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dayAfter = (iso) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
const formatTime = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));

function MatchScoreline({
  homeName,
  homeLogo,
  homeScore,
  awayName,
  awayLogo,
  awayScore,
  className = "",
  layout = "inline",
}) {
  return <MatchDisplay {...{ homeName, homeLogo, homeScore, awayName, awayLogo, awayScore, className, layout }} />;
}

function MatchPreview({ match, workspace }) {
  const logo = workspace.logos.find(
    (item) =>
      normalizeName(item.canonical_name) === normalizeName(match.opponent),
  );
  return (
    <section className="match-live-preview" aria-label="Preview da partida">
      <small>PREVIEW NO FC27</small>
      <MatchScoreline
        homeName="STRIX"
        homeLogo={STRIX_BRAND.logo}
        homeScore={match.strixScore}
        awayName={match.opponent || "ADVERSÁRIO"}
        awayLogo={logo?.storage_path ? workspace.assetUrl(logo.storage_path) : ""}
        awayScore={match.opponentScore}
      />
      <footer>
        <span>
          {formatDate(match.date)} · {formatTime(match.date)}
        </span>
        <em>{match.competition || "SEM COMPETIÇÃO"}</em>
      </footer>
      <p>
        {match.goalScorers?.length
          ? `Gols: ${match.goalScorers.join(", ")}`
          : "Gols: não informados"}
      </p>
    </section>
  );
}

function EditMatchModal({ match, workspace, close, save }) {
  const [draft, setDraft] = useState({
    ...match,
    scorersText: matchGoalScorers(match).join(", "),
  });
  const patch = (value) => setDraft((current) => ({ ...current, ...value }));
  // Date and hour are São Paulo's, and each one changes alone (match-clock.js).
  const clock = matchClock(draft.date);
  const changeDate = (key, value) => patch({ date: withMatchClock(draft.date, key, value) });
  const night = smallHoursNight(draft.date);
  const preview = {
    ...draft,
    goalScorers: draft.scorersText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
  return createPortal((
    <div
      className="match-flow-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <form
        className="match-review-modal"
        onSubmit={(event) => {
          event.preventDefault();
          save({
            ...preview,
            performance: {
              ...(preview.performance || {}),
              goalScorers: preview.goalScorers,
            },
          });
        }}
      >
        <header>
          <div>
            <span>REVISÃO · PARTIDA</span>
            <h2>Editar antes de importar</h2>
            <p>O card ao lado acompanha cada alteração em tempo real.</p>
          </div>
          <CloseButton onClick={close} />
        </header>
        <div className="match-review-layout">
          <section className="match-review-fields">
            <label>
              ADVERSÁRIO
              <input
                autoFocus
                value={draft.opponent}
                onChange={(event) => patch({ opponent: event.target.value })}
              />
            </label>
            <div>
              <label>
                DATA
                <input
                  type="date"
                  value={clock.date}
                  onChange={(event) => changeDate("date", event.target.value)}
                />
              </label>
              <label>
                HORÁRIO
                <input
                  type="time"
                  value={clock.time}
                  onChange={(event) => changeDate("time", event.target.value)}
                />
              </label>
            </div>
            {night && <p className="match-review-note">Horário de madrugada: este jogo conta para a noite de {brDay(night)}. Se ele foi da noite de {brDay(clock.date)}, a data certa é {brDay(dayAfter(clock.date))}.</p>}
            <div>
              <label>
                STRIX
                <input
                  type="number"
                  min="0"
                  value={draft.strixScore}
                  onChange={(event) =>
                    patch({ strixScore: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                ADVERSÁRIO
                <input
                  type="number"
                  min="0"
                  value={draft.opponentScore}
                  onChange={(event) =>
                    patch({ opponentScore: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              COMPETIÇÃO
              <input
                value={draft.competition}
                onChange={(event) => patch({ competition: event.target.value })}
                placeholder="Amistoso, liga ou copa"
              />
            </label>
            <label>
              AUTORES DOS GOLS
              <input
                value={draft.scorersText}
                onChange={(event) => patch({ scorersText: event.target.value })}
                placeholder="Obenzera, SxntsTheAngel"
              />
            </label>
          </section>
          <MatchPreview match={preview} workspace={workspace} />
        </div>
        <footer>
          <button type="button" className="secondary" onClick={close}>
            CANCELAR
          </button>
          <button className="primary">APLICAR ALTERAÇÕES</button>
        </footer>
      </form>
    </div>
  ), document.body);
}

function ReviewStep({
  matches,
  selected,
  toggle,
  selectAll,
  clearSelection,
  edit,
  next,
}) {
  return (
    <section className="import-stage motion-stack-stage">
      <header>
        <div>
          <span>ETAPA 1 · ESCOLHER E REVISAR</span>
          <h2>Partidas encontradas</h2>
          <p>Selecione somente o que deve entrar no histórico.</p>
        </div>
        <b>
          {selected.size}/{matches.length}
        </b>
      </header>
      <div
        className="match-selection-toolbar"
        aria-label="Controles de seleção"
      >
        <button
          type="button"
          onClick={selectAll}
          disabled={selected.size === matches.length}
        >
          SELECIONAR TODOS
        </button>
        <button
          type="button"
          onClick={clearSelection}
          disabled={!selected.size}
        >
          LIMPAR SELEÇÃO
        </button>
        <span>
          {selected.size
            ? `${selected.size} pronta${selected.size === 1 ? "" : "s"} para revisar`
            : "Nenhuma partida selecionada"}
        </span>
      </div>
      <div className="match-review-list">
        {matches.map((match) => (
          <article
            key={match.id}
            className={`${selected.has(match.id) ? "selected" : ""} ${match.alreadyImported ? "is-imported" : ""}`}
          >
            <label className="match-review-check">
              <input
                type="checkbox"
                checked={selected.has(match.id)}
                disabled={match.alreadyImported}
                onChange={() => toggle(match.id)}
              />
              <span aria-hidden="true" />
            </label>
            <time>
              {match.dateLabel}
              <small>{match.timeLabel}</small>
            </time>
            <div className="match-review-score">
              <b>STRIX</b>
              <strong>
                {match.strixScore} × {match.opponentScore}
              </strong>
              <b>{match.opponent}</b>
              <em className={resultLabel(match).toLowerCase()}>
                {match.alreadyImported ? "JÁ IMPORTADO" : resultLabel(match)}
              </em>
              {looksReplayed(match) && (
                <em className="match-replayed-tag" title="A maioria do Strix terminou sem nenhum passe: costuma ser jogo abandonado e refeito. Dá para importar mesmo assim.">
                  PARTIDA REFEITA?
                </em>
              )}
            </div>
            <p>
              {matchGoalScorers(match).length
                ? `Gols: ${matchGoalScorers(match).join(", ")}`
                : "Gols do Strix não identificados"}
              <small>{matchTypeLabel(match.matchType)}</small>
            </p>
            <button
              type="button"
              className="match-mini-action"
              onClick={() => edit(match)}
              aria-label={`Editar partida contra ${match.opponent}`}
            >
              ✎
            </button>
          </article>
        ))}
      </div>
      <footer>
        <button className="primary" disabled={!selected.size} onClick={next}>
          AVANÇAR
        </button>
      </footer>
    </section>
  );
}

function RosterQuickAdd({ eaName, onClose, onSaved, workspace }) {
  const positions = ["GOL", "ZAG", "ALA", "VOL", "MC", "MEI", "ATA"];
  const [draft, setDraft] = useState({ display_name: eaName || "", positions: [], member_type: "elenco", shirt_number: "", trial_expires_at: "" });
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);
  const togglePosition = (position) => setDraft((current) => ({
    ...current,
    positions: current.positions.includes(position) ? current.positions.filter((item) => item !== position) : [...current.positions, position],
  }));
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (!draft.display_name.trim()) throw new Error("Informe o nome do jogador.");
      if (!draft.positions.length) throw new Error("Escolha ao menos uma posição.");
      const result = await workspace.savePlayer({ ...draft, trial_expires_at: draft.member_type === "teste" ? draft.trial_expires_at || null : null }, photo);
      notify(result?.reactivated ? "Jogador reativado. Perfil e histórico preservados." : "Jogador salvo. Elenco atualizado.");
      onSaved(result?.player?.id || "");
    } catch (saveError) {
      setError(saveError.message || "Não foi possível salvar o jogador.");
      setSaving(false);
    }
  };
  return createPortal(<div className="match-manual-backdrop squad-dialog-layer" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <form className="match-manual-modal squad-modal-v2" role="dialog" aria-modal="true" aria-labelledby="alias-player-title" aria-busy={saving} onSubmit={save}>
      <header><div><span>ELENCO · NOVO PERFIL</span><h2 id="alias-player-title">Adicionar jogador</h2><p>Entra no elenco e já fica vinculado a {eaName}.</p></div><CloseButton onClick={onClose} disabled={saving} /></header>
      <div className="squad-editor"><section className="manual-form-grid">
        <label className="manual-full">NOME DE EXIBIÇÃO<input autoFocus value={draft.display_name} onChange={(event) => setDraft((current) => ({ ...current, display_name: event.target.value }))} placeholder="Como aparece no time" /></label>
        <label>NÚMERO<input type="number" min="0" max="99" value={draft.shirt_number} onChange={(event) => setDraft((current) => ({ ...current, shirt_number: event.target.value }))} placeholder="10" /></label>
        <label className="manual-full logo-drop"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /><span>{photo ? photo.name : "Enviar foto do computador"}</span></label>
        <fieldset className="position-picker manual-full"><legend>POSIÇÕES EM QUE JOGA</legend>{positions.map((position) => <button type="button" className={draft.positions.includes(position) ? "selected" : ""} key={position} onClick={() => togglePosition(position)}>{position}</button>)}</fieldset>
        <fieldset className="member-picker member-picker-three manual-full"><legend>VÍNCULO COM O TIME</legend>
          <button type="button" className={draft.member_type === "elenco" ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, member_type: "elenco", trial_expires_at: "" }))}><b>ELENCO</b><small>Jogador do elenco</small></button>
          <button type="button" className={draft.member_type === "teste" ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, member_type: "teste" }))}><b>TESTE</b><small>Em avaliação</small></button>
          <button type="button" className={draft.member_type === "complete" ? "selected" : ""} onClick={() => setDraft((current) => ({ ...current, member_type: "complete", trial_expires_at: "" }))}><b>COMPLETE</b><small>Fixo no time</small></button>
        </fieldset>
        {draft.member_type === "teste" && <label className="manual-full">TESTE ATÉ<input type="date" value={draft.trial_expires_at} onChange={(event) => setDraft((current) => ({ ...current, trial_expires_at: event.target.value }))} /></label>}
      </section><aside className="squad-preview"><span>PREVIEW DO ELENCO</span><ClubLogo name={draft.display_name || "?"} url={previewUrl} kind="photo" size={116} /><small>{draft.positions[0] || "POSIÇÃO"}</small><h3>{draft.display_name || "NOME DO JOGADOR"}</h3><p>{draft.member_type === "teste" ? "Jogador em teste" : draft.member_type === "complete" ? "Jogador completo" : "Jogador do elenco"}</p></aside></div>
      <footer>{error && <p className="squad-save-error" role="alert">{error}</p>}<div><button type="button" className="secondary" onClick={onClose} disabled={saving}>CANCELAR</button><button className="primary" disabled={saving}>{saving ? "SALVANDO…" : "SALVAR JOGADOR"}</button></div></footer>
    </form>
  </div>, document.body);
}

const dayOf = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(value));

/**
 * The Agenda games a played match can be linked to: only the ones of its own day, closest
 * kick-off first. A match played in the small hours also sees the day before (its night
 * started then). The one already linked or suggested is always offered.
 */
function agendaAround(agenda, match) {
  const played = new Date(match?.date || match?.played_at || Date.now());
  if (!Number.isFinite(played.getTime())) return [];
  const days = new Set([dayOf(played)]);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(played));
  if (hour < 6) days.add(dayOf(played.getTime() - 86400000));
  const at = (entry) => new Date(entry.scheduled_at).getTime();
  const pinned = new Set([match?.agendaId, match?.suggestedAgendaId].filter(Boolean).map(String));
  return (Array.isArray(agenda) ? agenda : [])
    .filter((entry) => pinned.has(String(entry.id)) || (Number.isFinite(at(entry)) && days.has(dayOf(entry.scheduled_at))))
    .sort((left, right) => Math.abs(at(left) - played.getTime()) - Math.abs(at(right) - played.getTime()));
}

/**
 * What linking a match to an Agenda game also fills in: that game's competition (a competition
 * of the club, or a friendly). Nothing when the Agenda game names a competition the club does
 * not have, so a wrong one is never chosen for the manager.
 */
function competitionOfAgenda(entry, competitions) {
  if (!entry) return {};
  const found = competitions.find((item) => item.id === entry.competition_id)
    || competitions.find((item) => normalizeName(item.name) === normalizeName(entry.competition_name));
  if (found) return { competitionId: found.id, competitionEditionId: entry.competition_edition_id || found.editionId || "", competition: found.name };
  if (!entry.competition_name || /amistos/i.test(entry.competition_name)) return { competitionId: "", competitionEditionId: "", competition: "Amistoso" };
  return {};
}

export function ResolveStep({
  matches,
  agenda,
  competitions,
  players,
  aliases,
  patchMatch,
  patchAlias,
  back,
  next,
  canAdd = false,
  onAddPlayer,
}) {
  return (
    <section className="import-stage motion-stack-stage">
      <header>
        <div>
          <span>ETAPA 2 · RESOLVER PENDÊNCIAS</span>
          <h2>Contexto e vínculos</h2>
          <p>Confirme competição, Agenda e os nomes identificados pela EA.</p>
        </div>
      </header>
      <div className="resolve-list">
        {matches.map((match) => (
          <article key={match.id}>
            <header>
              <div>
                <small>PARTIDA</small>
                <h3>
                  STRIX {match.strixScore} × {match.opponentScore}{" "}
                  {match.opponent}
                </h3>
                <span>
                  {formatDate(match.date)} · {formatTime(match.date)}
                </span>
              </div>
              <em className={resultLabel(match).toLowerCase()}>{resultLabel(match)}</em>
            </header>
            <div className="resolve-fields">
              <label>
                COMPETIÇÃO *
                <select
                  value={
                    match.competitionId ||
                    (normalizeName(match.competition) === "amistoso"
                      ? "friendly"
                      : "")
                  }
                  onChange={(event) => {
                    const competition = competitions.find(
                      (item) => item.id === event.target.value,
                    );
                    patchMatch(match.id, {
                      competitionId: competition?.id || "",
                      competitionEditionId: competition?.editionId || "",
                      competition:
                        event.target.value === "friendly"
                          ? "Amistoso"
                          : competition?.name || "",
                    });
                  }}
                >
                  <option value="">Selecionar</option>
                  <option value="friendly">Amistoso</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                VINCULAR À AGENDA
                <select
                  value={match.agendaId || ""}
                  onChange={(event) =>
                    patchMatch(match.id, {
                      agendaId: event.target.value,
                      // The Agenda game already says which competition it is.
                      ...competitionOfAgenda(agenda.find((entry) => String(entry.id) === event.target.value), competitions),
                    })
                  }
                >
                  <option value="">Sem vínculo</option>
                  {agendaAround(agenda, match).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.id === match.suggestedAgendaId
                        ? "SUGERIDO · "
                        : ""}
                      {formatDate(entry.scheduled_at)} ·{" "}
                      {formatTime(entry.scheduled_at)} · {entry.opponent_name}
                    </option>
                  ))}
                </select>
                {match.suggestedAgendaId && (
                  <small
                    className={`agenda-suggestion-note ${match.suggestionConfidence || ""}`}
                  >
                    <b>Vínculo sugerido:</b> {match.suggestedAgendaName} —{" "}
                    {formatDate(match.suggestedAgendaAt)} ·{" "}
                    {formatTime(match.suggestedAgendaAt)}
                    <br />
                    {match.suggestionReason}
                    {!match.suggestionAutoLink && " · confirme manualmente"}
                  </small>
                )}
              </label>
            </div>
            <section className="alias-resolver">
              <div>
                <small>EA × ELENCO</small>
                <span>Associações anteriores já aparecem selecionadas.</span>
              </div>
              <div className="alias-resolver-columns" aria-hidden="true"><span>JOGADOR EA</span><span /><span>ELENCO</span><span>G</span><span>A</span></div>
              {(match.performance?.players || []).map((player) => {
                const key = normalizeName(player.eaName);
                // A name nobody linked yet: the likely roster player is offered, never applied on its own.
                const taken = new Set((match.performance?.players || []).map((other) => aliases[normalizeName(other.eaName)]).filter(Boolean));
                const suggestion = aliases[key] ? null : suggestAliasPlayer(player.eaName, players, { taken, lineup: agenda.find((entry) => entry.id === match.agendaId)?.lineup || [] });
                return (
                  <div className="alias-player-row" key={`${match.id}-${key}`}>
                    <div className="alias-player-identity"><b>{player.eaName}</b>{canAdd && <button type="button" className="alias-add-player" aria-label={`Adicionar ${player.eaName} ao elenco`} onClick={() => onAddPlayer?.(player)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>}</div>
                    <span className="alias-player-arrow" aria-hidden="true">→</span>
                    <label className="alias-player-select"><select aria-label={`Jogador do elenco para ${player.eaName}`} value={aliases[key] ?? ""} onChange={(event) => patchAlias(key, event.target.value)}>
                        <option value="">Fora do elenco</option>
                        {players.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
                      </select>{suggestion && <button type="button" className="alias-suggestion" title={`Sugestão por ${suggestion.reason}`} onClick={() => patchAlias(key, suggestion.playerId)}>Sugestão: <b>{suggestion.name}</b> · usar</button>}</label>
                    <span className="player-event-fields">
                      <label><input aria-label={`Gols de ${player.eaName}`} type="number" min="0" max="99" inputMode="numeric" value={Number(player.goals || 0)} onChange={(event) => patchMatch(match.id, { performance: { ...match.performance, players: match.performance.players.map((row) => row.id === player.id ? { ...row, goals: Number(event.target.value) } : row) } })} /></label>
                      <label><input aria-label={`Assistências de ${player.eaName}`} type="number" min="0" max="99" inputMode="numeric" value={Number(player.assists || 0)} onChange={(event) => patchMatch(match.id, { performance: { ...match.performance, players: match.performance.players.map((row) => row.id === player.id ? { ...row, assists: Number(event.target.value) } : row) } })} /></label>
                    </span>
                  </div>
                );
              })}
            </section>
          </article>
        ))}
      </div>
      <footer>
        <button className="secondary" onClick={back}>
          VOLTAR
        </button>
        <button className="primary" onClick={next}>
          REVISAR IMPORTAÇÃO
        </button>
      </footer>
    </section>
  );
}

function SummaryStep({
  matches,
  agenda,
  aliases,
  players,
  validation,
  back,
  confirm,
  saving,
}) {
  const totalPlayers = new Set(
    matches.flatMap((match) =>
      (match.performance?.players || []).map((player) =>
        normalizeName(player.eaName),
      ),
    ),
  ).size;
  const linkedPlayers = new Set(
    Object.entries(aliases)
      .filter(([, id]) => id)
      .map(([name]) => name),
  ).size;
  return (
    <section className="import-stage import-summary motion-stack-stage">
      <header>
        <div>
          <span>REVISÃO FINAL</span>
          <h2>
            {matches.length} partida{matches.length === 1 ? "" : "s"}
          </h2>
          <p>Confira o resumo antes de gravar no histórico do clube.</p>
        </div>
        <b className={validation.valid ? "ready" : "pending"}>
          {validation.valid
            ? "PRONTO"
            : `${validation.pending.length} PENDÊNCIA${validation.pending.length === 1 ? "" : "S"}`}
        </b>
      </header>
      {matches.map((match) => {
        const linkedAgenda = agenda.find(
          (entry) => entry.id === match.agendaId,
        );
        return (
          <article key={match.id}>
            <h3>{match.opponent}</h3>
            <span>
              {formatDate(match.date)} · {formatTime(match.date)}
            </span>
            <strong>
              STRIX {match.strixScore} × {match.opponentScore} {match.opponent}
            </strong>
            <dl>
              <div>
                <dt>Competição</dt>
                <dd>{match.competition || "Pendente"}</dd>
              </div>
              <div>
                <dt>Agenda</dt>
                <dd>
                  {linkedAgenda
                    ? `${linkedAgenda.opponent_name} · ${formatTime(linkedAgenda.scheduled_at)}`
                    : "Sem vínculo"}
                </dd>
              </div>
              <div>
                <dt>Vínculos</dt>
                <dd>
                  {linkedPlayers}/{totalPlayers} no elenco
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
      {!validation.valid && (
        <p className="import-blocker">
          Preencha todos os campos marcados com * para continuar.
        </p>
      )}
      <footer>
        <button className="secondary" onClick={back}>
          VOLTAR
        </button>
        <button
          className="primary"
          disabled={!validation.valid || saving}
          onClick={confirm}
        >
          <RollingLabel>{saving ? "PUBLICANDO…" : matches.length === 1 ? "PUBLICAR JOGO" : "PUBLICAR JOGOS"}</RollingLabel>
        </button>
      </footer>
    </section>
  );
}

function portuguesePosition(value) {
  const labels = { goalkeeper: "Goleiro", gk: "Goleiro", defender: "Defensor", midfielder: "Meio-campo", winger: "Ponta", forward: "Atacante", striker: "Atacante", attacker: "Atacante" };
  return String(value || "—").split(/[·,/]/).map((part) => {
    const clean = part.trim();
    return labels[clean.toLocaleLowerCase("pt-BR")] || clean;
  }).filter(Boolean).join(" · ");
}

function PlayerMatchSheet({ player, match, workspace, close }) {
  const dialogRef = useDialog(close);
  useEffect(() => {
    const dismiss = (event) => event.key === "Escape" && close();
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [close]);
  const eaId = String(player.eaPlayerId ?? player.ea_player_id ?? player.id ?? "");
  const linkedAlias = safeRows(workspace.aliases).find((alias) => String(alias.ea_player_id || "") === eaId && eaId)
    || safeRows(workspace.aliases).find((alias) => normalizeName(alias.ea_name) === normalizeName(player.eaName || player.name));
  const linkedPlayer = safeRows(workspace.players).find((item) => eaId && String(item.ea_player_id || "") === eaId)
    || (linkedAlias ? safeRows(workspace.players).find((item) => String(item.id) === String(linkedAlias.player_id)) : null);
  const name = linkedPlayer?.display_name || canonicalPlayerName(player.name || player.eaName, workspace.players, workspace.aliases);
  const position = portuguesePosition(player.pos || player.position || linkedPlayer?.positions?.join(" · ") || "—");
  const archetype = player.archetypeId ? describeEaArchetype(player.archetypeId) : null;
  const archetypeName = archetype?.verified ? archetype.name : "";
  const goalkeeper = /^(GK|GOL|GL|GOLEIRO)$/i.test(String(position)) || Number(player.saves) > 0;
  const passesMatch = String(player.passes || "").match(/(\d+)\s*\/\s*(\d+)/);
  const passesMade = Number(player.passesMade ?? passesMatch?.[1]);
  const passesAttempted = Number(player.passesAttempts ?? player.passAttempts ?? passesMatch?.[2]);
  const tacklesMade = hasOwnValue(player.tackles) && Number.isFinite(Number(player.tackles)) ? Number(player.tackles) : null;
  const tackleAttempts = Number(player.tackleAttempts ?? player.tacklesAttempts);
  const normalMetrics = [
    ["GOLS", player.goals, "goals"], ["ASSISTÊNCIAS", player.assists, "assists"], ["G+A", hasOwnValue(player.goals) && hasOwnValue(player.assists) ? Number(player.goals) + Number(player.assists) : null, "goals"],
    ["CHUTES", player.shots, "shots"], ["PASSES", Number.isFinite(passesMade) && Number.isFinite(passesAttempted) ? `${passesMade} / ${passesAttempted}` : null, "passes"],
    ["PRECISÃO", passesAttempted > 0 && Number.isFinite(passesMade) ? `${((passesMade / passesAttempted) * 100).toFixed(1)}%` : null, "accuracy"],
    ["DESARMES", tacklesMade, "tackles"],
    ["DESARMES TENTADOS", Number.isFinite(tackleAttempts) ? tackleAttempts : null, "tackles"],
    ["EFICIÊNCIA", tacklesMade !== null && Number.isFinite(tackleAttempts) && tackleAttempts > 0 ? `${((tacklesMade / tackleAttempts) * 100).toFixed(1)}%` : null, "efficiency"],
    ["MOTM", isStrixMotm(match, player, { players: workspace.players, aliases: workspace.aliases }) ? "SIM" : null, "mom"],
    ["VERMELHO", player.redcards, "cards"], ["CLEAN SHEET DEF", player.cleansheetsdef, "clean"],
  ];
  const goalkeeperMetrics = [
    ["DEFESAS", player.saves, "saves"],
    ["DIREÇÃO BOA", player.goodDirectionSaves, "direction"],
    ["REFLEXO", player.reflexSaves, "reflex"],
    ["CRUZAMENTO", player.crossSaves, "cross"],
    ["MERGULHO", player.ballDiveSaves, "dive"],
    ["ESPALMO", player.parrySaves, "parry"],
    ["SOCO", player.punchSaves, "punch"],
    ["SEM SOFRER GOL", player.cleansheetsgk, "clean"],
    ["MOTM", isStrixMotm(match, player, { players: workspace.players, aliases: workspace.aliases }) ? "SIM" : null, "mom"],
  ];
  const dateLabel = match.played_at ? formatDate(match.played_at) : "Data indisponível";
  return createPortal(<div className="player-match-sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section ref={dialogRef} tabIndex={-1} className="player-match-sheet" role="dialog" aria-modal="true" aria-label={`Ficha pós-jogo de ${name}`}>
      <header><div><span>FICHA PÓS-JOGO · {dateLabel}</span><h2>{name}</h2><p>{[position, archetypeName, `Strix ${match.strix_score} × ${match.opponent_score} ${match.opponent_name}`].filter(Boolean).join(" · ")}</p></div><CloseButton onClick={close}/></header>
      <div className="player-match-sheet-rating"><small><StatIcon name="rating"/> NOTA EA</small><strong className={hasOwnValue(player.rating) ? "data-value" : undefined}>{hasOwnValue(player.rating) ? player.rating : "—"}</strong></div>
      <div className="player-match-sheet-grid">{(goalkeeper ? goalkeeperMetrics : normalMetrics).filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value, icon]) => <article key={label}><StatIcon name={icon}/><small>{label}</small><b className="data-value">{value}</b></article>)}</div>
      {!goalkeeper && <p className="player-match-sheet-note">Métricas defensivas e disciplina conforme os campos fornecidos pela EA.</p>}
      <footer><button type="button" className="secondary" onClick={close}>FECHAR</button></footer>
    </section>
  </div>, document.body);
}

const hasOwnValue = (value) => value !== null && value !== undefined && value !== "";

function MatchDetails({ match, workspace, close }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  // Where this result left both clubs in the competition's table, as the organiser publishes it now.
  const standings = useMemo(
    () => agendaStandingComparison(match, workspace.competitionSources || [], workspace.competitionTeams || []),
    [match, workspace.competitionSources, workspace.competitionTeams],
  );
  const sheetDismiss = useSheetDismiss(close);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (selectedPlayer) setSelectedPlayer(null);
      else close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, selectedPlayer]);
  const performance = match.performance || {};
  const players = [...(performance.players || [])].sort(
    (left, right) => Number(right.rating || 0) - Number(left.rating || 0),
  );
  const statNumber = (value) => Number(String(value ?? 0).split("/")[0].trim()) || 0;
  const disconnected = (player) => Number(player.rating) > 0 && Number(player.rating) <= 3
    && [
      player.goals,
      player.assists,
      player.passesMade ?? player.passes,
      player.shots,
      player.tackles,
      player.saves,
    ].every((value) => statNumber(value) === 0);
  const metrics = [
    ["Posse", performance.possession, "possession"],
    ["Passes", performance.passes, "passes"],
    ["Chutes", performance.shots, "shots"],
    ["Desarmes", performance.tackles, "tackles"],
    ["Nota média", performance.averageRating, "rating"],
    ["Defesas", performance.goalkeeperSaves, "saves"],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  const result = Number(match.strix_score) > Number(match.opponent_score) ? "VITÓRIA" : Number(match.strix_score) < Number(match.opponent_score) ? "DERROTA" : "EMPATE";
  const max = (key) => Math.max(0, ...players.map((player) => Number(player[key]) || 0));
  const bestRating = max("rating");
  const maxGoals = max("goals");
  const maxAssists = max("assists");
  const maxPasses = max("passesMade");
  const opponentLogo = match.resolved_opponent_logo_url || (match.opponent_logos?.storage_path ? workspace.assetUrl(match.opponent_logos.storage_path) : "");
  return createPortal((
    <div
      className="match-flow-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        className="match-review-modal match-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da partida"
      >
        <button type="button" className="match-sheet-handle" aria-label="Arraste ou toque para fechar" onClick={close} {...sheetDismiss}><i /></button>
        <header className="match-detail-header">
          <div><span>HISTÓRICO DA PARTIDA</span><h2>Resumo do confronto</h2><p>{formatDate(match.played_at)} · {formatTime(match.played_at)} · {match.competition_name || "Amistoso"}</p></div>
          <CloseButton onClick={close} />
        </header>
        <div className="match-detail-body">
          <section className="match-detail-score-shell" aria-label={`Resultado: ${result}`}>
            <em className={`match-result-badge ${result.toLowerCase()}`}>{result}</em>
            <MatchScoreline
              className="match-detail-score"
              homeName="STRIX UNITED"
              homeLogo={STRIX_BRAND.logo}
              homeScore={match.strix_score}
              awayName={match.opponent_name}
              awayLogo={opponentLogo}
              awayScore={match.opponent_score}
            />
          </section>
          <section className="match-detail-analytics">
          <RastroWatermark label="Rastro Match Data" />
          <RastroDataSignature />
          <div className="match-detail-metrics">
            {metrics.map(([label, value, icon]) => (
              <article key={label}>
                <StatIcon name={icon}/><div><small>{label}</small><strong className="data-value">{value}</strong></div>
              </article>
            ))}
          </div>
          </section>
          <section className="match-player-performance">
            <header><span>DESEMPENHO INDIVIDUAL</span><h3>Jogadores do Strix</h3></header>
            {players.length ? (
              <div className="match-player-table-scroll">
              <div className="match-player-table" role="table">
                <header role="row"><span>JOGADOR</span><span>NOTA</span><span>G</span><span>A</span><span>PASSES</span><span>CHUTES</span><span>DESARMES</span><span>DEFESAS</span></header>
                {players.map((player, index) => (
                  <article role="row" className={`${Number(player.rating) === bestRating && bestRating > 0 ? "is-best " : ""}${disconnected(player) ? "is-disconnected" : ""}`} key={player.id || player.eaName || index}>
                    <div><b><button type="button" className="match-player-profile-trigger" onClick={() => setSelectedPlayer(player)} aria-label={`Abrir ficha de ${canonicalPlayerName(player.name || player.eaName, workspace.players, workspace.aliases)} nesta partida`}>{canonicalPlayerName(player.name || player.eaName, workspace.players, workspace.aliases)}</button></b><small>{disconnected(player) && <em className="disconnect-badge">CAIU DA PARTIDA</em>}{!disconnected(player) && Number(player.rating) === bestRating && bestRating > 0 && <em className="match-player-tag"><StatIcon name="rating"/> MELHOR NOTA</em>}{isStrixMotm(match, player, { players: workspace.players, aliases: workspace.aliases }) && <em className="match-player-tag"><StatIcon name="mom"/> MOTM</em>}{Number(player.goals) === maxGoals && maxGoals > 0 && <em className="match-player-tag"><StatIcon name="goals"/> ARTILHEIRO</em>}{Number(player.assists) === maxAssists && maxAssists > 0 && <em className="match-player-tag"><StatIcon name="assists"/> ASSISTÊNCIA</em>}{Number(player.passesMade) === maxPasses && maxPasses > 0 && <em className="match-player-tag"><StatIcon name="passes"/> MAIS PASSES</em>}</small></div>
                    <strong className={player.rating == null ? undefined : "data-value"}>{player.rating ?? "—"}</strong><span>{player.goals ?? "—"}</span><span>{player.assists ?? "—"}</span><span>{player.passes ?? "—"}</span><span>{player.shots ?? "—"}</span><span>{player.tackles ?? "—"}</span><span>{player.saves ?? "—"}</span>
                  </article>
                ))}
              </div></div>
            ) : (
              <p>
                A fonte não entregou estatísticas individuais para esta partida.
              </p>
            )}
          </section>
          {standings.available && <section className="match-detail-table"><MatchStandings standings={standings} competition={match.competition_name} /></section>}
        </div>
        <footer>
          <CopyLinkButton page="partidas" id={match.id} className="is-leading" />
          <button type="button" className="secondary" onClick={close}>
            FECHAR
          </button>
        </footer>
      </section>
      {selectedPlayer && <PlayerMatchSheet player={selectedPlayer} match={match} workspace={workspace} close={() => setSelectedPlayer(null)}/>}
    </div>
  ), document.body);
}

function MobileMatchCard({ match, opponentLogo, result, canManage, detail, edit, remove }) {
  const swipe = useSwipeActions(canManage ? 132 : 0);
  const confirmRemove = () => { swipe.close(); remove(match); };
  return (
    <div className={`match-mobile-swipe${swipe.offset ? " is-open" : ""}${swipe.dragging ? " is-dragging" : ""}`}>
      {canManage && (
        <div className="match-mobile-actions" aria-hidden={!swipe.offset}>
          <button type="button" onClick={() => (swipe.close(), edit(match))}>EDITAR</button>
          <button type="button" className="danger" onClick={confirmRemove}>EXCLUIR</button>
        </div>
      )}
      <article
        className="match-mobile-card"
        style={{ transform: `translateX(${swipe.offset}px)` }}
        {...swipe.handlers}
      >
        <header>
          <div>
            <time>{formatDate(match.played_at)} · {formatTime(match.played_at)}</time>
            <p><em className={result.toLowerCase()}>{result}</em><span>{match.competition_name || "AMISTOSO"}</span></p>
          </div>
          <button type="button" onClick={() => detail(match)} aria-label={`Abrir detalhes contra ${match.opponent_name}`}><IconListDetails aria-hidden="true" size={18} stroke={1.75} /></button>
        </header>
        <MatchDisplay
          homeName="STRIX UNITED"
          homeLogo={STRIX_BRAND.logo}
          homeScore={match.strix_score}
          awayName={match.opponent_name}
          awayLogo={opponentLogo}
          awayScore={match.opponent_score}
        />
        {canManage && <small className="match-swipe-hint">DESLIZE PARA AÇÕES</small>}
      </article>
    </div>
  );
}

function MatchHistory({ workspace, canManage, detail, edit, remove }) {
  const matches = safeRows(workspace.matches);
  return (
    <section className="matches-list matches-history progressive-history">
      <header>
        <span>DATA</span>
        <span>PARTIDA</span>
        <span>RESULTADO</span>
        <span>COMPETIÇÃO</span>
        <span>GESTÃO</span>
      </header>
      {matches.length ? (
        matches.map((match) => {
          const result =
            Number(match.strix_score) > Number(match.opponent_score)
              ? "VITÓRIA"
              : Number(match.strix_score) < Number(match.opponent_score)
                ? "DERROTA"
                : "EMPATE";
          const opponentLogo = match.resolved_opponent_logo_url || (match.opponent_logos?.storage_path
            ? workspace.assetUrl(match.opponent_logos.storage_path)
            : "");
          return (
            <React.Fragment key={match.id}>
            <article className="match-history-desktop">
              <span>
                {formatDate(match.played_at)}
                <small>{formatTime(match.played_at)}</small>
              </span>
              <MatchScoreline
                className="match-teams"
                layout="ledger"
                homeName="STRIX"
                homeLogo={STRIX_BRAND.logo}
                homeScore={match.strix_score}
                awayName={match.opponent_name}
                awayLogo={opponentLogo}
                awayScore={match.opponent_score}
              />
              <em className={result.toLowerCase()}>{result}</em>
              <small>{match.competition_name || "AMISTOSO"}</small>
              <div className="match-row-actions">
                <button className="motion-tooltip" data-tooltip="Ver dados" aria-label="Ver dados" title="Ver dados" onClick={() => detail(match)}>
                  <IconListDetails aria-hidden="true" size={17} stroke={1.75} />
                </button>
                {canManage && (
                  <>
                    <button className="motion-tooltip" data-tooltip="Editar" aria-label="Editar" title="Editar" onClick={() => edit(match)}>
                      <IconPencil aria-hidden="true" size={17} stroke={1.75} />
                    </button>
                    <button className="motion-tooltip is-danger" data-tooltip="Excluir" aria-label="Excluir" title="Excluir" onClick={() => remove(match)}>
                      <IconTrash aria-hidden="true" size={17} stroke={1.75} />
                    </button>
                  </>
                )}
              </div>
            </article>
            <MobileMatchCard {...{ match, opponentLogo, result, canManage, detail, edit, remove }} />
            </React.Fragment>
          );
        })
      ) : (
        <div className="matches-empty">Ainda não há partidas no histórico.</div>
      )}
    </section>
  );
}

export function MatchesPage({ profile, workspace, client }) {
  const canManage = canAddManualMatch(profile);
  const canImportEa = canSearchEa(profile);
  const [found, setFound] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [step, setStep] = useState("review");
  const [aliases, setAliases] = useState({});
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [loadingSource, setLoadingSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [success, setSuccess] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [emptySource, setEmptySource] = useState("");
  const [creatingPlayer, setCreatingPlayer] = useState(null);
  // A direct link (/partidas/<id>) opens that result; the address follows the open one.
  const target = useDeepTarget("partidas");
  useEffect(() => {
    if (!target?.id || detail) return;
    const match = safeRows(workspace.matches).find((entry) => String(entry.id) === target.id);
    if (match) setDetail(match);
  }, [target?.id, workspace.matches]);
  const openDetail = (match) => {
    setDetail(match);
    if (match?.id) openTarget("partidas", match.id);
  };
  const closeDetail = () => {
    setDetail(null);
    clearTarget("partidas");
  };
  const chosen = safeRows(found).filter((match) => selected.has(match.id));
  const competitionOptions = useMemo(
    () =>
      safeRows(workspace.competitions)
        .filter((item) => item.is_active)
        .map((item) => ({
          ...item,
          editionId:
            safeRows(workspace.competitionEditions).find(
              (edition) =>
                edition.competition_id === item.id &&
                edition.status === "active",
            )?.id || "",
        })),
    [workspace.competitions, workspace.competitionEditions],
  );

  const load = async () => {
    if (!canImportEa || loadingSource) return;
    const started = performance.now();
    setLoadingSource("ea");
    setError("");
    setErrorDetail("");
    setSuccess("");
    setEmptySource("");
    setMetrics({ feedbackMs: null, totalMs: null, requests: 1, status: "loading" });
    requestAnimationFrame(() =>
      setMetrics((current) => ({
        ...current,
        feedbackMs: Math.round(performance.now() - started),
      })),
    );
    try {
      const { data } = await client.auth.getSession();
      const response = await fetch("/api/ea/matches", {
        method: "GET",
        headers: {
          authorization: `Bearer ${data.session?.access_token || ""}`,
        },
        cache: "no-store",
      });
      const payload = await readApiJson(response);
      const candidates = safeRows(payload.matches);
      setFound(candidates);
      setSelected(new Set());
      setAliases(resolvePlayerAliases(candidates, workspace.players, workspace.aliases));
      setStep("review");
      setEmptySource(candidates.length ? "" : "A EA respondeu normalmente, mas não retornou partidas recentes.");
      setSuccess(candidates.length ? `${candidates.length} partida${candidates.length === 1 ? " encontrada" : "s encontradas"}. Nenhuma alteração foi feita no histórico.` : "");
      notify(candidates.length ? "Partidas disponíveis para revisão." : "Nenhuma partida encontrada.");
      setMetrics((current) => ({
        ...current,
        totalMs: Math.round(performance.now() - started),
        status: "success",
      }));
    } catch (requestError) {
      const layer = String(requestError.layer || "").toLowerCase();
      const status = requestError.status || "";
      const layerLabel = layer === "railway" ? `SYNC INDISPONÍVEL. Railway respondeu HTTP ${status || 502}.`
        : layer === "render" ? `SYNC INDISPONÍVEL. Render respondeu HTTP ${status || 502}.`
        : layer === "ea_sync" || layer === "local" ? `SYNC INDISPONÍVEL. O serviço de sincronização respondeu HTTP ${status || 502}.`
        : layer === "pages_edge" ? "Falha antes da resposta da API."
        : layer === "ea" ? "A EA recusou ou devolveu payload inválido."
        : layer === "pages" ? "Pages não conseguiu completar a consulta."
        : "";
      setError(
        requestError.message || "Não foi possível consultar as partidas.",
      );
      setErrorDetail([layerLabel, requestError.detail].filter(Boolean).join(" "));
      setMetrics((current) => ({
        ...current,
        totalMs: Math.round(performance.now() - started),
        status: "error",
      }));
    } finally {
      setLoadingSource("");
    }
  };
  const patchMatch = (id, patch) =>
    setFound((current) =>
      current.map((match) =>
        match.id === id ? { ...match, ...patch } : match,
      ),
    );
  const confirm = async () => {
    if (!canImportEa) return setError("A publicação de partidas da EA é exclusiva de Desenvolvimento.");
    const validation = validateImport(chosen, aliases);
    if (!validation.valid) return;
    const importedCount = chosen.length;
    setSaving(true);
    setError("");
    setErrorDetail("");
    setSuccess("");
    try {
      const aliasRows = Object.entries(aliases)
        .filter(([, playerId]) => playerId)
        .map(([eaName, playerId]) => {
          const rawName =
            chosen
              .flatMap((match) => match.performance?.players || [])
              .find((player) => normalizeName(player.eaName) === eaName)
              ?.eaName || eaName;
          return { eaName: rawName, playerId };
        });
      await workspace.savePlayerAliases(aliasRows, false);
      const { data } = await client.auth.getSession();
      const response = await fetch("/api/ea/matches", {
        method: "POST",
        headers: {
          authorization: `Bearer ${data.session?.access_token || ""}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ matches: chosen }),
      });
      await readApiJson(response);
      await workspace.refresh();
      setFound([]);
      setSelected(new Set());
      setAliases({});
      setEditing(null);
      setStep("review");
      setSuccess(
        `${importedCount} partida${importedCount === 1 ? " publicada" : "s publicadas"} com sucesso. O histórico foi atualizado abaixo.`,
      );
      notify(`${importedCount} partida${importedCount === 1 ? " publicada" : "s publicadas"}.`);
    } catch (saveError) {
      try {
        await workspace.refresh();
      } catch {
        /* preserve the original import failure */
      }
      setError(saveError.message || "Não foi possível concluir a importação.");
      setErrorDetail(saveError.detail || "");
    } finally {
      setSaving(false);
    }
  };
  const editExisting = (match) =>
    setEditing({
      id: match.id,
      dbId: match.id,
      date: match.played_at,
      opponent: match.opponent_name,
      strixScore: match.strix_score,
      opponentScore: match.opponent_score,
      competition: match.competition_name,
      competitionId: match.competition_id || "",
      competitionEditionId: match.competition_edition_id || "",
      agendaId: match.agenda_match_id || "",
      performance: match.performance || {},
      goalScorers: matchGoalScorers({ performance: match.performance }),
      importSource: match.source || "manual",
    });
  const saveEdit = async (match) => {
    if (!canManage) return setError("Somente Desenvolvimento altera o histórico de partidas.");
    try {
      await workspace.upsertClubMatch(match, match.importSource || "manual");
      setEditing(null);
      setSuccess("Partida atualizada.");
      notify("Partida atualizada.");
    } catch (saveError) {
      setError(saveError.message);
    }
  };
  const addManual = () => {
    if (!canManage) return;
    setEditing({
      id: `manual-${Date.now()}`,
      date: new Date().toISOString(),
      opponent: "",
      strixScore: 0,
      opponentScore: 0,
      competition: "Amistoso",
      competitionId: "",
      competitionEditionId: "",
      agendaId: "",
      performance: {},
      goalScorers: [],
      importSource: "manual",
    });
  };
  const validation = validateImport(chosen, aliases);

  return (
    <section className="matches-page page-enter progressive-matches">
      <PageHeader
        title="Histórico de jogo."
        description="Encontre, revise e conecte cada partida ao ecossistema FC27."
        actions={(canImportEa || canManage) && (
          <>
            {canImportEa && (
            <button
              className="secondary"
              onClick={() => void load()}
              disabled={Boolean(loadingSource)}
            >
              {loadingSource === "ea" ? "BUSCANDO NA EA…" : "BUSCAR NA EA"}
            </button>
            )}
            {canManage && (
            <button className="secondary" onClick={addManual}>
              ADICIONAR MANUAL
            </button>
            )}
          </>
        )}
      />
      {metrics && (
        <div className="performance-note" aria-live="polite">
          <span className={metrics.status === "error" ? "is-error" : metrics.status === "loading" ? "is-pending" : "is-ok"}>
            Resposta visual: {metrics.feedbackMs ?? "…"} ms
          </span>
          <span className={metrics.status === "error" ? "is-error" : metrics.status === "loading" ? "is-pending" : "is-ok"}>
            Consulta: {metrics.status === "error" ? "falhou em " : ""}
            {metrics.totalMs ?? "em andamento"}
            {metrics.totalMs !== null ? " ms" : ""}
          </span>
          <span>{metrics.requests} request{metrics.requests === 1 ? "" : "s"}</span>
        </div>
      )}
      {(error || workspace.error) && (
        <ErrorNote message={error || workspace.error} detail={error ? errorDetail : ""} onRetry={error ? undefined : () => workspace.refresh()} />
      )}
      {success && (
        <p className="matches-success" role="status">
          <svg className="matches-success-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 12.5 4 4L18 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {success}
        </p>
      )}
      {emptySource && <div className="matches-source-empty" role="status"><b>NENHUMA PARTIDA NOVA</b><span>{emptySource}</span></div>}
      {found.length > 0 && step === "review" && (
        <ReviewStep
          matches={found}
          selected={selected}
          toggle={(id) =>
            setSelected((current) => {
              const next = new Set(current);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })
          }
          selectAll={() => setSelected(new Set(found.filter((match) => !match.alreadyImported).map((match) => match.id)))}
          clearSelection={() => setSelected(new Set())}
          edit={setEditing}
          next={() => setStep("resolve")}
        />
      )}
      {found.length > 0 && step === "resolve" && (
        <ResolveStep
          matches={chosen}
          agenda={safeRows(workspace.agenda).filter(
            (entry) => !["cancelled", "completed"].includes(entry.status),
          )}
          competitions={competitionOptions}
          players={safeRows(workspace.players)}
          aliases={aliases}
          patchMatch={patchMatch}
          patchAlias={(key, value) =>
            setAliases((current) => ({ ...current, [key]: value }))
          }
          canAdd={canCreatePlayer(profile)}
          onAddPlayer={setCreatingPlayer}
          back={() => setStep("review")}
          next={() => setStep("summary")}
        />
      )}
      {creatingPlayer && (
        <RosterQuickAdd
          eaName={creatingPlayer.eaName}
          workspace={workspace}
          onClose={() => setCreatingPlayer(null)}
          onSaved={(playerId) => {
            if (playerId) setAliases((current) => ({ ...current, [normalizeName(creatingPlayer.eaName)]: playerId }));
            setCreatingPlayer(null);
          }}
        />
      )}
      {found.length > 0 && step === "summary" && (
        <SummaryStep
          matches={chosen}
          agenda={safeRows(workspace.agenda)}
          aliases={aliases}
          players={safeRows(workspace.players)}
          validation={validation}
          back={() => setStep("resolve")}
          confirm={() => void confirm()}
          saving={saving}
        />
      )}
      <MatchHistory
        workspace={workspace}
        canManage={canManage}
        detail={openDetail}
        edit={editExisting}
        remove={setPendingDelete}
      />
      {pendingDelete && (
        <ConfirmDialog
          kicker="EXCLUSÃO DEFINITIVA"
          title={`Excluir Strix ${pendingDelete.strix_score} × ${pendingDelete.opponent_score} ${pendingDelete.opponent_name}?`}
          confirmLabel="EXCLUIR PARTIDA"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await workspace.removeClubMatch(pendingDelete.id);
            setPendingDelete(null);
            notify("Partida excluída.");
          }}
        >
          <p>A partida de <b>{formatDate(pendingDelete.played_at)}</b> sai do histórico e das estatísticas, junto com os dados dos jogadores neste jogo. Não dá para desfazer.</p>
        </ConfirmDialog>
      )}
      {editing && (
        <EditMatchModal
          match={editing}
          workspace={workspace}
          close={() => setEditing(null)}
          save={(match) =>
            found.some((item) => item.id === match.id)
              ? (patchMatch(match.id, match), setEditing(null))
              : void saveEdit(match)
          }
        />
      )}
    {detail && <MatchDetails match={detail} workspace={workspace} close={closeDetail} />}
    </section>
  );
}
