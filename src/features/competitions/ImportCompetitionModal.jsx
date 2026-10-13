import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconAlertCircle, IconArrowLeft, IconExternalLink } from "@tabler/icons-react";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { notify } from "../../ui/motion/motion.jsx";
import { saveCompetitionPreview } from "./competition-storage.js";
import { loadProviderImage } from "./competition-logo-image.js";
import { analyzeCompetition, cachedTournaments, discoverTournaments } from "./competition-analysis.js";
import "./competition-import.css";

const PHASES = { groups: "Fase de grupos", knockout: "Mata-mata", league: "Pontos corridos", standings: "Classificação" };
const isStrix = (name) => /\bstrix\b/i.test(String(name || ""));
const clockOf = (value) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value));

function Notice({ children, action }) {
  return (
    <div className="cimport-notice" role="alert">
      <IconAlertCircle size={18} stroke={1.8} aria-hidden="true" />
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Tournaments in progress on CCB Clubs: pick one instead of pasting its address. */
function TournamentFinder({ client, workspace, busy, reading, choose }) {
  const [state, setState] = useState(() => {
    const cached = cachedTournaments();
    return cached ? { status: "ready", tournaments: cached.tournaments, at: cached.at, error: "" } : { status: "loading", tournaments: [], at: 0, error: "" };
  });
  const load = async (refresh = false) => {
    // While reading again, the list already on screen stays usable.
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const result = await discoverTournaments(client, { refresh });
      setState({ status: "ready", tournaments: result.tournaments, at: result.at, error: "" });
    } catch (cause) {
      setState((current) => ({ ...current, status: "error", error: cause.message }));
    }
  };
  useEffect(() => { if (state.status === "loading") void load(false); }, []);
  const added = new Set((workspace.competitionSources || []).filter((source) => source.provider === "ccb").map((source) => String(source.external_competition_id || "")));
  const loading = state.status === "loading";
  return (
    <section className="tournament-finder" aria-label="Torneios em andamento na CCB Clubs" aria-busy={loading}>
      <header>
        <span>EM ANDAMENTO NA CCB CLUBS{state.at ? <small> · lido às {clockOf(state.at)}</small> : null}</span>
        <button type="button" className="tournament-finder-refresh" onClick={() => void load(true)} disabled={loading || !!busy}>{loading ? "BUSCANDO…" : "ATUALIZAR"}</button>
      </header>
      {loading && !state.tournaments.length && <p className="tournament-finder-note">Lendo os torneios e procurando o Strix em cada tabela…</p>}
      {state.status === "error" && <Notice>{state.error}{state.tournaments.length ? " A lista abaixo é a última leitura." : " Dá para colar a URL do campeonato abaixo."}</Notice>}
      {state.status === "ready" && !state.tournaments.length && <p className="tournament-finder-note">Nenhum torneio em andamento na CCB Clubs agora.</p>}
      {state.tournaments.length > 0 && <ul>
        {state.tournaments.map((tournament) => {
          const already = added.has(String(tournament.id));
          const target = tournament.strixUrl || tournament.url;
          const meta = [tournament.startsAt && `Início ${tournament.startsAt}`, tournament.teams && `${tournament.teams} times`, tournament.platform].filter(Boolean).join(" · ");
          return (
            <li key={tournament.id} className={tournament.strix ? "has-strix" : ""}>
              <ClubLogo name={tournament.name} url={tournament.logo} className="tournament-finder-logo" sizes="48px" decorative />
              <div>
                <b>{tournament.name}</b>
                <small>{meta || tournament.status}</small>
                <p>
                  {tournament.strix === true && <em className="is-strix">STRIX PARTICIPA{tournament.strixGroup ? ` · ${tournament.strixGroup}` : ""}</em>}
                  {tournament.strix === false && <em>Strix não está na tabela</em>}
                  {tournament.strix === null && <em>Tabela ainda sem leitura</em>}
                  {already && <em>JÁ ADICIONADO</em>}
                </p>
              </div>
              {/* Importing starts from the group Strix plays in, so that group and its rounds are the ones read first. */}
              <button type="button" className="secondary" disabled={!!busy} onClick={() => choose(target)}>{reading === target ? "LENDO…" : already ? "ATUALIZAR" : "ADICIONAR"}</button>
            </li>
          );
        })}
      </ul>}
    </section>
  );
}

function ReadProgress({ progress }) {
  const ratio = progress.total ? Math.min(1, progress.done / progress.total) : 0.04;
  return (
    <div className="cimport-progress" role="status" aria-live="polite">
      <p>
        <b>Lendo o campeonato</b>
        <span>{progress.total ? `${progress.done} de ${progress.total} páginas` : "abrindo a tabela…"}</span>
      </p>
      <i><em style={{ transform: `scaleX(${ratio})` }} /></i>
    </div>
  );
}

/** The provider's logo from the copy already downloaded for the colours: one download, shown as soon as it lands. */
function ReviewLogo({ client, preview }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!preview.logo) return undefined;
    let address = "";
    let alive = true;
    loadProviderImage(client, preview.logo).then((blob) => {
      if (!alive) return;
      address = URL.createObjectURL(blob);
      setSource(address);
    }).catch(() => { /* the monogram stays */ });
    return () => { alive = false; if (address) URL.revokeObjectURL(address); };
  }, [client, preview.logo]);
  return (
    <span className={`cimport-logo${source ? " is-loaded" : preview.logo ? " is-loading" : ""}`} aria-hidden="true">
      {source ? <img src={source} alt="" /> : <b>{String(preview.name || "?").replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join("")}</b>}
    </span>
  );
}

