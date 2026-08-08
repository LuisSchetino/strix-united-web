import React, { useMemo, useState } from "react";
import {
  dedupeImportedMatches,
  normalizeEaMatch,
  normalizeName,
  resolvePlayerAliases,
  resultLabel,
  suggestAgendaMatch,
  validateImport,
} from "./import-core.js";
import "./match-import.css";

const canManageMatches = (profile) => ["diretoria", "dev"].includes(profile?.access_tier);
const formatDate = (value) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
const formatTime = (value) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value));

function TeamMark({ name, url }) {
  return url ? <img src={url} alt="" /> : <span>{String(name || "?").split(/\s+/).map((word) => word[0]).slice(0, 2).join("")}</span>;
}

function MatchPreview({ match, workspace }) {
  const logo = workspace.logos.find((item) => normalizeName(item.canonical_name) === normalizeName(match.opponent));
  return (
    <section className="match-live-preview" aria-label="Preview da partida">
      <small>PREVIEW NO FC27</small>
      <div>
        <TeamMark name="STRIX" url="/assets/strix-logo.png" />
        <b>STRIX</b>
        <strong>{match.strixScore} <i>×</i> {match.opponentScore}</strong>
        <TeamMark name={match.opponent} url={logo?.storage_path ? workspace.assetUrl(logo.storage_path) : ""} />
        <b>{match.opponent || "ADVERSÁRIO"}</b>
      </div>
      <footer><span>{formatDate(match.date)} · {formatTime(match.date)}</span><em>{match.competition || "SEM COMPETIÇÃO"}</em></footer>
      <p>{match.goalScorers?.length ? `Gols: ${match.goalScorers.join(", ")}` : "Gols: não informados"}</p>
    </section>
  );
}

function EditMatchModal({ match, workspace, close, save }) {
  const [draft, setDraft] = useState({ ...match, scorersText: (match.goalScorers || []).join(", ") });
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
  const preview = { ...draft, goalScorers: draft.scorersText.split(",").map((item) => item.trim()).filter(Boolean) };
  return (
    <div className="match-flow-backdrop" role="presentation">
      <form className="match-review-modal" onSubmit={(event) => { event.preventDefault(); save({ ...preview, performance: { ...(preview.performance || {}), goalScorers: preview.goalScorers } }); }}>
        <header><div><span>REVISÃO · PARTIDA</span><h2>Editar antes de importar</h2><p>O card ao lado acompanha cada alteração em tempo real.</p></div><button type="button" onClick={close} aria-label="Fechar">×</button></header>
        <div className="match-review-layout">
          <section className="match-review-fields">
            <label>ADVERSÁRIO<input autoFocus value={draft.opponent} onChange={(event) => patch({ opponent: event.target.value })} /></label>
            <div><label>DATA<input type="date" value={String(draft.date).slice(0, 10)} onChange={(event) => changeDate("date", event.target.value)} /></label><label>HORÁRIO<input type="time" value={formatTime(draft.date)} onChange={(event) => changeDate("time", event.target.value)} /></label></div>
            <div><label>STRIX<input type="number" min="0" value={draft.strixScore} onChange={(event) => patch({ strixScore: Number(event.target.value) })} /></label><label>ADVERSÁRIO<input type="number" min="0" value={draft.opponentScore} onChange={(event) => patch({ opponentScore: Number(event.target.value) })} /></label></div>
            <label>COMPETIÇÃO<input value={draft.competition} onChange={(event) => patch({ competition: event.target.value })} placeholder="Amistoso, liga ou copa" /></label>
            <label>AUTORES DOS GOLS<input value={draft.scorersText} onChange={(event) => patch({ scorersText: event.target.value })} placeholder="Obenzera, SxntsTheAngel" /></label>
          </section>
          <MatchPreview match={preview} workspace={workspace} />
        </div>
        <footer><button type="button" className="secondary" onClick={close}>CANCELAR</button><button className="primary">APLICAR ALTERAÇÕES</button></footer>
      </form>
    </div>
  );
}

