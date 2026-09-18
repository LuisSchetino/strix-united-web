import React, { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "../../ui/AccessDenied.jsx";
import { MotionTabs, notify } from "../../ui/motion/motion.jsx";
import "./developer.css";

const safeRows = (value) => Array.isArray(value) ? value : [];
const stamp = (value) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";

async function timed(label, task) {
  const start = performance.now();
  try {
    await task();
    return { label, ok: true, latency: Math.round(performance.now() - start), message: "Operacional" };
  } catch (error) {
    return { label, ok: false, latency: Math.round(performance.now() - start), message: error.message || "Indisponível" };
  }
}

export function DeveloperPage({ client, profile, workspace }) {
  const [tab, setTab] = useState("overview");
  const [health, setHealth] = useState(null);
  const [flags, setFlags] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [checks, setChecks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token || "";
    const [healthResponse, flagsResult, syncResult, auditResult] = await Promise.all([
      fetch("/api/internal/health", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }),
      client.from("system_flags").select("*").order("key"),
      client.from("competition_sync_log").select("*").order("completed_at", { ascending: false }).limit(30),
      client.from("competition_audit_log").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    const healthPayload = await healthResponse.json().catch(() => ({}));
    setHealth(healthResponse.ok ? healthPayload : null);
    setFlags(safeRows(flagsResult.data)); setSyncLogs(safeRows(syncResult.data)); setAuditLogs(safeRows(auditResult.data));
    const firstError = flagsResult.error || syncResult.error || auditResult.error;
    if (firstError && !["42P01", "PGRST205"].includes(firstError.code)) setError(firstError.message);
  };
  useEffect(() => { void refresh(); }, [client, profile?.user_id]);

  const runChecks = async () => {
    setBusy(true);
    const results = [];
    results.push(await timed("Cloudflare Pages", async () => { const response = await fetch("/api/public-config", { cache: "no-store" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); }));
    results.push(await timed("Supabase Data API", async () => { const { error: checkError } = await client.from("team_members").select("user_id").eq("user_id", profile.user_id).single(); if (checkError) throw checkError; }));
    results.push(await timed("Ponte EA local", async () => { const response = await fetch("http://127.0.0.1:8789/api/ea/matches", { cache: "no-store" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); }));
    setChecks(results); setBusy(false);
  };
  const toggleFlag = async (flag) => {
    const { error: updateError } = await client.from("system_flags").update({ enabled: !flag.enabled, updated_by: profile.user_id }).eq("key", flag.key);
    if (updateError) return setError(updateError.message);
    notify(`${flag.label}: ${flag.enabled ? "desativado" : "ativado"}.`); await refresh();
  };
  const activity = useMemo(() => [...syncLogs.map((row) => ({ at: row.completed_at, type: `SYNC · ${row.provider}`, state: row.status, text: row.error_message || `${row.fixtures_created} fixtures criadas · ${row.agenda_created} Agenda` })), ...auditLogs.map((row) => ({ at: row.created_at, type: "COMPETIÇÃO", state: row.action, text: row.result ? JSON.stringify(row.result) : "Evento registrado" }))].sort((a, b) => new Date(b.at) - new Date(a.at)), [syncLogs, auditLogs]);
  if (profile?.access_tier !== "dev") return <AccessDenied page="desenvolvedor" />;
  const tabs = [["overview", "VISÃO GERAL"], ["diagnostics", "DIAGNÓSTICOS"], ["activity", "ATIVIDADE"], ["maintenance", "MANUTENÇÃO"]];
  return <section className="data-page page-enter developer-page"><header className="data-page-header"><div><span>DESENVOLVEDOR</span><h1>Saúde do FC27.</h1><p>Diagnósticos, providers e operação sem expor credenciais.</p></div><button className="secondary developer-refresh" onClick={() => void refresh()}>ATUALIZAR</button></header><MotionTabs className="developer-tabs" items={tabs} active={tab} onChange={setTab} label="Ferramentas de desenvolvimento"/>{error && <p className="developer-error">{error}</p>}{tab === "overview" && <div className="developer-panel motion-panel-enter"><section className="developer-health-grid">{[["PAGES", health?.status === "ok", health?.project || "Sem resposta"], ["SUPABASE", health?.services?.supabase, health?.services?.supabase ? "Configurado" : "Ausente"], ["DISCORD", health?.services?.discord, health?.services?.discord ? "Configurado" : "Ausente"], ["SYNC", health?.services?.competition_sync, health?.services?.competition_sync ? "Secret configurado" : "Ausente"]].map(([label, ok, detail]) => <article key={label} className={ok ? "is-ok" : "is-warning"}><small>{label}</small><b>{ok ? "OPERACIONAL" : "ATENÇÃO"}</b><span>{detail}</span></article>)}</section><section className="developer-deploy"><header><span>DEPLOY ATUAL</span><h2>Cloudflare Pages</h2></header><dl><div><dt>Projeto</dt><dd>{health?.project || "strix-united-fc27"}</dd></div><div><dt>Ambiente</dt><dd>{health?.environment || "—"}</dd></div><div><dt>Branch</dt><dd>{health?.deployment?.branch || "—"}</dd></div><div><dt>Commit</dt><dd>{health?.deployment?.commit_sha?.slice(0, 12) || "—"}</dd></div><div><dt>Verificado</dt><dd>{stamp(health?.checked_at)}</dd></div></dl></section></div>}{tab === "diagnostics" && <section className="developer-panel motion-panel-enter developer-diagnostics"><header><div><span>TESTES AO VIVO</span><h2>Latência e disponibilidade</h2></div><button className="primary" disabled={busy} onClick={() => void runChecks()}>{busy ? "TESTANDO…" : "RODAR TESTES"}</button></header>{checks.length ? checks.map((check) => <article key={check.label} className={check.ok ? "is-ok" : "is-error"}><i /><b>{check.label}</b><span>{check.message}</span><strong>{check.latency} ms</strong></article>) : <p>Rode os testes para validar Pages, Supabase e a ponte EA deste computador.</p>}<footer><small>A ponte EA é local: indisponível em outro dispositivo não significa falha do Pages.</small></footer></section>}{tab === "activity" && <section className="developer-panel motion-panel-enter developer-activity"><header><span>LOGS RECENTES</span><h2>Providers e competições</h2></header>{activity.length ? activity.map((entry, index) => <article key={`${entry.at}-${index}`}><time>{stamp(entry.at)}</time><b>{entry.type}</b><span>{entry.state}</span><p>{entry.text}</p></article>) : <p>Nenhuma atividade visível com as policies atuais.</p>}</section>}{tab === "maintenance" && <section className="developer-panel motion-panel-enter developer-flags"><header><span>FLAGS OPERACIONAIS</span><h2>Manutenção</h2><p>Alterações ficam protegidas por tier Dev e RLS.</p></header>{flags.length ? flags.map((flag) => <article key={flag.key}><div><b>{flag.label}</b><p>{flag.description}</p><small>{flag.key}</small></div><button type="button" className={flag.enabled ? "is-enabled" : ""} onClick={() => void toggleFlag(flag)} aria-pressed={flag.enabled}><i /><span>{flag.enabled ? "ATIVO" : "INATIVO"}</span></button></article>) : <p>As flags serão liberadas após a migration desta rodada.</p>}</section>}</section>;
}
