import React, { useEffect, useMemo, useRef, useState } from "react";
import { RollingLabel, notify, useReducedMotion } from "../../ui/motion/motion.jsx";
import { SelectControl } from "../../ui/SelectControl.jsx";
import {
  ANNOUNCE_CACHE_DAY,
  ANNOUNCE_ROLES,
  ANNOUNCE_TEMPLATE_ID,
  ANNOUNCE_TITLES,
  applyAnnounceRoles,
  clearStoredAnnounceRoles,
  collectAnnouncePeople,
  isStructureRole,
  pickAnnouncePhrase,
  phrasesForPerson,
  readAnnounceDraft,
  readStoredAnnounceRoles,
  resolveAnnouncePhrase,
  writeAnnounceDraft,
} from "./announce-core.js";
import { announceFrameTime, renderAnnounceFrame } from "./announce-frame.js";
import { buildAnnounceTimeline } from "./announce-timeline.js";
import { loadAnnounceAssets } from "./media-assets.js";
import { withMediaLook } from "./media-look.js";
import { downloadBlob, listCachedRenders, startAnnounceRender } from "./media-jobs.js";
import { MEDIA_FORMAT_LABELS, mediaGenerateLabel, resolveMediaOutput } from "./media-renderer.js";
import { STATIC_MEDIA_V2_CANVAS } from "./static-media-v2-core.js";
import { STATIC_MEDIA_V2_TEMPLATE_REGISTRY } from "./static-media-v2-templates.js";
import { StaticMediaV2Canvas } from "./StaticMediaV2Canvas.jsx";
import { exportStaticMediaV2Png } from "./static-media-v2-export.js";
import {
  ArchiveList,
  FormatGroup,
  MediaNotice,
  MediaToolbar,
  MediaWorkspace,
  Options,
  PieceActions,
  PreviewCanvas,
  PreviewStage,
  RailBlock,
  StageEmpty,
  StageLoading,
  StageResult,
  ToolbarFact,
  jobPercent,
  ToolbarGroup,
  isImageRecord,
  recordToArchiveItem,
} from "./MediaShell.jsx";
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
const CONTENT_ITEMS = [["individual", "INDIVIDUAL"], ["team", "TIME"], ["seletiva", "SELETIVA"]];
const SELETIVA = Object.values(STATIC_MEDIA_V2_TEMPLATE_REGISTRY)[0];
const pad = (value) => String(value).padStart(2, "0");

