import React, { useEffect, useMemo, useRef, useState } from "react";
import { RollingLabel, notify } from "../../ui/motion/motion.jsx";
import {
  AGENDA_TEMPLATE_ID,
  collectTodayAgenda,
  fingerprintAgendaRender,
  formatAgendaDay,
} from "./agenda-media-core.js";
import { agendaFrameTime, renderAgendaFrame } from "./agenda-frame.js";
import { loadNightAgendaAssets, loadNightRelatedAssets } from "./media-assets.js";
import { buildNightAgendaTimeline, buildNightRelatedTimeline, buildNightSummaryTimeline, seededPick } from "./night-plan.js";
import { readFaceChoice, writeFaceChoice } from "./night-look.js";
import {
  RELATED_NIGHT_TEMPLATE_ID,
  describeTonightRelated,
  fingerprintRelatedNightRender,
  squadFaces,
} from "./related-night-core.js";
import { relatedNightFrameTime, renderRelatedNightFrame } from "./related-night-frame.js";
import { SUMMARY_TEMPLATE_ID, collectPeriodSummary, defaultSummaryPeriod, fingerprintSummaryRender, summaryInstant, summaryPeriods } from "./summary-core.js";
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
import { addSong, listSongs, readSongChoice, removeSong, writeSongChoice } from "./music-library.js";
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

/* ----------------------------- MÚSICA ----------------------------- */

/** A phone without an AAC encoder writes the song as Opus: it plays here, but some apps refuse it. */
export function warnOpus(started) {
  if (started?.status === "ready" && started.result?.sound === "opus") notify("Neste aparelho o som saiu em Opus. Se o Instagram recusar o vídeo, gere pelo computador.");
}

