import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MotionTabs, RollingLabel, notify } from "../../ui/motion/motion.jsx";
import {
  agendaFileName,
  canManageMedia,
  collectTodayAgenda,
  fingerprintAgendaRender,
  formatAgendaDay,
} from "./agenda-media-core.js";
import { buildAgendaTimeline } from "./agenda-timeline.js";
import { paintAgendaFrame } from "./agenda-paint.js";
import { loadAgendaAssets } from "./media-assets.js";
import {
  downloadBlob,
  listCachedRenders,
  progressLabel,
  startAgendaRender,
  subscribeMediaJob,
} from "./media-jobs.js";
import "./media.css";

const GameDayEditor = lazy(() => import("../../gameday/GameDayEditor.jsx").then((module) => ({ default: module.GameDayEditor })));

function PreviewCanvas({ timeline, assets, dayLabel, format }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !timeline?.totalFrames || !assets) return undefined;
    const ctx = canvas.getContext("2d", { alpha: false });
    let frame = 0;
    let raf = 0;
    const tick = () => {
      const time = (frame / timeline.fps) % timeline.duration;
      paintAgendaFrame(ctx, { timeline, time, assets, dayLabel });
      frame += 1;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [assets, dayLabel, timeline]);
  return (
    <canvas
      ref={canvasRef}
      width={timeline.width}
      height={timeline.height}
      className={format === "feed" ? "is-feed" : ""}
      aria-label="Preview da agenda do dia"
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

function CacheCard({ title, record, currentFingerprint, onView, onDownload, onRegen, disabled }) {
  const stale = Boolean(record && currentFingerprint && record.fingerprint !== currentFingerprint);
  return (
    <article className={stale ? "stale" : ""}>
      <small>{title}</small>
      {record ? (
        <>
          <b>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(record.createdAt))}</b>
          <p>{record.matchCount} jogo{record.matchCount === 1 ? "" : "s"} · {record.fileName}</p>
          {stale && <p className="media-changed">A Agenda mudou desde este render.</p>}
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
  const [cache, setCache] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [assetError, setAssetError] = useState("");
  const day = useMemo(() => formatAgendaDay(), []);
  const matches = useMemo(() => collectTodayAgenda(workspace), [workspace.agenda, workspace.competitions, workspace.competitionFixtures]);
  const matchKey = matches.map((match) => `${match.id}:${match.scheduled_at}:${match.opponent_logo}:${match.competition_logo}`).join("|");
  const timeline = useMemo(() => buildAgendaTimeline(matches, { format }), [matches, format]);
  const hasGames = matches.length > 0;
  const running = job?.status === "running";

  useEffect(() => subscribeMediaJob(setJob), []);

  useEffect(() => {
    let alive = true;
    listCachedRenders(day.iso).then((rows) => { if (alive) setCache(rows); });
    return () => { alive = false; };
  }, [day.iso, job?.status]);

  const [prints, setPrints] = useState({ story: "", feed: "" });
  useEffect(() => {
    let alive = true;
    Promise.all([
      fingerprintAgendaRender({ day: day.iso, format: "story", matches }),
      fingerprintAgendaRender({ day: day.iso, format: "feed", matches }),
    ]).then(([story, feed]) => { if (alive) setPrints({ story, feed }); });
    return () => { alive = false; };
  }, [day.iso, matchKey]);

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
        items={[["agenda", "AGENDA DO DIA"], ["gameday", "GAME DAY"]]}
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
