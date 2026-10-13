import React, { useCallback, useEffect, useState } from "react";
import { IconChevronRight, IconEye, IconEyeCheck, IconEyeOff, IconLock, IconMovie, IconPlayerPlayFilled, IconRefresh, IconShieldCheck } from "@tabler/icons-react";
import { requiredBoard, requiredSummary } from "../../../shared/night-required.js";
import { readRequired } from "./required-client.js";
import "./required.css";

/** What a player sees in place of a line-up he has not unlocked yet. */
export function RequiredGate({ status, onWatch }) {
  const { total, done } = status;
  return (
    <div className="required-gate">
      <i className="required-gate-mark" aria-hidden="true"><IconLock size={22} stroke={1.7} /></i>
      <small>ESCALAÇÃO FECHADA POR ENQUANTO</small>
      <h3>{total === 1 ? "Antes, a jogada de hoje" : `Antes, as ${total} jogadas de hoje`}</h3>
      <p>A gente sabe que o dia de todo mundo é corrido, então é rápido: assista {total === 1 ? "à jogada" : "às jogadas"} e a escalação deste jogo abre na hora.{done ? ` Você já viu ${done} de ${total}.` : ""}</p>
      <div className="required-gate-foot">
        <i className="required-pips" aria-hidden="true">{Array.from({ length: total }, (_, index) => <u key={index} className={index < done ? "is-on" : ""} />)}</i>
        <button type="button" className="primary" onClick={onWatch}><IconPlayerPlayFilled size={14} aria-hidden="true" />{done ? "CONTINUAR ASSISTINDO" : "ASSISTIR AGORA"}</button>
      </div>
    </div>
  );
}

/** In the match view, for the board: one quiet line that opens the centre. */
export function RequiredPeek({ total, onOpen }) {
  return (
    <button type="button" className="required-peek" onClick={onOpen}>
      <i aria-hidden="true"><IconMovie size={18} stroke={1.7} /></i>
      <span><small>OBRIGATÓRIO DA NOITE</small><b>{total === 1 ? "1 jogada marcada hoje" : `${total} jogadas marcadas hoje`}</b></span>
      <em>VER QUEM ASSISTIU<IconChevronRight size={16} stroke={2} aria-hidden="true" /></em>
    </button>
  );
}

// One mark per situation: owes the video, half way, watched, cannot enter the site, exempt.
const MARK = { pending: IconEyeOff, partial: IconEye, done: IconEyeCheck, noaccount: IconLock, nocontract: IconLock, exempt: IconShieldCheck, none: IconEye };
const plural = (count, one, many) => (count === 1 ? one : many);

/**
 * For whoever picks the team: every roster player and what he did with the day's videos —
 * did not watch, watched some, watched all, has no access to the site, or is exempt (Conselho,
 * Diretoria, Desenvolvimento). Read from the server when it appears and again on request.
 */
export function RequiredBoard({ client, required, players = [], embedded = false }) {
  const [state, setState] = useState({ status: "loading", rows: [] });
  const total = required.items.length;
  const load = useCallback(() => {
    if (!client) return;
    setState((current) => ({ ...current, status: current.rows.length ? "refreshing" : "loading" }));
    readRequired(client, { team: true })
      .then((payload) => setState({ status: "ready", rows: requiredBoard({ members: payload.team || [], items: payload.items || [], players }) }))
      .catch(() => setState((current) => ({ ...current, status: "error" })));
  }, [client, players]);
  useEffect(() => { if (total) load(); }, [total, load]);
  if (!total) return null;
  const tally = requiredSummary(state.rows);
  const busy = state.status === "loading" || state.status === "refreshing";
  return (
    <section className={`required-board${embedded ? " is-embedded" : ""}`} aria-labelledby="required-board-title">
      <header>
        {!embedded && <i className="required-board-mark" aria-hidden="true"><IconMovie size={22} stroke={1.6} /></i>}
        <div>
          <small>{embedded ? "QUEM ASSISTIU" : "OBRIGATÓRIO DA NOITE"}</small>
          <h3 id="required-board-title">{embedded ? "O elenco hoje" : total === 1 ? "1 jogada marcada hoje" : `${total} jogadas marcadas hoje`}</h3>
        </div>
        <button type="button" className={`secondary required-refresh${busy ? " is-busy" : ""}`} onClick={load} disabled={busy}><IconRefresh size={15} stroke={2} aria-hidden="true" />ATUALIZAR</button>
      </header>
      {state.status === "loading" && <p className="required-board-note">Lendo quem assistiu…</p>}
      {state.status === "error" && <p className="required-board-note">Não foi possível ler quem assistiu. Tente atualizar.</p>}
      {state.rows.length > 0 && (
        <>
          <ul className="required-tally" aria-label="Resumo">
            <li className={tally.owing ? "is-strong" : ""}><b>{tally.owing}</b>{plural(tally.owing, "deve vídeo", "devem vídeo")}</li>
            <li className="is-data"><b>{tally.done}</b>{plural(tally.done, "viu tudo", "viram tudo")}</li>
            <li><b>{tally.noAccount}</b>sem acesso ao site</li>
            <li><b>{tally.exempt}</b>{plural(tally.exempt, "isento", "isentos")}</li>
          </ul>
          <ul className="required-rows">
            {state.rows.map((row) => {
              const Mark = MARK[row.state] || IconEye;
              return (
                <li key={row.key} className={`is-${row.state}`}>
                  <i className="required-mark" aria-hidden="true"><Mark size={18} stroke={1.8} /></i>
                  <div className="required-who"><b>{row.name}</b><span>{row.detail}</span></div>
                  {row.account && !row.exempt && row.total > 0
                    ? <i className="required-pips" aria-hidden="true">{Array.from({ length: row.total }, (_, index) => <u key={index} className={index < row.done ? "is-on" : ""} />)}</i>
                    : <i className="required-pips" aria-hidden="true" />}
                  <em>{row.label}</em>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
