import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MotionTabs, notify } from "../../ui/motion/motion.jsx";
import {
  asArray,
  canManageLibrary,
  canTrackLibrary,
  librarySource,
  progressPatch,
} from "./library-core.js";
import "./library.css";

const formatDate = (value) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "—";
const formatTime = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};

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
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

function LibraryPlayer({ item, progress, close, saveProgress }) {
  const source = librarySource(item.source_url);
  const targetRef = useRef(null);
  const playerRef = useRef(null);
  const intervalRef = useRef(0);
  const lastCommittedRef = useRef(-1);
  const [status, setStatus] = useState(source.trackable ? "Pronto para reproduzir" : "Aberto · progresso limitado pelo provider");
  const commit = (position, duration) => saveProgress(progressPatch(position, duration, progress));

  useEffect(() => {
    saveProgress({ opened_at: progress?.opened_at || new Date().toISOString(), last_accessed_at: new Date().toISOString() });
    if (source.type !== "youtube" || !source.id) return undefined;
    let alive = true;
    loadYouTubeApi().then((YT) => {
      if (!alive || !targetRef.current) return;
      playerRef.current = new YT.Player(targetRef.current, {
        videoId: source.id,
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: (event) => {
            if (progress?.last_position_seconds) event.target.seekTo(progress.last_position_seconds, true);
            setStatus("Pronto para reproduzir");
          },
          onStateChange: (event) => {
            window.clearInterval(intervalRef.current);
            if (event.data === YT.PlayerState.PLAYING) {
              setStatus("Reproduzindo · progresso sincronizado");
              intervalRef.current = window.setInterval(() => {
                commit(event.target.getCurrentTime(), event.target.getDuration());
              }, 5000);
            } else if ([YT.PlayerState.PAUSED, YT.PlayerState.ENDED].includes(event.data)) {
              commit(event.target.getCurrentTime(), event.target.getDuration());
              setStatus(event.data === YT.PlayerState.ENDED ? "Concluído" : "Pausado");
            }
          },
        },
      });
    });
    return () => {
      alive = false;
      window.clearInterval(intervalRef.current);
      const player = playerRef.current;
      if (player?.getCurrentTime) commit(player.getCurrentTime(), player.getDuration());
      player?.destroy?.();
    };
  }, [item.id]);

  return createPortal(
    <div className="library-player-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="library-player-dialog" role="dialog" aria-modal="true" aria-label={item.title}>
        <header><div><span>{item.category === "jogada" ? "JOGADA" : "REVIEW"}</span><h2>{item.title}</h2><p>{item.description || "Material do Strix FC27."}</p></div><button type="button" onClick={close} aria-label="Fechar">×</button></header>
        <div className="library-player-frame">
          {source.type === "youtube" && source.id && <div ref={targetRef} />}
          {source.type === "drive" && <iframe src={source.embedUrl} allow="autoplay" title={item.title} />}
          {source.type === "direct" && <video
            src={source.embedUrl}
            poster={item.thumbnail_url || undefined}
            controls
            playsInline
            onLoadedMetadata={(event) => { if (progress?.last_position_seconds) event.currentTarget.currentTime = progress.last_position_seconds; }}
            onPlay={() => setStatus("Reproduzindo · progresso sincronizado")}
            onPause={(event) => commit(event.currentTarget.currentTime, event.currentTarget.duration)}
            onTimeUpdate={(event) => {
              const bucket = Math.floor(event.currentTarget.currentTime / 5);
              if (bucket !== lastCommittedRef.current) {
                lastCommittedRef.current = bucket;
                commit(event.currentTarget.currentTime, event.currentTarget.duration);
              }
            }}
            onEnded={(event) => { commit(event.currentTarget.duration, event.currentTarget.duration); setStatus("Concluído"); }}
          />}
        </div>
        <footer><span className={`library-provider-note is-${source.type}`}>{status}</span>{source.type === "drive" && <small>O player do Drive não expõe tempo real ao FC27; registramos abertura e último acesso.</small>}<button type="button" className="secondary" onClick={close}>FECHAR</button></footer>
      </section>
    </div>,
    document.body,
  );
}

