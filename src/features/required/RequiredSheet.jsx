import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconEyeOff, IconPlayerPauseFilled, IconPlayerPlayFilled, IconRotate, IconVolumeOff } from "@tabler/icons-react";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { useDialog } from "../../ui/useDialog.js";
import { PING_SECONDS, completionSeconds, requiredStatus } from "../../../shared/night-required.js";
import { librarySource } from "../library/library-core.js";
import { reportRequired } from "./required-client.js";
import { loadYouTubeApi } from "./youtube-api.js";
import "./required.css";

const thumbOf = (item) => { const source = librarySource(item?.source_url); return item?.thumbnail_url || (source.id ? `https://i.ytimg.com/vi/${source.id}/mqdefault.jpg` : ""); };
const clock = (value) => {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * The player of a required play. It has no bar to drag, no speed and no way out to YouTube:
 * a shield sits over the video and the only controls are ours. It pauses by itself when the
 * tab is not in front or the sound is off, puts the speed back to normal, and undoes a jump
 * ahead. Every few seconds, while it really plays, it tells the server "still playing"; the
 * server counts the time (see shared/night-required.js).
 */
function StrictPlayer({ client, day, item, requirement, row, onRow }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const live = useRef({ ok: false, furthest: Number(row?.watched_seconds) || 0, sending: false, started: false });
  const [phase, setPhase] = useState("loading"); // loading | ready | playing | paused | ended | failed
  const [block, setBlock] = useState("");         // "", "hidden", "muted"
  const [needTap, setNeedTap] = useState(false);
  const source = useMemo(() => librarySource(item.source_url), [item.source_url]);
  const duration = Number(requirement.duration_seconds) || 0;
  const needed = completionSeconds(duration);
  const watched = Number(row?.watched_seconds) || 0;
  const done = Boolean(row?.completed_at);
  // The server answers every few seconds; between two answers the clock runs on its own.
  const base = useRef({ watched, at: performance.now() });
  useEffect(() => { base.current = { watched, at: performance.now() }; }, [watched]);
  const [, setBeat] = useState(0);

  const send = useCallback((playing, options) => {
    if (live.current.sending && playing) return;
    live.current.sending = true;
    reportRequired(client, { day, itemId: item.id, playing }, options)
      .then((result) => onRow(result))
      .catch(() => null)
      .finally(() => { live.current.sending = false; });
  }, [client, day, item.id, onRow]);

  useEffect(() => {
    let cancelled = false;
    if (source.type !== "youtube" || !source.id) { setPhase("failed"); return undefined; }
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const target = document.createElement("div");
      hostRef.current.appendChild(target);
      playerRef.current = new YT.Player(target, {
        videoId: source.id,
        host: "https://www.youtube-nocookie.com",
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, origin: window.location.origin },
        events: {
          onReady: () => { if (!cancelled) setPhase("ready"); },
          onError: () => { if (!cancelled) setPhase("failed"); },
          onPlaybackRateChange: (event) => { if (event.data !== 1) event.target.setPlaybackRate(1); },
        },
      });
    });
    return () => {
      cancelled = true;
      if (live.current.ok) reportRequired(client, { day, itemId: item.id, playing: false }, { keepalive: true }).catch(() => null);
      live.current.ok = false;
      try { playerRef.current?.destroy(); } catch { /* already gone */ }
      playerRef.current = null;
    };
  }, [source.type, source.id, client, day, item.id]);

  // The watch: speed, jumps, sound, tab in front. Runs a few times a second.
  useEffect(() => {
    const watch = window.setInterval(() => {
      const player = playerRef.current;
      const states = window.YT?.PlayerState;
      if (!player?.getPlayerState || !states) return;
      const state = player.getPlayerState();
      if (player.getPlaybackRate?.() !== 1) player.setPlaybackRate(1);
      const time = Number(player.getCurrentTime?.()) || 0;
      if (time > live.current.furthest + 2.5) player.seekTo(live.current.furthest, true);
      else if (state === states.PLAYING) live.current.furthest = Math.max(live.current.furthest, time);
      const hidden = document.hidden || !document.hasFocus();
      const muted = Boolean(player.isMuted?.()) || player.getVolume?.() === 0;
      if (state === states.PLAYING && (hidden || muted)) { player.pauseVideo(); setBlock(hidden ? "hidden" : "muted"); }
      const ok = state === states.PLAYING && !hidden && !muted;
      if (live.current.ok && !ok) send(false);
      live.current.ok = ok;
      if (state === states.PLAYING || state === states.BUFFERING) { live.current.started = true; setNeedTap(false); }
      if (ok) setBeat((beat) => beat + 1);
      setPhase((current) => (current === "loading" || current === "failed") ? current
        : state === states.ENDED ? "ended"
        : ok || state === states.BUFFERING ? "playing"
        : live.current.started ? "paused" : "ready");
    }, 350);
    const report = window.setInterval(() => { if (live.current.ok) send(true); }, PING_SECONDS * 1000);
    const leave = () => {
      if (!live.current.ok) return;
      live.current.ok = false;
      try { playerRef.current?.pauseVideo(); } catch { /* nothing to pause */ }
      reportRequired(client, { day, itemId: item.id, playing: false }, { keepalive: true }).catch(() => null);
    };
    const hide = () => { if (document.hidden) { if (live.current.ok) setBlock("hidden"); leave(); } };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => { window.clearInterval(watch); window.clearInterval(report); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", leave); };
  }, [client, day, item.id, send]);

  const play = () => {
    const player = playerRef.current;
    if (!player?.playVideo) return;
    setBlock("");
    try { player.unMute(); if (player.getVolume?.() === 0) player.setVolume(60); } catch { /* the watch will tell */ }
    if (!live.current.started && live.current.furthest > 1) player.seekTo(Math.max(0, Math.min(live.current.furthest, duration - 2)), true);
    player.playVideo();
    send(true);
    // A phone may refuse a play that did not come from a touch on the video itself.
    window.setTimeout(() => { const state = playerRef.current?.getPlayerState?.(); const states = window.YT?.PlayerState; if (states && state !== states.PLAYING && state !== states.BUFFERING && !live.current.started) setNeedTap(true); }, 1600);
  };
  const pause = () => { try { playerRef.current?.pauseVideo(); } catch { /* nothing to pause */ } };
  const again = () => { const player = playerRef.current; if (!player) return; player.seekTo(0, true); play(); };

  const running = live.current.ok ? Math.min(PING_SECONDS + 4, (performance.now() - base.current.at) / 1000) : 0;
  const counted = done ? needed : Math.min(needed, watched + running);
  const share = needed && Number.isFinite(needed) ? Math.min(1, counted / needed) : 0;
  const missing = Math.max(0, Math.ceil(needed - watched));
  return (
    <div className={`required-player is-${phase}${done ? " is-done" : ""}`}>
      <div className="required-stage">
        <div ref={hostRef} className="required-video" />
        {!needTap && <div className="required-shield" aria-hidden="true" onContextMenu={(event) => event.preventDefault()} />}
        {phase === "loading" && <p className="required-stage-note">Carregando o vídeo…</p>}
        {phase === "failed" && <p className="required-stage-note">Este vídeo não abriu. Avise a diretoria: sem ele a escalação não libera.</p>}
        {needTap && <p className="required-stage-hint">Toque no vídeo para começar.</p>}
      </div>
      <div className="required-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label="Tempo assistido que já contou">
        <i style={{ "--share": share }} />
      </div>
      <div className="required-controls">
        <p aria-live="polite" className={block && !done ? "is-notice" : ""}>
          {done ? <><IconCheck size={16} stroke={2.4} aria-hidden="true" />Jogada assistida. Valeu.</>
            : block === "hidden" ? <><IconEyeOff size={16} stroke={1.9} aria-hidden="true" />Pausou sozinho: só conta com esta aba aberta na frente.</>
            : block === "muted" ? <><IconVolumeOff size={16} stroke={1.9} aria-hidden="true" />Pausou sozinho: o som do vídeo está desligado.</>
            : phase === "ended" ? `Faltaram ${missing} s. Reveja o trecho que ficou para trás e fecha.`
            : <><b>{clock(Math.floor(counted))}</b> de {clock(needed)} contados</>}
        </p>
        {!done && phase !== "loading" && phase !== "failed" && (
          phase === "playing" ? <button type="button" className="secondary" onClick={pause}><IconPlayerPauseFilled size={14} aria-hidden="true" />PAUSAR</button>
            : phase === "ended" ? <button type="button" className="primary" onClick={again}><IconRotate size={15} stroke={2.2} aria-hidden="true" />REVER</button>
            : <button type="button" className="primary" onClick={play}><IconPlayerPlayFilled size={14} aria-hidden="true" />{block === "muted" ? "ATIVAR O SOM E CONTINUAR" : live.current.started ? "CONTINUAR" : "ASSISTIR"}</button>
        )}
      </div>
    </div>
  );
}

