import React, { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "../../ui/AccessDenied.jsx";
import { PageHeader } from "../../ui/PageHeader.jsx";
import { canManageMedia } from "./agenda-media-core.js";
import { downloadBlob, pruneCachedRenders, startAgendaRender, startRelatedNightRender, subscribeMediaJob } from "./media-jobs.js";
import { nightBatchPlan, runNightBatch } from "./night-batch.js";
import { normalizeMediaSection, resolveMediaLook } from "./media-renderer.js";
import { RUNDOWN_STATE_LABEL, describeMediaRundown } from "./media-rundown.js";
import { MediaBoundary, MediaNav, MediaViewer } from "./MediaShell.jsx";
import { AgendaSection, RelatedSection, SummarySection } from "./MediaSections.jsx";
import { AnnounceStudio } from "./AnnounceStudio.jsx";
import { useRemembered } from "../../ui/useRemembered.js";
import "./media.css";

/**
 * "Gerar tudo da noite": the Agenda do dia (both formats) and the Relacionados made in sequence.
 * It says beforehand what tonight can produce, shows which piece is being made, and ends with
 * each file ready to download; a piece that cannot be made says why.
 */
function NightBatch({ workspace, look, running }) {
  const plan = useMemo(() => nightBatchPlan(workspace), [workspace.agenda, workspace.nightRelated, workspace.players, workspace.competitions, workspace.competitionFixtures]);
  const [step, setStep] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const possible = plan.filter((piece) => piece.ready).length;
  const run = async () => {
    setBusy(true);
    setResults(null);
    try {
      setResults(await runNightBatch({ workspace, look, render: { agenda: startAgendaRender, related: startRelatedNightRender }, onStep: setStep }));
    } finally {
      setStep("");
      setBusy(false);
    }
  };
  const rows = results || plan;
  return (
    <section className="media-batch" aria-label="Gerar tudo da noite">
      <header><span>NOITE DE JOGO</span><p>{possible ? `${possible} ${possible === 1 ? "peça pronta" : "peças prontas"} para gerar em sequência.` : "Nenhuma peça da noite pode ser gerada agora."}</p></header>
      <ol>
        {rows.map((piece) => (
          <li key={piece.id} className={`is-${piece.status || (piece.ready ? "waiting" : "skipped")}${step === piece.id ? " is-running" : ""}`}>
            <b>{piece.label}</b>
            <small>{step === piece.id ? "Gerando…" : piece.status === "ready" ? "Pronta" : piece.status === "error" ? piece.error : piece.reason || "Na fila"}</small>
            {piece.status === "ready" && piece.record?.blob && <button type="button" onClick={() => downloadBlob(piece.record.blob, piece.record.fileName)}>Baixar</button>}
          </li>
        ))}
      </ol>
      <button type="button" className="primary" disabled={!possible || busy || running} onClick={() => void run()}>{busy ? "GERANDO…" : "GERAR TUDO DA NOITE"}</button>
    </section>
  );
}

/**
 * Central de mídia: pauta → peça → resultado. The pauta says what tonight can
 * produce and what each piece still needs; the studio shows the piece at scale,
 * generates it on the stage and hands back the file in the same place.
 */
export function MediaPage({ profile, client, workspace }) {
  const allowed = canManageMedia(profile);
  const [section, setSection] = useRemembered("media-section", "agenda");
  const [job, setJob] = useState(null);
  const [viewer, setViewer] = useState(null);
  const look = resolveMediaLook();
  const running = job?.status === "running";
  useEffect(() => subscribeMediaJob(setJob), []);
  // Old pieces leave this browser's archive when the studio opens.
  useEffect(() => { if (allowed) void pruneCachedRenders(); }, [allowed]);
  const rundown = useMemo(
    () => describeMediaRundown(workspace).map((item) => ({ ...item, stateLabel: RUNDOWN_STATE_LABEL[item.state] })),
    [workspace.agenda, workspace.matches, workspace.players, workspace.aliases, workspace.nightRelated, workspace.competitions, workspace.competitionFixtures],
  );

  if (!allowed) return <AccessDenied page="midia" />;

  const active = normalizeMediaSection(section);
  const shared = { workspace, profile, look, job, running, openViewer: setViewer };

  return (
    <section className="media-page page-enter">
      <PageHeader className="is-compact" title="Central de mídia." description="Escolha a peça da noite, confira a prévia e baixe pronta para postar." />
      <div className="media-studio">
        <div className="media-side">
          <MediaNav sections={rundown} active={active} onChange={setSection} />
          <NightBatch workspace={workspace} look={look} running={running} />
        </div>
        <div className="media-section" key={active}>
          <MediaBoundary key={active}>
            {active === "agenda" ? <AgendaSection {...shared} />
              : active === "related" ? <RelatedSection {...shared} />
                : active === "summary-day" ? <SummarySection mode="day" {...shared} />
                  : active === "summary-week" ? <SummarySection mode="week" {...shared} />
                    : <AnnounceStudio {...shared} />}
          </MediaBoundary>
        </div>
      </div>
      {viewer && <MediaViewer record={viewer} close={() => setViewer(null)} />}
    </section>
  );
}
