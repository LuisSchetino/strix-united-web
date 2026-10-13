import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconMovie, IconPlayerPlayFilled } from "@tabler/icons-react";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { notify } from "../../ui/motion/motion.jsx";
import { useDialog } from "../../ui/useDialog.js";
import { REQUIRED_MAX, isDay } from "../../../shared/night-required.js";
import { saoPauloDay } from "../agenda/agenda-time.js";
import { librarySource } from "../library/library-core.js";
import { markFailure, markRequired, readYouTubeDuration, unmarkRequired } from "./required-client.js";
import { RequiredBoard } from "./RequiredGate.jsx";
import "./required.css";

const MISSING = new Set(["42P01", "PGRST205"]);
const clock = (value) => {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  return seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "";
};
const dayLabel = (day) => (isDay(day) ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : "");
/** "07/10/2026" (the game form) → "2026-10-07". */
export const dayOfFormDate = (value) => {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};
const thumbOf = (item) => { const source = librarySource(item?.source_url); return item?.thumbnail_url || (source.id ? `https://i.ytimg.com/vi/${source.id}/mqdefault.jpg` : ""); };

/**
 * "Obrigatório da noite", for the board, in one place: which Library plays the team has to
 * watch on `day` and, on the day itself, who already did. It opens by itself right after a new
 * game is saved (`intro="saved"`) and from the Agenda's header. `canPick` is Diretoria and
 * above; Conselho only reads who watched.
 */