function ReviewStep({ matches, selected, toggle, edit, next }) {
  return (
    <section className="import-stage">
      <header><div><span>ETAPA 1 · ESCOLHER E REVISAR</span><h2>Partidas encontradas</h2><p>Selecione somente o que deve entrar no histórico.</p></div><b>{selected.size}/{matches.length}</b></header>
      <div className="match-review-list">
        {matches.map((match) => <article key={match.id} className={selected.has(match.id) ? "selected" : ""}>
          <label className="match-review-check"><input type="checkbox" checked={selected.has(match.id)} onChange={() => toggle(match.id)} /><span aria-hidden="true">✓</span></label>
          <time>{match.dateLabel}<small>{match.timeLabel}</small></time>
          <div className="match-review-score"><b>STRIX</b><strong>{match.strixScore} × {match.opponentScore}</strong><b>{match.opponent}</b><em className={resultLabel(match).toLowerCase()}>{resultLabel(match)}</em></div>
          <p>{match.goalScorers?.length ? `Gols: ${match.goalScorers.join(", ")}` : "Gols do Strix não identificados"}</p>
          <button type="button" className="match-mini-action" onClick={() => edit(match)} aria-label={`Editar partida contra ${match.opponent}`}>✎</button>
        </article>)}
      </div>
      <footer><button className="primary" disabled={!selected.size} onClick={next}>AVANÇAR</button></footer>
    </section>
  );
}

