import React, { useEffect, useMemo, useState } from "react";
import { normalizeName } from "../matches/import-core.js";
import { aggregateCompetitionHistory, detectParticipationEnd } from "./history-core.js";
import { calculateQualificationScenarios } from "./scenario-engine.js";
import { archiveCompetitionEdition, saveCompetitionPreview } from "./competition-storage.js";
import { extractPalette } from "./palette-core.js";
import "./competitions.css";

const fallbackPalettes = {
  ccb: ["#793cff", "#fab721", "#cf4cff", "#1b8cff"],
  lb_esports: ["#26c96f", "#00b7ff", "#ffd54a", "#754aff"],
};
const dateTime = (value) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Nunca";
const canDevelop = (profile) => profile?.access_tier === "dev";

async function analyzeCompetition(client, url) {
  const { data } = await client.auth.getSession();
  const response = await fetch("/api/competitions/analyze", { method: "POST", headers: { authorization: `Bearer ${data.session?.access_token || ""}`, "content-type": "application/json" }, body: JSON.stringify({ url }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || payload.error || "Não foi possível analisar a competição.");
  return payload.preview;
}

function ImportCompetitionModal({ client, profile, workspace, close }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [palette, setPalette] = useState([]);
  const [accent, setAccent] = useState("#168cff");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const analyze = async () => {
    setBusy("Analisando provider"); setError("");
    try {
      const result = await analyzeCompetition(client, url);
      setPreview(result);
      const extracted = await extractPalette(client, result.logo).catch(() => []);
      const colors = extracted.length ? extracted : fallbackPalettes[result.provider] || ["#168cff"];
      setPalette(colors); setAccent(colors[0]);
    } catch (analysisError) { setError(analysisError.message); }
    finally { setBusy(""); }
  };
  const add = async () => {
    setBusy("Adicionando competição"); setError("");
    try { await saveCompetitionPreview(client, profile, preview, palette, accent); await workspace.refresh(); close(); }
    catch (saveError) { setError(saveError.code === "42P01" ? "A migration de Competições precisa ser aplicada antes de salvar." : saveError.message); }
    finally { setBusy(""); }
  };
  return <div className="competition-modal-layer"><section className="competition-import-modal" role="dialog" aria-modal="true" aria-label="Adicionar competição">
    <header><div><span>DEV · PROVIDER EXTERNO</span><h2>Adicionar campeonato</h2><p>A fonte é analisada no backend e só será salva após sua revisão.</p></div><button onClick={close} aria-label="Fechar">×</button></header>
    <div className="competition-url-row"><label>URL DO CAMPEONATO<input autoFocus value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://ccbclubs.com.br/fifa.php?..." /></label><button className="primary" disabled={!url || !!busy} onClick={() => void analyze()}>{busy || "ANALISAR"}</button></div>
    {error && <p className="competition-error" role="alert">{error}</p>}
    {preview && <section className="competition-import-preview" style={{ "--competition-accent": accent }}>
      <div className="competition-preview-hero">{preview.logo ? <img src={preview.logo} alt="" /> : <span>{preview.name.slice(0, 2)}</span>}<div><small>{preview.organization} · {preview.provider}</small><h3>{preview.name}</h3><p>{preview.type || preview.phase} · {preview.teamCount} times</p></div></div>
      <dl><div><dt>Fase</dt><dd>{preview.phase}</dd></div><div><dt>Grupos</dt><dd>{preview.groups.length || "—"}</dd></div><div><dt>Grupo do Strix</dt><dd>{preview.strixGroup || "Não identificado"}</dd></div><div><dt>Última atualização</dt><dd>{dateTime(preview.fetchedAt)}</dd></div></dl>
      <div className="palette-picker"><span>ACCENT DA COMPETIÇÃO</span><div>{palette.map((color) => <button key={color} className={accent === color ? "selected" : ""} style={{ background: color }} onClick={() => setAccent(color)} aria-label={`Usar cor ${color}`} />)}</div></div>
      <footer><a href={preview.source} target="_blank" rel="noreferrer">ABRIR FONTE</a><button className="primary" disabled={!!busy} onClick={() => void add()}>{busy || "ADICIONAR CAMPEONATO"}</button></footer>
    </section>}
  </section></div>;
}

function Standings({ groups, accent }) {
  const initial = groups.find((group) => group.isStrixGroup)?.name || groups[0]?.name;
  const [selected, setSelected] = useState(initial);
  useEffect(() => { if (!groups.some((group) => group.name === selected)) setSelected(initial); }, [groups, initial, selected]);
  const group = groups.find((item) => item.name === selected) || groups[0];
  if (!group) return null;
  return <section className="competition-section"><header><div><span>CLASSIFICAÇÃO</span><h2>{group.name}</h2></div>{groups.length > 1 && <nav>{groups.map((item) => <button className={item.name === group.name ? "active" : ""} onClick={() => setSelected(item.name)} key={item.name}>{item.name}</button>)}</nav>}</header><div className="standings-scroll"><div className="standings-table" role="table" style={{ "--competition-accent": accent }}><header role="row"><span>#</span><span>CLUBE</span><span>P</span><span>J</span><span>V</span><span>E</span><span>D</span><span>GP</span><span>GC</span><span>SG</span><span>FORMA</span></header>{group.standings.map((row) => <article role="row" className={row.isStrix ? "is-strix" : ""} key={row.team}><b>{row.position}</b><div>{row.logo ? <img src={row.logo} alt="" /> : <i>{row.team.slice(0, 2)}</i>}<strong>{row.team}{row.isStrix && <small>STRIX</small>}</strong></div><b>{row.points}</b><span>{row.played}</span><span>{row.wins}</span><span>{row.draws}</span><span>{row.losses}</span><span>{row.goalsFor}</span><span>{row.goalsAgainst}</span><span>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span><div className="form-five">{(row.form || []).map((form, index) => <i key={`${form}-${index}`} className={form.toLowerCase()} title={`Forma publicada pelo provider: ${form}`}>{form}</i>)}</div></article>)}</div></div></section>;
}

function CompetitionGames({ competition, edition, workspace }) {
  const matches = workspace.matches.filter((match) => match.competition_id === competition.id || (!match.competition_id && normalizeName(match.competition_name) === normalizeName(competition.name)));
  const agenda = workspace.agenda.filter((match) => match.competition_id === competition.id || (!match.competition_id && normalizeName(match.competition_name) === normalizeName(competition.name)));
  return <><section className="competition-section"><header><div><span>AGENDA DO CAMPEONATO</span><h2>Próximos jogos do Strix</h2></div></header>{agenda.length ? <div className="competition-timeline" tabIndex="0">{agenda.map((match) => <article key={match.id}><small>{match.status}</small><time>{dateTime(match.scheduled_at)}</time><h3>STRIX × {match.opponent_name}</h3><p>{match.competition_name}</p></article>)}</div> : <p className="competition-empty">Nenhum jogo desta competição está na Agenda.</p>}</section><section className="competition-section"><header><div><span>RESULTADOS</span><h2>Partidas anteriores</h2></div></header>{matches.length ? <div className="competition-results">{matches.map((match) => <article key={match.id}><time>{dateTime(match.played_at)}</time><strong>STRIX {match.strix_score} × {match.opponent_score} {match.opponent_name}</strong><small>{match.competition_name}</small></article>)}</div> : <p className="competition-empty">Nenhum resultado interno vinculado a esta edição.</p>}</section></>;
}

function Knockout({ snapshot, accent }) {
  if (!snapshot?.knockout?.stages?.length) return null;
  return <section className="competition-section knockout-section" style={{ "--competition-accent": accent }}><header><div><span>MATA-MATA</span><h2>Chaveamento</h2></div></header><div className="bracket-scroll"><div className="bracket-grid">{snapshot.knockout.stages.map((stage, index) => <section key={stage}><h3>{stage}</h3><div>{snapshot.knockout.teams.filter((_, teamIndex) => teamIndex % snapshot.knockout.stages.length === index).map((team) => <article className={/\bstrix\b/i.test(team) ? "is-strix" : ""} key={team}>{team}</article>)}</div></section>)}</div></div><p className="provider-note">Confrontos e placares são exibidos quando o provider os publica em estrutura identificável.</p></section>;
}

function ScenarioPanel({ edition, snapshot }) {
  const group = snapshot?.groups?.find((item) => item.isStrixGroup) || snapshot?.groups?.[0];
  if (!group || !edition.qualification_slots || !snapshot.fixtures?.length) return <section className="competition-section scenario-panel"><header><div><span>CENÁRIOS</span><h2>Classificação matemática</h2></div></header><p className="competition-empty">Configure as vagas e aguarde fixtures completas do provider para calcular cenários confirmados. Critério de desempate não confirmado.</p></section>;
  const result = calculateQualificationScenarios({ standings: group.standings.map((row) => ({ name: row.team, ...row })), fixtures: snapshot.fixtures, qualificationSlots: edition.qualification_slots, tieBreakRules: edition.tie_break_rules || [] });
  return <section className="competition-section scenario-panel"><header><div><span>CENÁRIOS</span><h2>Para classificar</h2></div></header><div className="scenario-metrics"><article><small>POSIÇÃO</small><b>{result.currentPosition}º</b></article><article><small>DISTÂNCIA</small><b>{result.distanceToCutoff} pts</b></article><article><small>JOGOS</small><b>{result.remainingMatches}</b></article><article><small>DISPONÍVEIS</small><b>{result.pointsAvailable} pts</b></article></div>{result.tieBreakWarning && <p className="competition-warning">{result.tieBreakWarning}</p>}<div className="scenario-list">{result.scenarios.map((scenario) => <article key={scenario.result}><b>{scenario.result === "V" ? "Vitória" : scenario.result === "E" ? "Empate" : "Derrota"}</b><span>{scenario.guaranteed ? "Classifica em todos os cenários" : scenario.possible ? `${scenario.qualifyingCombinations}/${scenario.totalCombinations} combinações classificam` : "Classificação impossível"}</span></article>)}</div></section>;
}

function HistoryPanel({ editions }) {
  const groups = aggregateCompetitionHistory(editions);
  return <section className="competition-section history-panel"><header><div><span>HISTÓRICO</span><h2>Evolução do Strix</h2></div></header>{groups.length ? groups.map((group) => <article key={group.competitionId}><header><div><h3>{group.name}</h3><span>{group.editions.length} participações · {group.titles} título(s)</span></div><b>{group.efficiency}%</b></header><div className="history-evolution">{group.editions.map((edition, index) => <div key={edition.id || edition.label}><i style={{ height: `${Math.max(12, edition.campaignLevel)}%` }} /><span>{edition.outcome || edition.final_stage || edition.final_position ? `${edition.final_position || ""} ${edition.outcome || edition.final_stage || ""}`.trim() : "Participação"}</span><small>{edition.label || `Edição ${index + 1}`}</small></div>)}</div><dl><div><dt>J</dt><dd>{group.games}</dd></div><div><dt>V</dt><dd>{group.wins}</dd></div><div><dt>E</dt><dd>{group.draws}</dd></div><div><dt>D</dt><dd>{group.losses}</dd></div><div><dt>GP</dt><dd>{group.goalsFor}</dd></div><div><dt>GC</dt><dd>{group.goalsAgainst}</dd></div><div><dt>SG</dt><dd>{group.goalDifference}</dd></div></dl></article>) : <p className="competition-empty">Nenhuma edição foi enviada ao histórico.</p>}</section>;
}

function CompetitionDetail({ competition, edition, sources, workspace, client, profile, close }) {
  const standingsSource = sources.find((source) => source.source_kind === "standings");
  const knockoutSource = sources.find((source) => source.source_kind === "knockout");
  const snapshot = standingsSource?.snapshot || knockoutSource?.snapshot || {};
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [outcome, setOutcome] = useState(edition?.outcome || "Participação encerrada");
  const gamesAvailable = workspace.matches.some((match) => match.competition_id === competition.id || normalizeName(match.competition_name) === normalizeName(competition.name)) || workspace.agenda.some((match) => match.competition_id === competition.id || normalizeName(match.competition_name) === normalizeName(competition.name));
  const tabs = [["overview", "Visão geral"], snapshot.groups?.length && ["standings", "Classificação"], gamesAvailable && ["games", "Jogos"], knockoutSource && ["knockout", "Mata-mata"], snapshot.groups?.length && ["scenarios", "Cenários"]].filter(Boolean);
  const sync = async (source) => { setBusy("Sincronizando"); setError(""); try { const preview = await analyzeCompetition(client, source.source_url); await saveCompetitionPreview(client, profile, preview, competition.palette, competition.accent_color); await workspace.refresh(); } catch (syncError) { setError(syncError.message); } finally { setBusy(""); } };
  const endDetection = detectParticipationEnd({ edition, fixtures: snapshot.fixtures || [] });
  return <section className="competition-detail page-enter" style={{ "--competition-accent": competition.accent_color }}><button className="competition-back" onClick={close}>← COMPETIÇÕES</button><header className="competition-detail-hero">{competition.logo_url ? <img src={competition.logo_url} alt="" /> : <span>{competition.name.slice(0, 2)}</span>}<div><small>{competition.organization || "COMPETIÇÃO"}</small><h1>{competition.name}</h1><p>{edition?.label} · {edition?.format}</p></div><aside><span>ÚLTIMA SINCRONIZAÇÃO</span><b>{dateTime(standingsSource?.last_synced_at || knockoutSource?.last_synced_at)}</b>{canDevelop(profile) && sources[0] && <button disabled={!!busy} onClick={() => void sync(sources[0])}>{busy || "ATUALIZAR AGORA"}</button>}</aside></header>{error && <p className="competition-error">{error}</p>}<nav className="competition-tabs">{tabs.map(([id, label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav>{tab === "overview" && <><section className="competition-overview-grid"><article><small>FASE</small><b>{snapshot.phase || edition?.format}</b></article><article><small>TIMES</small><b>{snapshot.teamCount || "—"}</b></article><article><small>GRUPO DO STRIX</small><b>{snapshot.strixGroup || "—"}</b></article><article><small>STATUS</small><b>{edition?.status || "ativo"}</b></article></section><CompetitionGames competition={competition} edition={edition} workspace={workspace}/>{canDevelop(profile) && edition?.status !== "historical" && <section className="archive-callout"><div><span>ENCERRAMENTO</span><h2>{endDetection.outcome || "Enviar edição ao histórico"}</h2><p>{endDetection.ended ? "A estrutura indica o fim da participação." : "Revise o resumo antes de arquivar manualmente."}</p></div><button onClick={() => { setOutcome(endDetection.outcome || outcome); setArchiveOpen(true); }}>ENVIAR PARA HISTÓRICO</button></section>}</>}{tab === "standings" && <Standings groups={snapshot.groups || []} accent={competition.accent_color}/>} {tab === "games" && <CompetitionGames competition={competition} edition={edition} workspace={workspace}/>} {tab === "knockout" && <Knockout snapshot={knockoutSource?.snapshot} accent={competition.accent_color}/>} {tab === "scenarios" && <ScenarioPanel edition={edition} snapshot={snapshot}/>} {archiveOpen && <div className="competition-modal-layer"><section className="archive-preview"><span>PREVIEW DO HISTÓRICO</span><h2>{competition.name} · {edition.label}</h2><label>SITUAÇÃO FINAL<input value={outcome} onChange={(event) => setOutcome(event.target.value)} /></label><p>Jogos internos e dados ricos permanecerão vinculados; nenhuma partida será copiada ou apagada.</p><footer><button onClick={() => setArchiveOpen(false)}>CANCELAR</button><button className="primary" onClick={async () => { setBusy("Arquivando"); try { await archiveCompetitionEdition(client, profile, edition, outcome); await workspace.refresh(); setArchiveOpen(false); close(); } catch (archiveError) { setError(archiveError.message); } finally { setBusy(""); } }}>CONFIRMAR HISTÓRICO</button></footer></section></div>}</section>;
}

export function CompetitionsPage({ profile, workspace, client }) {
  const [modal, setModal] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState("active");
  const active = workspace.competitions.filter((competition) => workspace.competitionEditions.some((edition) => edition.competition_id === competition.id && edition.status !== "historical"));
  const historicalEditions = workspace.competitionEditions.filter((edition) => edition.status === "historical").map((edition) => ({ ...edition, competition: workspace.competitions.find((competition) => competition.id === edition.competition_id) }));
  const selected = workspace.competitions.find((competition) => competition.id === selectedId);
  const edition = workspace.competitionEditions.find((item) => item.competition_id === selectedId && (view === "historical" ? item.status === "historical" : item.status !== "historical"));
  if (selected) return <CompetitionDetail competition={selected} edition={edition} sources={workspace.competitionSources.filter((source) => source.edition_id === edition?.id)} workspace={workspace} client={client} profile={profile} close={() => setSelectedId("")} />;
  return <section className="competitions-page page-enter"><header className="data-page-header"><div><span>COMPETIÇÕES</span><h1>Temporadas com contexto.</h1><p>Classificação, jogos, mata-mata e história conectados à mesma edição.</p></div>{canDevelop(profile) && <button className="primary" onClick={() => setModal(true)}>+ ADICIONAR CAMPEONATO</button>}</header>{workspace.schemaPending && <p className="competition-warning">A migration local de Competições está pronta, mas ainda não foi aplicada ao Supabase remoto.</p>}<nav className="competition-view-tabs"><button className={view === "active" ? "active" : ""} onClick={() => setView("active")}>ATIVAS</button><button className={view === "historical" ? "active" : ""} onClick={() => setView("historical")}>HISTÓRICO</button></nav>{view === "active" ? <div className="competition-card-grid">{active.length ? active.map((competition) => { const currentEdition = workspace.competitionEditions.find((item) => item.competition_id === competition.id && item.status !== "historical"); const source = workspace.competitionSources.find((item) => item.edition_id === currentEdition?.id); return <button key={competition.id} onClick={() => setSelectedId(competition.id)} style={{ "--competition-accent": competition.accent_color }}><div>{competition.logo_url ? <img src={competition.logo_url} alt="" /> : <span>{competition.name.slice(0, 2)}</span>}</div><small>{competition.organization || "COMPETIÇÃO"}</small><h2>{competition.name}</h2><p>{currentEdition?.label} · {source?.snapshot?.phase || currentEdition?.format}</p><footer><span>{source?.snapshot?.teamCount || "—"} times</span><b>ABRIR →</b></footer></button>; }) : <p className="competition-empty">Nenhuma competição ativa cadastrada.</p>}</div> : <HistoryPanel editions={historicalEditions}/>} {modal && <ImportCompetitionModal client={client} profile={profile} workspace={workspace} close={() => setModal(false)} />}</section>;
}
