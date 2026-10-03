import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MotionTabs, notify } from "../../ui/motion/motion.jsx";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { ActionMenu } from "../../ui/ActionMenu.jsx";
import { SelectControl } from "../../ui/SelectControl.jsx";
import {
  LIBRARY_CATEGORIES,
  archiveLibraryItem,
  asArray,
  canManageLibrary,
  canTrackLibrary,
  categoryCover,
  libraryCategoriesOf,
  librarySource,
  libraryThumbnail,
  primaryCategory,
  progressPatch,
} from "./library-core.js";
import { LibraryTracking } from "./LibraryTracking.jsx";
import "./library.css";
import { PageHeader } from "../../ui/PageHeader.jsx";

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
const PLAYER_ICONS = {
  play: "M8 5.5v13l10.5-6.5z",
  pause: "M8 5.5v13M16 5.5v13",
  sound: "M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  mute: "M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5l5 5M21 9.5l-5 5",
  full: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
};
const PlayerIcon = ({ name }) => <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d={PLAYER_ICONS[name]} /></svg>;
const externalLabel = (type) => type === "youtube" ? "ABRIR NO YOUTUBE" : type === "drive" ? "ABRIR NO DRIVE" : "ABRIR ORIGINAL";

function LibraryPlayer({ item, progress, close, saveProgress, onExternalOpen }) {
  const source = librarySource(item.source_url);
  const targetRef = useRef(null);
  const playerRef = useRef(null);
  const intervalRef = useRef(0);
  const lastCommittedRef = useRef(-1);
  const [status, setStatus] = useState("Carregando player…");
  const [playerState, setPlayerState] = useState("loading");
  // Strix player over the YouTube IFrame API: our controls, YouTube's stream.
  const [clock, setClock] = useState({ time: 0, duration: 0, playing: false, muted: false });
  const uiTimerRef = useRef(0);
  const frameRef = useRef(null);
  const commit = (position, duration) =>
    saveProgress(progressPatch(position, duration, progress));

  useEffect(() => {
    saveProgress({
      opened_at: progress?.opened_at || new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    });
    if (source.type !== "youtube" || !source.id) return undefined;
    let alive = true;
    loadYouTubeApi().then((YT) => {
      if (!alive || !targetRef.current) return;
      playerRef.current = new YT.Player(targetRef.current, {
        videoId: source.id,
        playerVars: { rel: 0, playsinline: 1, controls: 0, modestbranding: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: (event) => {
            if (progress?.last_position_seconds)
              event.target.seekTo(progress.last_position_seconds, true);
            setPlayerState("ready");
            setStatus("Pronto para assistir");
            window.clearInterval(uiTimerRef.current);
            uiTimerRef.current = window.setInterval(() => {
              const player = event.target;
              if (!player?.getCurrentTime) return;
              setClock({ time: player.getCurrentTime(), duration: player.getDuration(), playing: player.getPlayerState() === 1, muted: player.isMuted() });
            }, 250);
          },
          onError: () => {
            setPlayerState("error");
            setStatus("Não foi possível carregar este vídeo.");
          },
          onStateChange: (event) => {
            window.clearInterval(intervalRef.current);
            if (event.data === YT.PlayerState.PLAYING) {
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
            }
          },
        },
      });
    });
    return () => {
      alive = false;
      window.clearInterval(intervalRef.current);
      window.clearInterval(uiTimerRef.current);
      const player = playerRef.current;
      if (player?.getCurrentTime)
        commit(player.getCurrentTime(), player.getDuration());
      player?.destroy?.();
    };
  }, [item.id]);

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
          </div>
          <CloseButton onClick={close} />
        </header>
        <div ref={frameRef} className={`library-player-frame is-${playerState}${source.type === "youtube" ? " is-strix-player" : ""}`}>
          {playerState === "loading" && (
            <div className="library-player-loading">
              <i />
              <span>PREPARANDO CONTEÚDO</span>
            </div>
          )}
          {source.type === "youtube" && source.id && <div ref={targetRef} />}
          {source.type === "youtube" && playerState === "ready" && <button type="button" className="strix-player-surface" aria-label={clock.playing ? "Pausar" : "Reproduzir"} onClick={() => (clock.playing ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo())}>{!clock.playing && <span><PlayerIcon name="play" /></span>}</button>}
          {source.type === "drive" && (
            <iframe
              src={source.embedUrl}
              allow="autoplay"
              title={item.title}
              onLoad={() => {
                setPlayerState("ready");
                setStatus("Pronto para assistir");
              }}
            />
          )}
          {source.type === "direct" && (
            <video
              src={source.embedUrl}
              poster={libraryThumbnail(item)}
              controls
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
                if (progress?.last_position_seconds)
                  event.currentTarget.currentTime =
                    progress.last_position_seconds;
              }}
              onPlay={() => setStatus("Reproduzindo · progresso sincronizado")}
              onPause={(event) =>
                commit(
                  event.currentTarget.currentTime,
                  event.currentTarget.duration,
                )
              }
              onTimeUpdate={(event) => {
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
        {source.type === "youtube" && playerState === "ready" && (
          <div className="strix-player-controls">
            <button type="button" onClick={() => (clock.playing ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo())} aria-label={clock.playing ? "Pausar" : "Reproduzir"}><PlayerIcon name={clock.playing ? "pause" : "play"} /></button>
            <time>{clockLabel(clock.time)}</time>
            <input type="range" min="0" max={Math.max(1, Math.floor(clock.duration))} step="1" value={Math.floor(clock.time)} aria-label="Posição do vídeo" style={{ "--played": `${clock.duration ? (clock.time / clock.duration) * 100 : 0}%` }} onChange={(event) => { const next = Number(event.target.value); playerRef.current?.seekTo(next, true); setClock((current) => ({ ...current, time: next })); }} />
            <time>{clockLabel(clock.duration)}</time>
            <button type="button" onClick={() => (clock.muted ? playerRef.current?.unMute() : playerRef.current?.mute())} aria-label={clock.muted ? "Ativar som" : "Silenciar"}><PlayerIcon name={clock.muted ? "mute" : "sound"} /></button>
            <button type="button" onClick={() => (document.fullscreenElement ? document.exitFullscreen?.() : frameRef.current?.requestFullscreen?.())} aria-label="Tela cheia"><PlayerIcon name="full" /></button>
          </div>
        )}
        <footer>
          <span className={`library-provider-note is-${source.type}`}>
            {status}
          </span>
          <div className="library-player-actions">
            <a className="secondary library-external" href={source.type === "youtube" && source.id ? `https://www.youtube.com/watch?v=${source.id}` : item.source_url} target="_blank" rel="noopener noreferrer" onClick={() => onExternalOpen?.()}>{externalLabel(source.type)} <span aria-hidden="true">↗</span></a>
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

const blankItem = {
  title: "",
  category: "jogada",
  description: "",
  thumbnail_url: "",
  source_url: "",
  tags: "",
  status: "active",
  minimum_access_tier: "player",
};
function LibraryItemModal({ client, profile, close, refresh }) {
  const [draft, setDraft] = useState(blankItem);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!canManageLibrary(profile)) return setError("Sem permissão para adicionar material.");
    const source = librarySource(draft.source_url);
    if (!draft.title.trim() || !/^https?:\/\//i.test(draft.source_url))
      return setError("Informe título e uma URL válida.");
    setBusy(true);
    setError("");
    const { error: saveError } = await client.from("library_items").insert({
      title: draft.title.trim(),
      category: draft.category,
      description: draft.description.trim(),
      thumbnail_url: draft.thumbnail_url.trim() || null,
      source_type: source.type,
      source_url: draft.source_url.trim(),
      tags: draft.tags
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      status: draft.status,
      minimum_access_tier: draft.minimum_access_tier,
      created_by: profile.user_id,
      updated_by: profile.user_id,
    });
    setBusy(false);
    if (saveError) return setError(saveError.message);
    await refresh();
    notify("Material adicionado à Biblioteca.");
    close();
  };
  return createPortal(
    <div className="library-player-layer">
      <form className="library-item-modal" onSubmit={submit}>
        <header>
          <div>
            <span>BIBLIOTECA · NOVO MATERIAL</span>
            <h2>Adicionar vídeo</h2>
            <p>YouTube, Google Drive ou arquivo MP4 direto.</p>
          </div>
          <CloseButton onClick={close} />
        </header>
        <div className="library-item-fields">
          <label>
            TÍTULO
            <input
              autoFocus
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </label>
          <label>
            TIPO
            <select
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value })
              }
            >
              <option value="jogada">Jogada</option>
              <option value="review">Review</option>
            </select>
          </label>
          <label className="full">
            DESCRIÇÃO
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          <label className="full">
            URL DO VÍDEO
            <input
              value={draft.source_url}
              onChange={(event) =>
                setDraft({ ...draft, source_url: event.target.value })
              }
              placeholder="https://youtube.com/watch?v=…"
            />
          </label>
          <label className="full">
            THUMBNAIL (OPCIONAL)
            <input
              value={draft.thumbnail_url}
              onChange={(event) =>
                setDraft({ ...draft, thumbnail_url: event.target.value })
              }
            />
          </label>
          <label>
            TAGS
            <input
              value={draft.tags}
              onChange={(event) =>
                setDraft({ ...draft, tags: event.target.value })
              }
              placeholder="pressão, saída, review"
            />
          </label>
          <label>
            ACESSO MÍNIMO
            <select
              value={draft.minimum_access_tier}
              onChange={(event) =>
                setDraft({ ...draft, minimum_access_tier: event.target.value })
              }
            >
              <option value="teste">Teste</option>
              <option value="player">Jogador</option>
              <option value="conselho">Conselho</option>
              <option value="diretoria">Diretoria</option>
            </select>
          </label>
        </div>
        {error && <p className="library-error">{error}</p>}
        <footer>
          <button type="button" className="secondary" onClick={close}>
            CANCELAR
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "SALVANDO…" : "ADICIONAR"}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}

