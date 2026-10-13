import React, { useEffect, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { lineupDiff } from "../features/agenda/lineup-diff.js";
import "./activity-list.css";

const stamp = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  .format(new Date(value)).replace(",", " ·");
const clock = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
const day = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(value));
const validDate = (value) => Boolean(value) && Number.isFinite(new Date(value).getTime());

/** Whether a line of the history has something to open: the two line-ups, or the two kick-offs. */
function hasDetail(row) {
  const details = row?.details || {};
  if (row?.action === "lineup_changed") return Array.isArray(details.before) || Array.isArray(details.after);
  if (row?.action === "rescheduled") return validDate(details.before) && validDate(details.after);
  return false;
}

/** The line-up change, said as a manager would: who came in for whom, who left, who moved. */
function LineupChange({ before, after }) {
  const diff = lineupDiff(before, after);
  if (!diff.changed) return <p className="activity-none">Os mesmos jogadores, nas mesmas posições.</p>;
  let order = 0;
  const step = () => ({ "--i": order++ });
  return (
    <ul className="activity-diff">
      {diff.swaps.map((item) => (
        <li key={`swap-${item.in}`} className="is-in" style={step()}>
          <i aria-hidden="true">+</i>
          <span><b>{item.in}</b> entrou no lugar de <s>{item.out}</s></span>
          <em>{item.position}</em>
        </li>
      ))}
      {diff.entered.map((item) => (
        <li key={`in-${item.name}`} className="is-in" style={step()}>
          <i aria-hidden="true">+</i>
          <span><b>{item.name}</b> entrou</span>
          <em>{item.position}</em>
        </li>
      ))}
      {diff.left.map((item) => (
        <li key={`out-${item.name}`} className="is-out" style={step()}>
          <i aria-hidden="true">−</i>
          <span><s>{item.name}</s> saiu</span>
          <em>{item.position}</em>
        </li>
      ))}
      {diff.moved.map((item) => (
        <li key={`move-${item.name}`} className="is-move" style={step()}>
          <i aria-hidden="true">↔</i>
          <span><b>{item.name}</b> mudou de posição</span>
          <em>{item.from} → {item.to}</em>
        </li>
      ))}
      <li className="is-total" style={step()}>
        <span>Escalação: {diff.filledBefore}/11 → {diff.filledAfter}/11</span>
      </li>
    </ul>
  );
}

function KickoffChange({ before, after }) {
  const sameDay = day(before) === day(after);
  return (
    <p className="activity-time">
      <s>{sameDay ? clock(before) : `${day(before)} · ${clock(before)}`}</s>
      <span aria-hidden="true">→</span>
      <b>{sameDay ? clock(after) : `${day(after)} · ${clock(after)}`}</b>
    </p>
  );
}

/**
 * "Histórico de mudanças": who changed what and when, as the database recorded it
 * (club_activity_log, written by triggers). `entity`/`entityId` narrow it to one thing
 * (a match, a night list). A line that kept what changed (a line-up, a kick-off) opens to
 * show it. Before its migration the table does not exist: the list then renders nothing at
 * all, it does not pretend there is no history.
 */
export function ActivityList({ client, entity = "", entityId = "", limit = 8, title = "Histórico de mudanças", refreshKey = "" }) {
  const [state, setState] = useState({ rows: [], status: "loading" });
  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    if (!client) return undefined;
    let alive = true;
    let query = client.from("club_activity_log").select("*").order("created_at", { ascending: false }).limit(limit);
    if (entity) query = query.eq("entity", entity);
    if (entityId) query = query.eq("entity_id", String(entityId));
    query.then(({ data, error }) => {
      if (!alive) return;
      if (error) return setState({ rows: [], status: ["42P01", "PGRST205"].includes(error.code) ? "absent" : "error", message: error.message });
      setState({ rows: Array.isArray(data) ? data : [], status: "ready" });
    });
    return () => { alive = false; };
  }, [client, entity, entityId, limit, refreshKey]);
  if (state.status === "absent" || state.status === "loading") return null;
  return (
    <section className="activity-list" aria-label={title}>
      <h3>{title}</h3>
      {state.status === "error" ? <p>Não foi possível ler o histórico: {state.message}</p>
        : state.rows.length ? (
          <ol>
            {state.rows.map((row) => {
              const line = <>
                <time dateTime={row.created_at}>{stamp(row.created_at)}</time>
                <span><b>{row.actor_name || "Sistema"}</b>{row.summary}</span>
              </>;
              if (!hasDetail(row)) return <li key={row.id}><div className="activity-line">{line}</div></li>;
              const open = openId === row.id;
              return (
                <li key={row.id} className={open ? "is-open" : ""}>
                  <button type="button" className="activity-line" aria-expanded={open} onClick={() => setOpenId(open ? null : row.id)}>
                    {line}
                    <IconChevronDown size={16} stroke={2} aria-hidden="true" />
                  </button>
                  {open && (
                    <div className="activity-detail">
                      {row.action === "lineup_changed"
                        ? <LineupChange before={row.details.before} after={row.details.after} />
                        : <KickoffChange before={row.details.before} after={row.details.after} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : <p>Nenhuma mudança registrada desde que o histórico foi ativado.</p>}
    </section>
  );
}
