import React, { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "../../ui/AccessDenied.jsx";
import { MotionTabs, notify } from "../../ui/motion/motion.jsx";
import "./developer.css";
import { PageHeader } from "../../ui/PageHeader.jsx";
import { useRemembered } from "../../ui/useRemembered.js";
import { ActivityList } from "../../ui/ActivityList.jsx";

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
  const [tab, setTab] = useRemembered("developer-tab", "overview", { allowed: ["overview", "diagnostics", "activity", "maintenance"] });
  const [health, setHealth] = useState(null);
  const [flags, setFlags] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [checks, setChecks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingFlags, setPendingFlags] = useState(() => new Set());

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
  // The switch answers the click at once; the write follows, and a refused write puts it back.
  const toggleFlag = async (flag) => {
    if (pendingFlags.has(flag.key)) return;
    const next = !flag.enabled;
    setFlags((current) => current.map((item) => item.key === flag.key ? { ...item, enabled: next } : item));
    setPendingFlags((current) => new Set(current).add(flag.key));
    const { error: updateError } = await client.from("system_flags").update({ enabled: next, updated_by: profile.user_id }).eq("key", flag.key);
    setPendingFlags((current) => { const rest = new Set(current); rest.delete(flag.key); return rest; });
    if (updateError) {
      setFlags((current) => current.map((item) => item.key === flag.key ? { ...item, enabled: flag.enabled } : item));
      setError(updateError.message);
      notify(`${flag.label}: não foi possível alterar.`, "error");
      return;
    }
    notify(`${flag.label}: ${next ? "ativado" : "desativado"}.`);
  };
  const activity = useMemo(() => [...syncLogs.map((row) => ({ at: row.completed_at, type: `SYNC · ${row.provider}`, state: row.status, text: row.error_message || `${row.fixtures_created} fixtures criadas · ${row.agenda_created} Agenda` })), ...auditLogs.map((row) => ({ at: row.created_at, type: "COMPETIÇÃO", state: row.action, text: row.result ? JSON.stringify(row.result) : "Evento registrado" }))].sort((a, b) => new Date(b.at) - new Date(a.at)), [syncLogs, auditLogs]);
  if (profile?.access_tier !== "dev") return <AccessDenied page="desenvolvedor" />;
  const tabs = [["overview", "VISÃO GERAL"], ["diagnostics", "DIAGNÓSTICOS"], ["activity", "ATIVIDADE"], ["maintenance", "MANUTENÇÃO"]];
  return <section className="data-page page-enter developer-page"><PageHeader title="Saúde do FC27." description="Diagnósticos, providers e operação sem expor credenciais." actions={<button className="secondary developer-refresh" onClick={() => void refresh()}>ATUALIZAR</button>} /><MotionTabs className="developer-tabs" items={tabs} active={tab} onChange={setTab} label="Ferramentas de desenvolvimento"/>{error && <p className="developer-error">{error}</p>}{tab === "overview" && <div className="developer-panel motion-panel-enter"><section className="developer-health-grid">{[["PAGES", health?.status === "ok", health?.project || "Sem resposta"], ["SUPABASE", health?.services?.supabase, health?.services?.supabase ? "Configurado" : "Ausente"], ["DISCORD", health?.services?.discord, health?.services?.discord ? "Configurado" : "Ausente"], ["SYNC", health?.services?.competition_sync, health?.services?.competition_sync ? "Secret configurado" : "Ausente"], ["EA SYNC", health?.services?.ea_sync && health?.ea_sync?.health === "ok", health?.ea_sync?.host ? `${health.ea_sync.host} · ${health.ea_sync.health || "—"}` : (health?.services?.ea_sync ? health?.ea_sync?.health || "erro" : "Não configurado")]].map(([label, ok, detail]) => <article key={label} className={ok ? "is-ok" : "is-warning"}><small>{label}</small><b>{ok ? "OPERACIONAL" : "ATENÇÃO"}</b><span>{detail}</span></article>)}</section><section className="developer-deploy"><header><span>DEPLOY ATUAL</span><h2>Cloudflare Pages</h2></header><dl><div><dt>Projeto</dt><dd>{health?.project || "strix-united-fc27"}</dd></div><div><dt>Ambiente</dt><dd>{health?.environment || "—"}</dd></div><div><dt>Branch</dt><dd>{health?.deployment?.branch || "—"}</dd></div><div><dt>Commit</dt><dd>{health?.deployment?.commit_sha?.slice(0, 12) || "—"}</dd></div><div><dt>Verificado</dt><dd>{stamp(health?.checked_at)}</dd></div><div><dt>EA host</dt><dd>{health?.ea_sync?.host || "—"}</dd></div><div><dt>Club FC27</dt><dd>{health?.fc27?.clubId || health?.ea_sync?.clubId || "—"}</dd></div><div><dt>Platform</dt><dd>{health?.fc27?.platform || health?.ea_sync?.platform || "—"}</dd></div></dl></section></div>}{tab === "diagnostics" && <section className="developer-panel motion-panel-enter developer-diagnostics"><header><div><span>TESTES AO VIVO</span><h2>Latência e disponibilidade</h2></div><button className="primary" disabled={busy} onClick={() => void runChecks()}>{busy ? "TESTANDO…" : "RODAR TESTES"}</button></header>{checks.length ? checks.map((check) => <article key={check.label} className={check.ok ? "is-ok" : "is-error"}><i /><b>{check.label}</b><span>{check.message}</span><strong>{check.latency} ms</strong></article>) : <p>Rode os testes para validar Pages, Supabase e a ponte EA deste computador.</p>}<footer><small>A ponte EA é local: indisponível em outro dispositivo não significa falha do Pages.</small></footer></section>}{tab === "activity" && <section className="developer-panel motion-panel-enter developer-club-activity"><header><span>CLUBE</span><h2>Quem mudou o quê</h2></header><ActivityList client={client} limit={40} title="Agenda, lista da noite, Biblioteca e recado" /></section>}{tab === "activity" && <section className="developer-panel motion-panel-enter developer-activity"><header><span>LOGS RECENTES</span><h2>Providers e competições</h2></header>{activity.length ? activity.map((entry, index) => <article key={`${entry.at}-${index}`}><time>{stamp(entry.at)}</time><b>{entry.type}</b><span>{entry.state}</span><p>{entry.text}</p></article>) : <p>Nenhuma atividade visível com as policies atuais.</p>}</section>}{tab === "maintenance" && <section className="developer-panel motion-panel-enter developer-flags"><header><span>FLAGS OPERACIONAIS</span><h2>Manutenção</h2><p>Alterações ficam protegidas por tier Dev e RLS.</p></header>{flags.length ? flags.map((flag) => <article key={flag.key}><div><b>{flag.label}</b><p>{flag.description}</p><small>{flag.key}</small></div><button type="button" role="switch" className={`developer-switch${flag.enabled ? " is-enabled" : ""}${pendingFlags.has(flag.key) ? " is-pending" : ""}`} onClick={() => void toggleFlag(flag)} aria-checked={flag.enabled} aria-busy={pendingFlags.has(flag.key)} aria-label={flag.label}><span className="developer-switch-track" aria-hidden="true"><i /></span><span className="developer-switch-label">{flag.enabled ? "ATIVO" : "INATIVO"}</span></button></article>) : <p>As flags serão liberadas após a migration desta rodada.</p>}</section>}</section>;
}
