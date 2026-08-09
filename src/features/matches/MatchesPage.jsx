import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MatchDisplay } from "../../ui/MatchDisplay.jsx";
import {
  RollingLabel,
  notify,
  useSheetDismiss,
  useSwipeActions,
} from "../../ui/motion/motion.jsx";
import {
  dedupeImportedMatches,
  normalizeEaMatch,
  normalizeName,
  resolvePlayerAliases,
  resultLabel,
  suggestAgendaMatches,
  validateImport,
} from "./import-core.js";
import "./match-import.css";
import "./match-fixes.css";

const canManageMatches = (profile) =>
  ["diretoria", "dev"].includes(profile?.access_tier);
const formatDate = (value) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
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
}) {
  return <MatchDisplay {...{ homeName, homeLogo, homeScore, awayName, awayLogo, awayScore, className }} />;
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
        homeLogo="/assets/strix-logo.png"
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
    scorersText: (match.goalScorers || []).join(", "),
  });
  const patch = (value) => setDraft((current) => ({ ...current, ...value }));
  const changeDate = (key, value) => {
    const date = new Date(draft.date);
    if (key === "date") {
      const [year, month, day] = value.split("-").map(Number);
      date.setFullYear(year, month - 1, day);
    } else {
      const [hour, minute] = value.split(":").map(Number);
      date.setHours(hour, minute, 0, 0);
    }
    patch({ date: date.toISOString() });
  };
  const preview = {
    ...draft,
    goalScorers: draft.scorersText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
  return createPortal((
    <div className="match-flow-backdrop" role="presentation">
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
          <button type="button" onClick={close} aria-label="Fechar">
            ×
          </button>
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
                  value={String(draft.date).slice(0, 10)}
                  onChange={(event) => changeDate("date", event.target.value)}
                />
              </label>
              <label>
                HORÁRIO
                <input
                  type="time"
                  value={formatTime(draft.date)}
                  onChange={(event) => changeDate("time", event.target.value)}
                />
              </label>
            </div>
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
            className={selected.has(match.id) ? "selected" : ""}
          >
            <label className="match-review-check">
              <input
                type="checkbox"
                checked={selected.has(match.id)}
                onChange={() => toggle(match.id)}
              />
              <span aria-hidden="true">✓</span>
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
                {resultLabel(match)}
              </em>
            </div>
            <p>
              {match.goalScorers?.length
                ? `Gols: ${match.goalScorers.join(", ")}`
                : "Gols do Strix não identificados"}
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

function ResolveStep({
  matches,
  agenda,
  competitions,
  players,
  aliases,
  patchMatch,
  patchAlias,
  back,
  next,
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
              <em>{resultLabel(match)}</em>
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
                    patchMatch(match.id, { agendaId: event.target.value })
                  }
                >
                  <option value="">Sem vínculo</option>
                  {agenda.map((entry) => (
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
              {(match.performance?.players || []).map((player) => {
                const key = normalizeName(player.eaName);
                return (
                  <label key={`${match.id}-${key}`}>
                    <b>{player.eaName}</b>
                    <span>→</span>
                    <select
                      value={aliases[key] ?? ""}
                      onChange={(event) => patchAlias(key, event.target.value)}
                    >
                      <option value="">Fora do elenco</option>
                      {players
                        .filter((item) => item.is_active)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.display_name}
                          </option>
                        ))}
                    </select>
                  </label>
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
          <RollingLabel>{saving ? "IMPORTANDO…" : "CONFIRMAR IMPORTAÇÃO"}</RollingLabel>
        </button>
      </footer>
    </section>
  );
}

function StatIcon({ name }) {
  const paths = {
    possession: <><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></>,
    shots: <><circle cx="12" cy="12" r="8.5"/><path d="m12 7 3.7 2.7-1.4 4.3H9.7L8.3 9.7 12 7Z"/><path d="m12 7-.4-3.4M15.7 9.7l3.2-1.1M14.3 14l2.1 2.8M9.7 14l-2.1 2.8M8.3 9.7 5.1 8.6"/></>,
    passes: <><path d="M4 8h12m0 0-3-3m3 3-3 3M20 16H8m0 0 3-3m-3 3 3 3"/></>,
    tackles: <><circle cx="12" cy="12" r="2.2"/><path d="M4 7.5 9.8 11M20 16.5 14.2 13M6.5 5 4 7.5l.8 3.4M17.5 19 20 16.5l-.8-3.4"/></>,
    saves: <><path d="M6.5 20 4.8 10.5c-.2-1.1.5-2.1 1.5-2.3.9-.2 1.8.3 2.1 1.2l.4 1.1-.9-5.2c-.2-1.1.5-2.1 1.6-2.3 1.1-.2 2.1.5 2.3 1.6l.8 4.5-.4-4c-.1-1.1.7-2 1.8-2.1 1.1-.1 2 .7 2.1 1.8l.5 4.4-.1-2.8c0-1.1.8-2 1.9-2 1.1 0 2 .8 2 1.9l.1 6.7c.1 3.7-2.7 6.8-6.4 7H6.5Z"/></>,
    rating: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
    goals: <><circle cx="12" cy="12" r="8"/><path d="m12 8 3 2-1 4h-4l-1-4 3-2Z"/></>,
    assists: <><path d="M4 16c4-6 8-8 16-8"/><path d="m15 4 5 4-4 5"/></>,
  };
  return <svg className="match-stat-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.rating}</svg>;
}

function MatchDetails({ match, workspace, close }) {
  const sheetDismiss = useSheetDismiss(close);
  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);
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
  const opponentLogo = match.opponent_logos?.storage_path ? workspace.assetUrl(match.opponent_logos.storage_path) : "";
  return createPortal((
    <div className="match-flow-backdrop" role="presentation">
      <section
        className="match-review-modal match-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da partida"
      >
        <button type="button" className="match-sheet-handle" aria-label="Arraste ou toque para fechar" onClick={close} {...sheetDismiss}><i /></button>
        <header className="match-detail-header">
          <div><span>HISTÓRICO DA PARTIDA</span><h2>Resumo do confronto</h2><p>{formatDate(match.played_at)} · {formatTime(match.played_at)} · {match.competition_name || "Amistoso"}</p></div>
          <em className={result.toLowerCase()}>{result}</em>
          <button type="button" onClick={close} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="match-detail-body">
          <MatchScoreline
            className="match-detail-score"
            homeName="STRIX UNITED"
            homeLogo="/assets/strix-logo.png"
            homeScore={match.strix_score}
            awayName={match.opponent_name}
            awayLogo={opponentLogo}
            awayScore={match.opponent_score}
          />
          <div className="match-detail-metrics">
            {metrics.map(([label, value, icon]) => (
              <article key={label}>
                <StatIcon name={icon}/><div><small>{label}</small><strong>{value}</strong></div>
              </article>
            ))}
          </div>
          <section className="match-player-performance">
            <header><span>DESEMPENHO INDIVIDUAL</span><h3>Jogadores do Strix</h3></header>
            {players.length ? (
              <div className="match-player-table-scroll">
              <div className="match-player-table" role="table">
                <header role="row"><span>JOGADOR</span><span>NOTA</span><span>G</span><span>A</span><span>PASSES</span><span>CHUTES</span><span>DESARMES</span><span>DEFESAS</span></header>
                {players.map((player, index) => (
                  <article role="row" className={`${Number(player.rating) === bestRating && bestRating > 0 ? "is-best " : ""}${disconnected(player) ? "is-disconnected" : ""}`} key={player.id || player.eaName || index}>
                    <div><b>{player.name || player.eaName || "Jogador EA"}</b><small>{disconnected(player) && <em className="disconnect-badge">CAIU DA PARTIDA</em>}{!disconnected(player) && Number(player.rating) === bestRating && bestRating > 0 && <em>MELHOR NOTA</em>}{Number(player.goals) === maxGoals && maxGoals > 0 && <em><StatIcon name="goals"/> ARTILHEIRO</em>}{Number(player.assists) === maxAssists && maxAssists > 0 && <em><StatIcon name="assists"/> ASSISTÊNCIA</em>}{Number(player.passesMade) === maxPasses && maxPasses > 0 && <em>MAIS PASSES</em>}</small></div>
                    <strong>{player.rating ?? "—"}</strong><span>{player.goals ?? "—"}</span><span>{player.assists ?? "—"}</span><span>{player.passes ?? "—"}</span><span>{player.shots ?? "—"}</span><span>{player.tackles ?? "—"}</span><span>{player.saves ?? "—"}</span>
                  </article>
                ))}
              </div></div>
            ) : (
              <p>
                A fonte não entregou estatísticas individuais para esta partida.
              </p>
            )}
          </section>
        </div>
        <footer>
          <button type="button" className="secondary" onClick={close}>
            FECHAR
          </button>
        </footer>
      </section>
    </div>
  ), document.body);
}

function MobileMatchCard({ match, opponentLogo, result, canManage, detail, edit, remove }) {
  const swipe = useSwipeActions(canManage ? 132 : 0);
  const confirmRemove = () => {
    if (window.confirm(`Excluir a partida contra ${match.opponent_name}?`)) remove(match.id);
  };
  return (
    <div className={`match-mobile-swipe${swipe.offset ? " is-open" : ""}`}>
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
          <time>{formatDate(match.played_at)} · {formatTime(match.played_at)}</time>
          <button type="button" onClick={() => detail(match)} aria-label={`Abrir detalhes contra ${match.opponent_name}`}>◎</button>
        </header>
        <MatchDisplay
          homeName="STRIX UNITED"
          homeLogo="/assets/strix-logo.png"
          homeScore={match.strix_score}
          awayName={match.opponent_name}
          awayLogo={opponentLogo}
          awayScore={match.opponent_score}
        />
        <footer>
          <em className={result.toLowerCase()}>{result}</em>
          <span>{match.competition_name || "AMISTOSO"}</span>
          {canManage && <small>DESLIZE PARA AÇÕES</small>}
        </footer>
      </article>
    </div>
  );
}

function MatchHistory({ workspace, canManage, detail, edit, remove }) {
  return (
    <section className="matches-list matches-history progressive-history">
      <header>
        <span>DATA</span>
        <span>PARTIDA</span>
        <span>RESULTADO</span>
        <span>COMPETIÇÃO</span>
        <span>GESTÃO</span>
      </header>
      {workspace.matches.length ? (
        workspace.matches.map((match) => {
          const result =
            Number(match.strix_score) > Number(match.opponent_score)
              ? "VITÓRIA"
              : Number(match.strix_score) < Number(match.opponent_score)
                ? "DERROTA"
                : "EMPATE";
          const opponentLogo = match.opponent_logos?.storage_path
            ? workspace.assetUrl(match.opponent_logos.storage_path)
            : "";
          return (
            <React.Fragment key={match.id}>
            <article className="match-history-desktop">
              <span>
                {formatDate(match.played_at)}
                <small>{formatTime(match.played_at)}</small>
              </span>
              <MatchScoreline
                className="match-teams"
                homeName="STRIX"
                homeLogo="/assets/strix-logo.png"
                homeScore={match.strix_score}
                awayName={match.opponent_name}
                awayLogo={opponentLogo}
                awayScore={match.opponent_score}
              />
              <em className={result.toLowerCase()}>{result}</em>
              <small>{match.competition_name || "AMISTOSO"}</small>
              <div className="match-row-actions">
                <button className="motion-tooltip" data-tooltip="Ver dados" aria-label="Ver dados" title="Ver dados" onClick={() => detail(match)}>
                  ◎
                </button>
                {canManage && (
                  <>
                    <button className="motion-tooltip" data-tooltip="Editar" aria-label="Editar" title="Editar" onClick={() => edit(match)}>
                      ✎
                    </button>
                    <button className="motion-tooltip" data-tooltip="Excluir" aria-label="Excluir" title="Excluir" onClick={() => remove(match.id)}>
                      ⌫
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
  const canManage = canManageMatches(profile);
  const [found, setFound] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [step, setStep] = useState("review");
  const [aliases, setAliases] = useState({});
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingSource, setLoadingSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [metrics, setMetrics] = useState(null);
  const chosen = found.filter((match) => selected.has(match.id));
  const competitionOptions = useMemo(
    () =>
      workspace.competitions
        .filter((item) => item.is_active)
        .map((item) => ({
          ...item,
          editionId:
            workspace.competitionEditions.find(
              (edition) =>
                edition.competition_id === item.id &&
                edition.status === "active",
            )?.id || "",
        })),
    [workspace.competitions, workspace.competitionEditions],
  );

  const load = async (source) => {
    if (!canManage || loadingSource) return;
    const started = performance.now();
    setLoadingSource(source);
    setError("");
    setSuccess("");
    setMetrics({ feedbackMs: null, totalMs: null, requests: 1 });
    requestAnimationFrame(() =>
      setMetrics((current) => ({
        ...current,
        feedbackMs: Math.round(performance.now() - started),
      })),
    );
    try {
      let response;
      if (source === "computer")
        response = await fetch("http://127.0.0.1:8789/api/ea/matches", {
          cache: "no-store",
        });
      else {
        const { data } = await client.auth.getSession();
        response = await fetch("/api/ea/matches", {
          headers: {
            authorization: `Bearer ${data.session?.access_token || ""}`,
          },
          cache: "no-store",
        });
      }
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.message || payload.error || "A fonte não retornou partidas.",
        );
      const normalizedBase = dedupeImportedMatches(
        (payload.matches || []).map((item, index) => ({
          ...normalizeEaMatch(item, index),
          importSource: source === "computer" ? "local_bridge" : "ea_api",
        })),
        workspace.matches,
      );
      const agendaSuggestions = suggestAgendaMatches(
        normalizedBase,
        workspace.agenda,
      );
      const normalized = normalizedBase.map((match) => {
        const suggestion = agendaSuggestions.get(match.id);
        return {
          ...match,
          agendaId: suggestion?.suggestion?.autoLink ? suggestion.id : "",
          suggestedAgendaId: suggestion?.id || "",
          suggestedAgendaName: suggestion?.opponent_name || "",
          suggestedAgendaAt: suggestion?.scheduled_at || "",
          suggestionConfidence: suggestion?.suggestion?.confidence || "",
          suggestionReason: suggestion?.suggestion?.reason || "",
          suggestionAutoLink: Boolean(suggestion?.suggestion?.autoLink),
        };
      });
      if (!normalized.length)
        throw new Error("Nenhuma partida nova foi encontrada para importar.");
      setFound(normalized);
      setSelected(new Set(normalized.map((match) => match.id)));
      setAliases(
        resolvePlayerAliases(normalized, workspace.players, workspace.aliases),
      );
      setStep("review");
      setMetrics((current) => ({
        ...current,
        totalMs: Math.round(performance.now() - started),
      }));
    } catch (requestError) {
      setError(
        requestError.message || "Não foi possível consultar as partidas.",
      );
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
    const validation = validateImport(chosen, aliases);
    if (!validation.valid) return;
    const importedCount = chosen.length;
    setSaving(true);
    setError("");
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
      await workspace.upsertClubMatches(chosen);
      setFound([]);
      setSelected(new Set());
      setAliases({});
      setEditing(null);
      setStep("review");
      setSuccess(
        `${importedCount} partida${importedCount === 1 ? " importada" : "s importadas"} com sucesso. O histórico foi atualizado abaixo.`,
      );
      notify(`${importedCount} partida${importedCount === 1 ? " importada" : "s importadas"}.`);
    } catch (saveError) {
      try {
        await workspace.refresh();
      } catch {
        /* preserve the original import failure */
      }
      setError(saveError.message || "Não foi possível concluir a importação.");
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
      goalScorers: match.performance?.goalScorers || [],
      importSource: match.source || "manual",
    });
  const saveEdit = async (match) => {
    try {
      await workspace.upsertClubMatch(match, match.importSource || "manual");
      setEditing(null);
      setSuccess("Partida atualizada.");
      notify("Partida atualizada.");
    } catch (saveError) {
      setError(saveError.message);
    }
  };
  const addManual = () =>
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
  const validation = validateImport(chosen, aliases);

  return (
    <section className="matches-page page-enter progressive-matches">
      <header className="matches-hero">
        <div>
          <span>PARTIDAS DO CLUBE</span>
          <h1>Histórico de jogo.</h1>
          <p>Encontre, revise e conecte cada partida ao ecossistema FC27.</p>
        </div>
        {canManage && (
          <div className="matches-actions">
            <button
              className="secondary"
              onClick={() => void load("computer")}
              disabled={Boolean(loadingSource)}
            >
              {loadingSource === "computer"
                ? "CONSULTANDO SEU PC…"
                : "BUSCAR PELO MEU PC"}
            </button>
            <button
              className="secondary"
              onClick={() => void load("cloud")}
              disabled={Boolean(loadingSource)}
            >
              {loadingSource === "cloud" ? "CONSULTANDO EA…" : "BUSCAR NA EA"}
            </button>
            <button className="secondary" onClick={addManual}>
              ADICIONAR MANUAL
            </button>
          </div>
        )}
      </header>
      {metrics && (
        <div className="performance-note" aria-live="polite">
          <span>Resposta visual: {metrics.feedbackMs ?? "…"} ms</span>
          <span>
            Consulta: {metrics.totalMs ?? "em andamento"}
            {metrics.totalMs ? " ms" : ""}
          </span>
          <span>{metrics.requests} request</span>
        </div>
      )}
      {(error || workspace.error) && (
        <p className="matches-error" role="alert">
          {error || workspace.error}
        </p>
      )}
      {success && (
        <p className="matches-success" role="status">
          {success}
        </p>
      )}
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
          selectAll={() => setSelected(new Set(found.map((match) => match.id)))}
          clearSelection={() => setSelected(new Set())}
          edit={setEditing}
          next={() => setStep("resolve")}
        />
      )}
      {found.length > 0 && step === "resolve" && (
        <ResolveStep
          matches={chosen}
          agenda={workspace.agenda.filter(
            (entry) => !["cancelled", "completed"].includes(entry.status),
          )}
          competitions={competitionOptions}
          players={workspace.players}
          aliases={aliases}
          patchMatch={patchMatch}
          patchAlias={(key, value) =>
            setAliases((current) => ({ ...current, [key]: value }))
          }
          back={() => setStep("review")}
          next={() => setStep("summary")}
        />
      )}
      {found.length > 0 && step === "summary" && (
        <SummaryStep
          matches={chosen}
          agenda={workspace.agenda}
          aliases={aliases}
          players={workspace.players}
          validation={validation}
          back={() => setStep("resolve")}
          confirm={() => void confirm()}
          saving={saving}
        />
      )}
      <MatchHistory
        workspace={workspace}
        canManage={canManage}
        detail={setDetail}
        edit={editExisting}
        remove={(id) =>
          void workspace
            .removeClubMatch(id)
            .catch((removeError) => setError(removeError.message))
        }
      />
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
    {detail && <MatchDetails match={detail} workspace={workspace} close={() => setDetail(null)} />}
    </section>
  );
}
