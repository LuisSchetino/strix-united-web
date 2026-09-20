import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MotionTabs, RollingLabel, notify, useReducedMotion } from "../../ui/motion/motion.jsx";
import {
  AGENDA_TEMPLATE_ID,
  agendaFileName,
  canManageMedia,
  collectTodayAgenda,
  fingerprintAgendaRender,
  formatAgendaDay,
} from "./agenda-media-core.js";
import { buildAgendaTimeline } from "./agenda-timeline.js";
import { agendaFrameTime, renderAgendaFrame } from "./agenda-frame.js";
import { loadAgendaAssets, loadRelatedNightAssets, loadSummaryAssets } from "./media-assets.js";
import {
  describeTonightRelated,
  fingerprintRelatedNightRender,
  RELATED_NIGHT_TEMPLATE_ID,
  relatedNightFileName,
} from "./related-night-core.js";
import { NightRelatedEditor } from "../agenda/NightRelatedEditor.jsx";
import { buildRelatedNightTimeline } from "./related-night-timeline.js";
import { relatedNightFrameTime, renderRelatedNightFrame } from "./related-night-frame.js";
import {
  collectPeriodSummary,
  fingerprintSummaryRender,
  SUMMARY_TEMPLATE_ID,
  summaryFileName,
} from "./summary-core.js";
import { buildSummaryTimeline } from "./summary-timeline.js";
import { summaryFrameTime, renderSummaryFrame } from "./summary-frame.js";
import {
  downloadBlob,
  listCachedRenders,
  progressLabel,
  startAgendaRender,
  startRelatedNightRender,
  startSummaryRender,
  subscribeMediaJob,
} from "./media-jobs.js";
import { AnnounceStudio } from "./AnnounceStudio.jsx";
import { AccessDenied } from "../../ui/AccessDenied.jsx";
import { MediaLookBadge, MediaLookSwitch } from "./MediaLookSwitch.jsx";
import { readStoredMediaLook, withMediaLook, writeStoredMediaLook } from "./media-look.js";
import { preloadCollageAssets } from "../../assets/collage/index.js";
import "./media.css";

function PreviewCanvas({
  timeline,
  assets,
  dayLabel,
  format,
  frameTime = agendaFrameTime,
  renderFrame = renderAgendaFrame,
  label = "Preview da agenda do dia",
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  useEffect(() => { frameRef.current = 0; }, [assets, timeline]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !timeline?.totalFrames || !assets) return undefined;
    const ctx = canvas.getContext("2d", { alpha: false });
    let raf = 0;
    const tick = () => {
      const timeSec = frameTime(frameRef.current % timeline.totalFrames, timeline);
      renderFrame(ctx, { timeline, timeSec, assets, dayLabel });
      if (!reduced && !paused && !document.hidden) { frameRef.current += 1; raf = requestAnimationFrame(tick); }
    };
    const visibility = () => { cancelAnimationFrame(raf); if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", visibility);
    tick();
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", visibility); };
  }, [assets, dayLabel, frameTime, renderFrame, timeline, reduced, paused]);
  return (
    <div className="media-preview-stage"><canvas
      ref={canvasRef}
      width={timeline.width}
      height={timeline.height}
      className={format === "feed" ? "is-feed" : ""}
      aria-label={label}
    />{!reduced && <button type="button" className="media-playback" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "Reproduzir preview" : "Pausar preview"}</button>}</div>
  );
}

function Viewer({ record, close }) {
  const dialogRef = useRef(null);
  const url = useMemo(() => (record?.blob ? URL.createObjectURL(record.blob) : ""), [record]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    if (!url) return undefined;
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus?.({ preventScroll: true }); };
  }, [url]);
  if (!record || !url) return null;
  return createPortal(
    <dialog ref={dialogRef} className="media-viewer" aria-label="Visualizar vídeo gerado" onCancel={(event) => { event.preventDefault(); close(); }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section>
        <header>
          <span>VÍDEO PRONTO</span>
          <h2>{record.fileName}</h2>
        </header>
        <video src={url} controls autoPlay playsInline />
        <div className="media-inline-actions">
          <button type="button" className="primary" onClick={() => downloadBlob(record.blob, record.fileName)}>BAIXAR MP4</button>
          <button type="button" className="secondary" onClick={close}>FECHAR</button>
        </div>
      </section>
    </dialog>,
    document.body,
  );
}