export function RequiredCenter({ client, day, items = [], players = [], canPick = false, intro = "", close, onChanged }) {
  const dialogRef = useDialog(close);
  const [state, setState] = useState({ status: "loading", marked: [] });
  const [chosen, setChosen] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // The Library is read again here: a play added a minute ago is already on the list.
  const [fresh, setFresh] = useState(null);
  useEffect(() => {
    if (!client) return;
    client.from("library_items").select("*").order("published_at", { ascending: false }).then(({ data, error: readError }) => { if (!readError && Array.isArray(data)) setFresh(data); });
  }, [client]);
  const materials = useMemo(() => (fresh || items || []).filter((item) => item?.status !== "archived" && librarySource(item.source_url).type === "youtube" && librarySource(item.source_url).id), [fresh, items]);
  const load = useCallback(async () => {
    if (!client || !isDay(day)) return [];
    const { data, error: readError } = await client.from("night_required_items").select("item_id,position,duration_seconds").eq("day", day).order("position", { ascending: true });
    if (readError) { setState({ status: MISSING.has(readError.code) ? "off" : "error", marked: [] }); return []; }
    const marked = Array.isArray(data) ? data : [];
    setState({ status: "ready", marked });
    setChosen(new Set(marked.map((row) => String(row.item_id))));
    return marked;
  }, [client, day]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return needle ? materials.filter((item) => String(item.title || "").toLocaleLowerCase("pt-BR").includes(needle)) : materials;
  }, [materials, query]);
  const before = useMemo(() => new Set(state.marked.map((row) => String(row.item_id))), [state.marked]);
  // A play marked before and since removed from the Library is not counted as chosen.
  useEffect(() => { if (fresh) setChosen((current) => { const ids = new Set(materials.map((item) => String(item.id))); const next = new Set([...current].filter((id) => ids.has(id))); return next.size === current.size ? current : next; }); }, [fresh, materials]);
  const changed = before.size !== chosen.size || [...chosen].some((id) => !before.has(id));
  const live = day === saoPauloDay(new Date());
  const toggle = (id) => {
    if (!canPick || busy) return;
    setError("");
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size >= REQUIRED_MAX) { setError(`São no máximo ${REQUIRED_MAX} jogadas por dia. Tire uma para pôr outra.`); return current; }
      else next.add(id);
      return next;
    });
  };
  const save = async () => {
    if (busy || !changed) return;
    setError("");
    const gone = [...before].filter((id) => !chosen.has(id));
    const added = [...chosen].filter((id) => !before.has(id));
    try {
      setBusy("Salvando…");
      for (const id of gone) await unmarkRequired(client, { day, itemId: id });
      let position = state.marked.reduce((most, row) => Math.max(most, Number(row.position) || 0), -1) + 1;
      for (const id of added) {
        const item = materials.find((entry) => String(entry.id) === id);
        setBusy(`Lendo a duração de “${item?.title || "jogada"}”…`);
        const duration = Number(item?.duration_seconds) || await readYouTubeDuration(librarySource(item.source_url).id);
        await markRequired(client, { day, itemId: id, position, duration });
        position += 1;
      }
      await load();
      await onChanged?.();
      notify(chosen.size ? `Jogadas do dia ${dayLabel(day)} salvas. O time assiste antes de ver a escalação.` : `Dia ${dayLabel(day)} sem jogada obrigatória: a escalação abre direto.`, "success");
      close();
    } catch (cause) {
      setError(markFailure(cause));
      await load();
      await onChanged?.().catch(() => null);
    } finally {
      setBusy("");
    }
  };
  const saved = intro === "saved";
  return createPortal(
    <div className="required-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section ref={dialogRef} className={`required-sheet required-center${live && state.marked.length ? " has-board" : ""}`} role="dialog" aria-modal="true" aria-labelledby="required-center-title">
        <header>
          <i className="required-board-mark" aria-hidden="true"><IconMovie size={22} stroke={1.6} /></i>
          <div>
            <small>OBRIGATÓRIO DA NOITE · {dayLabel(day)}</small>
            <h2 id="required-center-title">{saved ? "Jogo salvo. O que o time precisa ver antes?" : "Jogadas do dia"}</h2>
            <p>{canPick
              ? `Marque até ${REQUIRED_MAX} jogadas da Biblioteca. Nesse dia, cada jogador assiste antes de ver a escalação. Sem nada marcado, a escalação abre direto.`
              : "As jogadas que a diretoria marcou para hoje e quem já assistiu."}</p>
          </div>
          <CloseButton onClick={close} disabled={Boolean(busy)} />
        </header>
        <div className="required-center-body">
          <div className="required-center-plays">
            <h3>Jogadas da Biblioteca <span>{chosen.size} de {REQUIRED_MAX}</span></h3>
            {state.status === "off" && <p className="required-board-note">O obrigatório ainda não foi ligado no banco (falta aplicar a migração).</p>}
            {state.status === "error" && <p className="required-board-note">Não foi possível ler as jogadas desse dia. Feche e tente de novo.</p>}
            {state.status === "loading" && <p className="required-board-note">Lendo…</p>}
            {state.status === "ready" && (
              <>
                {materials.length > 6 && <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jogada" aria-label="Buscar jogada na Biblioteca" />}
                {!materials.length && <p className="required-board-note">A Biblioteca ainda não tem vídeo do YouTube. Adicione a jogada lá primeiro.</p>}
                <ul className="required-plays">
                  {shown.map((item) => {
                    const id = String(item.id);
                    const on = chosen.has(id);
                    return (
                      <li key={id}>
                        <button type="button" className={on ? "is-on" : ""} aria-pressed={on} disabled={!canPick || Boolean(busy)} onClick={() => toggle(id)}>
                          <span className="required-thumb">{thumbOf(item) && <img src={thumbOf(item)} alt="" loading="lazy" />}<i aria-hidden="true"><IconPlayerPlayFilled size={14} /></i></span>
                          <span className="required-play-copy"><b>{item.title}</b><small>{clock(item.duration_seconds) || "YouTube"}</small></span>
                          <i className="required-tick" aria-hidden="true">{on && <IconCheck size={16} stroke={2.4} />}</i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          {live && state.marked.length > 0 && (
            <div className="required-center-team">
              <RequiredBoard client={client} required={{ items: state.marked }} players={players} embedded />
            </div>
          )}
        </div>
        <footer>
          <span role="status">{error || busy || (canPick ? (changed ? "Há mudanças para salvar." : state.marked.length ? "Nada para salvar." : "Nenhuma jogada marcada para esse dia.") : "")}</span>
          <div className="required-picker-actions">
            <button type="button" className="secondary" onClick={close} disabled={Boolean(busy)}>{saved && !changed ? "AGORA NÃO" : "FECHAR"}</button>
            {canPick && <button type="button" className="primary" onClick={save} disabled={Boolean(busy) || !changed || state.status !== "ready"}>SALVAR JOGADAS</button>}
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