/** The song the video is cut on. The files stay in this browser; `value` is the chosen one's id. */
export function MusicBlock({ value, onChange }) {
  const [songs, setSongs] = useState(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef(null);
  const refresh = () => listSongs().then(setSongs);
  useEffect(() => { refresh(); }, []);
  // A choice whose file is no longer on this device is forgotten.
  useEffect(() => { if (songs && value && !songs.some((song) => song.id === value)) onChange(""); }, [songs, value]);
  const add = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const song = await addSong(file);
      await refresh();
      onChange(song.id);
      notify(`“${song.name}” guardada neste aparelho.`);
    } catch (error) {
      notify(error?.message || "Não foi possível guardar a música.", "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    const song = songs?.find((item) => item.id === value);
    if (!song) return;
    await removeSong(song.id).catch(() => {});
    onChange("");
    await refresh();
    notify(`“${song.name}” saiu da lista deste aparelho.`);
  };
  return (
    <RailBlock kicker="MÚSICA" aside={value ? "NA BATIDA" : ""}>
      <select className="media-select" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Música do vídeo">
        <option value="">Sem música</option>
        {(songs || []).map((song) => <option key={song.id} value={song.id}>{song.name}</option>)}
      </select>
      <div className="media-music-actions">
        <button type="button" className="media-link" onClick={() => picker.current?.click()} disabled={busy}>{busy ? "Guardando…" : "Adicionar música"}</button>
        {value ? <button type="button" className="media-link" onClick={remove}>Tirar da lista</button> : null}
      </div>
      <input ref={picker} type="file" accept="audio/*,.mp3,.m4a,.wav" hidden onChange={add} />
      <p className="media-hint">{value ? "O vídeo sai cortado nas batidas dessa música. A prévia ao lado continua sem som." : "Com uma música, o vídeo sai cortado nas batidas dela."} O arquivo fica só neste aparelho.</p>
    </RailBlock>
  );
}

/* ----------------------------- ROSTO ----------------------------- */

/**
 * Whose face a piece wears: the current squad's players that have a photo (nobody who left, or
 * is on trial). With no choice, one is drawn for the day (the same one every time the page is
 * opened, until "Sortear outro"). Returns `{ faces, choice, face, choose, roll }`.
 */
function useAgendaFace(workspace, day) {
  const faces = useMemo(() => squadFaces(workspace), [workspace.players]);
  const [choice, setChoice] = useState(readFaceChoice);
  const [rolls, setRolls] = useState(0);
  const chosen = choice ? faces.find((player) => player.id === choice) : null;
  const face = chosen || seededPick(faces, `${day}:${rolls}`);
  return { faces, choice: chosen ? choice : "", face, choose: (id) => { setChoice(id); writeFaceChoice(id); }, roll: () => setRolls((value) => value + 1) };
}

function FaceBlock({ faces, choice, face, choose, roll }) {
  return (
    <RailBlock kicker="ROSTO DA PEÇA" aside={!faces.length ? "" : choice ? "ESCOLHIDO" : "ALEATÓRIO"}>
      {faces.length ? (
        <>
          <select className="media-select" value={choice} onChange={(event) => choose(event.target.value)} aria-label="Rosto da peça">
            <option value="">{`Aleatório${face ? ` · hoje: ${face.name}` : ""}`}</option>
            {faces.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
          {!choice && faces.length > 1 ? <div className="media-music-actions"><button type="button" className="media-link" onClick={roll}>Sortear outro</button></div> : null}
          <p className="media-hint">Só o elenco atual, e só quem tem foto no Elenco. Quem saiu do time ou está em teste não aparece.</p>
        </>
      ) : <p className="media-hint">Nenhum jogador do Elenco tem foto ainda: a peça sai com o escudo no lugar do rosto.</p>}
    </RailBlock>
  );
}

/* ----------------------------- AGENDA ----------------------------- */

export function AgendaSection({ workspace, look, job, running, openViewer }) {
  const day = useMemo(() => formatAgendaDay(), []);
  const matches = useMemo(() => collectTodayAgenda(workspace), [workspace.agenda, workspace.competitions, workspace.competitionFixtures]);
  const [format, setFormat] = useState("story");
  const [music, setMusic] = useState(readSongChoice);
  const chooseMusic = (id) => { setMusic(id); writeSongChoice(id); };
  const matchKey = matches.map((match) => `${match.id}:${match.scheduled_at}:${match.opponent_logo}:${match.competition_logo}`).join("|");
  const picker = useAgendaFace(workspace, day.iso);
  const face = picker.face, faceId = face?.id || "crest";
  // The piece as the page shows it runs on a plain metronome; with a song it is rebuilt on the song's clock when generated.
  const timeline = useMemo(() => withMediaLook(buildNightAgendaTimeline(matches, { format, face }), look), [matches, format, look, faceId]);
  const { assets, error, retry } = useAssets(matches.length > 0, `${matchKey}|${faceId}`, () => loadNightAgendaAssets(matches, face), "Não foi possível preparar os escudos e a foto.");
  const cache = useRenderCache(AGENDA_TEMPLATE_ID, day.iso, job);
  const [prints, setPrints] = useState({ story: "", feed: "" });
  useEffect(() => {
    let alive = true;
    Promise.all([
      fingerprintAgendaRender({ day: day.iso, format: "story", matches, look, music, model: "night", face: faceId }),
      fingerprintAgendaRender({ day: day.iso, format: "feed", matches, look, music, model: "night", face: faceId }),
    ]).then(([story, feed]) => { if (alive) setPrints({ story, feed }); });
    return () => { alive = false; };
  }, [day.iso, matchKey, look, music, faceId]);

  const latest = (id) => cache.find((row) => row.format === id) || null;
  const generate = async (force) => {
    if (!matches.length || running) return null;
    const started = await startAgendaRender({
      matches, format, day: day.iso, dayLabel: day.label,
      timeline: withMediaLook(buildNightAgendaTimeline(matches, { format, face }), look), force,
      music: music ? { id: music } : null,
    });
    if (started.status === "error") notify(started.error, "error");
    else warnOpus(started);
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
      pieceKey={`agenda:${format}:${look}:${matchKey}:${faceId}`} ratio={format} caption={MEDIA_FORMAT_LABELS[format]}
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
          <FaceBlock {...picker} />
          <MusicBlock value={music} onChange={chooseMusic} />
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
  const related = state.video;
  const ready = state.saved && related.length > 0;
  const [music, setMusic] = useState(readSongChoice);
  const chooseMusic = (id) => { setMusic(id); writeSongChoice(id); };
  const key = related.map((player) => `${player.id}:${player.name}:${player.photo}:${player.position}:${player.group}:${player.number || ""}`).join("|");
  const timeline = useMemo(() => withMediaLook(buildNightRelatedTimeline(related, { format: "story" }), look), [related, look]);
  const { assets, error, retry } = useAssets(ready, key, () => loadNightRelatedAssets(related), "Não foi possível preparar as fotos.");
  const cache = useRenderCache(RELATED_NIGHT_TEMPLATE_ID, day.iso, job);
  const [print, setPrint] = useState("");
  useEffect(() => {
    let alive = true;
    fingerprintRelatedNightRender({ day: day.iso, format: "story", players: related, saved: state.saved, look, music, model: "night" }).then((value) => { if (alive) setPrint(value); });
    return () => { alive = false; };
  }, [day.iso, key, state.saved, look, music]);

  const record = cache.find((row) => row.format === "story") || null;
  const generate = async (force) => {
    if (!ready || running) return null;
    const started = await startRelatedNightRender({ players: related, format: "story", day: day.iso, dayLabel: day.label, timeline, force, music: music ? { id: music } : null });
    if (started.status === "error") notify(started.error, "error");
    else warnOpus(started);
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
          <MusicBlock value={music} onChange={chooseMusic} />
          <ArchiveList items={record ? [recordToArchiveItem(record, { label: MEDIA_FORMAT_LABELS.story, unit: "relacionado", currentFingerprint: print, onView: () => openViewer(record) })] : []} />
        </>
      }
    />
  );
}

/* ------------------------------ RESUMO ------------------------------ */

export function SummarySection({ mode, workspace, look, job, running, openViewer }) {
  // The summary can be made for today or for any earlier day (or week) with imported results.
  const periods = useMemo(() => summaryPeriods(workspace, { mode }), [workspace.matches, mode]);
  const [picked, setPicked] = useState("");
  const period = periods.find((entry) => entry.key === picked) || periods.find((entry) => entry.key === defaultSummaryPeriod(periods)) || null;
  const day = useMemo(() => formatAgendaDay(period ? summaryInstant(period.key) : new Date()), [period?.key]);
  const summary = useMemo(() => collectPeriodSummary(workspace, { mode, now: period ? summaryInstant(period.key) : new Date() }), [workspace.matches, mode, period?.key]);
  const has = summary.matches.length > 0;
  const key = summary.matches.map((match) => `${match.id}:${match.strix_score}:${match.opponent_score}:${match.opponent_logo}`).join("|");
  const [music, setMusic] = useState(readSongChoice);
  const chooseMusic = (id) => { setMusic(id); writeSongChoice(id); };
  const picker = useAgendaFace(workspace, day.iso);
  const face = picker.face, faceId = face?.id || "crest";
  // As in the Agenda: the page shows the piece on a plain metronome; with a song it is rebuilt on the song's clock when generated.
  const timeline = useMemo(() => withMediaLook(buildNightSummaryTimeline(summary, { format: "story", face }), look), [summary, look, faceId]);
  const { assets, error, retry } = useAssets(has, `${mode}:${key}|${faceId}`, () => loadNightAgendaAssets(summary.matches, face), "Não foi possível preparar os escudos e a foto.");
  const cache = useRenderCache(SUMMARY_TEMPLATE_ID, day.iso, job);
  const [print, setPrint] = useState("");
  useEffect(() => {
    let alive = true;
    fingerprintSummaryRender({ mode: summary.mode, day: day.iso, format: "story", matches: summary.matches, look, music, model: "night", face: faceId }).then((value) => { if (alive) setPrint(value); });
    return () => { alive = false; };
  }, [day.iso, summary.mode, key, look, music, faceId]);

  const record = cache.find((row) => row.format === "story" && (row.fileName || "").includes(mode === "week" ? "semana" : "dia")) || null;
  const generate = async (force) => {
    if (!has || running) return null;
    const started = await startSummaryRender({ period: summary, format: "story", day: day.iso, dayLabel: summary.rangeLabel, timeline, force, music: music ? { id: music } : null });
    if (started.status === "error") notify(started.error, "error");
    else warnOpus(started);
    return started;
  };
  const title = mode === "week" ? "Resumo da semana" : "Resumo do dia";

  return (
    <PieceView
      title={title}
      meta={`${summary.rangeLabel} · ${pad(summary.matches.length)} ${plural(summary.matches.length, "jogo concluído", "jogos concluídos")}`}
      formats={["story"]} format="story" onFormat={() => {}}
      pieceKey={`summary-${mode}:${look}:${key}:${faceId}`} ratio="story" caption={MEDIA_FORMAT_LABELS.story}
      timeline={timeline} assets={assets} assetError={error} onRetry={retry} dayLabel={summary.rangeLabel}
      frameTime={summaryFrameTime} renderFrame={renderSummaryFrame} previewLabel="Preview do resumo"
      empty={has ? null : { title: mode === "week" ? "Nenhum jogo concluído nesta semana." : period && !period.isCurrent ? `Nenhum jogo concluído em ${period.detail}.` : "Nenhum jogo concluído hoje.", hint: "O resumo usa só partidas do histórico com placar." }}
      record={record} running={running} job={job} jobMatches={job?.template === SUMMARY_TEMPLATE_ID}
      onGenerate={generate} onView={openViewer} canGenerate={Boolean(assets)}
      generateLabel={mediaGenerateLabel(resolveMediaOutput({ sectionId: `summary-${mode}` }))} downloadLabel="BAIXAR MP4" blockedHint="O resumo usa só partidas importadas com placar."
      rail={
        <>
          <RailBlock kicker={mode === "week" ? "SEMANA DO RESUMO" : "DIA DO RESUMO"} aside={periods.length > 1 ? "com resultados importados" : ""}>
            <div className="media-period" role="radiogroup" aria-label={mode === "week" ? "Semana do resumo" : "Dia do resumo"}>
              {periods.map((entry) => (
                <button key={entry.key} type="button" role="radio" aria-checked={entry.key === period?.key} className={entry.key === period?.key ? "is-on" : ""} onClick={() => setPicked(entry.key)}>
                  <b>{entry.label}</b>
                  <small>{entry.label === entry.detail ? "" : `${entry.detail} · `}{entry.count} {plural(entry.count, "jogo", "jogos")}</small>
                </button>
              ))}
            </div>
          </RailBlock>
          <RailBlock kicker={mode === "week" ? "RESULTADOS DA SEMANA" : "RESULTADOS DO DIA"} aside={has ? `${summary.stats.wins}V · ${summary.stats.draws}E · ${summary.stats.losses}D` : ""}>
            {has ? (
              <ol className="media-lineup is-results">
                {summary.matches.map((match) => (
                  <li key={match.id}><time>{match.dateLabel}</time><b>{match.opponent}</b><strong>{match.strix_score}–{match.opponent_score}</strong></li>
                ))}
              </ol>
            ) : <p className="media-block-empty">Sem resultados no período.</p>}
          </RailBlock>
          <FaceBlock {...picker} />
          <MusicBlock value={music} onChange={chooseMusic} />
          <ArchiveList items={record ? [recordToArchiveItem(record, { label: MEDIA_FORMAT_LABELS.story, currentFingerprint: print, onView: () => openViewer(record) })] : []} />
        </>
      }
    />
  );
}
