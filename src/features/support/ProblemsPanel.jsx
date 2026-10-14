import React, { useMemo, useState } from "react";
import { notify } from "../../ui/motion/motion.jsx";
import { agoLabel } from "../notifications/notifications-core.js";
import { PROBLEM_BUCKET, PROBLEM_STATUS, describeDevice } from "./problem-core.js";
import "./problems-panel.css";

const FILTERS = [["open", "ABERTOS"], ["resolved", "RESOLVIDOS"], ["all", "TODOS"]];
const stamp = (value) => (value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—");

/** Desenvolvedor › Problemas: every report, newest first, moved along aberto → vendo → resolvido. */
export function ProblemsPanel({ client, workspace }) {
  const [filter, setFilter] = useState("open");
  const reports = (workspace.problemReports || []).map((report) => ({ ...report, status: report.status || "open" }));
  const shown = useMemo(() => reports.filter((report) => filter === "all" || (filter === "resolved" ? report.status === "resolved" : report.status !== "resolved")), [reports, filter]);
  const openCount = reports.filter((report) => report.status !== "resolved").length;
  if (!workspace.problemsAvailable) {
    return <section className="developer-panel motion-panel-enter problems-panel"><header><span>REPORTAR PROBLEMA</span><h2>Problemas</h2></header><p>Aplique a migration <code>20261014200000_fc27_problem_reports.sql</code> no Supabase para ativar os reportes.</p></section>;
  }
  return (
    <section className="developer-panel motion-panel-enter problems-panel">
      <header>
        <div><span>REPORTADOS PELO TIME</span><h2>Problemas {openCount ? <em>{openCount} em aberto</em> : null}</h2></div>
        <div className="problems-filter" role="group" aria-label="Filtrar problemas">
          {FILTERS.map(([id, label]) => <button key={id} type="button" className={filter === id ? "is-active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
      </header>
      {shown.length ? <ol className="problems-list">{shown.map((report) => <ProblemCard key={report.id} report={report} client={client} workspace={workspace} />)}</ol>
        : <p className="problems-empty">{filter === "open" ? "Nenhum problema em aberto." : "Nada por aqui."}</p>}
    </section>
  );
}

function ProblemCard({ report: row, client, workspace }) {
  const report = { ...row, status: row.status || "open" };
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [picture, setPicture] = useState("");
  const errors = Array.isArray(report.errors) ? report.errors : [];
  const move = async (status, text = "") => {
    setBusy(true);
    try {
      await workspace.setProblemStatus(report.id, status, text);
      notify(status === "resolved" ? "Marcado como resolvido. Quem reportou recebe o aviso." : status === "seeing" ? "Marcado como vendo." : "Reaberto.");
      setResolving(false);
    } catch (cause) {
      notify(cause?.message || "Não foi possível mudar o status.", "error");
    } finally {
      setBusy(false);
    }
  };
  const showPicture = async () => {
    const { data, error } = await client.storage.from(PROBLEM_BUCKET).createSignedUrl(report.screenshot_path, 600);
    if (error || !data?.signedUrl) { notify("Não foi possível abrir o print.", "error"); return; }
    setPicture(data.signedUrl);
  };
  return (
    <li className={`problem-card is-${report.status}`}>
      <header>
        <span className="problem-status">{PROBLEM_STATUS[report.status] || report.status}</span>
        <b>{report.reporter_name || "Membro"}</b>
        <time dateTime={report.created_at} title={stamp(report.created_at)}>{agoLabel(report.created_at)}</time>
      </header>
      <p className="problem-message">{report.message}</p>
      <dl className="problem-facts">
        <div><dt>Página</dt><dd>{report.page || "—"}</dd></div>
        <div><dt>Aparelho</dt><dd>{describeDevice(report.device) || "—"}</dd></div>
        {report.status === "resolved" && <div><dt>Resolvido</dt><dd>{stamp(report.resolved_at)}{report.resolution_note ? ` · ${report.resolution_note}` : ""}</dd></div>}
      </dl>
      {errors.length > 0 && (
        <details className="problem-errors">
          <summary>{errors.length} erro{errors.length > 1 ? "s" : ""} registrado{errors.length > 1 ? "s" : ""} antes do reporte</summary>
          <ol>{errors.map((entry, index) => <li key={index}><span>{entry.kind}</span><code>{entry.message}{entry.times > 1 ? ` (×${entry.times})` : ""}</code>{entry.source ? <small>{entry.source}</small> : null}</li>)}</ol>
        </details>
      )}
      {picture && <a className="problem-picture" href={picture} target="_blank" rel="noreferrer"><img src={picture} alt={`Print enviado por ${report.reporter_name || "membro"}`} /></a>}
      {resolving ? (
        <div className="problem-resolve">
          <input value={note} maxLength={600} placeholder="O que foi feito (opcional, quem reportou vê)" onChange={(event) => setNote(event.target.value)} disabled={busy} autoFocus />
          <button type="button" className="secondary" onClick={() => setResolving(false)} disabled={busy}>VOLTAR</button>
          <button type="button" className="primary" onClick={() => void move("resolved", note)} disabled={busy}>{busy ? "SALVANDO…" : "RESOLVIDO"}</button>
        </div>
      ) : (
        <footer>
          {report.screenshot_path && !picture && <button type="button" className="secondary" onClick={() => void showPicture()}>VER PRINT</button>}
          {report.status === "open" && <button type="button" className="secondary" onClick={() => void move("seeing")} disabled={busy}>ESTOU VENDO</button>}
          {report.status !== "resolved" && <button type="button" className="primary" onClick={() => setResolving(true)} disabled={busy}>MARCAR RESOLVIDO</button>}
          {report.status === "resolved" && <button type="button" className="secondary" onClick={() => void move("open")} disabled={busy}>REABRIR</button>}
        </footer>
      )}
    </li>
  );
}
