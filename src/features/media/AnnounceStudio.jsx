import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MotionTabs, notify, useReducedMotion } from "../../ui/motion/motion.jsx";
import { SelectControl } from "../../ui/SelectControl.jsx";
import {
  ANNOUNCE_CACHE_DAY,
  ANNOUNCE_ROLES,
  ANNOUNCE_TEMPLATE_ID,
  ANNOUNCE_TITLES,
  applyAnnounceRoles,
  collectAnnouncePeople,
  isStructureRole,
  pickAnnouncePhrase,
  phrasesForPerson,
  readStoredAnnounceRoles,
  resolveAnnouncePhrase,
  writeStoredAnnounceRoles,
} from "./announce-core.js";
import { announceFrameTime, renderAnnounceFrame } from "./announce-frame.js";
import { buildAnnounceTimeline } from "./announce-timeline.js";
import { loadAnnounceAssets } from "./media-assets.js";
import {
  downloadBlob,
  listCachedRenders,
  progressLabel,
  startAnnounceRender,
  subscribeMediaJob,
} from "./media-jobs.js";
import "./announce.css";

const ROLE_OPTIONS = Object.values(ANNOUNCE_ROLES).map((role) => [role.id, role.label.toUpperCase()]);
const TYPE_OPTIONS = [
  ["jogador", "JOGADOR"],
  ["retorno", "RETORNO"],
  ["renovacao", "RENOVAÇÃO"],
  ["staff", "STAFF"],
  ["diretoria", "DIRETORIA"],
  ["conselho", "CONSELHO"],
  ["manager", "MANAGER"],
];

function PreviewCanvas({ timeline, assets, format, label }) {
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
      const timeSec = announceFrameTime(frameRef.current % timeline.totalFrames, timeline);
      renderAnnounceFrame(ctx, { timeline, timeSec, assets });
      if (!reduced && !paused && !timeline.still && !document.hidden) {
        frameRef.current += 1;
        raf = requestAnimationFrame(tick);
      }
    };
    const visibility = () => { cancelAnimationFrame(raf); if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", visibility);
    tick();
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", visibility); };
  }, [assets, format, timeline, reduced, paused]);
  return (
    <div className="media-preview-stage">
      <canvas
        ref={canvasRef}
        width={timeline.width}
        height={timeline.height}
        className={format === "feed" ? "is-feed" : ""}
        aria-label={label}
      />
      {!reduced && !timeline.still && (
        <button type="button" className="media-playback" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
          {paused ? "Reproduzir preview" : "Pausar preview"}
        </button>
      )}
    </div>
  );
}

function isImageRecord(record) {
  return record?.mime === "image/png" || String(record?.fileName || "").endsWith(".png") || record?.blob?.type === "image/png";
}

function Viewer({ record, close }) {
  const dialogRef = useRef(null);
  const url = useMemo(() => (record?.blob ? URL.createObjectURL(record.blob) : ""), [record]);
  const image = isImageRecord(record);
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
    <dialog ref={dialogRef} className="media-viewer" aria-label="Visualizar anúncio gerado" onCancel={(event) => { event.preventDefault(); close(); }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section>
        <header>
          <span>{image ? "POST PRONTO" : "REELS PRONTO"}</span>
          <h2>{record.fileName}</h2>
        </header>
        {image ? <img src={url} alt={record.fileName} /> : <video src={url} controls autoPlay playsInline />}
        <div className="media-inline-actions">
          <button type="button" className="primary" onClick={() => downloadBlob(record.blob, record.fileName)}>
            {image ? "BAIXAR PNG" : "BAIXAR MP4"}
          </button>
          <button type="button" className="secondary" onClick={close}>FECHAR</button>
        </div>
      </section>
    </dialog>,
    document.body,
  );
}

