import { IconMaximize, IconMinimize, IconPlayerPauseFilled, IconPlayerPlayFilled, IconVolume, IconVolumeOff } from "@tabler/icons-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MotionTabs, notify } from "../../ui/motion/motion.jsx";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { ActionMenu } from "../../ui/ActionMenu.jsx";
import { SelectControl } from "../../ui/SelectControl.jsx";
import {
  LIBRARY_CATEGORIES,
  LIBRARY_POSITIONS,
  archiveLibraryItem,
  normalizeFocus,
  restoreLibraryItem,
  saveLibraryExtras,
  asArray,
  canManageLibrary,
  canTrackLibrary,
  categoryCover,
  libraryCategoriesOf,
  librarySource,
  libraryThumbnail,
  createPlayMeter,
  primaryCategory,
  watchPatch,
} from "./library-core.js";
import { LibraryTracking } from "./LibraryTracking.jsx";
import "./library.css";
import { PageHeader } from "../../ui/PageHeader.jsx";
import { clearTarget, openTarget, useDeepTarget } from "../../ui/useDeepTarget.js";
import { CopyLinkButton } from "../../ui/CopyLinkButton.jsx";
import { timeLabel } from "../../deep-link.js";
import { ensureLibraryBanners } from "./library-share-banner.js";
import { useRemembered } from "../../ui/useRemembered.js";
import { isForPlayer } from "./library-glance.js";
import { ErrorNote } from "../../ui/ErrorNote.jsx";
import { AddMaterial } from "./AddMaterial.jsx";
import { ConfirmDialog } from "../../ui/ConfirmDialog.jsx";
import { REQUIRED_MAX } from "../../../shared/night-required.js";
import { saoPauloDay } from "../agenda/agenda-time.js";
import { markFailure, markRequired, readYouTubeDuration, unmarkRequired } from "../required/required-client.js";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "—";
const formatTime = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};

const categoryLabel = (id) => LIBRARY_CATEGORIES.find((category) => category.id === id)?.label || "Biblioteca";

function LibraryCover({ item, open }) {
  const [failed, setFailed] = useState(false);
  const shelf = primaryCategory(item);
  const source = item.thumbnail_url && !failed ? item.thumbnail_url : categoryCover(shelf);
  return <button className={`library-cover${item.thumbnail_url && !failed ? " has-thumbnail" : ""}`} onClick={open} aria-label={`Assistir ${item.title}`}>
    <img src={source} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    <span className="library-cover-caption">{categoryLabel(shelf)}</span>
    <i className="library-play-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg></i>
  </button>;
}

/** The shelves: one editorial cover per category, with what is on it and how far you are. */
function CategoryShelf({ items, progress, userId, active, onChange }) {
  const shelves = LIBRARY_CATEGORIES.map((category) => {
    const pool = items.filter((item) => libraryCategoriesOf(item).includes(category.id));
    const done = pool.filter((item) => progress.some((row) => row.item_id === item.id && row.user_id === userId && row.completed_at)).length;
    return { ...category, total: pool.length, done };
  }).filter((shelf) => shelf.total > 0 || shelf.base);
  return <div className="library-shelves" role="group" aria-label="Categorias da Biblioteca">
    {shelves.map((shelf, index) => {
      const selected = active === shelf.id;
      return <button type="button" key={shelf.id} className={`library-shelf data-arrive${selected ? " is-active" : ""}`} style={{ "--i": index }} aria-pressed={selected} onClick={() => onChange(selected ? "all" : shelf.id)} disabled={!shelf.total}>
        <img src={categoryCover(shelf.id)} alt="" loading={index < 3 ? "eager" : "lazy"} decoding="async" />
        <span className="library-shelf-copy">
          <b>{shelf.label}</b>
          <small>{shelf.total ? `${shelf.total} ${shelf.total === 1 ? "conteúdo" : "conteúdos"}` : "Nenhum conteúdo ainda"}</small>
          {shelf.total > 0 && <em>Você · <span className="data-value">{shelf.done}</span>/{shelf.total} concluídos</em>}
        </span>
      </button>;
    })}
  </div>;
}

let youtubeApiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    if (
      !document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      )
    ) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

