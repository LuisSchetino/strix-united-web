import React, { useEffect, useMemo, useState } from "react";
import { RollingLabel, notify } from "../../ui/motion/motion.jsx";
import {
  AGENDA_TEMPLATE_ID,
  collectTodayAgenda,
  fingerprintAgendaRender,
  formatAgendaDay,
} from "./agenda-media-core.js";
import { buildAgendaTimeline } from "./agenda-timeline.js";
import { agendaFrameTime, renderAgendaFrame } from "./agenda-frame.js";
import { loadAgendaAssets, loadRelatedNightAssets, loadSummaryAssets } from "./media-assets.js";
import {
  RELATED_NIGHT_TEMPLATE_ID,
  describeTonightRelated,
  fingerprintRelatedNightRender,
} from "./related-night-core.js";
import { buildRelatedNightTimeline } from "./related-night-timeline.js";
import { relatedNightFrameTime, renderRelatedNightFrame } from "./related-night-frame.js";
import { SUMMARY_TEMPLATE_ID, collectPeriodSummary, fingerprintSummaryRender } from "./summary-core.js";
import { buildSummaryTimeline } from "./summary-timeline.js";
import { summaryFrameTime, renderSummaryFrame } from "./summary-frame.js";
import {
  downloadBlob,
  listCachedRenders,
  startAgendaRender,
  startRelatedNightRender,
  startSummaryRender,
} from "./media-jobs.js";
import { NightRelatedEditor } from "../agenda/NightRelatedEditor.jsx";
import { withMediaLook } from "./media-look.js";
import { MEDIA_FORMAT_LABELS, mediaGenerateLabel, resolveMediaOutput } from "./media-renderer.js";
import {
  ArchiveList,
  FormatGroup,
  MediaNotice,
  MediaToolbar,
  MediaWorkspace,
  PieceActions,
  PreviewCanvas,
  PreviewStage,
  RailBlock,
  StageEmpty,
  StageError,
  StageLoading,
  StageResult,
  jobPercent,
  recordToArchiveItem,
} from "./MediaShell.jsx";

const pad = (value) => String(value).padStart(2, "0");
const plural = (count, one, many) => (count === 1 ? one : many);

/** Cached renders for one template, refreshed whenever a job settles. */
function useRenderCache(template, dayIso, job) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    listCachedRenders(dayIso, { template }).then((next) => { if (alive) setRows(next); });
    return () => { alive = false; };
  }, [template, dayIso, job?.status]);
  return rows;
}

function useAssets(enabled, key, loader, errorText) {
  const [state, setState] = useState({ assets: null, error: "", attempt: 0 });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setState({ assets: null, error: "", attempt });
      return undefined;
    }
    let alive = true;
    setState((current) => ({ ...current, assets: null, error: "" }));
    loader().then((assets) => {
      if (alive) setState({ assets, error: "", attempt });
    }).catch((error) => {
      if (alive) setState({ assets: null, error: error?.message || errorText, attempt });
    });
    return () => { alive = false; };
  }, [enabled, key, attempt]);
  return { assets: state.assets, error: state.error, retry: () => setAttempt((value) => value + 1) };
}

/**
 * One piece, one layout: toolbar → stage (preview) → actions → rail.
 * Every section feeds this view; none of them builds its own page.
 */