function CacheCard({ title, record, currentFingerprint, onView, onDownload, onRegen, disabled, unit = "jogo" }) {
  const stale = Boolean(record && currentFingerprint && record.fingerprint !== currentFingerprint);
  const plural = record?.matchCount === 1 ? unit : `${unit}s`;
  return (
    <article className={stale ? "stale" : ""}>
      <small>{title}</small>
      {record ? (
        <>
          <b>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(record.createdAt))}</b>
          <p>{record.matchCount} {plural} · {record.fileName}</p>
          {stale && <p className="media-changed">Os dados mudaram desde este render.</p>}
        </>
      ) : (
        <p>Gere esta versão para visualizar e baixar o vídeo aqui.</p>
      )}
      {record && <div className="media-inline-actions">
        <button type="button" className="secondary" disabled={!record} onClick={onView}>VISUALIZAR</button>
        <button type="button" className="secondary" disabled={!record} onClick={onDownload}>BAIXAR</button>
        <button type="button" className="secondary" disabled={disabled} onClick={onRegen}>GERAR NOVAMENTE</button>
      </div>}
    </article>
  );
}

export function MediaPage({ profile, client, workspace }) {
  const allowed = canManageMedia(profile);
  const [tab, setTab] = useState("agenda");
  const [format, setFormat] = useState("story");
  const [job, setJob] = useState(null);
  const [assets, setAssets] = useState(null);
  const [relatedAssets, setRelatedAssets] = useState(null);
  const [cache, setCache] = useState([]);
  const [relatedCache, setRelatedCache] = useState([]);
  const [summaryCache, setSummaryCache] = useState([]);
  const [summaryAssets, setSummaryAssets] = useState(null);
  const [summaryAssetError, setSummaryAssetError] = useState("");
  const [viewer, setViewer] = useState(null);
  const [assetError, setAssetError] = useState("");
  const [relatedAssetError, setRelatedAssetError] = useState("");
  const [mediaLook, setMediaLook] = useState(readStoredMediaLook);
  const setLook = (value) => setMediaLook(writeStoredMediaLook(value));
  useEffect(() => {
    if (mediaLook === "collage") void preloadCollageAssets();
  }, [mediaLook]);
  const day = useMemo(() => formatAgendaDay(), []);
  const matches = useMemo(() => collectTodayAgenda(workspace), [workspace.agenda, workspace.competitions, workspace.competitionFixtures]);
  const relatedState = useMemo(
    () => describeTonightRelated(workspace),
    [workspace.nightRelated, workspace.agenda, workspace.players],
  );
  const related = relatedState.players;
  const summaryMode = tab === "summary-week" ? "week" : "day";
  const summary = useMemo(
    () => collectPeriodSummary(workspace, { mode: summaryMode }),
    [workspace.matches, summaryMode],
  );
  const summaryTimeline = useMemo(
    () => withMediaLook(buildSummaryTimeline(summary, { format: "story" }), mediaLook),
    [summary, mediaLook],
  );
  const hasSummary = summary.matches.length > 0;
  const matchKey = matches.map((match) => `${match.id}:${match.scheduled_at}:${match.opponent_logo}:${match.competition_logo}`).join("|");
  const relatedKey = related.map((player) => `${player.id}:${player.name}:${player.photo}:${player.position}:${player.group}:${player.number || ""}`).join("|");
  const timeline = useMemo(
    () => withMediaLook(buildAgendaTimeline(matches, { format }), mediaLook),
    [matches, format, mediaLook],
  );
  const relatedTimeline = useMemo(
    () => withMediaLook(buildRelatedNightTimeline(related, { format: "story" }), mediaLook),
    [related, mediaLook],
  );
  const hasGames = matches.length > 0;
  const hasRelated = relatedState.saved && related.length > 0;
  const running = job?.status === "running";

  useEffect(() => subscribeMediaJob(setJob), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listCachedRenders(day.iso, { template: AGENDA_TEMPLATE_ID }),
      listCachedRenders(day.iso, { template: RELATED_NIGHT_TEMPLATE_ID }),
      listCachedRenders(day.iso, { template: SUMMARY_TEMPLATE_ID }),
    ]).then(([agendaRows, relatedRows, summaryRows]) => {
      if (!alive) return;
      setCache(agendaRows);
      setRelatedCache(relatedRows);
      setSummaryCache(summaryRows);
    });
    return () => { alive = false; };
  }, [day.iso, job?.status]);

  const [prints, setPrints] = useState({ story: "", feed: "" });
  const [relatedPrint, setRelatedPrint] = useState("");
  const [summaryPrint, setSummaryPrint] = useState("");
  useEffect(() => {
    let alive = true;
    Promise.all([
      fingerprintAgendaRender({ day: day.iso, format: "story", matches, look: mediaLook }),
      fingerprintAgendaRender({ day: day.iso, format: "feed", matches, look: mediaLook }),
    ]).then(([story, feed]) => { if (alive) setPrints({ story, feed }); });
    return () => { alive = false; };
  }, [day.iso, matchKey, mediaLook]);

  useEffect(() => {
    let alive = true;
    fingerprintRelatedNightRender({ day: day.iso, format: "story", players: related, saved: relatedState.saved, look: mediaLook })
      .then((value) => { if (alive) setRelatedPrint(value); });
    return () => { alive = false; };
  }, [day.iso, relatedKey, relatedState.saved, mediaLook]);

  const summaryKey = summary.matches.map((match) => `${match.id}:${match.strix_score}:${match.opponent_score}:${match.opponent_logo}`).join("|");
  useEffect(() => {
    let alive = true;
    fingerprintSummaryRender({ mode: summary.mode, day: day.iso, format: "story", matches: summary.matches, look: mediaLook })
      .then((value) => { if (alive) setSummaryPrint(value); });
    return () => { alive = false; };
  }, [day.iso, summary.mode, summaryKey, mediaLook]);

  useEffect(() => {
    if (!hasSummary || (tab !== "summary-day" && tab !== "summary-week")) {
      setSummaryAssets(null);
      return undefined;
    }
    let alive = true;
    setSummaryAssetError("");
    loadSummaryAssets(summary.matches).then((loaded) => {
      if (alive) setSummaryAssets(loaded);
    }).catch((error) => {
      if (alive) setSummaryAssetError(error.message || "Não foi possível preparar os escudos.");
    });
    return () => { alive = false; };
  }, [hasSummary, summaryKey, tab]);

  useEffect(() => {
    if (!hasGames) {
      setAssets(null);
      return undefined;
    }
    let alive = true;
    setAssetError("");
    loadAgendaAssets(matches).then((loaded) => {
      if (alive) setAssets(loaded);
    }).catch((error) => {
      if (alive) setAssetError(error.message || "Não foi possível preparar os escudos.");
    });
    return () => { alive = false; };
  }, [hasGames, matchKey]);

  useEffect(() => {
    if (!hasRelated) {
      setRelatedAssets(null);
      return undefined;
    }
    let alive = true;
    setRelatedAssetError("");
    loadRelatedNightAssets(related).then((loaded) => {
      if (alive) setRelatedAssets(loaded);
    }).catch((error) => {
      if (alive) setRelatedAssetError(error.message || "Não foi possível preparar as fotos.");
    });
    return () => { alive = false; };
  }, [hasRelated, relatedKey]);

  const generate = async (targetFormat, force = false) => {
    if (!hasGames || running) return;
    const nextTimeline = withMediaLook(buildAgendaTimeline(matches, { format: targetFormat }), mediaLook);
    const started = await startAgendaRender({
      matches,
      format: targetFormat,
      day: day.iso,
      dayLabel: day.label,
      timeline: nextTimeline,
      force,
    });
    if (started.status === "ready") {
      notify(started.stage === "cached" ? "Render reutilizado do cache." : "Vídeo gerado.");
      setViewer(started.result);
      setFormat(targetFormat);
    } else if (started.status === "error") {
      notify(started.error);
    }
  };

  const generateRelated = async (force = false) => {
    if (!hasRelated || running) return;
    const started = await startRelatedNightRender({
      players: related,
      format: "story",
      day: day.iso,
      dayLabel: day.label,
      timeline: relatedTimeline,
      force,
    });
    if (started.status === "ready") {
      notify(started.stage === "cached" ? "Render reutilizado do cache." : "Vídeo gerado.");
      setViewer(started.result);
    } else if (started.status === "error") {
      notify(started.error);
    }
  };

  const generateSummary = async (force = false) => {
    if (!hasSummary || running) return;
    const started = await startSummaryRender({
      period: summary,
      format: "story",
      day: day.iso,
      dayLabel: summary.rangeLabel,
      timeline: summaryTimeline,
      force,
    });
    if (started.status === "ready") {
      notify(started.stage === "cached" ? "Render reutilizado do cache." : "Vídeo gerado.");
      setViewer(started.result);
    } else if (started.status === "error") {
      notify(started.error);
    }
  };

  if (!allowed) {
    return <AccessDenied page="midia" />;
  }

  const latest = (id) => cache.find((row) => row.format === id) || null;
  const ratio = Number.isFinite(job?.progress?.ratio)
    ? job.progress.ratio
    : (job?.progress?.total ? job.progress.loaded / job.progress.total : null);
  const determinate = Number.isFinite(ratio);

  return (
    <section className="media-page page-enter">
      <header className="media-editorial-heading"><span>STRIX UNITED · MÍDIA</span><h1>Central de conteúdo.</h1><p>A noite em campo. A história nas redes.</p></header>
      <MotionTabs
        className="media-tabs"
        items={[
          ["agenda", "AGENDA DO DIA"],
          ["related", "RELACIONADOS DA NOITE"],
          ["summary-day", "RESUMO DO DIA"],
          ["summary-week", "RESUMO DA SEMANA"],
          ["announce", "ANÚNCIOS FC 27"],
        ]}
        active={tab}
        onChange={setTab}
        label="Área de mídia"
      />
      {tab === "announce" ? (
        <AnnounceStudio workspace={workspace} mediaLook={mediaLook} onMediaLook={setLook} />
      ) : tab === "summary-day" || tab === "summary-week" ? (
        <>
          <header className="media-hero">
            <div>
              <span>CONTEÚDO DO STRIX</span>
              <h1>{summary.mode === "week" ? "Resumo da semana." : "Resumo do dia."}</h1>
              <p>Peça vertical com o desempenho do Strix no período, a partir do histórico oficial de partidas.</p>
            </div>
            <div className="media-hero-meta">
              <span>{summary.rangeLabel}</span>
              <b>{summary.matches.length}</b>
              <small>{summary.matches.length === 1 ? "jogo concluído" : "jogos concluídos"}</small>
            </div>
          </header>
          {!hasSummary ? (
            <div className="media-empty">
              <span>{summary.title}</span>
              <h1>{summary.mode === "week" ? "Nenhum jogo concluído nesta semana." : "Nenhum jogo concluído hoje."}</h1>
              <p>O resumo usa somente partidas do histórico com placar. Sem resultado, o vídeo não é gerado.</p>
              <button type="button" className="primary" disabled>GERAR STORY</button>
            </div>
          ) : (
            <div className="media-layout">
              <section className="media-preview-card">
                <header>
                  <span>PREVIEW</span>
                  <h2>Story / Reels 9:16</h2>
                  <MediaLookBadge value={mediaLook} />
                </header>
                <MediaLookSwitch value={mediaLook} onChange={setLook} />
                <div className={`media-preview-frame${summaryAssets ? "" : " is-empty"}`}>
                  {summaryAssets ? (
                    <PreviewCanvas
                      timeline={summaryTimeline}
                      assets={summaryAssets}
                      dayLabel={summary.rangeLabel}
                      format="story"
                      frameTime={summaryFrameTime}
                      renderFrame={renderSummaryFrame}
                      label="Preview do resumo"
                    />
                  ) : (
                    <p>{summaryAssetError || "Carregando escudos antes do preview…"}</p>
                  )}
                </div>
                <div className="media-actions">
                  <button type="button" className="primary" disabled={!summaryAssets || running} onClick={() => void generateSummary(false)}>
                    <RollingLabel>{running ? "GERANDO…" : "GERAR STORY"}</RollingLabel>
                  </button>
                  <button type="button" className="secondary" disabled={!summaryAssets || running} onClick={() => void generateSummary(true)}>
                    GERAR NOVAMENTE
                  </button>
                </div>
                {running && (
                  <div className="media-progress">
                    <b>{progressLabel(job.progress)}</b>
                    <i>{determinate && <em style={{ transform: `scaleX(${ratio})` }} />}</i>
                  </div>
                )}
                {job?.status === "ready" && job.result && job.result.template === SUMMARY_TEMPLATE_ID && (
                  <div className="media-actions">
                    <p>✓ Vídeo gerado</p>
                    <button type="button" className="primary" onClick={() => downloadBlob(job.result.blob, job.result.fileName || summaryFileName({ day: day.iso, mode: summary.mode, format: "story" }))}>
                      BAIXAR MP4
                    </button>
                    <button type="button" className="secondary" onClick={() => setViewer(job.result)}>VISUALIZAR</button>
                  </div>
                )}
                {job?.status === "error" && <p className="media-error">{job.error}</p>}
              </section>
              <aside className="media-side">
                <h2>Vídeo disponível</h2>
                <div className="media-cache">
                  <CacheCard
                    title="STORY"
                    record={summaryCache.find((row) => row.format === "story" && (row.fileName || "").includes(summary.mode === "week" ? "semana" : "dia")) || summaryCache.find((row) => row.format === "story") || null}
                    currentFingerprint={summaryPrint}
                    unit="jogo"
                    disabled={running}
                    onView={() => setViewer(summaryCache.find((row) => row.format === "story") || null)}
                    onDownload={() => {
                      const record = summaryCache.find((row) => row.format === "story");
                      if (record) downloadBlob(record.blob, record.fileName);
                    }}
                    onRegen={() => void generateSummary(true)}
                  />
                </div>
              </aside>
            </div>
          )}
        </>
      ) : tab === "related" ? (
        <>
          <header className="media-hero">
            <div>
              <span>RELACIONADOS DA NOITE</span>
              <h1>{day.label}</h1>
              <p>Salve a lista para gerar o vídeo.</p>
            </div>
            <div className="media-hero-meta">
              <b>{relatedState.saved ? related.length : 0}</b>
              <small>{related.length === 1 ? "relacionado" : "relacionados"}</small>
            </div>
          </header>
          <NightRelatedEditor workspace={workspace} profile={profile} compact />
          <div className="media-layout">
            <section className="media-preview-card">
              <header>
                <span>PREVIEW</span>
                <h2>Story / Reels 9:16</h2>
                <MediaLookBadge value={mediaLook} />
              </header>
              <MediaLookSwitch value={mediaLook} onChange={setLook} />
              <div className={`media-preview-frame${relatedAssets && hasRelated ? "" : " is-empty"}`}>
                {hasRelated && relatedAssets ? (
                  <PreviewCanvas
                    timeline={relatedTimeline}
                    assets={relatedAssets}
                    dayLabel={day.label}
                    format="story"
                    frameTime={relatedNightFrameTime}
                    renderFrame={renderRelatedNightFrame}
                    label="Preview dos relacionados da noite"
                  />
                ) : (
                  <p>{hasRelated ? (relatedAssetError || "Carregando fotos antes do preview…") : "Salve a lista para gerar o vídeo."}</p>
                )}
              </div>
              <div className="media-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={!hasRelated || !relatedAssets || running}
                  onClick={() => void generateRelated(false)}
                >
                  <RollingLabel>{running ? "GERANDO…" : "GERAR STORY"}</RollingLabel>
                </button>
              </div>
              {running && (
                <div className="media-progress">
                  <b>{progressLabel(job.progress)}</b>
                  <i>{determinate && <em style={{ transform: `scaleX(${ratio})` }} />}</i>
                </div>
              )}
              {job?.status === "ready" && job.result && job.result.template === RELATED_NIGHT_TEMPLATE_ID && (
                <div className="media-actions">
                  <p>✓ Vídeo gerado</p>
                  <button type="button" className="primary" onClick={() => downloadBlob(job.result.blob, job.result.fileName || relatedNightFileName({ day: day.iso, format: "story" }))}>
                    BAIXAR MP4
                  </button>
                  <button type="button" className="secondary" onClick={() => setViewer(job.result)}>VISUALIZAR</button>
                </div>
              )}
              {job?.status === "error" && <p className="media-error">{job.error}</p>}
            </section>
          </div>
        </>
      ) : (
        <>
          <header className="media-hero">
            <div>
              <span>CONTEÚDO DO STRIX</span>
              <h1>Agenda do dia.</h1>
              <p>Uma peça vertical pronta para o Instagram, montada só com os jogos de hoje em São Paulo.</p>
            </div>
            <div className="media-hero-meta">
              <span>{day.label}</span>
              <b>{matches.length}</b>
              <small>{matches.length === 1 ? "jogo encontrado" : "jogos encontrados"}</small>
            </div>
          </header>

          {!hasGames ? (
            <div className="media-empty">
              <span>AGENDA DO DIA</span>
              <h1>Nenhuma partida agendada para hoje.</h1>
              <p>O gerador não cria mídia de próxima partida. Volte quando houver jogo nesta data.</p>
              <button type="button" className="primary" disabled>GERAR AGENDA DO DIA</button>
            </div>
          ) : (
            <div className="media-layout">
              <section className="media-preview-card">
                <header>
                  <span>PREVIEW</span>
                  <h2>{format === "feed" ? "Feed 4:5" : "Story / Reels 9:16"}</h2>
                  <MediaLookBadge value={mediaLook} />
                </header>
                <MediaLookSwitch value={mediaLook} onChange={setLook} />
                <div className={`media-preview-frame${format === "feed" ? " is-feed" : ""}${assets ? "" : " is-empty"}`}>
                  {assets ? (
                    <PreviewCanvas timeline={timeline} assets={assets} dayLabel={day.label} format={format} />
                  ) : (
                    <p>{assetError || "Carregando escudos antes do preview…"}</p>
                  )}
                </div>
                <MotionTabs
                  items={[["story", "STORY 9:16"], ["feed", "FEED 4:5"]]}
                  active={format}
                  onChange={setFormat}
                  label="Formato"
                />
                <div className="media-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={!assets || running}
                    onClick={() => void generate(format, false)}
                  >
                    <RollingLabel>{running && job?.format === format ? "GERANDO…" : "GERAR VÍDEO"}</RollingLabel>
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!assets || running}
                    onClick={() => void generate(format, true)}
                  >
                    GERAR NOVAMENTE
                  </button>
                </div>
                {running && (
                  <div className="media-progress">
                    <b>{progressLabel(job.progress)}</b>
                    <i>{determinate && <em style={{ transform: `scaleX(${ratio})` }} />}</i>
                  </div>
                )}
                {job?.status === "ready" && job.result && job.format === format && (
                  <div className="media-actions">
                    <p>✓ Vídeo gerado</p>
                    <button type="button" className="primary" onClick={() => downloadBlob(job.result.blob, job.result.fileName || agendaFileName({ day: day.iso, format }))}>
                      BAIXAR MP4
                    </button>
                    <button type="button" className="secondary" onClick={() => setViewer(job.result)}>VISUALIZAR</button>
                  </div>
                )}
                {job?.status === "error" && <p className="media-error">{job.error}</p>}
              </section>
              <aside className="media-side">
                <h2>Vídeos disponíveis</h2>
                <div className="media-cache">
                  <CacheCard
                    title="STORY"
                    record={latest("story")}
                    currentFingerprint={prints.story}
                    disabled={running}
                    onView={() => setViewer(latest("story"))}
                    onDownload={() => downloadBlob(latest("story").blob, latest("story").fileName)}
                    onRegen={() => void generate("story", true)}
                  />
                  <CacheCard
                    title="FEED"
                    record={latest("feed")}
                    currentFingerprint={prints.feed}
                    disabled={running}
                    onView={() => setViewer(latest("feed"))}
                    onDownload={() => downloadBlob(latest("feed").blob, latest("feed").fileName)}
                    onRegen={() => void generate("feed", true)}
                  />
                </div>
              </aside>
            </div>
          )}
        </>
      )}
      {viewer && <Viewer record={viewer} close={() => setViewer(null)} />}
    </section>
  );
}