const Chevron = ({ up = false }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d={up ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function moveItem(ids, index, offset) {
  const next = [...ids];
  const target = index + offset;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function AnnounceStudio({ workspace, look, job, running, openViewer }) {
  const draft = useMemo(() => readAnnounceDraft() || {}, []);
  const [kind, setKind] = useState(draft.kind === "team" ? "team" : "individual");
  const [format, setFormat] = useState(draft.format === "feed" ? "feed" : "story");
  const [query, setQuery] = useState(draft.query || "");
  const [groupFilter, setGroupFilter] = useState(draft.groupFilter || "all");
  const [pendingRoles, setPendingRoles] = useState({});
  const [selectedIds, setSelectedIds] = useState(Array.isArray(draft.selectedIds) ? draft.selectedIds : []);
  const [announceType, setAnnounceType] = useState(draft.announceType || "jogador");
  const [phraseId, setPhraseId] = useState(draft.phraseId || "");
  const [customPhrase, setCustomPhrase] = useState(draft.customPhrase || "");
  const [title, setTitle] = useState(draft.title || "ELENCO FC 27");
  const [usedPhraseIds, setUsedPhraseIds] = useState(Array.isArray(draft.usedPhraseIds) ? draft.usedPhraseIds : []);
  const [assets, setAssets] = useState(null);
  const [cache, setCache] = useState([]);
  const [result, setResult] = useState(null);
  const dragIndex = useRef(null);
  const migrated = useRef(false);
  const isSeletiva = kind === "seletiva";
  const pieceKind = isSeletiva ? "individual" : kind;

  const people = useMemo(() => applyAnnounceRoles(collectAnnouncePeople(workspace), pendingRoles), [workspace, pendingRoles]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return people.filter((person) => {
      if (groupFilter === "players" && isStructureRole(person.extraRole)) return false;
      if (groupFilter === "structure" && !isStructureRole(person.extraRole)) return false;
      if (["GOL", "DEF", "MEI", "ATA"].includes(groupFilter) && person.group !== groupFilter) return false;
      if (!needle) return true;
      return [person.name, person.nick, person.position, person.extraBadge].join(" ").toLocaleLowerCase("pt-BR").includes(needle);
    });
  }, [people, query, groupFilter]);

  const selected = useMemo(() => {
    const byId = new Map(people.map((person) => [person.id, person]));
    if (pieceKind === "individual") {
      const person = byId.get(selectedIds[0]) || filtered[0] || people[0];
      return person ? [person] : [];
    }
    return selectedIds.map((id) => byId.get(id)).filter(Boolean);
  }, [people, selectedIds, pieceKind, filtered]);

  const phrase = useMemo(() => {
    if (pieceKind !== "individual" || !selected[0]) return { id: "", text: "", source: "auto" };
    return resolveAnnouncePhrase(selected[0], { type: announceType, phraseId, custom: customPhrase, usedIds: usedPhraseIds });
  }, [pieceKind, selected, announceType, phraseId, customPhrase, usedPhraseIds]);

  const timeline = useMemo(() => withMediaLook(buildAnnounceTimeline({
    kind: pieceKind, format, people: selected, phrase: phrase.text, title, announceType,
  }), look), [pieceKind, format, selected, phrase.text, title, announceType, look]);

  const fingerprintKey = selected.map((person) => person.id).join(",");
  const pieceKey = `announce:${pieceKind}:${format}:${look}:${fingerprintKey}:${phrase.id}`;
  useEffect(() => { setResult(null); }, [pieceKey]);

  useEffect(() => {
    if (isSeletiva) return undefined;
    let cancelled = false;
    setAssets(null);
    loadAnnounceAssets(selected).then((result) => { if (!cancelled) setAssets(result); });
    return () => { cancelled = true; };
  }, [fingerprintKey, isSeletiva]);

  useEffect(() => {
    let alive = true;
    listCachedRenders(ANNOUNCE_CACHE_DAY, { template: ANNOUNCE_TEMPLATE_ID }).then((rows) => { if (alive) setCache(rows); });
    return () => { alive = false; };
  }, [job?.status, job?.result?.id]);

  useEffect(() => {
    writeAnnounceDraft({
      kind: pieceKind, format, query, groupFilter, selectedIds, announceType, phraseId, customPhrase, title, usedPhraseIds,
    });
  }, [pieceKind, format, query, groupFilter, selectedIds, announceType, phraseId, customPhrase, title, usedPhraseIds]);

  useEffect(() => {
    if (migrated.current) return undefined;
    const legacy = readStoredAnnounceRoles();
    const entries = Object.entries(legacy).filter(([, role]) => role && role !== "jogador");
    if (entries.length) setPendingRoles((current) => ({ ...Object.fromEntries(entries), ...current }));
    if (!workspace?.saveStructureRole || !entries.length) return undefined;
    migrated.current = true;
    Promise.allSettled(entries.map(([id, role]) => workspace.saveStructureRole(id, role))).then((results) => {
      if (results.some((result) => result.status === "fulfilled")) clearStoredAnnounceRoles();
    });
    return undefined;
  }, [workspace]);

  const setRole = async (id, role) => {
    setPendingRoles((current) => ({ ...current, [id]: role }));
    if (!workspace?.saveStructureRole) return;
    try {
      await workspace.saveStructureRole(id, role);
      setPendingRoles((current) => { const next = { ...current }; delete next[id]; return next; });
    } catch (error) {
      notify(error?.message || "A função oficial não pôde ser salva no elenco. Aplique a migration structure_role.", "error");
    }
  };

  const toggleSelected = (id) => {
    if (pieceKind === "individual") { setSelectedIds([id]); return; }
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };
  const selectFiltered = (predicate) => setSelectedIds(filtered.filter(predicate).map((person) => person.id));
  const shufflePhrase = () => {
    if (!selected[0]) return;
    const next = pickAnnouncePhrase(selected[0], { type: announceType, currentId: phrase.id, usedIds: usedPhraseIds });
    setPhraseId(next.id);
    setCustomPhrase("");
  };

  const generate = async (force = false) => {
    if (!selected.length || running) return;
    const next = await startAnnounceRender({
      kind: pieceKind, format, people: selected, phrase: phrase.text, phraseId: phrase.id, title, announceType, timeline, force,
    });
    if (next.status === "error") notify(next.error || "Não foi possível gerar o anúncio.", "error");
    else if (next.status === "ready") {
      if (phrase.id && phrase.id !== "custom") setUsedPhraseIds((current) => [...current.filter((id) => id !== phrase.id), phrase.id].slice(-8));
      notify(format === "feed" ? "Post pronto." : "Reels pronto.");
      if (next.result) setResult(next.result);
    }
  };

  const output = resolveMediaOutput({ sectionId: "announce", kind: pieceKind, format });
  const mine = job?.template === ANNOUNCE_TEMPLATE_ID;
  const record = (mine && job?.status === "ready" && job.result && (isImageRecord(job.result) === (output.type === "image")) ? job.result : null)
    || cache.find((row) => row.format === format) || null;
  const meta = isSeletiva
    ? "Divulgação de posições abertas"
    : `${pad(selected.length)} ${selected.length === 1 ? "nome na peça" : "nomes na peça"}`;

  const toolbar = (
    <MediaToolbar title="Anúncios FC27" meta={meta}>
      <ToolbarGroup label="CONTEÚDO" items={CONTENT_ITEMS} active={kind} onChange={(value) => {
        setKind(value);
        if (value === "individual") setSelectedIds((current) => current.slice(0, 1));
      }} />
      {isSeletiva ? <ToolbarFact label="FORMATO" value="STORY 9:16 · PNG" /> : <FormatGroup value={format} onChange={setFormat} />}
    </MediaToolbar>
  );

  if (isSeletiva) {
    return <>{toolbar}<SeletivaPanel /></>;
  }

  const archive = cache.slice(0, 6).map((row) => recordToArchiveItem(row, {
    label: isImageRecord(row) ? "POST 4:5 · PNG" : "REELS 9:16 · MP4", unit: "nome", onView: () => openViewer(row),
  }));

  return (
    <>
      {toolbar}
      <MediaWorkspace
        stage={
          <PreviewStage
            pieceKey={pieceKey}
            ratio={format} caption={MEDIA_FORMAT_LABELS[format]} state={!selected.length ? "empty" : assets ? "ready" : "loading"} label="Preview do anúncio FC27"
            job={running && mine ? job : null} showingResult={Boolean(result)}
          >
            {result ? <StageResult record={result} />
              : !selected.length ? <StageEmpty title="Escolha quem entra na peça." hint="Selecione ao menos uma pessoa do elenco ativo." />
              : assets && timeline.totalFrames
                ? <PreviewCanvas timeline={timeline} assets={assets} format={format} frameTime={announceFrameTime} renderFrame={renderAnnounceFrame} label="Preview do anúncio FC27" />
                : <StageLoading />}
          </PreviewStage>
        }
        actions={
          <>
            {result ? (
              <PieceActions
                primary={<button type="button" className="primary" onClick={() => downloadBlob(result.blob, result.fileName)}>{isImageRecord(result) ? "BAIXAR PNG" : "BAIXAR MP4"}</button>}
                secondary={<>
                  <button type="button" className="secondary" onClick={() => openViewer(result)}>TELA CHEIA</button>
                  <button type="button" className="secondary announce-regenerate" disabled={!selected.length || running} onClick={() => generate(true)}>GERAR DE NOVO</button>
                </>}
                tertiary={<button type="button" className="media-link" onClick={() => setResult(null)}>Voltar à prévia</button>}
              />
            ) : (
              <PieceActions
                primary={<button type="button" className="primary announce-generate" disabled={!selected.length || running} onClick={() => generate(false)}><RollingLabel>{running && mine ? (jobPercent(job) !== null ? `GERANDO… ${jobPercent(job)}%` : "GERANDO…") : mediaGenerateLabel(output)}</RollingLabel></button>}
                secondary={record && <>
                  <button type="button" className="secondary" onClick={() => setResult(record)}>VER ÚLTIMA</button>
                  <button type="button" className="secondary" onClick={() => downloadBlob(record.blob, record.fileName)}>{isImageRecord(record) ? "BAIXAR PNG" : "BAIXAR MP4"}</button>
                </>}
                tertiary={!selected.length && <p className="media-hint">Selecione quem entra na peça para liberar.</p>}
              />
            )}
            {job?.status === "error" && mine && <MediaNotice tone="error" title="A geração não terminou.">{job.error}</MediaNotice>}
          </>
        }
        rail={
          <>
            <RailBlock kicker={pieceKind === "team" ? "ELENCO DA PEÇA" : "QUEM ENTRA"} aside={pieceKind === "team" && selectedIds.length ? `${pad(selectedIds.length)} selecionados` : ""} className="announce-roster">
              <label className="announce-search">
                <span className="visually-hidden">Buscar no elenco</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, nick ou posição" />
              </label>
              <div className="announce-filters" aria-label="Filtros do elenco">
                {[["all", "TODOS"], ["players", "JOGADORES"], ["structure", "ESTRUTURA"], ["GOL", "GOL"], ["DEF", "DEF"], ["MEI", "MEI"], ["ATA", "ATA"]].map(([id, label]) => (
                  <button key={id} type="button" className={groupFilter === id ? "is-active" : ""} aria-pressed={groupFilter === id} onClick={() => setGroupFilter(id)}>{label}</button>
                ))}
              </div>
              {pieceKind === "team" && (
                <div className="announce-bulk" aria-label="Seleção em massa">
                  <button type="button" onClick={() => selectFiltered(() => true)}>TODOS</button>
                  <button type="button" onClick={() => selectFiltered((person) => !isStructureRole(person.extraRole))}>SÓ JOGADORES</button>
                  <button type="button" onClick={() => selectFiltered((person) => isStructureRole(person.extraRole))}>SÓ ESTRUTURA</button>
                  <button type="button" className="is-reset" onClick={() => setSelectedIds([])}>LIMPAR</button>
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
                      draggable={pieceKind === "team" && on}
                      onDragStart={() => { dragIndex.current = selectedIds.indexOf(person.id); }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        const from = dragIndex.current;
                        const to = selectedIds.indexOf(person.id);
                        if (from < 0 || to < 0 || from === to) return;
                        setSelectedIds(moveItem(selectedIds, from, to - from));
                      }}
                    >
                      <button type="button" className="announce-person" onClick={() => toggleSelected(person.id)} aria-pressed={on}>
                        <span className="announce-person-index" aria-label={on ? `Ordem ${order + 1}` : "Não selecionado"}>{on && order >= 0 ? pad(order + 1) : on ? "•" : "—"}</span>
                        <span className="announce-person-copy"><b>{person.name}</b><small>{[person.position, person.extraBadge || ANNOUNCE_ROLES[person.extraRole]?.label].filter(Boolean).join(" · ")}</small></span>
                      </button>
                      {pieceKind === "team" && on && order >= 0 && (
                        <div className="announce-order" aria-label={`Ordenar ${person.name}`}>
                          <button type="button" aria-label={`Subir ${person.name}`} disabled={order === 0} onClick={() => setSelectedIds(moveItem(selectedIds, order, -1))}><Chevron up /></button>
                          <button type="button" aria-label={`Descer ${person.name}`} disabled={order === selectedIds.length - 1} onClick={() => setSelectedIds(moveItem(selectedIds, order, 1))}><Chevron /></button>
                        </div>
                      )}
                      {on && (
                        <div className="announce-role">
                          <SelectControl label={`Função oficial de ${person.name}`} value={person.extraRole} options={ROLE_OPTIONS} onChange={(value) => setRole(person.id, value)} />
                        </div>
                      )}
                    </li>
                  );
                })}
                {!filtered.length && <li className="announce-empty">Nenhum nome encontrado no elenco ativo.</li>}
              </ul>
            </RailBlock>
            <Options>
              {pieceKind === "individual" ? (
                <>
                  <SelectControl label="Tipo do anúncio" value={announceType} options={TYPE_OPTIONS} onChange={(value) => { setAnnounceType(value); setPhraseId(""); }} />
                  <SelectControl
                    label="Frase"
                    value={phrasesForPerson(selected[0], announceType).some((item) => item.id === (phraseId || phrase.id)) ? (phraseId || phrase.id) : (phrasesForPerson(selected[0], announceType)[0]?.id || "")}
                    options={phrasesForPerson(selected[0], announceType).map((item) => [item.id, item.text])}
                    onChange={(value) => { setPhraseId(value); setCustomPhrase(""); }}
                  />
                  <button type="button" className="secondary" onClick={shufflePhrase}>SORTEAR OUTRA FRASE</button>
                  <label className="announce-field">
                    <span>EDITAR FRASE</span>
                    <textarea value={customPhrase} onChange={(event) => setCustomPhrase(event.target.value)} rows={3} placeholder={phrase.text} />
                  </label>
                </>
              ) : (
                <SelectControl label="Título da peça" value={title} options={ANNOUNCE_TITLES.map((item) => [item, item])} onChange={setTitle} />
              )}
            </Options>
            <ArchiveList items={archive} empty="Nenhuma peça gerada ainda." />
          </>
        }
      />
    </>
  );
}