function ResolveStep({ matches, agenda, competitions, players, aliases, patchMatch, patchAlias, back, next }) {
  return (
    <section className="import-stage">
      <header><div><span>ETAPA 2 · RESOLVER PENDÊNCIAS</span><h2>Contexto e vínculos</h2><p>Confirme competição, Agenda e os nomes identificados pela EA.</p></div></header>
      <div className="resolve-list">
        {matches.map((match) => <article key={match.id}>
          <header><div><small>PARTIDA</small><h3>STRIX {match.strixScore} × {match.opponentScore} {match.opponent}</h3><span>{formatDate(match.date)} · {formatTime(match.date)}</span></div><em>{resultLabel(match)}</em></header>
          <div className="resolve-fields">
            <label>COMPETIÇÃO *<select value={match.competitionId || (normalizeName(match.competition) === "amistoso" ? "friendly" : "")} onChange={(event) => {
              const competition = competitions.find((item) => item.id === event.target.value);
              patchMatch(match.id, { competitionId: competition?.id || "", competitionEditionId: competition?.editionId || "", competition: event.target.value === "friendly" ? "Amistoso" : competition?.name || "" });
            }}><option value="">Selecionar</option><option value="friendly">Amistoso</option>{competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}</select></label>
            <label>VINCULAR À AGENDA<select value={match.agendaId || ""} onChange={(event) => patchMatch(match.id, { agendaId: event.target.value })}><option value="">Sem vínculo</option>{agenda.map((entry) => <option key={entry.id} value={entry.id}>{formatDate(entry.scheduled_at)} · {formatTime(entry.scheduled_at)} · {entry.opponent_name}</option>)}</select></label>
          </div>
          <section className="alias-resolver"><div><small>EA × ELENCO</small><span>Associações anteriores já aparecem selecionadas.</span></div>{(match.performance?.players || []).map((player) => {
            const key = normalizeName(player.eaName);
            return <label key={`${match.id}-${key}`}><b>{player.eaName}</b><span>→</span><select value={aliases[key] ?? ""} onChange={(event) => patchAlias(key, event.target.value)}><option value="">Fora do elenco</option>{players.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>;
          })}</section>
        </article>)}
      </div>
      <footer><button className="secondary" onClick={back}>VOLTAR</button><button className="primary" onClick={next}>REVISAR IMPORTAÇÃO</button></footer>
    </section>
  );
}

function SummaryStep({ matches, agenda, aliases, players, validation, back, confirm, saving }) {
  const totalPlayers = new Set(matches.flatMap((match) => (match.performance?.players || []).map((player) => normalizeName(player.eaName)))).size;
  const linkedPlayers = new Set(Object.entries(aliases).filter(([, id]) => id).map(([name]) => name)).size;
  return (
    <section className="import-stage import-summary">
      <header><div><span>REVISÃO FINAL</span><h2>{matches.length} partida{matches.length === 1 ? "" : "s"}</h2><p>Confira o resumo antes de gravar no histórico do clube.</p></div><b className={validation.valid ? "ready" : "pending"}>{validation.valid ? "PRONTO" : `${validation.pending.length} PENDÊNCIA${validation.pending.length === 1 ? "" : "S"}`}</b></header>
      {matches.map((match) => { const linkedAgenda = agenda.find((entry) => entry.id === match.agendaId); return <article key={match.id}>
        <h3>{match.opponent}</h3><span>{formatDate(match.date)} · {formatTime(match.date)}</span><strong>STRIX {match.strixScore} × {match.opponentScore} {match.opponent}</strong>
        <dl><div><dt>Competição</dt><dd>{match.competition || "Pendente"}</dd></div><div><dt>Agenda</dt><dd>{linkedAgenda ? `${linkedAgenda.opponent_name} · ${formatTime(linkedAgenda.scheduled_at)}` : "Sem vínculo"}</dd></div><div><dt>Vínculos</dt><dd>{linkedPlayers}/{totalPlayers} no elenco</dd></div></dl>
      </article>; })}
      {!validation.valid && <p className="import-blocker">Preencha todos os campos marcados com * para continuar.</p>}
      <footer><button className="secondary" onClick={back}>VOLTAR</button><button className="primary" disabled={!validation.valid || saving} onClick={confirm}>{saving ? "IMPORTANDO…" : "CONFIRMAR IMPORTAÇÃO"}</button></footer>
    </section>
  );
}

function MatchDetails({ match, close }) {
  const performance = match.performance || {};
  const players = performance.players || [];
  const metrics = [["Posse", performance.possession], ["Chutes", performance.shots], ["Passes", performance.passes], ["Desarmes", performance.tackles]];
  return <div className="match-flow-backdrop" role="presentation"><section className="match-review-modal match-detail-modal" role="dialog" aria-modal="true" aria-label="Detalhes da partida">
    <header><div><span>HISTÓRICO DA PARTIDA</span><h2>STRIX {match.strix_score} × {match.opponent_score} {match.opponent_name}</h2><p>{formatDate(match.played_at)} · {formatTime(match.played_at)} · {match.competition_name || "Amistoso"}</p></div><button type="button" onClick={close} aria-label="Fechar">×</button></header>
    <div className="match-detail-body"><div className="match-detail-metrics">{metrics.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value ?? "—"}</strong></article>)}</div><section><h3>Dados individuais</h3>{players.length ? <div className="match-detail-players">{players.map((player, index) => <article key={player.id || player.eaName || index}><b>{player.name || player.eaName || "Jogador EA"}</b><span>Nota {player.rating ?? "—"}</span><span>G+A {player.goalAssists ?? player.goals ?? "—"}</span><span>Passes {player.passes ?? "—"}</span></article>)}</div> : <p>A fonte não entregou estatísticas individuais para esta partida.</p>}</section></div>
    <footer><button type="button" className="secondary" onClick={close}>FECHAR</button></footer>
  </section></div>;
}