function CompetitionReview({ client, preview, busy, add, back, readAgain }) {
  const knockout = preview.relatedPreviews?.find((item) => item.sourceKind === "knockout");
  const strixGroup = preview.groups?.find((group) => group.isStrixGroup);
  const strixGames = (preview.fixtures || []).filter((fixture) => isStrix(fixture.homeTeamName) || isStrix(fixture.awayTeamName)).length;
  const report = preview.sourceReport;
  return (
    <section className="cimport-review">
      <button type="button" className="cimport-back" onClick={back} disabled={!!busy}>
        <IconArrowLeft size={15} stroke={2} aria-hidden="true" /> TROCAR CAMPEONATO
      </button>
      <div className="cimport-identity">
        <ReviewLogo client={client} preview={preview} />
        <div>
          <small>{[preview.organization, preview.type].filter(Boolean).join(" · ")}</small>
          <h3>{preview.name}</h3>
          <p>
            {strixGroup
              ? <em className="is-strix">STRIX JOGA NO {String(strixGroup.name).toUpperCase()}</em>
              : <em>Strix não aparece na tabela</em>}
          </p>
        </div>
      </div>
      <dl className="cimport-facts">
        <div><dt>Fase</dt><dd>{knockout?.knockout.currentStage || PHASES[preview.phase] || "—"}</dd></div>
        <div><dt>Grupos</dt><dd>{preview.groups?.length || "—"}</dd></div>
        <div><dt>Times</dt><dd>{preview.teamCount || "—"}</dd></div>
        <div><dt>Jogos do Strix</dt><dd>{strixGames}</dd></div>
      </dl>
      {strixGroup && (
        <div className="cimport-table" role="table" aria-label={`${strixGroup.name}: classificação`}>
          <header role="row"><span>{String(strixGroup.name).toUpperCase()}</span><span>P</span><span>J</span></header>
          {strixGroup.standings.map((row) => (
            <div role="row" key={row.team} className={row.isStrix ? "is-strix" : ""}>
              <b>{row.position}</b>
              <ClubLogo name={row.team} url={row.logo} className="cimport-table-logo" sizes="24px" decorative />
              <strong>{row.team}</strong>
              <span className="cimport-num is-points">{row.points}</span>
              <span className="cimport-num">{row.played}</span>
            </div>
          ))}
        </div>
      )}
      {report?.failed > 0 && (
        <Notice action={<button type="button" className="secondary" onClick={readAgain} disabled={!!busy}>LER O QUE FALTOU</button>}>
          Faltaram {report.failed} de {report.expected} páginas da CCB Clubs: algum grupo ou rodada pode ter ficado de fora.
        </Notice>
      )}
      <footer>
        <a href={preview.source} target="_blank" rel="noreferrer">
          ABRIR NA CCB CLUBS <IconExternalLink size={14} stroke={2} aria-hidden="true" />
        </a>
        <button type="button" className="primary" disabled={!!busy} onClick={add}>{busy || "ADICIONAR CAMPEONATO"}</button>
      </footer>
    </section>
  );
}

export function ImportCompetitionModal({ client, profile, workspace, close }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [reading, setReading] = useState("");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const run = useRef(0);
  const analyze = async (target = url) => {
    const turn = ++run.current;
    setBusy("LENDO…");
    setReading(target);
    setProgress({ done: 0, total: 0 });
    setError("");
    try {
      const result = await analyzeCompetition(client, target, { onProgress: (state) => { if (run.current === turn) setProgress(state); } });
      if (run.current !== turn) return;
      setPreview(result);
    } catch (cause) {
      if (run.current === turn) setError(cause.message);
    } finally {
      if (run.current === turn) { setBusy(""); setReading(""); setProgress(null); }
    }
  };
  const add = async () => {
    setBusy("ADICIONANDO…");
    setError("");
    try {
      await saveCompetitionPreview(client, profile, preview);
      await workspace.refresh();
      notify(`${preview.name || "Campeonato"} adicionado.`);
      close();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  };
  const back = () => { run.current += 1; setPreview(null); setError(""); };
  return createPortal((
    <div className="competition-modal-layer" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="competition-import-modal cimport" role="dialog" aria-modal="true" aria-label="Adicionar campeonato">
        <header>
          <div>
            <span>DEV · CCB CLUBS</span>
            <h2>Adicionar campeonato</h2>
            <ol className="cimport-steps" aria-label="Etapas">
              <li className={preview ? "is-done" : "is-current"} aria-current={preview ? undefined : "step"}><b>1</b> Escolher</li>
              <li className={preview ? "is-current" : ""} aria-current={preview ? "step" : undefined}><b>2</b> Conferir e adicionar</li>
            </ol>
          </div>
          <CloseButton onClick={close} />
        </header>
        {!preview && (
          <div className="cimport-pick">
            <TournamentFinder client={client} workspace={workspace} busy={busy} reading={reading} choose={(target) => { setUrl(target); void analyze(target); }} />
            <form className="cimport-url" onSubmit={(event) => { event.preventDefault(); if (url && !busy) void analyze(); }}>
              <label>
                OU COLE A URL DO CAMPEONATO
                <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://ccbclubs.com.br/fifa.php?..." inputMode="url" autoComplete="off" spellCheck={false} />
              </label>
              <button type="submit" className="primary" disabled={!url || !!busy}>{busy || "LER"}</button>
            </form>
            {progress && <ReadProgress progress={progress} />}
            {error && <Notice>{error}</Notice>}
          </div>
        )}
        {preview && (
          <>
            <CompetitionReview
              client={client}
              preview={preview}
              busy={busy}
              add={() => void add()}
              back={back}
              readAgain={() => void analyze(preview.source)}
            />
            {progress && <ReadProgress progress={progress} />}
            {error && <Notice>{error}</Notice>}
          </>
        )}
      </section>
    </div>
  ), document.body);
}