const blankItem = { title: "", category: "jogada", description: "", thumbnail_url: "", source_url: "", tags: "", status: "active", minimum_access_tier: "player" };
function LibraryItemModal({ client, profile, close, refresh }) {
  const [draft, setDraft] = useState(blankItem);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    const source = librarySource(draft.source_url);
    if (!draft.title.trim() || !/^https?:\/\//i.test(draft.source_url)) return setError("Informe título e uma URL válida.");
    setBusy(true); setError("");
    const { error: saveError } = await client.from("library_items").insert({
      title: draft.title.trim(), category: draft.category, description: draft.description.trim(),
      thumbnail_url: draft.thumbnail_url.trim() || null, source_type: source.type, source_url: draft.source_url.trim(),
      tags: draft.tags.split(",").map((value) => value.trim()).filter(Boolean), status: draft.status,
      minimum_access_tier: draft.minimum_access_tier, created_by: profile.user_id, updated_by: profile.user_id,
    });
    setBusy(false);
    if (saveError) return setError(saveError.message);
    await refresh(); notify("Material adicionado à Biblioteca."); close();
  };
  return createPortal(<div className="library-player-layer"><form className="library-item-modal" onSubmit={submit}><header><div><span>BIBLIOTECA · NOVO MATERIAL</span><h2>Adicionar vídeo</h2><p>YouTube, Google Drive ou arquivo MP4 direto.</p></div><button type="button" onClick={close}>×</button></header><div className="library-item-fields"><label>TÍTULO<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></label><label>TIPO<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="jogada">Jogada</option><option value="review">Review</option></select></label><label className="full">DESCRIÇÃO<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label><label className="full">URL DO VÍDEO<input value={draft.source_url} onChange={(event) => setDraft({ ...draft, source_url: event.target.value })} placeholder="https://youtube.com/watch?v=…"/></label><label className="full">THUMBNAIL (OPCIONAL)<input value={draft.thumbnail_url} onChange={(event) => setDraft({ ...draft, thumbnail_url: event.target.value })}/></label><label>TAGS<input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="pressão, saída, review"/></label><label>ACESSO MÍNIMO<select value={draft.minimum_access_tier} onChange={(event) => setDraft({ ...draft, minimum_access_tier: event.target.value })}><option value="teste">Teste</option><option value="player">Jogador</option><option value="conselho">Conselho</option><option value="diretoria">Diretoria</option></select></label></div>{error && <p className="library-error">{error}</p>}<footer><button type="button" className="secondary" onClick={close}>CANCELAR</button><button className="primary" disabled={busy}>{busy ? "SALVANDO…" : "ADICIONAR"}</button></footer></form></div>, document.body);
}

