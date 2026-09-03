import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MotionTabs, RollingLabel, notify } from "../../ui/motion/motion.jsx";
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
import "./media.css";

const GameDayEditor = lazy(() => import("../../gameday/GameDayEditor.jsx").then((module) => ({ default: module.GameDayEditor })));

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
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !timeline?.totalFrames || !assets) return undefined;
    const ctx = canvas.getContext("2d", { alpha: false });
    let frame = 0;
    let raf = 0;
    const tick = () => {
      const timeSec = frameTime(frame % timeline.totalFrames, timeline);
      renderFrame(ctx, { timeline, timeSec, assets, dayLabel });
      frame += 1;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [assets, dayLabel, frameTime, renderFrame, timeline]);
  return (
    <canvas
      ref={canvasRef}
      width={timeline.width}
      height={timeline.height}
      className={format === "feed" ? "is-feed" : ""}
      aria-label={label}
    />
  );
}

function Viewer({ record, close }) {
  const url = useMemo(() => (record?.blob ? URL.createObjectURL(record.blob) : ""), [record]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!record || !url) return null;
  return createPortal(
    <div className="media-viewer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section>
        <header>
          <span>RENDER PRONTO</span>
          <h2>{record.fileName}</h2>
        </header>
        <video src={url} controls autoPlay playsInline />
        <div className="media-inline-actions">
          <button type="button" className="primary" onClick={() => downloadBlob(record.blob, record.fileName)}>BAIXAR MP4</button>
          <button type="button" className="secondary" onClick={close}>FECHAR</button>
        </div>
      </section>
    </div>,
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
        <p>Nenhum render ainda.</p>
      )}
      <div className="media-inline-actions">
        <button type="button" className="secondary" disabled={!record} onClick={onView}>VISUALIZAR</button>
        <button type="button" className="secondary" disabled={!record} onClick={onDownload}>BAIXAR</button>
        <button type="button" className="secondary" disabled={disabled} onClick={onRegen}>GERAR NOVAMENTE</button>
      </div>
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
  const summaryTimeline = useMemo(() => buildSummaryTimeline(summary, { format: "story" }), [summary]);
  const hasSummary = summary.matches.length > 0;
  const matchKey = matches.map((match) => `${match.id}:${match.scheduled_at}:${match.opponent_logo}:${match.competition_logo}`).join("|");
  const relatedKey = related.map((player) => `${player.id}:${player.name}:${player.photo}:${player.position}:${player.group}`).join("|");
  const timeline = useMemo(() => buildAgendaTimeline(matches, { format }), [matches, format]);
  const relatedTimeline = useMemo(() => buildRelatedNightTimeline(related, { format: "story" }), [related]);
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
      fingerprintAgendaRender({ day: day.iso, format: "story", matches }),
      fingerprintAgendaRender({ day: day.iso, format: "feed", matches }),
    ]).then(([story, feed]) => { if (alive) setPrints({ story, feed }); });
    return () => { alive = false; };
  }, [day.iso, matchKey]);

  useEffect(() => {
    let alive = true;
    fingerprintRelatedNightRender({ day: day.iso, format: "story", players: related, saved: relatedState.saved })
      .then((value) => { if (alive) setRelatedPrint(value); });
    return () => { alive = false; };
  }, [day.iso, relatedKey, relatedState.saved]);

  const summaryKey = summary.matches.map((match) => `${match.id}:${match.strix_score}:${match.opponent_score}:${match.opponent_logo}`).join("|");
  useEffect(() => {
    let alive = true;
    fingerprintSummaryRender({ mode: summary.mode, day: day.iso, format: "story", matches: summary.matches })
      .then((value) => { if (alive) setSummaryPrint(value); });
    return () => { alive = false; };
  }, [day.iso, summary.mode, summaryKey]);

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
    const nextTimeline = buildAgendaTimeline(matches, { format: targetFormat });
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
    return (
      <section className="media-page page-enter">
        <div className="media-forbidden">
          <span>MÍDIA</span>
          <h1>Acesso de criação restrito.</h1>
          <p>O gerador automático da Agenda do Dia é liberado para Diretoria e Desenvolvimento.</p>
        </div>
      </section>
    );
  }

  const latest = (id) => cache.find((row) => row.format === id) || null;
  const ratio = Number.isFinite(job?.progress?.ratio)
    ? job.progress.ratio
    : (job?.progress?.total ? job.progress.loaded / job.progress.total : null);
  const determinate = Number.isFinite(ratio);

  return (
    <section className="media-page page-enter">
      <MotionTabs
        className="media-tabs"
        items={[
          ["agenda", "AGENDA DO DIA"],
          ["related", "RELACIONADOS DA NOITE"],
          ["summary-day", "RESUMO DO DIA"],
          ["summary-week", "RESUMO DA SEMANA"],
          ["gameday", "GAME DAY"],
        ]}
        active={tab}
        onChange={setTab}
        label="Área de mídia"
      />
      {tab === "gameday" ? (
        <div className="media-gameday">
          <Suspense fallback={<p>Carregando o editor Game Day…</p>}>
            <GameDayEditor profile={profile} client={client} workspace={workspace} />
          </Suspense>
        </div>
      ) : tab === "summary-day" || tab === "summary-week" ? (
        <>
          <header className="media-hero">
            <div>
              <span>GERADOR DE MÍDIA</span>
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
                </header>
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
                <h2>Último render</h2>
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
              <span>GERADOR DE MÍDIA</span>
              <h1>Relacionados da noite.</h1>
              <p>Uma peça vertical com todos os relacionados do dia no mesmo campo, sem titulares nem reservas.</p>
            </div>
            <div className="media-hero-meta">
              <span>{day.label}</span>
              <b>{relatedState.saved ? related.length : 0}</b>
              <small>{relatedState.saved
                ? (related.length === 1 ? "relacionado salvo" : "relacionados salvos")
                : "sugestão ainda não salva"}</small>
            </div>
          </header>
          <NightRelatedEditor workspace={workspace} profile={profile} compact />
          {!hasRelated ? (
            <div className="media-empty">
              <span>RELACIONADOS DA NOITE</span>
              <h1>Nenhum relacionado salvo para hoje.</h1>
              <p>As escalações só sugerem. Salve a lista oficial para gerar o vídeo. O jogador relacionado que não entrar em nenhum jogo continua na mídia.</p>
              <button type="button" className="primary" disabled>GERAR STORY</button>
            </div>
          ) : (
            <div className="media-layout">
              <section className="media-preview-card">
                <header>
                  <span>PREVIEW</span>
                  <h2>Story / Reels 9:16</h2>
                </header>
                <div className={`media-preview-frame${relatedAssets ? "" : " is-empty"}`}>
                  {relatedAssets ? (
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
                    <p>{relatedAssetError || "Carregando fotos antes do preview…"}</p>
                  )}
                </div>
                <div className="media-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={!relatedAssets || running}
                    onClick={() => void generateRelated(false)}
                  >
                    <RollingLabel>{running ? "GERANDO…" : "GERAR STORY"}</RollingLabel>
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!relatedAssets || running}
                    onClick={() => void generateRelated(true)}
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
              <aside className="media-side">
                <h2>Último render</h2>
                <div className="media-cache">
                  <CacheCard
                    title="STORY"
                    record={relatedCache.find((row) => row.format === "story") || null}
                    currentFingerprint={relatedPrint}
                    unit="relacionado"
                    disabled={running}
                    onView={() => setViewer(relatedCache.find((row) => row.format === "story") || null)}
                    onDownload={() => {
                      const record = relatedCache.find((row) => row.format === "story");
                      if (record) downloadBlob(record.blob, record.fileName);
                    }}
                    onRegen={() => void generateRelated(true)}
                  />
                </div>
              </aside>
            </div>
          )}
        </>
      ) : (
        <>
          <header className="media-hero">
            <div>
              <span>GERADOR DE MÍDIA</span>
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
                </header>
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
                <h2>Últimos renders</h2>
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