const clockLabel = (seconds) => {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = `${String(minutes).padStart(hours ? 2 : 1, "0")}:${String(value % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${rest}` : rest;
};
const PLAYER_ICONS = { play: IconPlayerPlayFilled, pause: IconPlayerPauseFilled, sound: IconVolume, mute: IconVolumeOff, full: IconMaximize, exit: IconMinimize };
const PlayerIcon = ({ name }) => { const Glyph = PLAYER_ICONS[name]; return <Glyph aria-hidden="true" size={18} stroke={1.8} />; };

function LibraryPlayer({ item, progress, close, saveProgress, onExternalOpen, startAt = 0, canManage = false, saveExtras }) {
  const source = librarySource(item.source_url);
  const targetRef = useRef(null);
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const intervalRef = useRef(0);
  const lastCommittedRef = useRef(-1);
  const isYouTube = source.type === "youtube" && Boolean(source.id);
  const [status, setStatus] = useState(isYouTube ? "Pronto para assistir" : "Carregando player…");
  const [playerState, setPlayerState] = useState(isYouTube ? "idle" : "loading");
  // YouTube loads only when the member presses play here: until then the frame is the Strix cover.
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  // If YouTube's own stream never starts (autoplay refused), our veil keeps its branded
  // title card hidden and offers a Strix-styled retry instead of leaking it.
  const [stalled, setStalled] = useState(false);
  // Strix player over the YouTube IFrame API: our controls, YouTube's stream.
  const [clock, setClock] = useState({ time: 0, duration: 0, playing: false, muted: false });
  const focus = normalizeFocus(item.focus_positions);
  const [extrasError, setExtrasError] = useState("");
  const persistExtras = (patch) => {
    setExtrasError("");
    return Promise.resolve(saveExtras?.(patch)).catch((cause) => { setExtrasError(cause?.message || "Não foi possível salvar."); });
  };
  const uiTimerRef = useRef(0);
  const frameRef = useRef(null);
  // Fullscreen takes the frame and its controls together, so there is always a way out on screen.
  // Where the browser can't fullscreen an element (iPhone), the stage fills the viewport instead.
  const stageRef = useRef(null);
  const [full, setFull] = useState(false);
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(0);
  useEffect(() => {
    const sync = () => setFull((current) => (document.fullscreenElement ? document.fullscreenElement === stageRef.current : current && !stageRef.current?.requestFullscreen));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (event) => { if (event.key === "Escape" && !document.fullscreenElement) { event.stopPropagation(); setFull(false); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [full]);
  useEffect(() => () => window.clearTimeout(idleRef.current), []);
  const wake = () => {
    setIdle(false);
    window.clearTimeout(idleRef.current);
    if (full) idleRef.current = window.setTimeout(() => setIdle(true), 2600);
  };
  const toggleFull = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (full) {
      if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => null);
      setFull(false);
      return;
    }
    if (stage.requestFullscreen) {
      try {
        await stage.requestFullscreen({ navigationUI: "hide" });
        setFull(true);
        screen.orientation?.lock?.("landscape").catch(() => null);
        return;
      } catch { /* fall through to the in-page fullscreen */ }
    }
    setFull(true);
  };
  // Real play time since the last save. What is saved is where the member is and how
  // long was actually played to get there; a save that fails keeps its seconds for the next.
  const meterRef = useRef(null);
  if (!meterRef.current) meterRef.current = createPlayMeter();
  const commit = (position, duration) => {
    const played = meterRef.current.take();
    if (source.type === "drive" && !played) return;
    Promise.resolve(saveProgress({ watch: { position, duration, played } })).then((saved) => {
      if (saved !== false) return;
      meterRef.current.giveBack(played);
      setStatus("Progresso não salvo agora · tentando de novo");
    });
  };

  useEffect(() => {
    saveProgress({
      opened_at: progress?.opened_at || new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    });
  }, [item.id]);

  // Leaving through an embedded player (e.g. Drive's pop-out): the page hands focus to the
  // iframe and is hidden moments later by the new tab. That pair is recorded as an external open.
  useEffect(() => {
    if (source.type === "direct") return undefined;
    let armedAt = 0;
    const onBlur = () => {
      if (frameRef.current?.contains(document.activeElement)) armedAt = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && armedAt && Date.now() - armedAt < 2500) {
        armedAt = 0;
        onExternalOpen?.();
      }
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [item.id, source.type]);

  // Google Drive reports nothing about playback. What can be measured is the time
  // its player stays open after the member clicked into it (the play button is in
  // there); that is saved as time in the player, never as a percentage.
  useEffect(() => {
    if (source.type !== "drive") return undefined;
    let engaged = false;
    const onBlur = () => {
      if (!engaged && frameRef.current?.contains(document.activeElement)) {
        engaged = true;
        meterRef.current.tick(performance.now(), { counting: false });
      }
    };
    const save = () => commit(0, 0);
    const onHide = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    const clock = window.setInterval(() => meterRef.current.tick(performance.now(), { counting: engaged }), 1000);
    const saver = window.setInterval(save, 15000);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
      window.clearInterval(clock);
      window.clearInterval(saver);
      meterRef.current.tick(performance.now(), { counting: engaged });
      save();
    };
  }, [item.id, source.type]);

  // Leaving the tab or the site while a video plays still saves what was watched.
  useEffect(() => {
    if (source.type === "drive") return undefined;
    const save = () => {
      const player = playerRef.current;
      if (player?.getCurrentTime) commit(player.getCurrentTime(), player.getDuration());
      else if (videoRef.current) commit(videoRef.current.currentTime, videoRef.current.duration);
    };
    const onHide = () => { if (document.visibilityState === "hidden") save(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [item.id, source.type]);

  useEffect(() => {
    if (!isYouTube || !started) return undefined;
    let alive = true;
    loadYouTubeApi().then((YT) => {
      if (!alive || !targetRef.current) return;
      playerRef.current = new YT.Player(targetRef.current, {
        videoId: source.id,
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, controls: 0, modestbranding: 1, iv_load_policy: 3, fs: 0, disablekb: 1 },
        events: {
          onReady: (event) => {
            const resumeAt = startAt || progress?.last_position_seconds;
            if (resumeAt) event.target.seekTo(resumeAt, true);
            // The member already pressed play on the Strix cover: start without a second click.
            // playerState stays "loading" — our veil keeps covering YouTube's own title card
            // until onStateChange confirms a real frame is on screen (see below).
            event.target.playVideo?.();
            window.clearInterval(uiTimerRef.current);
            uiTimerRef.current = window.setInterval(() => {
              const player = event.target;
              if (!player?.getCurrentTime) return;
              const playing = player.getPlayerState() === 1;
              meterRef.current.sample(player.getCurrentTime(), { playing, rate: player.getPlaybackRate?.() || 1, wall: performance.now() });
              setClock({ time: player.getCurrentTime(), duration: player.getDuration(), playing, muted: player.isMuted() });
            }, 250);
          },
          onError: () => {
            setPlayerState("error");
            setStatus("Não foi possível carregar este vídeo.");
          },
          onStateChange: (event) => {
            window.clearInterval(intervalRef.current);
            // Unstarted/cued is YouTube's own title card; anything past that is a real frame.
            if (![YT.PlayerState.UNSTARTED, YT.PlayerState.CUED].includes(event.data)) {
              setPlayerState((current) => (current === "loading" ? "ready" : current));
              setStalled(false);
            }
            if (event.data === YT.PlayerState.PLAYING) {
              setEnded(false);
              setStatus("Reproduzindo · progresso sincronizado");
              intervalRef.current = window.setInterval(() => {
                commit(
                  event.target.getCurrentTime(),
                  event.target.getDuration(),
                );
              }, 5000);
            } else if (
              [YT.PlayerState.PAUSED, YT.PlayerState.ENDED].includes(event.data)
            ) {
              commit(event.target.getCurrentTime(), event.target.getDuration());
              setStatus(
                event.data === YT.PlayerState.ENDED ? "Concluído" : "Pausado",
              );
              if (event.data === YT.PlayerState.ENDED) setEnded(true);
            }
          },
        },
      });
    });
    return () => {
      alive = false;
      window.clearInterval(intervalRef.current);
      window.clearInterval(uiTimerRef.current);
      // Closing with the video still playing (the X, a click outside, another material):
      // the last stretch is measured and saved before the player goes away.
      const player = playerRef.current;
      if (player?.getCurrentTime) {
        try {
          meterRef.current.sample(player.getCurrentTime(), { playing: player.getPlayerState?.() === 1, rate: player.getPlaybackRate?.() || 1, wall: performance.now() });
          commit(player.getCurrentTime(), player.getDuration());
        } catch { /* the frame is already gone: what the clock measured was saved on its last beat */ }
      }
      playerRef.current = null;
      player?.destroy?.();
    };
  }, [item.id, started]);

  // Give YouTube's autoplay a window to kick in before offering a manual retry over the veil.
  useEffect(() => {
    if (!isYouTube || !started || playerState !== "loading") {
      setStalled(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setStalled(true), 5000);
    return () => window.clearTimeout(timer);
  }, [isYouTube, started, playerState]);

  return createPortal(
    <div
      className="library-player-layer"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        className="library-player-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
      >
        <header>
          <div>
            <span>{categoryLabel(primaryCategory(item)).toLocaleUpperCase("pt-BR")}</span>
            <h2>{item.title}</h2>
            <p>{item.description || "Material do Strix FC27."}</p>
            {(focus.length > 0 || canManage) && (
              <div className="library-focus" role="group" aria-label="Indicado para">
                <span>Indicado para</span>
                {canManage
                  ? LIBRARY_POSITIONS.map((position) => {
                    const on = focus.includes(position);
                    return <button key={position} type="button" className={on ? "is-on" : ""} aria-pressed={on} onClick={() => void persistExtras({ focus: on ? focus.filter((entry) => entry !== position) : [...focus, position] })}>{position}</button>;
                  })
                  : <b>{focus.join(" · ")}</b>}
                {canManage && <small>Todo mundo vê o material; isto só indica quem deve assistir primeiro.</small>}
              </div>
            )}
          </div>
          <CloseButton onClick={close} />
        </header>
        <div ref={stageRef} className={`library-player-stage${full ? " is-full" : ""}${full && idle ? " is-idle" : ""}`} onPointerMove={wake} onPointerDown={wake}>
        {full && <button type="button" className="library-player-exit" onClick={() => void toggleFull()}><PlayerIcon name="exit" /><span>SAIR DA TELA CHEIA</span></button>}
        <div ref={frameRef} className={`library-player-frame is-${playerState}${source.type === "youtube" ? " is-strix-player" : ""}`} onContextMenu={(event) => event.preventDefault()}>
          {isYouTube && !started && (
            <button type="button" className="strix-player-facade" onClick={() => { setStarted(true); setPlayerState("loading"); setStatus("Carregando player…"); }} aria-label={`Assistir ${item.title}`}>
              <img src={libraryThumbnail(item)} alt="" decoding="async" />
              <span className="strix-player-facade-play"><PlayerIcon name="play" /></span>
              <b>{startAt ? `ASSISTIR A PARTIR DE ${timeLabel(startAt)}` : "ASSISTIR AQUI"}</b>
            </button>
          )}
          {isYouTube && ended && (
            <div className="strix-player-end">
              <b>Concluído</b>
              <span>Você assistiu até o fim.</span>
              <button type="button" className="secondary" onClick={() => { playerRef.current?.seekTo(0, true); playerRef.current?.playVideo(); setEnded(false); }}>ASSISTIR DE NOVO</button>
            </div>
          )}
          {playerState === "loading" && !stalled && (
            <div className="library-player-loading">
              <i />
              <span>PREPARANDO CONTEÚDO</span>
            </div>
          )}
          {isYouTube && started && <div ref={targetRef} />}
          {isYouTube && playerState === "loading" && stalled && (
            <button type="button" className="strix-player-surface" aria-label={`Assistir ${item.title}`} onClick={() => { setStalled(false); playerRef.current?.playVideo(); }}>
              <span><PlayerIcon name="play" /></span>
            </button>
          )}
          {isYouTube && playerState === "ready" && !ended && <button type="button" className="strix-player-surface" aria-label={clock.playing ? "Pausar" : "Reproduzir"} onClick={() => (clock.playing ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo())}>{!clock.playing && <span><PlayerIcon name="play" /></span>}</button>}
          {source.type === "drive" && (
            <iframe
              src={source.embedUrl}
              allow="autoplay"
              title={item.title}
              referrerPolicy="no-referrer"
              onLoad={() => {
                setPlayerState("ready");
                setStatus("Pronto para assistir");
              }}
            />
          )}
          {source.type === "drive" && <span className="drive-popout-guard" aria-hidden="true" />}
          {source.type === "direct" && (
            <video
              ref={videoRef}
              src={source.embedUrl}
              poster={libraryThumbnail(item)}
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              playsInline
              onCanPlay={() => {
                setPlayerState("ready");
                setStatus("Pronto para assistir");
              }}
              onError={() => {
                setPlayerState("error");
                setStatus("Não foi possível carregar este vídeo.");
              }}
              onLoadedMetadata={(event) => {
                const resumeAt = startAt || progress?.last_position_seconds;
                if (resumeAt) event.currentTarget.currentTime = resumeAt;
              }}
              onPlay={() => setStatus("Reproduzindo · progresso sincronizado")}
              onPause={(event) =>
                commit(
                  event.currentTarget.currentTime,
                  event.currentTarget.duration,
                )
              }
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                meterRef.current.sample(video.currentTime, { playing: !video.paused && !video.seeking, rate: video.playbackRate || 1, wall: performance.now() });
                const bucket = Math.floor(event.currentTarget.currentTime / 5);
                if (bucket !== lastCommittedRef.current) {
                  lastCommittedRef.current = bucket;
                  commit(
                    event.currentTarget.currentTime,
                    event.currentTarget.duration,
                  );
                }
              }}
              onEnded={(event) => {
                commit(
                  event.currentTarget.duration,
                  event.currentTarget.duration,
                );
                setStatus("Concluído");
              }}
            />
          )}
          {playerState === "error" && (
            <div className="library-player-error">
              <b>VÍDEO INDISPONÍVEL</b>
              <span>Confira a origem do conteúdo e tente novamente.</span>
            </div>
          )}
        </div>
        {isYouTube && playerState === "ready" && (
          <div className="strix-player-controls">
            <button type="button" onClick={() => (clock.playing ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo())} aria-label={clock.playing ? "Pausar" : "Reproduzir"}><PlayerIcon name={clock.playing ? "pause" : "play"} /></button>
            <time>{clockLabel(clock.time)}</time>
            <input type="range" min="0" max={Math.max(1, Math.floor(clock.duration))} step="1" value={Math.floor(clock.time)} aria-label="Posição do vídeo" style={{ "--played": `${clock.duration ? (clock.time / clock.duration) * 100 : 0}%` }} onChange={(event) => { const next = Number(event.target.value); playerRef.current?.seekTo(next, true); setClock((current) => ({ ...current, time: next })); }} />
            <time>{clockLabel(clock.duration)}</time>
            <button type="button" onClick={() => (clock.muted ? playerRef.current?.unMute() : playerRef.current?.mute())} aria-label={clock.muted ? "Ativar som" : "Silenciar"}><PlayerIcon name={clock.muted ? "mute" : "sound"} /></button>
            <button type="button" onClick={() => void toggleFull()} aria-label={full ? "Sair da tela cheia" : "Tela cheia"}><PlayerIcon name={full ? "exit" : "full"} /></button>
          </div>
        )}
        {!isYouTube && source.type === "drive" && (
          <div className="strix-player-controls is-compact">
            <span>Os controles deste vídeo ficam no próprio player.</span>
            <button type="button" onClick={() => void toggleFull()} aria-label={full ? "Sair da tela cheia" : "Tela cheia"}><PlayerIcon name={full ? "exit" : "full"} /></button>
          </div>
        )}
        {extrasError && <p className="library-error" role="alert">{extrasError}</p>}
        </div>
        <footer>
          <span className={`library-provider-note is-${source.type}`}>
            {status}
          </span>
          <div className="library-player-actions">
            {(() => {
              // The link can point at the minute on screen: whoever opens it starts there.
              const second = Math.floor(isYouTube ? clock.time : videoRef.current?.currentTime || 0);
              return second >= 3 && source.type !== "drive"
                ? <CopyLinkButton page="biblioteca" id={item.id} params={{ t: second }} label={`Link em ${timeLabel(second)}`} />
                : null;
            })()}
            <CopyLinkButton page="biblioteca" id={item.id} />
            <button type="button" className="secondary" onClick={close}>
              FECHAR
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export function LibraryPage({ client, profile, ownPlayer = null, required = null }) {
  const [tab, setTab] = useRemembered("library-tab", "library", { allowed: ["library", "tracking"] });
  const [shelf, setShelf] = useRemembered("library-shelf", "all");
  const [items, setItems] = useState([]);
  const [progress, setProgress] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [removingItem, setRemovingItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canManage = canManageLibrary(profile?.access_tier);
  const canTrack = canTrackLibrary(profile?.access_tier);
  // Obrigatório da noite: the board marks up to three plays a day; players watch them to open the line-up.
  const today = saoPauloDay(new Date());
  const requiredToday = required?.day === today ? required.items : [];
  const isRequiredToday = (item) => requiredToday.some((entry) => String(entry.item_id) === String(item.id));
  const [marking, setMarking] = useState(false);
  const toggleRequired = async (item) => {
    if (marking || !client) return;
    setMarking(true);
    try {
      if (isRequiredToday(item)) {
        await unmarkRequired(client, { day: today, itemId: item.id });
        notify(`“${item.title}” saiu do obrigatório de hoje.`, "success");
      } else {
        if (requiredToday.length >= REQUIRED_MAX) { notify("Já são três jogadas obrigatórias hoje. Tire uma para pôr outra.", "error"); return; }
        const duration = Number(item.duration_seconds) || await readYouTubeDuration(librarySource(item.source_url).id);
        await markRequired(client, { day: today, itemId: item.id, position: requiredToday.length, duration });
        notify(`“${item.title}” é obrigatória hoje: a escalação só abre para o jogador depois de assistir.`, "success");
      }
      await required?.refresh();
    } catch (cause) {
      notify(markFailure(cause), "error");
    } finally {
      setMarking(false);
    }
  };
  const progressTimer = useRef(0);
  // Whoever manages the Library publishes the link banner of each material that lacks one.
  useEffect(() => {
    if (!canManage || loading || !items.length) return;
    ensureLibraryBanners(client, items).catch((cause) => console.warn("[biblioteca] banner do link não publicado", cause?.message || cause));
  }, [canManage, loading, items.length]);
  // A direct link (/biblioteca/<id>?t=83) opens that material, at that minute when it names one.
  const target = useDeepTarget("biblioteca");
  const [startAt, setStartAt] = useState(0);
  useEffect(() => {
    if (!target?.id || selected || loading) return;
    const item = items.find((entry) => String(entry.id) === target.id);
    if (!item) {
      notify("Este material não está disponível para você ou saiu da Biblioteca.", "error");
      clearTarget("biblioteca");
      return;
    }
    setTab("library");
    setStartAt(target.params?.t || 0);
    setSelected(item);
  }, [target?.id, items, loading]);
  const openItem = (item) => {
    setStartAt(0);
    setSelected(item);
    openTarget("biblioteca", item.id);
  };
  const closeItem = () => {
    setSelected(null);
    setStartAt(0);
    clearTarget("biblioteca");
  };
  const refresh = async () => {
    const [itemsResult, progressResult] = await Promise.all([
      client
        .from("library_items")
        .select("*")
        .order("published_at", { ascending: false }),
      client
        .from("library_view_progress")
        .select("*")
        .order("last_accessed_at", { ascending: false }),
    ]);
    const missing = ["42P01", "PGRST205"].includes(itemsResult.error?.code);
    setItems(asArray(itemsResult.data).filter((item) => item.status !== "archived"));
    setProgress(asArray(progressResult.data));
    setLoading(false);
    setError(
      missing
        ? "A migration da Biblioteca ainda não foi aplicada."
        : itemsResult.error?.message || progressResult.error?.message || "",
    );
  };
  useEffect(() => {
    void refresh();
    const channel = client
      .channel("fc27-library")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "library_items" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "library_view_progress" },
        (change) => {
          if (change?.new?.user_id && change.new.user_id === profile?.user_id) return;
          window.clearTimeout(progressTimer.current);
          progressTimer.current = window.setTimeout(refresh, 2500);
        },
      )
      .subscribe();
    return () => { window.clearTimeout(progressTimer.current); client.removeChannel(channel); };
  }, [client, profile?.user_id]);
  // Progress is written one save at a time, in order, and always against the row
  // as the database has it: two saves can never overwrite each other, and play time
  // only ever adds up. A save that fails says so; it is never dropped in silence.
  const saveChain = useRef(Promise.resolve(true));
  const writeProgress = async (itemId, patch) => {
    const own = () => client.from("library_view_progress");
    const { data: current, error: readError } = await own().select("*").eq("item_id", itemId).eq("user_id", profile.user_id).maybeSingle();
    if (readError) { setError(`Progresso não salvo: ${readError.message}`); return false; }
    const payload = patch.watch ? watchPatch(current || {}, patch.watch) : patch;
    const write = (values) => (current
      ? own().update(values).eq("item_id", itemId).eq("user_id", profile.user_id).select("*")
      : own().insert({ item_id: itemId, ...values }).select("*"));
    let { data: saved, error: saveError } = await write(payload);
    const EXTRA = ["external_open_count", "last_external_open_at"];
    if (saveError && EXTRA.some((key) => key in payload) && /external_open|PGRST204|column/i.test(`${saveError.code} ${saveError.message}`)) {
      ({ data: saved, error: saveError } = await write(Object.fromEntries(Object.entries(payload).filter(([key]) => !EXTRA.includes(key)))));
    }
    if (saveError) { setError(`Progresso não salvo: ${saveError.message}`); return false; }
    setError((message) => (String(message).startsWith("Progresso não salvo") ? "" : message));
    const row = asArray(saved)[0] || { ...(current || { item_id: itemId, user_id: profile.user_id }), ...payload };
    setProgress((rows) => (rows.some((entry) => entry.item_id === itemId && entry.user_id === profile.user_id)
      ? rows.map((entry) => (entry.item_id === itemId && entry.user_id === profile.user_id ? { ...entry, ...row } : entry))
      : [row, ...rows]));
    return true;
  };
  const saveProgress = (itemId, patch) => {
    const next = saveChain.current.then(() => writeProgress(itemId, patch)).catch((cause) => {
      setError(`Progresso não salvo: ${cause?.message || "sem conexão"}`);
      return false;
    });
    saveChain.current = next;
    return next;
  };
  // Removing takes the material off the shelves at once; the toast carries the way back.
  const removeItem = async (item) => {
    try {
      await archiveLibraryItem(client, profile, item);
      // A play that leaves the Library leaves the required plays of today and of the days ahead too.
      await client.from("night_required_items").delete().eq("item_id", item.id).gte("day", today).then(() => null, () => null);
      void required?.refresh();
      await refresh();
      notify(`“${item.title}” saiu da Biblioteca.`, "success", {
        label: "Desfazer",
        run: () => { restoreLibraryItem(client, profile, item).then(refresh).then(() => notify("Material de volta à Biblioteca.")).catch((cause) => notify(cause.message || "Não foi possível restaurar o material.", "error")); },
      });
    } catch (cause) {
      notify(cause.message || "Não foi possível remover o material.", "error");
    }
  };
  const saveExtras = async (item, patch) => {
    const saved = await saveLibraryExtras(client, profile, item, patch);
    setItems((rows) => rows.map((row) => (row.id === item.id ? { ...row, ...saved } : row)));
    setSelected((current) => (current?.id === item.id ? { ...current, ...saved } : current));
  };
  const tabs = [
    ["library", "BIBLIOTECA"],
    ...(canTrack ? [["tracking", "ACOMPANHAMENTO"]] : []),
  ];
  const shelfOptions = [["all", "Todas as categorias"], ...LIBRARY_CATEGORIES.filter((category) => items.some((item) => libraryCategoriesOf(item).includes(category.id))).map((category) => [category.id, category.label])];
  // A remembered shelf that has no material any more falls back to everything.
  useEffect(() => {
    if (!loading && shelf !== "all" && !shelfOptions.some(([id]) => id === shelf)) setShelf("all");
  }, [loading, items.length, shelf]);
  const visibleItems = shelf === "all" ? items : items.filter((item) => libraryCategoriesOf(item).includes(shelf));
  return (
    <section className="data-page page-enter library-v2">
      <PageHeader
        title="Jogadas e reviews."
        description="Conteúdo do time para assistir, revisar e retomar de onde parou."
        actions={canManage && (
          <button className="primary" onClick={() => setAdding(true)}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>ADICIONAR MATERIAL
          </button>
        )}
      />
      <MotionTabs
        className="library-tabs"
        items={tabs}
        active={tab}
        onChange={setTab}
        label="Seções da Biblioteca"
      />
      <ErrorNote message={error} onRetry={() => refresh()} />
      {loading ? (
        <div className="library-empty">Carregando Biblioteca…</div>
      ) : tab !== "tracking" ? (
        <>
        <CategoryShelf items={items} progress={progress} userId={profile.user_id} active={shelf} onChange={setShelf} />
        <div className="library-play-filter">
          <span>{shelf === "all" ? `${items.length} ${items.length === 1 ? "conteúdo" : "conteúdos"}` : `${categoryLabel(shelf)} · ${visibleItems.length}`}</span>
          <SelectControl value={shelf} onChange={setShelf} label="Filtrar por categoria" options={shelfOptions} />
        </div>
        <section className="library-grid" key={shelf}>
          {visibleItems.length ? (
            visibleItems.map((item, index) => {
              const own = progress.find(
                (row) =>
                  row.item_id === item.id && row.user_id === profile.user_id,
              );
              const source = librarySource(item.source_url);
              const progressLabel = own
                ? source.trackable
                  ? `${Math.round(own.progress_percent)}% · ${formatTime(own.last_position_seconds)}`
                  : `Aberto em ${formatDate(own.last_accessed_at)}`
                : "Ainda não aberto";
              return (
                <article className="library-editorial-card data-arrive" style={{ "--i": Math.min(index, 10) }} key={item.id}>
                  <LibraryCover key={`${item.id}-${item.thumbnail_url || ""}`} item={item} open={() => openItem(item)}/>
                  <div className="library-editorial-copy">
                    <small>
                      {source.type === "youtube" ? "YouTube" : source.type === "drive" ? "Google Drive" : "Vídeo"} · {formatDate(item.published_at)}{isRequiredToday(item) ? " · Obrigatória hoje" : ""}
                    </small>
                    {canManage && (
                      <div className="library-card-manage">
                        <ActionMenu
                          className="library-more"
                          label={`Gerenciar ${item.title}`}
                          items={[
                            ...(source.type === "youtube" && source.id && required ? [{ id: "required", icon: "eye", label: isRequiredToday(item) ? "Tirar do obrigatório de hoje" : "Obrigatório hoje", onSelect: () => void toggleRequired(item) }] : []),
                            { id: "edit", icon: "edit", label: "Editar material", onSelect: () => setEditingItem(item) },
                            { id: "remove", icon: "trash", label: "Remover material", tone: "danger", onSelect: () => setRemovingItem(item) },
                          ]}
                        />
                      </div>
                    )}
                    <h2><button type="button" onClick={() => openItem(item)}>{item.title}</button></h2>
                    {item.description && <p>{item.description}</p>}
                    <div className="library-tags">
                      {normalizeFocus(item.focus_positions).length > 0 && (
                        <em className={isForPlayer(item, ownPlayer) ? "is-for-you" : "is-focus"}>{isForPlayer(item, ownPlayer) ? "Indicado para a sua posição" : `Para ${normalizeFocus(item.focus_positions).join(" · ")}`}</em>
                      )}
                      {asArray(item.tags).map((tag) => (
                        <em key={tag}>{tag}</em>
                      ))}
                    </div>
                    <footer>
                      <span>{progressLabel}</span>
                      <button type="button" className="library-watch" onClick={() => openItem(item)}>ASSISTIR <span aria-hidden="true">→</span></button>
                    </footer>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="library-empty">
              Nenhum material publicado nesta seção.
            </div>
          )}
        </section>
        </>
      ) : (
        <LibraryTracking items={items} progress={progress} />
      )}
      {selected && (
        <LibraryPlayer
          item={selected}
          progress={progress.find(
            (row) =>
              row.item_id === selected.id && row.user_id === profile.user_id,
          )}
          close={closeItem}
          startAt={startAt}
          canManage={canManage}
          saveExtras={(patch) => saveExtras(selected, patch)}
          saveProgress={(patch) => saveProgress(selected.id, patch)}
          onExternalOpen={() => {
            const own = progress.find((row) => row.item_id === selected.id && row.user_id === profile.user_id);
            void saveProgress(selected.id, { external_open_count: Number(own?.external_open_count || 0) + 1, last_external_open_at: new Date().toISOString(), last_accessed_at: new Date().toISOString() });
          }}
        />
      )}
      {adding && canManage && <AddMaterial client={client} profile={profile} close={() => setAdding(false)} refresh={refresh} />}
      {removingItem && canManage && (
        <ConfirmDialog kicker="BIBLIOTECA" title={`Remover “${removingItem.title}”?`} confirmLabel="REMOVER" onCancel={() => setRemovingItem(null)} onConfirm={async () => { const item = removingItem; setRemovingItem(null); await removeItem(item); }}>
          Ela sai da Biblioteca para todo mundo{isRequiredToday(removingItem) ? " e das jogadas obrigatórias de hoje" : ""}. O que cada um já assistiu continua guardado, e dá para desfazer logo depois.
        </ConfirmDialog>
      )}
      {editingItem && canManage && <AddMaterial key={editingItem.id} item={editingItem} client={client} profile={profile} close={() => setEditingItem(null)} refresh={refresh} />}
    </section>
  );
}
