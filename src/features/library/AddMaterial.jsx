import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBrandGoogleDrive, IconBrandYoutube, IconCheck, IconLink, IconMovie } from "@tabler/icons-react";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { useDialog } from "../../ui/useDialog.js";
import { notify } from "../../ui/motion/motion.jsx";
import {
  LIBRARY_CATEGORIES,
  LIBRARY_POSITIONS,
  LIBRARY_THEMES,
  LIBRARY_TIERS,
  MATERIAL_TITLE_MAX,
  canManageLibrary,
  categoryCover,
  describeMaterialLink,
  materialCover,
  materialDraftIssue,
  materialDraftOf,
  materialPatch,
  materialRow,
  primaryCategory,
} from "./library-core.js";
import "./add-material.css";

const BLANK = Object.freeze({
  source_url: "", title: "", category: "jogada", themes: [], description: "",
  focus_positions: [], minimum_access_tier: "player", thumbnail_url: "",
});
const KINDS = Object.freeze([
  { id: "jogada", label: "Jogada", lead: "Um lance ou movimento do time" },
  { id: "review", label: "Review", lead: "Leitura de uma partida" },
]);
const SOURCE_ICON = { youtube: IconBrandYoutube, drive: IconBrandGoogleDrive, direct: IconMovie };
const toggled = (list, value) => (list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);

/** The video's own title, asked to YouTube. "" when it cannot be read (the manager types it). */
async function youtubeTitle(url, signal) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal });
    if (!response.ok) return "";
    return String((await response.json())?.title || "").trim();
  } catch {
    return "";
  }
}

/**
 * "Adicionar material": the manager pastes a link and the sheet does the rest of the reading
 * (which service it is, what will be tracked, the video's own picture and title), while a card
 * on the side shows the material exactly as the shelf will show it. Only the link and the
 * title are required; everything else has a sensible answer already chosen.
 *
 * With `item` the same sheet edits that material: it opens filled in, the title is never
 * replaced by the video's, and saving writes over the material instead of adding one.
 */