/**
 * "Jogadas de hoje": the sheet where a player watches the day's required plays, one at a time.
 * `required` is the shell's state (useNightRequired); `items` the Library rows, for titles and links.
 */
export function RequiredSheet({ client, required, items = [], tier = "", close }) {
  const dialogRef = useDialog(close);
  const list = useMemo(() => [...required.items].sort((a, b) => (a.position || 0) - (b.position || 0)).map((entry) => ({ entry, item: items.find((item) => String(item.id) === String(entry.item_id)) || null })).filter(({ item }) => item), [required.items, items]);
  const status = requiredStatus({ items: required.items, progress: required.progress, tier });
  const [current, setCurrent] = useState(() => status.next || list[0]?.entry.item_id || "");
  const rowOf = (id) => required.progress.find((row) => row.item_id === id) || null;
  const active = list.find(({ entry }) => entry.item_id === current) || null;
  // When a play completes, the next one that is still owed takes the stage.
  const doneCount = status.done;
  const lastDone = useRef(doneCount);
  useEffect(() => {
    if (doneCount > lastDone.current && status.next) setCurrent(status.next);
    lastDone.current = doneCount;
  }, [doneCount, status.next]);
  const allDone = status.total > 0 && status.done >= status.total;
  return createPortal(
    <div className="required-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialogRef} className="required-sheet" role="dialog" aria-modal="true" aria-labelledby="required-title">
        <header>
          <div>
            <small>OBRIGATÓRIO DA NOITE</small>
            <h2 id="required-title">{allDone ? "Escalação liberada" : "Antes da escalação, as jogadas de hoje"}</h2>
            {allDone
              ? <p>Pronto. Obrigado por separar esse tempo: é isso que faz o time jogar junto.</p>
              : <>
                <p><strong>A diretoria não queria ter que travar nada.</strong> A gente sabe que todo mundo aqui trabalha, estuda e chega cansado. Mas entrar em campo sem as jogadas na cabeça custa caro para o time inteiro, e esse foi o jeito de garantir que ninguém fique para trás. São poucos minutos: assista com calma e a escalação abre na hora.</p>
                <p className="required-rules">Conta com o vídeo tocando nesta aba, com som e na velocidade normal.</p>
              </>}
          </div>
          <CloseButton onClick={close} />
        </header>
        <div className="required-body">
          {active?.item
            ? <StrictPlayer key={active.entry.item_id} client={client} day={required.day} item={active.item} requirement={active.entry} row={rowOf(active.entry.item_id)} onRow={required.apply} />
            : <p className="required-missing">Esta jogada não está mais na Biblioteca. Avise a diretoria.</p>}
          <ol className="required-list">
            {list.map(({ entry, item }, index) => {
              const row = rowOf(entry.item_id);
              const state = row?.completed_at ? "done" : entry.item_id === current ? "now" : "todo";
              return (
                <li key={entry.item_id} className={`is-${state}`}>
                  <button type="button" onClick={() => setCurrent(entry.item_id)} aria-current={state === "now" ? "true" : undefined}>
                    <span className="required-thumb">{thumbOf(item) && <img src={thumbOf(item)} alt="" loading="lazy" />}<i aria-hidden="true">{state === "done" ? <IconCheck size={14} stroke={2.6} /> : index + 1}</i></span>
                    <span><b title={item?.title || ""}>{item?.title || "Jogada"}</b><small>{clock(entry.duration_seconds)}</small></span>
                    <em>{state === "done" ? "Assistida" : state === "now" ? "Agora" : "Falta"}</em>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <footer>
          <span>{status.done} de {status.total} {status.total === 1 ? "assistida" : "assistidas"}</span>
          <button type="button" className={allDone ? "primary" : "secondary"} onClick={close}>{allDone ? "VER ESCALAÇÃO" : "FECHAR"}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
