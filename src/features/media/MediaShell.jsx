import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SegmentedControl, useReducedMotion } from "../../ui/motion/motion.jsx";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { motionMs } from "../../ui/motion/motion-tokens.js";
import { downloadBlob, progressLabel } from "./media-jobs.js";
import { MEDIA_FORMAT_LABELS } from "./media-renderer.js";

/* ------------------------------------------------------------------ *
 * Shell of the Central de Mídia. Sections change the CONTENT of this    *
 * shell; the structure (nav → toolbar → workspace) never moves.         *
 * ------------------------------------------------------------------ */

/**
 * The pauta: every piece the night can produce, what it uses and whether it is
 * ready. Choosing a piece swaps the studio content; the pauta never moves.
 */
export function MediaNav({ sections, active, onChange }) {
  return (
    <nav className="media-nav" aria-label="Peças da Central de mídia">
      <ol>
        {sections.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              className={`media-pauta-item is-${section.state || "ready"}${active === section.id ? " is-active" : ""}`}
              aria-current={active === section.id ? "true" : undefined}
              onClick={() => onChange(section.id)}
            >
              <span className="media-pauta-title">{section.title}</span>
              {section.meta && <span className="media-pauta-meta">{section.meta}</span>}
              {section.stateLabel && <em>{section.stateLabel}</em>}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** One quiet row: what you are making on the left, the few controls that matter on the right. */
export function MediaToolbar({ title, meta, children }) {
  return (
    <div className="media-toolbar">
      <div className="media-toolbar-title"><h2>{title}</h2>{meta && <p>{meta}</p>}</div>
      {children && <div className="media-toolbar-controls">{children}</div>}
    </div>
  );
}

export function ToolbarGroup({ label, items, active, onChange }) {
  return (
    <div className="media-toolbar-group">
      <span>{label}</span>
      <SegmentedControl className="media-seg" items={items} active={active} onChange={onChange} label={label} />
    </div>
  );
}

/** A decision the section does not offer is shown as a fact, never as a fake control. */
export function ToolbarFact({ label, value }) {
  return <div className="media-toolbar-group"><span>{label}</span><b className="media-toolbar-fact">{value}</b></div>;
}

export function FormatGroup({ formats = ["story", "feed"], value, onChange }) {
  if (formats.length < 2) return <ToolbarFact label="FORMATO" value={MEDIA_FORMAT_LABELS[formats[0]]} />;
  return <ToolbarGroup label="FORMATO" items={formats.map((id) => [id, MEDIA_FORMAT_LABELS[id]])} active={value} onChange={onChange} />;
}

export function MediaWorkspace({ stage, actions, rail }) {
  return (
    <div className="media-workspace">
      <div className="media-area-stage">{stage}</div>
      <div className="media-area-actions">{actions}</div>
      <aside className="media-area-rail">{rail}</aside>
    </div>
  );
}

/**
 * The protagonist. `pieceKey` identifies the piece (section + content + format);
 * when it changes the previous piece is replaced by a new one that assembles
 * and settles instead of snapping.
 */
export function PreviewStage({ pieceKey, ratio = "story", label, state = "ready", children, caption, job = null, showingResult = false }) {
  return (
    <section className="media-stage" aria-label={label}>
      <div className="media-stage-head"><span>{showingResult ? "PRONTO PARA POSTAR" : "PRÉVIA"}</span>{caption && <b>{caption}</b>}</div>
      <div className={`media-stage-frame is-${ratio}`} data-state={showingResult ? "result" : state}>
        <div className="media-stage-piece" key={showingResult ? `result:${pieceKey}` : pieceKey}>
          <i className="media-piece-sweep" aria-hidden="true" />
          {children}
          <StageProgress job={job} />
        </div>
      </div>
    </section>
  );
}

/** Generation happens on the piece itself: the preview dims and the progress runs across it. */
export function jobPercent(job) {
  const ratio = Number.isFinite(job?.progress?.ratio) ? job.progress.ratio : (job?.progress?.total ? job.progress.loaded / job.progress.total : null);
  return Number.isFinite(ratio) ? Math.round(Math.max(0, Math.min(1, ratio)) * 100) : null;
}

export function StageProgress({ job }) {
  if (job?.status !== "running") return null;
  const percent = jobPercent(job);
  const determinate = percent !== null;
  const ratio = determinate ? percent / 100 : 0;
  return (
    <div className="media-stage-progress" role="status" aria-live="polite">
      <b>{progressLabel(job.progress) || "Gerando"}</b>
      {percent !== null && <strong>{percent}%</strong>}
      <i className={determinate ? "" : "is-indeterminate"}><em style={determinate ? { transform: `scaleX(${Math.max(0.03, ratio)})` } : undefined} /></i>
    </div>
  );
}

/** The finished file, playing where the preview was. */
export function StageResult({ record }) {
  const url = useMemo(() => (record?.blob ? URL.createObjectURL(record.blob) : ""), [record]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!url) return null;
  return isImageRecord(record)
    ? <img className="media-stage-result" src={url} alt={`Peça gerada: ${record.fileName}`} />
    : <video className="media-stage-result" src={url} controls autoPlay muted loop playsInline aria-label={`Vídeo gerado: ${record.fileName}`} />;
}

const PlayIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8 5.5v13M16 5.5v13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;

/** Single canvas player used by every section; paints with the painter the renderer resolved. */
export function PreviewCanvas({ timeline, assets, dayLabel, format, frameTime, renderFrame, label }) {
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
      if (!reduced && !paused && !timeline.still && !document.hidden) { frameRef.current += 1; raf = requestAnimationFrame(tick); }
    };
    const visibility = () => { cancelAnimationFrame(raf); if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", visibility);
    tick();
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", visibility); };
  }, [assets, dayLabel, frameTime, renderFrame, timeline, reduced, paused]);
  const canPause = !reduced && !timeline.still;
  return (
    <>
      <canvas ref={canvasRef} width={timeline.width} height={timeline.height} className={format === "feed" ? "is-feed" : ""} aria-label={label} />
      {canPause && (
        <button type="button" className="media-playback" aria-pressed={paused} aria-label={paused ? "Reproduzir preview" : "Pausar preview"} onClick={() => setPaused((value) => !value)}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
      )}
    </>
  );
}

export function StageLoading({ children = "Montando a peça…" }) {
  return <div className="media-stage-state is-loading" role="status"><i aria-hidden="true" /><span>{children}</span></div>;
}

export function StageEmpty({ title, hint }) {
  return <div className="media-stage-state is-empty"><b>{title}</b>{hint && <span>{hint}</span>}</div>;
}

export function StageError({ title = "A prévia não carregou.", children, onRetry }) {
  return (
    <div className="media-stage-state is-error" role="alert">
      <b>{title}</b>{children && <span>{children}</span>}
      {onRetry && <button type="button" className="secondary" onClick={onRetry}>TENTAR NOVAMENTE</button>}
    </div>
  );
}

export function PieceActions({ primary, secondary, tertiary }) {
  return (
    <div className="media-actions">
      {primary}
      {secondary && <div className="media-actions-row">{secondary}</div>}
      {tertiary}
    </div>
  );
}

export function MediaProgress({ job }) {
  if (job?.status !== "running") return null;
  const ratio = Number.isFinite(job?.progress?.ratio) ? job.progress.ratio : (job?.progress?.total ? job.progress.loaded / job.progress.total : null);
  const determinate = Number.isFinite(ratio);
  return (
    <div className="media-progress" role="status">
      <b>{progressLabel(job.progress) || "Gerando"}</b>
      <i className={determinate ? "" : "is-indeterminate"}><em style={determinate ? { transform: `scaleX(${Math.max(0.03, Math.min(1, ratio))})` } : undefined} /></i>
    </div>
  );
}

export function MediaNotice({ tone = "info", title, children }) {
  return <div className={`media-notice is-${tone}`} role={tone === "error" ? "alert" : "status"}>{title && <b>{title}</b>}{children && <span>{children}</span>}</div>;
}

export function RailBlock({ kicker, aside, children, className = "" }) {
  return (
    <section className={`media-block ${className}`.trim()}>
      <header><span>{kicker}</span>{aside && <small>{aside}</small>}</header>
      {children}
    </section>
  );
}

/** Progressive disclosure: technical or secondary parameters stay one click away. */
export function Options({ label = "OPÇÕES", children }) {
  return (
    <details className="media-options">
      <summary><span>{label}</span><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
      <div className="media-options-body">{children}</div>
    </details>
  );
}

export function isImageRecord(record) {
  return record?.mime === "image/png" || String(record?.fileName || "").endsWith(".png") || record?.blob?.type === "image/png";
}

export function ArchiveList({ items = [], empty = "Nada gerado ainda." }) {
  return (
    <RailBlock kicker="ARQUIVO" aside={items.length ? String(items.length).padStart(2, "0") : ""}>
      {items.length ? (
        <ul className="media-archive">
          {items.map((item) => (
            <li key={item.id} className={item.stale ? "is-stale" : ""}>
              <div><b>{item.label}</b><small title={item.fileName}>{item.meta}</small>{item.stale && <em>Os dados mudaram desde este render.</em>}</div>
              <div className="media-archive-actions">
                <button type="button" className="secondary" aria-label={`Visualizar ${item.fileName || item.label}`} onClick={item.onView}>VER</button>
                <button type="button" className="secondary" aria-label={`Baixar ${item.fileName || item.label}`} onClick={item.onDownload}>BAIXAR</button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="media-block-empty">{empty}</p>}
    </RailBlock>
  );
}

export function recordToArchiveItem(record, { label, unit = "jogo", currentFingerprint = "", onView, onDownload } = {}) {
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(record.createdAt));
  const count = Number.isFinite(record.matchCount) ? ` · ${record.matchCount} ${record.matchCount === 1 ? unit : `${unit}s`}` : "";
  return {
    id: record.id,
    fileName: record.fileName,
    label: label || (isImageRecord(record) ? "PNG" : "MP4"),
    meta: `${date}${count}`,
    stale: Boolean(currentFingerprint && record.fingerprint !== currentFingerprint),
    onView: onView || (() => {}),
    onDownload: onDownload || (() => downloadBlob(record.blob, record.fileName)),
  };
}

export function MediaViewer({ record, close }) {
  const dialogRef = useRef(null);
  const [closing, setClosing] = useState(false);
  const url = useMemo(() => (record?.blob ? URL.createObjectURL(record.blob) : ""), [record]);
  const image = isImageRecord(record);
  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(close, motionMs("modal"));
  };
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
    <dialog
      ref={dialogRef}
      className={`media-viewer${closing ? " is-closing" : ""}`}
      aria-label={image ? "Visualizar imagem gerada" : "Visualizar vídeo gerado"}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onMouseDown={(event) => event.target === event.currentTarget && dismiss()}
    >
      <section>
        <header>
          <div><span>{image ? "IMAGEM PRONTA" : "VÍDEO PRONTO"}</span><h2>{record.fileName}</h2></div>
          <CloseButton onClick={dismiss} />
        </header>
        {image ? <img src={url} alt={record.fileName} /> : <video src={url} controls autoPlay playsInline />}
        <div className="media-inline-actions">
          <button type="button" className="primary" onClick={() => downloadBlob(record.blob, record.fileName)}>{image ? "BAIXAR PNG" : "BAIXAR MP4"}</button>
        </div>
      </section>
    </dialog>,
    document.body,
  );
}

/** A section can fail without taking the Central (nav, toolbar, other sections) with it. */
export class MediaBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="media-workspace is-failed">
        <div className="media-stage-state is-error" role="alert">
          <b>Esta área não carregou.</b>
          <span>As outras áreas da Central continuam disponíveis.</span>
          <button type="button" className="secondary" onClick={() => this.setState({ error: null })}>TENTAR NOVAMENTE</button>
        </div>
      </div>
    );
  }
}