export function LibraryPage({ client, profile }) {
  const [tab, setTab] = useState("plays");
  const [items, setItems] = useState([]);
  const [progress, setProgress] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canManage = canManageLibrary(profile?.access_tier);
  const canTrack = canTrackLibrary(profile?.access_tier);
  const refresh = async () => {
    const [itemsResult, progressResult] = await Promise.all([
      client.from("library_items").select("*").order("published_at", { ascending: false }),
      client.from("library_view_progress").select("*").order("last_accessed_at", { ascending: false }),
    ]);
    const missing = ["42P01", "PGRST205"].includes(itemsResult.error?.code);
    setItems(asArray(itemsResult.data)); setProgress(asArray(progressResult.data)); setLoading(false);
    setError(missing ? "A migration da Biblioteca ainda não foi aplicada." : itemsResult.error?.message || progressResult.error?.message || "");
  };
  useEffect(() => { void refresh(); const channel = client.channel("fc27-library").on("postgres_changes", { event: "*", schema: "public", table: "library_items" }, refresh).on("postgres_changes", { event: "*", schema: "public", table: "library_view_progress" }, refresh).subscribe(); return () => client.removeChannel(channel); }, [client, profile?.user_id]);
  const saveProgress = async (itemId, patch) => {
    const { data: current, error: readError } = await client.from("library_view_progress").select("*").eq("item_id", itemId).eq("user_id", profile.user_id).maybeSingle();
    if (readError) return setError(readError.message);
    const payload = current ? {
      ...patch,
      started_at: patch.started_at || current.started_at,
      watched_seconds: Math.max(Number(current.watched_seconds || 0), Number(patch.watched_seconds || 0)),
      completed_at: current.completed_at || patch.completed_at || null,
    } : patch;
    const query = current
      ? client.from("library_view_progress").update(payload).eq("item_id", itemId).eq("user_id", profile.user_id)
      : client.from("library_view_progress").insert({ item_id: itemId, ...payload });
    const { error: saveError } = await query;
    if (!saveError) await refresh();
  };
  const tabs = [["plays", "JOGADAS"], ["reviews", "REVIEWS"], ...(canTrack ? [["tracking", "ACOMPANHAMENTO"]] : [])];
  const visibleItems = items.filter((item) => tab === "plays" ? item.category === "jogada" : tab === "reviews" ? item.category === "review" : true);
  const trackingRows = useMemo(() => progress.map((row) => ({ ...row, item: items.find((item) => item.id === row.item_id) })).filter((row) => row.item), [progress, items]);
  return <section className="data-page page-enter library-v2"><header className="data-page-header"><div><span>BIBLIOTECA FC27</span><h1>Jogadas e reviews.</h1><p>Conteúdo do time com progresso real quando o provider permite.</p></div>{canManage && <button className="primary" onClick={() => setAdding(true)}>+ ADICIONAR MATERIAL</button>}</header><MotionTabs className="library-tabs" items={tabs} active={tab} onChange={setTab} label="Seções da Biblioteca"/>{error && <p className="library-error">{error}</p>}{loading ? <div className="library-empty">Carregando Biblioteca…</div> : tab !== "tracking" ? <section className="library-grid">{visibleItems.length ? visibleItems.map((item) => { const own = progress.find((row) => row.item_id === item.id && row.user_id === profile.user_id); const source = librarySource(item.source_url); return <article key={item.id}><button className="library-cover" onClick={() => setSelected(item)}>{item.thumbnail_url ? <img src={item.thumbnail_url} alt=""/> : <span>{item.category === "jogada" ? "JOGADA" : "REVIEW"}</span>}<i>▶</i></button><div><small>{source.type.toUpperCase()} · {formatDate(item.published_at)}</small><h2>{item.title}</h2><p>{item.description || "Sem descrição."}</p><div className="library-tags">{asArray(item.tags).map((tag) => <em key={tag}>{tag}</em>)}</div><footer><span>{own ? `${Math.round(own.progress_percent)}% · ${formatTime(own.last_position_seconds)}` : "Ainda não aberto"}</span>{!source.trackable && <b>TRACKING LIMITADO</b>}</footer></div></article>; }) : <div className="library-empty">Nenhum material publicado nesta seção.</div>}</section> : <section className="library-tracking"><header><span>MEMBRO</span><span>MATERIAL</span><span>PROGRESSO</span><span>ÚLTIMO ACESSO</span></header>{trackingRows.length ? trackingRows.map((row) => <article key={`${row.item_id}-${row.user_id}`}><b>{row.viewer_display_name}</b><span>{row.item.title}<small>{row.item.source_type}</small></span><strong>{Math.round(row.progress_percent)}%<i style={{ "--progress": `${row.progress_percent}%` }}/></strong><time>{formatDate(row.last_accessed_at)}</time></article>) : <div className="library-empty">Ainda não há acompanhamento registrado.</div>}</section>}{selected && <LibraryPlayer item={selected} progress={progress.find((row) => row.item_id === selected.id && row.user_id === profile.user_id)} close={() => setSelected(null)} saveProgress={(patch) => saveProgress(selected.id, patch)}/>} {adding && <LibraryItemModal client={client} profile={profile} close={() => setAdding(false)} refresh={refresh}/>}</section>;
}