function PieceView({
  title, meta, formats, format, onFormat, toolbarExtra, pieceKey, ratio, caption, timeline, assets, assetError, onRetry,
  dayLabel, frameTime, renderFrame, previewLabel, empty, record, running, job, onGenerate, onView, canGenerate, generateLabel,
  downloadLabel, error, rail, jobMatches, blockedHint,
}) {
  const busy = running && jobMatches;
  const state = empty ? "empty" : assetError ? "error" : assets ? "ready" : "loading";
  // The finished file replaces the preview in place; changing the piece returns to the live preview.
  const [result, setResult] = useState(null);
  useEffect(() => { setResult(null); }, [pieceKey]);
  const run = async (force) => {
    const started = await onGenerate(force);
    if (started?.status === "ready" && started.result) setResult(started.result);
  };
  const hint = !canGenerate ? (empty ? blockedHint : assetError ? "A prévia precisa carregar antes de gerar." : "Preparando a prévia…") : "";
  return (
    <>
      <MediaToolbar title={title} meta={meta}>
        <FormatGroup formats={formats} value={format} onChange={onFormat} />
        {toolbarExtra}
      </MediaToolbar>
      <MediaWorkspace
        stage={
          <PreviewStage pieceKey={pieceKey} ratio={ratio} caption={caption} state={state} label={previewLabel} job={busy ? job : null} showingResult={Boolean(result)}>
            {result ? <StageResult record={result} />
              : empty ? <StageEmpty {...empty} /> : assetError ? <StageError onRetry={onRetry}>{assetError}</StageError> : assets
                ? <PreviewCanvas timeline={timeline} assets={assets} dayLabel={dayLabel} format={format} frameTime={frameTime} renderFrame={renderFrame} label={previewLabel} />
                : <StageLoading />}
          </PreviewStage>
        }
        actions={
          <>
            {result ? (
              <PieceActions
                primary={<button type="button" className="primary" onClick={() => downloadBlob(result.blob, result.fileName)}>{downloadLabel}</button>}
                secondary={<>
                  <button type="button" className="secondary" onClick={() => onView(result)}>TELA CHEIA</button>
                  <button type="button" className="secondary" disabled={running || !canGenerate} onClick={() => void run(true)}>GERAR DE NOVO</button>
                </>}
                tertiary={<button type="button" className="media-link" onClick={() => setResult(null)}>Voltar à prévia</button>}
              />
            ) : (
              <PieceActions
                primary={<button type="button" className="primary" disabled={!canGenerate || running} onClick={() => void run(false)}><RollingLabel>{busy ? (jobPercent(job) !== null ? `GERANDO… ${jobPercent(job)}%` : "GERANDO…") : generateLabel}</RollingLabel></button>}
                secondary={record && <>
                  <button type="button" className="secondary" onClick={() => setResult(record)}>VER ÚLTIMA</button>
                  <button type="button" className="secondary" onClick={() => downloadBlob(record.blob, record.fileName)}>{downloadLabel}</button>
                </>}
                tertiary={hint && <p className="media-hint">{hint}</p>}
              />
            )}
            {job?.status === "error" && jobMatches && <MediaNotice tone="error" title="A geração não terminou.">{job.error}</MediaNotice>}
            {error}
          </>
        }
        rail={rail}
      />
    </>
  );
}

/* ----------------------------- AGENDA ----------------------------- */

export function AgendaSection({ workspace, look, job, running, openViewer }) {
  const day = useMemo(() => formatAgendaDay(), []);
  const matches = useMemo(() => collectTodayAgenda(workspace), [workspace.agenda, workspace.competitions, workspace.competitionFixtures]);
  const [format, setFormat] = useState("story");
  const matchKey = matches.map((match) => `${match.id}:${match.scheduled_at}:${match.opponent_logo}:${match.competition_logo}`).join("|");
  const timeline = useMemo(() => withMediaLook(buildAgendaTimeline(matches, { format }), look), [matches, format, look]);
  const { assets, error, retry } = useAssets(matches.length > 0, matchKey, () => loadAgendaAssets(matches), "Não foi possível preparar os escudos.");
  const cache = useRenderCache(AGENDA_TEMPLATE_ID, day.iso, job);
  const [prints, setPrints] = useState({ story: "", feed: "" });
  useEffect(() => {
    let alive = true;
    Promise.all([
      fingerprintAgendaRender({ day: day.iso, format: "story", matches, look }),
      fingerprintAgendaRender({ day: day.iso, format: "feed", matches, look }),
    ]).then(([story, feed]) => { if (alive) setPrints({ story, feed }); });
    return () => { alive = false; };
  }, [day.iso, matchKey, look]);

  const latest = (id) => cache.find((row) => row.format === id) || null;
  const generate = async (force) => {
    if (!matches.length || running) return null;
    const started = await startAgendaRender({
      matches, format, day: day.iso, dayLabel: day.label,
      timeline: withMediaLook(buildAgendaTimeline(matches, { format }), look), force,
    });
    if (started.status === "ready") notify(started.stage === "cached" ? "Esta versão já estava pronta." : "Vídeo pronto.");
    else if (started.status === "error") notify(started.error, "error");
    return started;
  };

  const archive = ["story", "feed"].map((id) => latest(id) && recordToArchiveItem(latest(id), {
    label: MEDIA_FORMAT_LABELS[id], currentFingerprint: prints[id], onView: () => openViewer(latest(id)),
  })).filter(Boolean);

  return (
    <PieceView
      title="Agenda do dia"
      meta={matches.length ? `${pad(matches.length)} ${plural(matches.length, "jogo", "jogos")} · ${day.label}` : day.label}
      formats={["story", "feed"]} format={format} onFormat={setFormat}
      pieceKey={`agenda:${format}:${look}:${matchKey}`} ratio={format} caption={MEDIA_FORMAT_LABELS[format]}
      timeline={timeline} assets={assets} assetError={error} onRetry={retry} dayLabel={day.label}
      frameTime={agendaFrameTime} renderFrame={renderAgendaFrame} previewLabel="Preview da agenda do dia"
      empty={matches.length ? null : { title: "Nenhuma partida hoje.", hint: "A peça nasce quando houver jogo marcado para esta data." }}
      record={latest(format)} running={running} job={job} jobMatches={job?.template === AGENDA_TEMPLATE_ID && job?.format === format}
      onGenerate={generate} onView={openViewer} canGenerate={Boolean(assets)}
      generateLabel={mediaGenerateLabel(resolveMediaOutput({ sectionId: "agenda", format }))} downloadLabel="BAIXAR MP4" blockedHint="A Agenda do dia nasce quando houver jogo marcado para hoje."
      rail={
        <>
          <RailBlock kicker="JOGOS DE HOJE" aside={matches.length ? pad(matches.length) : ""}>
            {matches.length ? (
              <ol className="media-lineup">
                {matches.map((match) => (
                  <li key={match.id}><time>{match.kickoff}</time><b>{match.opponent}</b><small>{match.competition || "Amistoso"}</small></li>
                ))}
              </ol>
            ) : <p className="media-block-empty">Sem jogos para hoje.</p>}
          </RailBlock>
          <ArchiveList items={archive} />
        </>
      }
    />
  );
}