export function AddMaterial({ client, profile, close, refresh, item = null }) {
  const editing = Boolean(item?.id);
  const [initial] = useState(() => (editing ? materialDraftOf(item) : BLANK));
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tried, setTried] = useState(false);
  const [suggested, setSuggested] = useState("");
  const [coverFailed, setCoverFailed] = useState(false);
  const titleTyped = useRef(editing);
  const titleRef = useRef(null);
  const dirty = draft !== initial;
  const dialogRef = useDialog(() => { if (!busy) close(); });

  const link = useMemo(() => describeMaterialLink(draft.source_url), [draft.source_url]);
  const issue = materialDraftIssue(draft);
  const set = (patch) => { setError(""); setDraft((current) => ({ ...current, ...patch })); };

  // A YouTube link brings its title: it fills the field while the manager has not typed one.
  useEffect(() => {
    setSuggested("");
    if (link.state !== "ok" || link.type !== "youtube") return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const title = (await youtubeTitle(link.url, controller.signal)).slice(0, MATERIAL_TITLE_MAX);
      if (!title || controller.signal.aborted) return;
      setSuggested(title);
      if (!titleTyped.current) setDraft((current) => (current.title.trim() ? current : { ...current, title }));
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [link.state, link.type, link.url]);
  useEffect(() => { setCoverFailed(false); }, [draft.thumbnail_url, link.thumbnail]);

  const row = materialRow(draft, profile?.user_id || "");
  const shelf = primaryCategory(row);
  const picture = !coverFailed && materialCover(draft, item);
  const shelfLabel = LIBRARY_CATEGORIES.find((category) => category.id === shelf)?.label || "Biblioteca";
  const SourceIcon = link.state === "ok" ? SOURCE_ICON[link.type] : IconLink;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setTried(true);
    if (!canManageLibrary(profile)) return setError("Só a diretoria adiciona material à Biblioteca.");
    if (issue) {
      setError(issue);
      (link.state === "ok" ? titleRef.current : dialogRef.current?.querySelector("input"))?.focus();
      return;
    }
    setBusy(true);
    setError("");
    const { error: saveError } = editing
      ? await client.from("library_items").update(materialPatch(draft, item, profile.user_id)).eq("id", item.id)
      : await client.from("library_items").insert(row);
    if (saveError) {
      setBusy(false);
      return setError(/focus_positions|PGRST204/.test(`${saveError.code} ${saveError.message}`)
        ? "O banco ainda não aceita a indicação por posição. Desmarque as posições e salve de novo."
        : `Não foi possível ${editing ? "salvar as alterações" : "adicionar o material"} (${saveError.message}).`);
    }
    await refresh();
    notify(editing ? `“${row.title}” foi atualizado.` : `“${row.title}” está na Biblioteca.`);
    close();
  };

  const linkShown = tried || draft.source_url.trim().length > 7;
  return createPortal(
    <div className="library-player-layer add-material-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !dirty && !busy) close(); }}>
      <form ref={dialogRef} className="add-material" role="dialog" aria-modal="true" aria-labelledby="add-material-title" onSubmit={submit} noValidate>
        <header>
          <div>
            <h2 id="add-material-title">{editing ? "Editar material" : "Adicionar material"}</h2>
            <p>{editing ? "Mude o título, a seção ou qualquer outro dado. O que cada um já assistiu continua guardado." : "Cole o link de um vídeo do YouTube ou do Google Drive. O resto o site preenche com você."}</p>
          </div>
          <CloseButton onClick={close} disabled={busy} />
        </header>

        <div className="add-material-body">
          <div className="add-material-fields">
            <div className={`add-field add-link${link.state === "ok" ? " is-ok" : ""}${link.state === "invalid" && linkShown ? " is-bad" : ""}`}>
              <label htmlFor="add-material-link">Link do vídeo</label>
              <div className="add-link-box">
                <SourceIcon size={20} stroke={1.7} aria-hidden="true" />
                <input
                  id="add-material-link" type="url" inputMode="url" autoComplete="off" spellCheck={false}
                  placeholder="https://youtube.com/watch?v=…"
                  value={draft.source_url}
                  aria-describedby="add-material-link-note"
                  aria-invalid={link.state === "invalid" && linkShown}
                  onChange={(event) => set({ source_url: event.target.value })}
                />
                {link.state === "ok" && <b><IconCheck size={14} stroke={2.4} aria-hidden="true" />{link.label}</b>}
              </div>
              <p id="add-material-link-note" role={link.state === "invalid" && linkShown ? "alert" : undefined}>
                {link.state === "ok" ? link.note
                  : link.state === "invalid" && linkShown ? link.message
                    : "YouTube, Google Drive ou um arquivo MP4."}
              </p>
            </div>

            <div className="add-field">
              <label htmlFor="add-material-name">Título</label>
              <input
                id="add-material-name" ref={titleRef} maxLength={MATERIAL_TITLE_MAX}
                placeholder="Ex.: Saída de bola pelo lado esquerdo"
                value={draft.title}
                aria-invalid={tried && !draft.title.trim()}
                onChange={(event) => { titleTyped.current = true; set({ title: event.target.value }); }}
              />
              {suggested && draft.title === suggested && <p>Título do próprio vídeo. Ajuste se quiser.</p>}
              {suggested && draft.title !== suggested && <p><button type="button" className="add-inline" onClick={() => { titleTyped.current = false; set({ title: suggested }); }}>Usar o título do vídeo</button></p>}
            </div>

            <fieldset className="add-field add-kind">
              <legend>Seção</legend>
              <div>
                {KINDS.map((kind) => (
                  <label key={kind.id} className={draft.category === kind.id ? "is-on" : ""}>
                    <input type="radio" name="add-material-kind" value={kind.id} checked={draft.category === kind.id} onChange={() => set({ category: kind.id })} />
                    <b>{kind.label}</b><small>{kind.lead}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="add-field" role="group" aria-labelledby="add-material-themes">
              <span className="add-label" id="add-material-themes">Tema <em>opcional</em></span>
              <div className="add-chips">
                {LIBRARY_THEMES.map((theme) => {
                  const on = draft.themes.includes(theme.id);
                  return <button key={theme.id} type="button" className={on ? "is-on" : ""} aria-pressed={on} onClick={() => set({ themes: toggled(draft.themes, theme.id) })}>{theme.label}</button>;
                })}
              </div>
              <p>O tema coloca o material também na prateleira dele.</p>
            </div>

            <div className="add-field" role="group" aria-labelledby="add-material-focus">
              <span className="add-label" id="add-material-focus">Indicado para <em>opcional</em></span>
              <div className="add-chips is-positions">
                {LIBRARY_POSITIONS.map((position) => {
                  const on = draft.focus_positions.includes(position);
                  return <button key={position} type="button" className={on ? "is-on" : ""} aria-pressed={on} onClick={() => set({ focus_positions: toggled(draft.focus_positions, position) })}>{position}</button>;
                })}
              </div>
              <p>Todo mundo vê o material; isto só avisa quem deve assistir primeiro.</p>
            </div>

            <div className="add-field">
              <label htmlFor="add-material-about">Descrição <em>opcional</em></label>
              <textarea id="add-material-about" rows={3} placeholder="O que observar no vídeo, em uma ou duas frases." value={draft.description} onChange={(event) => set({ description: event.target.value })} />
            </div>

            <div className="add-field">
              <label htmlFor="add-material-tier">Quem pode ver</label>
              <select id="add-material-tier" value={draft.minimum_access_tier} onChange={(event) => set({ minimum_access_tier: event.target.value })}>
                {LIBRARY_TIERS.map((tier) => <option key={tier.id} value={tier.id}>{tier.label}</option>)}
              </select>
            </div>

            <details className="add-more">
              <summary>Usar outra imagem de capa</summary>
              <div className="add-field">
                <label htmlFor="add-material-cover">Link da imagem</label>
                <input id="add-material-cover" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://…" value={draft.thumbnail_url} onChange={(event) => set({ thumbnail_url: event.target.value })} />
                <p>{link.thumbnail ? "Sem isto, a capa é a imagem do próprio vídeo." : "Sem isto, a capa é a da prateleira."}</p>
              </div>
            </details>
          </div>

          <aside className="add-material-preview" aria-label="Como vai aparecer na Biblioteca">
            <span className="add-label">Como vai aparecer</span>
            <article>
              <div className={`add-preview-cover${picture ? " has-picture" : ""}`}>
                <img key={picture || shelf} src={picture || categoryCover(shelf)} alt="" onError={() => setCoverFailed(true)} />
                <span>{shelfLabel}</span>
              </div>
              <h3 className={draft.title.trim() ? "" : "is-empty"}>{draft.title.trim() || "Título do material"}</h3>
              {draft.description.trim() && <p>{draft.description.trim()}</p>}
              <ul>
                <li>{draft.category === "review" ? "Review" : "Jogada"}</li>
                {LIBRARY_THEMES.filter((theme) => draft.themes.includes(theme.id)).map((theme) => <li key={theme.id}>{theme.label}</li>)}
                {row.focus_positions?.length > 0 && <li className="is-focus">Para {row.focus_positions.join(" · ")}</li>}
              </ul>
            </article>
            <dl>
              <div><dt>Origem</dt><dd>{link.state === "ok" ? link.label : "—"}</dd></div>
              <div><dt>Quem vê</dt><dd>{LIBRARY_TIERS.find((tier) => tier.id === draft.minimum_access_tier)?.label}</dd></div>
            </dl>
          </aside>
        </div>

        <footer>
          <p className={error ? "is-error" : ""} role={error ? "alert" : "status"}>{error || (issue ? issue : editing ? (dirty ? "Alterações prontas para salvar." : "Nada foi alterado ainda.") : "Pronto para entrar na Biblioteca.")}</p>
          <div>
            <button type="button" className="secondary" onClick={close} disabled={busy}>CANCELAR</button>
            <button className="primary" disabled={busy} aria-disabled={Boolean(issue)}>{busy ? (editing ? "SALVANDO…" : "ADICIONANDO…") : editing ? "SALVAR ALTERAÇÕES" : "ADICIONAR À BIBLIOTECA"}</button>
          </div>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