function MatchHistory({ workspace, canManage, detail, edit, remove }) {
  return <section className="matches-list matches-history progressive-history"><header><span>DATA</span><span>PARTIDA</span><span>RESULTADO</span><span>COMPETIÇÃO</span><span>GESTÃO</span></header>{workspace.matches.length ? workspace.matches.map((match) => {
    const result = Number(match.strix_score) > Number(match.opponent_score) ? "VITÓRIA" : Number(match.strix_score) < Number(match.opponent_score) ? "DERROTA" : "EMPATE";
    return <article key={match.id}><span>{formatDate(match.played_at)}<small>{formatTime(match.played_at)}</small></span><div className="match-teams"><TeamMark name="STRIX" url="/assets/strix-logo.png"/><b>STRIX</b><strong>{match.strix_score} × {match.opponent_score}</strong><TeamMark name={match.opponent_name}/><b>{match.opponent_name}</b></div><em className={result.toLowerCase()}>{result}</em><small>{match.competition_name || "AMISTOSO"}</small><div className="match-row-actions"><button title="Ver dados" onClick={() => detail(match)}>◎</button>{canManage && <><button title="Editar" onClick={() => edit(match)}>✎</button><button title="Excluir" onClick={() => remove(match.id)}>⌫</button></>}</div></article>;
  }) : <div className="matches-empty">Ainda não há partidas no histórico.</div>}</section>;
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
  const competitionOptions = useMemo(() => workspace.competitions.filter((item) => item.is_active).map((item) => ({ ...item, editionId: workspace.competitionEditions.find((edition) => edition.competition_id === item.id && edition.status === "active")?.id || "" })), [workspace.competitions, workspace.competitionEditions]);

  const load = async (source) => {
    if (!canManage || loadingSource) return;
    const started = performance.now();
    setLoadingSource(source); setError(""); setSuccess(""); setMetrics({ feedbackMs: null, totalMs: null, requests: 1 });
    requestAnimationFrame(() => setMetrics((current) => ({ ...current, feedbackMs: Math.round(performance.now() - started) })));
    try {
      let response;
      if (source === "computer") response = await fetch("http://127.0.0.1:8789/api/ea/matches", { cache: "no-store" });
      else {
        const { data } = await client.auth.getSession();
        response = await fetch("/api/ea/matches", { headers: { authorization: `Bearer ${data.session?.access_token || ""}` }, cache: "no-store" });
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "A fonte não retornou partidas.");
      const normalized = dedupeImportedMatches((payload.matches || []).map((item, index) => ({ ...normalizeEaMatch(item, index), importSource: source === "computer" ? "local_bridge" : "ea_api" })), workspace.matches)
        .map((match) => ({ ...match, agendaId: suggestAgendaMatch(match, workspace.agenda)?.id || "" }));
      if (!normalized.length) throw new Error("Nenhuma partida nova foi encontrada para importar.");
      setFound(normalized); setSelected(new Set(normalized.map((match) => match.id))); setAliases(resolvePlayerAliases(normalized, workspace.players, workspace.aliases)); setStep("review");
      setMetrics((current) => ({ ...current, totalMs: Math.round(performance.now() - started) }));
    } catch (requestError) { setError(requestError.message || "Não foi possível consultar as partidas."); }
    finally { setLoadingSource(""); }
  };
  const patchMatch = (id, patch) => setFound((current) => current.map((match) => match.id === id ? { ...match, ...patch } : match));
  const confirm = async () => {
    const validation = validateImport(chosen, aliases);
    if (!validation.valid) return;
    setSaving(true); setError("");
    try {
      const aliasRows = Object.entries(aliases).filter(([, playerId]) => playerId).map(([eaName, playerId]) => {
        const rawName = chosen.flatMap((match) => match.performance?.players || []).find((player) => normalizeName(player.eaName) === eaName)?.eaName || eaName;
        return { eaName: rawName, playerId };
      });
      await workspace.savePlayerAliases(aliasRows, false);
      await workspace.upsertClubMatches(chosen);
      setFound([]); setSelected(new Set()); setStep("review"); setSuccess(`${chosen.length} partida${chosen.length === 1 ? " importada" : "s importadas"} com sucesso.`);
    } catch (saveError) { setError(saveError.message || "Não foi possível concluir a importação."); }
    finally { setSaving(false); }
  };
  const editExisting = (match) => setEditing({
    id: match.id, dbId: match.id, date: match.played_at, opponent: match.opponent_name,
    strixScore: match.strix_score, opponentScore: match.opponent_score,
    competition: match.competition_name, competitionId: match.competition_id || "",
    competitionEditionId: match.competition_edition_id || "", agendaId: match.agenda_match_id || "",
    performance: match.performance || {}, goalScorers: match.performance?.goalScorers || [], importSource: match.source || "manual",
  });
  const saveEdit = async (match) => {
    try { await workspace.upsertClubMatch(match, match.importSource || "manual"); setEditing(null); setSuccess("Partida atualizada."); }
    catch (saveError) { setError(saveError.message); }
  };
  const addManual = () => setEditing({
    id: `manual-${Date.now()}`, date: new Date().toISOString(), opponent: "",
    strixScore: 0, opponentScore: 0, competition: "Amistoso",
    competitionId: "", competitionEditionId: "", agendaId: "",
    performance: {}, goalScorers: [], importSource: "manual",
  });
  const validation = validateImport(chosen, aliases);

  return <section className="matches-page page-enter progressive-matches">
    <header className="matches-hero"><div><span>PARTIDAS DO CLUBE</span><h1>Histórico de jogo.</h1><p>Encontre, revise e conecte cada partida ao ecossistema FC27.</p></div>{canManage && <div className="matches-actions"><button className="secondary" onClick={() => void load("computer")} disabled={Boolean(loadingSource)}>{loadingSource === "computer" ? "CONSULTANDO SEU PC…" : "BUSCAR PELO MEU PC"}</button><button className="secondary" onClick={() => void load("cloud")} disabled={Boolean(loadingSource)}>{loadingSource === "cloud" ? "CONSULTANDO EA…" : "BUSCAR NA EA"}</button><button className="secondary" onClick={addManual}>ADICIONAR MANUAL</button></div>}</header>
    {metrics && <div className="performance-note" aria-live="polite"><span>Resposta visual: {metrics.feedbackMs ?? "…"} ms</span><span>Consulta: {metrics.totalMs ?? "em andamento"}{metrics.totalMs ? " ms" : ""}</span><span>{metrics.requests} request</span></div>}
    {(error || workspace.error) && <p className="matches-error" role="alert">{error || workspace.error}</p>}
    {success && <p className="matches-success" role="status">{success}</p>}
    {found.length > 0 && step === "review" && <ReviewStep matches={found} selected={selected} toggle={(id) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })} edit={setEditing} next={() => setStep("resolve")} />}
    {found.length > 0 && step === "resolve" && <ResolveStep matches={chosen} agenda={workspace.agenda.filter((entry) => !["cancelled", "completed"].includes(entry.status))} competitions={competitionOptions} players={workspace.players} aliases={aliases} patchMatch={patchMatch} patchAlias={(key, value) => setAliases((current) => ({ ...current, [key]: value }))} back={() => setStep("review")} next={() => setStep("summary")} />}
    {found.length > 0 && step === "summary" && <SummaryStep matches={chosen} agenda={workspace.agenda} aliases={aliases} players={workspace.players} validation={validation} back={() => setStep("resolve")} confirm={() => void confirm()} saving={saving} />}
    <MatchHistory workspace={workspace} canManage={canManage} detail={setDetail} edit={editExisting} remove={(id) => void workspace.removeClubMatch(id).catch((removeError) => setError(removeError.message))} />
    {editing && <EditMatchModal match={editing} workspace={workspace} close={() => setEditing(null)} save={(match) => found.some((item) => item.id === match.id) ? (patchMatch(match.id, match), setEditing(null)) : void saveEdit(match)} />}
    {detail && <MatchDetails match={detail} close={() => setDetail(null)} />}
  </section>;
}