/* ---------------------------- RELACIONADOS ---------------------------- */

export function RelatedSection({ workspace, profile, look, job, running, openViewer }) {
  const day = useMemo(() => formatAgendaDay(), []);
  const state = useMemo(() => describeTonightRelated(workspace), [workspace.nightRelated, workspace.agenda, workspace.players]);
  const related = state.players;
  const ready = state.saved && related.length > 0;
  const key = related.map((player) => `${player.id}:${player.name}:${player.photo}:${player.position}:${player.group}:${player.number || ""}`).join("|");
  const timeline = useMemo(() => withMediaLook(buildRelatedNightTimeline(related, { format: "story" }), look), [related, look]);
  const { assets, error, retry } = useAssets(ready, key, () => loadRelatedNightAssets(related), "Não foi possível preparar as fotos.");
  const cache = useRenderCache(RELATED_NIGHT_TEMPLATE_ID, day.iso, job);
  const [print, setPrint] = useState("");
  useEffect(() => {
    let alive = true;
    fingerprintRelatedNightRender({ day: day.iso, format: "story", players: related, saved: state.saved, look }).then((value) => { if (alive) setPrint(value); });
    return () => { alive = false; };
  }, [day.iso, key, state.saved, look]);

  const record = cache.find((row) => row.format === "story") || null;
  const generate = async (force) => {
    if (!ready || running) return null;
    const started = await startRelatedNightRender({ players: related, format: "story", day: day.iso, dayLabel: day.label, timeline, force });
    if (started.status === "ready") notify(started.stage === "cached" ? "Esta versão já estava pronta." : "Vídeo pronto.");
    else if (started.status === "error") notify(started.error, "error");
    return started;
  };

  return (
    <PieceView
      title="Relacionados da noite"
      meta={`${pad(state.saved ? related.length : 0)} ${plural(related.length, "relacionado", "relacionados")} · ${day.label}`}
      formats={["story"]} format="story" onFormat={() => {}}
      pieceKey={`related:${look}:${key}`} ratio="story" caption={MEDIA_FORMAT_LABELS.story}
      timeline={timeline} assets={assets} assetError={error} onRetry={retry} dayLabel={day.label}
      frameTime={relatedNightFrameTime} renderFrame={renderRelatedNightFrame} previewLabel="Preview dos relacionados da noite"
      empty={ready ? null : { title: "Falta salvar a lista.", hint: "Escolha os relacionados ao lado e salve para gerar o vídeo." }}
      record={record} running={running} job={job} jobMatches={job?.template === RELATED_NIGHT_TEMPLATE_ID}
      onGenerate={generate} onView={openViewer} canGenerate={Boolean(assets)}
      generateLabel={mediaGenerateLabel(resolveMediaOutput({ sectionId: "related" }))} downloadLabel="BAIXAR MP4" blockedHint="Salve a lista de relacionados ao lado para liberar o vídeo."
      rail={
        <>
          <RailBlock kicker="LISTA DA NOITE" className="media-block-editor"><NightRelatedEditor workspace={workspace} profile={profile} compact /></RailBlock>
          <ArchiveList items={record ? [recordToArchiveItem(record, { label: MEDIA_FORMAT_LABELS.story, unit: "relacionado", currentFingerprint: print, onView: () => openViewer(record) })] : []} />
        </>
      }
    />
  );
}