/** Static "Seletiva" art, living inside the same shell as every other announcement. */
function SeletivaPanel() {
  const template = SELETIVA;
  const Template = template.Component;
  const reduced = useReducedMotion();
  const [draft, setDraft] = useState(template.defaultCopy);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const artboardRef = useRef(null);
  const fileName = useMemo(() => template.fileName(draft), [template, draft]);

  const update = (key, value) => {
    setDraft((current) => ({ ...current, [key]: template.sanitizeInput(key, value) }));
    setStatus("idle");
    setError("");
  };
  const exportPng = async () => {
    if (!artboardRef.current || status === "exporting") return;
    setStatus("exporting");
    setError("");
    try {
      await exportStaticMediaV2Png(artboardRef.current, fileName, STATIC_MEDIA_V2_CANVAS);
      setStatus("ready");
    } catch (exportError) {
      setError(exportError?.message || "Não foi possível exportar o PNG.");
      setStatus("error");
    }
  };

  return (
    <MediaWorkspace
      stage={
        <PreviewStage pieceKey={`seletiva:${template.id}`} ratio="story" caption="STORY 9:16 · PNG" label={`Preview do template ${template.name}`}>
          <StaticMediaV2Canvas artboardRef={artboardRef} label={`Canvas do template ${template.name}`}><Template copy={draft} /></StaticMediaV2Canvas>
        </PreviewStage>
      }
      actions={
        <>
          <PieceActions primary={<button type="button" className="primary" disabled={status === "exporting"} onClick={() => void exportPng()}><RollingLabel>{status === "exporting" ? "PREPARANDO PNG…" : "EXPORTAR PNG"}</RollingLabel></button>} />
          {status === "ready" && <MediaNotice tone="info">PNG {STATIC_MEDIA_V2_CANVAS.width} × {STATIC_MEDIA_V2_CANVAS.height} exportado.</MediaNotice>}
          {status === "error" && <MediaNotice tone="error" title="A exportação falhou.">{error}</MediaNotice>}
        </>
      }
      rail={
        <RailBlock kicker="TEXTO DA PEÇA" aside={`${template.name}`} className={reduced ? "announce-roster is-reduced" : "announce-roster"}>
          <div className="announce-fields">
            {template.fields.map(({ key, label, maxLength, prominent }) => (
              <label key={key} className={`announce-field${prominent ? " is-headline" : ""}`}>
                <span>{label}</span>
                <input value={draft[key]} maxLength={maxLength} onChange={(event) => update(key, event.target.value)} />
              </label>
            ))}
          </div>
          <p className="media-block-empty">{fileName}</p>
        </RailBlock>
      }
    />
  );
}