export function LibraryPage({ client, profile }) {
  const [tab, setTab] = useState("library");
  const [shelf, setShelf] = useState("all");
  const [items, setItems] = useState([]);
  const [progress, setProgress] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canManage = canManageLibrary(profile?.access_tier);
  const canTrack = canTrackLibrary(profile?.access_tier);
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
        refresh,
      )
      .subscribe();
    return () => client.removeChannel(channel);
  }, [client, profile?.user_id]);
  const saveProgress = async (itemId, patch) => {
    const { data: current, error: readError } = await client
      .from("library_view_progress")
      .select("*")
      .eq("item_id", itemId)
      .eq("user_id", profile.user_id)
      .maybeSingle();
    if (readError) return setError(readError.message);
    const payload = current
      ? {
          ...patch,
          started_at: patch.started_at || current.started_at,
          watched_seconds: Math.max(
            Number(current.watched_seconds || 0),
            Number(patch.watched_seconds || 0),
          ),
          completed_at: current.completed_at || patch.completed_at || null,
        }
      : patch;
    const query = current
      ? client
          .from("library_view_progress")
          .update(payload)
          .eq("item_id", itemId)
          .eq("user_id", profile.user_id)
      : client
          .from("library_view_progress")
          .insert({ item_id: itemId, ...payload });
    let { error: saveError } = await query;
    const EXTRA = ["external_open_count", "last_external_open_at"];
    if (saveError && EXTRA.some((key) => key in payload) && /external_open|PGRST204|column/i.test(`${saveError.code} ${saveError.message}`)) {
      const fallback = Object.fromEntries(Object.entries(payload).filter(([key]) => !EXTRA.includes(key)));
      ({ error: saveError } = await (current
        ? client.from("library_view_progress").update(fallback).eq("item_id", itemId).eq("user_id", profile.user_id)
        : client.from("library_view_progress").insert({ item_id: itemId, ...fallback })));
    }
    if (!saveError) await refresh();
  };
  const tabs = [
    ["library", "BIBLIOTECA"],
    ...(canTrack ? [["tracking", "ACOMPANHAMENTO"]] : []),
  ];
  const shelfOptions = [["all", "Todas as categorias"], ...LIBRARY_CATEGORIES.filter((category) => items.some((item) => libraryCategoriesOf(item).includes(category.id))).map((category) => [category.id, category.label])];
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
      {error && <p className="library-error">{error}</p>}
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
                  <LibraryCover key={`${item.id}-${item.thumbnail_url || ""}`} item={item} open={() => setSelected(item)}/>
                  <div className="library-editorial-copy">
                    <small>
                      {source.type === "youtube" ? "YouTube" : source.type === "drive" ? "Google Drive" : "Vídeo"} · {formatDate(item.published_at)}
                    </small>
                    {canManage && (
                      <div className="library-card-manage">
                        <ActionMenu
                          className="library-more"
                          label={`Gerenciar ${item.title}`}
                          items={[{ id: "remove", icon: "trash", label: "Remover material", tone: "danger", onSelect: () => setPendingRemove(item) }]}
                        />
                      </div>
                    )}
                    <h2><button type="button" onClick={() => setSelected(item)}>{item.title}</button></h2>
                    {item.description && <p>{item.description}</p>}
                    <div className="library-tags">
                      {asArray(item.tags).map((tag) => (
                        <em key={tag}>{tag}</em>
                      ))}
                    </div>
                    <footer>
                      <span>{progressLabel}</span>
                      <button type="button" className="library-watch" onClick={() => setSelected(item)}>ASSISTIR <span aria-hidden="true">↗</span></button>
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
          close={() => setSelected(null)}
          saveProgress={(patch) => saveProgress(selected.id, patch)}
          onExternalOpen={() => {
            const own = progress.find((row) => row.item_id === selected.id && row.user_id === profile.user_id);
            void saveProgress(selected.id, { external_open_count: Number(own?.external_open_count || 0) + 1, last_external_open_at: new Date().toISOString(), last_accessed_at: new Date().toISOString() });
          }}
        />
      )}{" "}
      {pendingRemove && createPortal(
        <div className="library-player-layer" onMouseDown={(event) => event.target === event.currentTarget && setPendingRemove(null)}>
          <section className="library-item-modal" role="alertdialog" aria-modal="true" aria-labelledby="library-remove-title">
            <header>
              <div>
                <span>BIBLIOTECA</span>
                <h2 id="library-remove-title">Remover {pendingRemove.title}?</h2>
                <p>O material sai da Biblioteca publicada. O histórico de acompanhamento permanece.</p>
              </div>
              <CloseButton onClick={() => setPendingRemove(null)} />
            </header>
            <footer>
              <button type="button" className="secondary" onClick={() => setPendingRemove(null)}>CANCELAR</button>
              <button type="button" className="primary" onClick={async () => {
                try {
                  await archiveLibraryItem(client, profile, pendingRemove);
                  notify("Material removido da Biblioteca.");
                  setPendingRemove(null);
                  await refresh();
                } catch (cause) {
                  notify(cause.message || "Não foi possível remover o material.", "error");
                }
              }}>REMOVER</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </section>
  );
}