/* ------------------------------ RESUMO ------------------------------ */

export function SummarySection({ mode, workspace, look, job, running, openViewer }) {
  const day = useMemo(() => formatAgendaDay(), []);
  const summary = useMemo(() => collectPeriodSummary(workspace, { mode }), [workspace.matches, mode]);
  const has = summary.matches.length > 0;
  const key = summary.matches.map((match) => `${match.id}:${match.strix_score}:${match.opponent_score}:${match.opponent_logo}`).join("|");
  const timeline = useMemo(() => withMediaLook(buildSummaryTimeline(summary, { format: "story" }), look), [summary, look]);
  const { assets, error, retry } = useAssets(has, `${mode}:${key}`, () => loadSummaryAssets(summary.matches), "Não foi possível preparar os escudos.");
  const cache = useRenderCache(SUMMARY_TEMPLATE_ID, day.iso, job);
  const [print, setPrint] = useState("");
  useEffect(() => {
    let alive = true;
    fingerprintSummaryRender({ mode: summary.mode, day: day.iso, format: "story", matches: summary.matches, look }).then((value) => { if (alive) setPrint(value); });
    return () => { alive = false; };
  }, [day.iso, summary.mode, key, look]);

  const record = cache.find((row) => row.format === "story" && (row.fileName || "").includes(mode === "week" ? "semana" : "dia")) || null;
  const generate = async (force) => {
    if (!has || running) return null;
    const started = await startSummaryRender({ period: summary, format: "story", day: day.iso, dayLabel: summary.rangeLabel, timeline, force });
    if (started.status === "ready") notify(started.stage === "cached" ? "Esta versão já estava pronta." : "Vídeo pronto.");
    else if (started.status === "error") notify(started.error, "error");
    return started;
  };
  const title = mode === "week" ? "Resumo da semana" : "Resumo do dia";

  return (
    <PieceView
      title={title}
      meta={`${summary.rangeLabel} · ${pad(summary.matches.length)} ${plural(summary.matches.length, "jogo concluído", "jogos concluídos")}`}
      formats={["story"]} format="story" onFormat={() => {}}
      pieceKey={`summary-${mode}:${look}:${key}`} ratio="story" caption={MEDIA_FORMAT_LABELS.story}
      timeline={timeline} assets={assets} assetError={error} onRetry={retry} dayLabel={summary.rangeLabel}
      frameTime={summaryFrameTime} renderFrame={renderSummaryFrame} previewLabel="Preview do resumo"
      empty={has ? null : { title: mode === "week" ? "Nenhum jogo concluído nesta semana." : "Nenhum jogo concluído hoje.", hint: "O resumo usa só partidas do histórico com placar." }}
      record={record} running={running} job={job} jobMatches={job?.template === SUMMARY_TEMPLATE_ID}
      onGenerate={generate} onView={openViewer} canGenerate={Boolean(assets)}
      generateLabel={mediaGenerateLabel(resolveMediaOutput({ sectionId: `summary-${mode}` }))} downloadLabel="BAIXAR MP4" blockedHint="O resumo usa só partidas importadas com placar."
      rail={
        <>
          <RailBlock kicker={mode === "week" ? "RESULTADOS DA SEMANA" : "RESULTADOS DO DIA"} aside={has ? `${summary.stats.wins}V · ${summary.stats.draws}E · ${summary.stats.losses}D` : ""}>
            {has ? (
              <ol className="media-lineup is-results">
                {summary.matches.map((match) => (
                  <li key={match.id}><time>{match.dateLabel}</time><b>{match.opponent}</b><strong>{match.strix_score}–{match.opponent_score}</strong></li>
                ))}
              </ol>
            ) : <p className="media-block-empty">Sem resultados no período.</p>}
          </RailBlock>
          <ArchiveList items={record ? [recordToArchiveItem(record, { label: MEDIA_FORMAT_LABELS.story, currentFingerprint: print, onView: () => openViewer(record) })] : []} />
        </>
      }
    />
  );
}