function moveItem(ids, index, offset) {
  const next = [...ids];
  const target = index + offset;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function AnnounceStudio({ workspace }) {
  const [kind, setKind] = useState("individual");
  const [format, setFormat] = useState("story");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [roles, setRoles] = useState(() => readStoredAnnounceRoles());
  const [selectedIds, setSelectedIds] = useState([]);
  const [announceType, setAnnounceType] = useState("jogador");
  const [phraseId, setPhraseId] = useState("");
  const [customPhrase, setCustomPhrase] = useState("");
  const [title, setTitle] = useState("ELENCO FC 27");
  const [assets, setAssets] = useState(null);
  const [job, setJob] = useState(null);
  const [cache, setCache] = useState([]);
  const [history, setHistory] = useState([]);
  const [viewer, setViewer] = useState(null);
  const dragIndex = useRef(null);

  const people = useMemo(
    () => applyAnnounceRoles(collectAnnouncePeople(workspace, roles), roles),
    [workspace, roles],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return people.filter((person) => {
      if (groupFilter === "players" && isStructureRole(person.extraRole)) return false;
      if (groupFilter === "structure" && !isStructureRole(person.extraRole)) return false;
      if (["GOL", "DEF", "MEI", "ATA"].includes(groupFilter) && person.group !== groupFilter) return false;
      if (!needle) return true;
      return [person.name, person.nick, person.position, person.extraBadge]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(needle);
    });
  }, [people, query, groupFilter]);

  const selected = useMemo(() => {
    const byId = new Map(people.map((person) => [person.id, person]));
    if (kind === "individual") {
      const person = byId.get(selectedIds[0]) || filtered[0] || people[0];
      return person ? [person] : [];
    }
    return selectedIds.map((id) => byId.get(id)).filter(Boolean);
  }, [people, selectedIds, kind, filtered]);

  const phrase = useMemo(() => {
    if (kind !== "individual" || !selected[0]) return { id: "", text: "", source: "auto" };
    return resolveAnnouncePhrase(selected[0], {
      type: announceType,
      phraseId,
      custom: customPhrase,
    });
  }, [kind, selected, announceType, phraseId, customPhrase]);

  const timeline = useMemo(() => buildAnnounceTimeline({
    kind,
    format,
    people: selected,
    phrase: phrase.text,
    title,
    announceType,
  }), [kind, format, selected, phrase.text, title, announceType]);

  const fingerprintKey = selected.map((person) => person.id).join(",");

  useEffect(() => {
    return subscribeMediaJob(setJob);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAnnounceAssets(selected).then((result) => {
      if (!cancelled) setAssets(result);
    });
    return () => { cancelled = true; };
  }, [fingerprintKey]);

  const refreshCache = () => {
    listCachedRenders(ANNOUNCE_CACHE_DAY, { template: ANNOUNCE_TEMPLATE_ID }).then(setCache);
  };

  useEffect(() => { refreshCache(); }, []);

  useEffect(() => {
    if (job?.status === "ready" && job.result?.template === ANNOUNCE_TEMPLATE_ID) {
      setHistory((current) => {
        const next = [job.result, ...current.filter((item) => item.id !== job.result.id)];
        return next.slice(0, 6);
      });
      refreshCache();
    }
  }, [job?.status, job?.result?.id]);

  const setRole = (id, role) => {
    const next = { ...roles, [id]: role };
    setRoles(next);
    writeStoredAnnounceRoles(next);
  };

  const toggleSelected = (id) => {
    if (kind === "individual") {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };

  const selectFiltered = (predicate) => {
    setSelectedIds(filtered.filter(predicate).map((person) => person.id));
  };

  const shufflePhrase = () => {
    if (!selected[0]) return;
    const next = pickAnnouncePhrase(selected[0], { type: announceType, currentId: phrase.id });
    setPhraseId(next.id);
    setCustomPhrase("");
  };

  const generate = async (force = false) => {
    if (!selected.length || job?.status === "running") return;
    const next = await startAnnounceRender({
      kind,
      format,
      people: selected,
      phrase: phrase.text,
      phraseId: phrase.id,
      title,
      announceType,
      timeline,
      force,
    });
    if (next.status === "error") notify(next.error || "Não foi possível gerar o anúncio.", "error");
    else if (next.status === "ready") notify(format === "feed" ? "Post gerado." : "Reels gerado.");
  };

  const running = job?.status === "running";
  const ratio = Number.isFinite(job?.progress?.ratio)
    ? job.progress.ratio
    : (job?.progress?.total ? job.progress.loaded / job.progress.total : null);
  const readyRecord = job?.result && job.fingerprint
    ? job.result
    : cache.find((row) => row.format === format) || history[0] || null;

  return (
    <section className="announce-studio">
      <header className="media-hero">
        <div>
          <span>ANÚNCIOS FC 27</span>
          <h1>Central de anúncio da temporada.</h1>
          <p>Peças individuais e do plantel, em Reels e Post, a partir do elenco oficial do Strix.</p>
        </div>
        <div className="media-hero-meta">
          <span>{kind === "team" ? "TIME" : "INDIVIDUAL"} · {format === "feed" ? "POST 4:5" : "REELS 9:16"}</span>
          <b>{String(selected.length).padStart(2, "0")}</b>
          <small>{selected.length === 1 ? "nome na peça" : "nomes na peça"}</small>
        </div>
      </header>

      <div className="announce-controls">
        <MotionTabs
          className="media-tabs"
          items={[["individual", "INDIVIDUAL"], ["team", "TIME"]]}
          active={kind}
          onChange={(value) => {
            setKind(value);
            setSelectedIds((current) => (value === "individual" ? current.slice(0, 1) : current));
          }}
          label="Gerador"
        />
        <MotionTabs
          className="media-tabs"
          items={[["story", "REELS 9:16"], ["feed", "POST 4:5"]]}
          active={format}
          onChange={setFormat}
          label="Formato"
        />
      </div>

      <div className="media-layout announce-layout">
        <aside className="media-side announce-side">
          <h2>Elenco e estrutura</h2>
          <label className="announce-search">
            <span>BUSCAR</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, nick ou posição" />
          </label>
          <div className="announce-filters">
            {[
              ["all", "TODOS"],
              ["players", "JOGADORES"],
              ["structure", "ESTRUTURA"],
              ["GOL", "GOL"],
              ["DEF", "DEF"],
              ["MEI", "MEI"],
              ["ATA", "ATA"],
            ].map(([id, label]) => (
              <button key={id} type="button" className={groupFilter === id ? "is-active" : ""} onClick={() => setGroupFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          {kind === "team" && (
            <div className="announce-bulk">
              <button type="button" className="secondary" onClick={() => selectFiltered(() => true)}>SELECIONAR TODOS</button>
              <button type="button" className="secondary" onClick={() => selectFiltered((person) => !isStructureRole(person.extraRole))}>SÓ JOGADORES</button>
              <button type="button" className="secondary" onClick={() => selectFiltered((person) => isStructureRole(person.extraRole))}>SÓ ESTRUTURA</button>
              <button type="button" className="secondary" onClick={() => setSelectedIds([])}>LIMPAR</button>
            </div>
          )}
          <ul className="announce-people">
            {filtered.map((person) => {
              const on = selected.some((item) => item.id === person.id);
              const order = selectedIds.indexOf(person.id);
              return (
                <li
                  key={person.id}
                  className={on ? "is-selected" : ""}
                  draggable={kind === "team" && on}
                  onDragStart={() => { dragIndex.current = selectedIds.indexOf(person.id); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    const from = dragIndex.current;
                    const to = selectedIds.indexOf(person.id);
                    if (from < 0 || to < 0 || from === to) return;
                    setSelectedIds(moveItem(selectedIds, from, to - from));
                  }}
                >
                  <button type="button" className="announce-person" onClick={() => toggleSelected(person.id)}>
                    <b>{person.name}</b>
                    <small>{[person.position, person.extraBadge || ANNOUNCE_ROLES[person.extraRole]?.label].filter(Boolean).join(" · ")}</small>
                  </button>
                  <SelectControl
                    label="Função extra"
                    value={person.extraRole}
                    options={ROLE_OPTIONS}
                    onChange={(value) => setRole(person.id, value)}
                  />
                  {kind === "team" && on && (
                    <div className="announce-order">
                      <span>{String(order + 1).padStart(2, "0")}</span>
                      <button type="button" aria-label="Subir" onClick={() => setSelectedIds(moveItem(selectedIds, order, -1))}>↑</button>
                      <button type="button" aria-label="Descer" onClick={() => setSelectedIds(moveItem(selectedIds, order, 1))}>↓</button>
                    </div>
                  )}
                </li>
              );
            })}
            {!filtered.length && <li className="announce-empty">Nenhum nome encontrado no elenco ativo.</li>}
          </ul>
          {kind === "individual" ? (
            <div className="announce-phrase">
              <SelectControl label="Tipo do anúncio" value={announceType} options={TYPE_OPTIONS} onChange={(value) => { setAnnounceType(value); setPhraseId(""); }} />
              <SelectControl
                label="Frase"
                value={phrasesForPerson(selected[0], announceType).some((item) => item.id === (phraseId || phrase.id)) ? (phraseId || phrase.id) : (phrasesForPerson(selected[0], announceType)[0]?.id || "")}
                options={phrasesForPerson(selected[0], announceType).map((item) => [item.id, item.text])}
                onChange={(value) => { setPhraseId(value); setCustomPhrase(""); }}
              />
              <div className="announce-phrase-actions">
                <button type="button" className="secondary" onClick={shufflePhrase}>SORTEAR OUTRA</button>
              </div>
              <label className="announce-search">
                <span>EDITAR FRASE</span>
                <textarea value={customPhrase} onChange={(event) => setCustomPhrase(event.target.value)} rows={3} placeholder={phrase.text} />
              </label>
            </div>
          ) : (
            <SelectControl
              label="Título da peça"
              value={title}
              options={ANNOUNCE_TITLES.map((item) => [item, item])}
              onChange={setTitle}
            />
          )}
        </aside>

        <article className="media-preview-card">
          <header>
            <span>PREVIEW</span>
            <h2>{format === "feed" ? "Post 1080×1350" : "Reels 1080×1920"}</h2>
          </header>
          <div className={`media-preview-frame ${format === "feed" ? "is-feed" : ""} ${selected.length ? "" : "is-empty"}`}>
            {selected.length && assets && timeline.totalFrames ? (
              <PreviewCanvas
                timeline={timeline}
                assets={assets}
                format={format}
                label="Preview do anúncio FC 27"
              />
            ) : (
              <p>Selecione ao menos uma pessoa do elenco para ver o anúncio.</p>
            )}
          </div>
          <div className="media-actions">
            <button type="button" className="primary" disabled={!selected.length || running} onClick={() => generate(false)}>
              {format === "feed" ? "GERAR PNG" : "GERAR MP4"}
            </button>
            <button type="button" className="secondary" disabled={!readyRecord} onClick={() => readyRecord && setViewer(readyRecord)}>
              VISUALIZAR
            </button>
            <button type="button" className="secondary" disabled={!readyRecord} onClick={() => readyRecord && downloadBlob(readyRecord.blob, readyRecord.fileName)}>
              {format === "feed" ? "BAIXAR PNG" : "BAIXAR MP4"}
            </button>
            <button type="button" className="secondary" disabled={!selected.length || running} onClick={() => generate(true)}>
              GERAR NOVAMENTE
            </button>
          </div>
          {running && (
            <div className="media-progress">
              <b>{progressLabel(job.progress) || "Gerando anúncio"}</b>
              <i><em style={{ transform: `scaleX(${determinateScale(ratio)})` }} /></i>
            </div>
          )}
          {job?.status === "error" && <p className="media-error">{job.error}</p>}
          <section className="media-cache">
            <h2>Últimas gerações</h2>
            {(history.length ? history : cache.slice(0, 6)).map((record) => (
              <article key={record.id}>
                <small>{isImageRecord(record) ? "POST" : "REELS"}</small>
                <p>{record.fileName}</p>
                <div className="media-inline-actions">
                  <button type="button" className="secondary" onClick={() => setViewer(record)}>VISUALIZAR</button>
                  <button type="button" className="secondary" onClick={() => downloadBlob(record.blob, record.fileName)}>BAIXAR</button>
                </div>
              </article>
            ))}
            {!history.length && !cache.length && <p>Nenhum anúncio gerado nesta sessão.</p>}
          </section>
        </article>
      </div>
      {viewer && <Viewer record={viewer} close={() => setViewer(null)} />}
    </section>
  );
}

function determinateScale(ratio) {
  if (!Number.isFinite(ratio)) return 0.15;
  return Math.max(0.04, Math.min(1, ratio));
}
