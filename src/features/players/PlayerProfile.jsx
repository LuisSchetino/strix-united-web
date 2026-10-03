import React, { useMemo } from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { buildPlayerProfile, buildPositionContext, formatPlayerHandle } from "../statistics/statistics-core.js";
import { describeEaArchetype } from "../statistics/ea-archetypes.js";

// The one player ficha. Estatísticas shows it inline; Elenco opens it in a sheet.
// Every value is observed EA data; a metric without a sample renders as "—".

export function SheetIcon({ name }) {
  const paths = {
    goals: <><circle cx="12" cy="12" r="8"/><path d="m12 8 3 2-1 4h-4l-1-4 3-2Z"/></>,
    assists: <><path d="M4 16c4-6 8-8 16-8"/><path d="m15 4 5 4-4 5"/></>,
    rating: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
    passes: <><path d="M4 8h12m0 0-3-3m3 3-3 3M20 16H8m0 0 3-3m-3 3 3 3"/></>,
    tackles: <><circle cx="12" cy="12" r="2.2"/><path d="M4 7.5 9.8 11M20 16.5 14.2 13M6.5 5 4 7.5l.8 3.4M17.5 19 20 16.5l-.8-3.4"/></>,
    saves: <><path d="M6.5 20 4.8 10.5c-.2-1.1.5-2.1 1.5-2.3.9-.2 1.8.3 2.1 1.2l.4 1.1-.9-5.2c-.2-1.1.5-2.1 1.6-2.3 1.1-.2 2.1.5 2.3 1.6l.8 4.5-.4-4c-.1-1.1.7-2 1.8-2.1 1.1-.1 2 .7 2.1 1.8l.5 4.4-.1-2.8c0-1.1.8-2 1.9-2 1.1 0 2 .8 2 1.9l.1 6.7c.1 3.7-2.7 6.8-6.4 7H6.5Z"/></>,
    mom: <path d="m12 3 2.2 4.6 5 .7-3.6 3.5.9 5.1L12 14.8 7.5 16.9l.9-5.1L4.8 8.3l5-.7L12 3Z"/>,
    direction: <><path d="M4 16.5 12 8l8 8.5"/><path d="M12 8v9"/><path d="M8 12h8"/></>,
    reflex: <><path d="M13 3 6 13h5l-1 8 8-12h-5l0-6Z"/></>,
    cross: <><circle cx="7" cy="16" r="2.2"/><path d="M9 15c3-6 6-8 11-9"/><path d="m16 4 4 2-1 4"/></>,
    dive: <><path d="M3 15h10"/><path d="m10 12 3 3-3 3"/><circle cx="18.5" cy="9" r="2.2"/></>,
    parry: <><path d="M12 4 6 7v5c0 3.2 2.2 5.2 6 6.4 3.8-1.2 6-3.2 6-6.4V7L12 4Z"/><path d="M9 11.5 15 9"/></>,
    punch: <><path d="M8 14V8.5a1.5 1.5 0 0 1 3 0V13"/><path d="M11 13V7.2a1.4 1.4 0 0 1 2.8 0V13"/><path d="M13.8 12.2V8.4a1.3 1.3 0 0 1 2.6 0v5.2c0 3-2 5.2-5.2 5.4H9.2C7 19 5.5 17.2 5.5 15.2V12"/></>,
    form: <><path d="M4 16.5 9 11l3 3 8-8"/><path d="M14 6h6v6"/></>,
    records: <><path d="M8 4h8v3a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5.5A2.5 2.5 0 0 0 8 8.5M16 6h2.5A2.5 2.5 0 0 1 16 8.5"/><path d="M12 11v3M9 20h6M10 17h4"/></>,
  };
  return <svg className="statistics-sheet-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.rating}</svg>;
}

export const display = (value, suffix = "") => value === null || value === undefined ? "—" : `${value}${suffix}`;
export const observed = (player, metric, value = player[metric]) => player.metricSamples?.[metric] > 0 ? display(value) : "—";
const displayHandle = formatPlayerHandle;

const LIMITED_SAMPLE_GAMES = 3;
function sampleStatus(player) {
  if (player.noSample || !(player.validGames > 0)) return { key: "none", label: "SEM AMOSTRA" };
  if (player.validGames < LIMITED_SAMPLE_GAMES) return { key: "limited", label: "AMOSTRA LIMITADA" };
  return { key: "ok", label: "AMOSTRA SUFICIENTE" };
}

export function PlayerProfile({ player, players, matches, workspace, onClose }) {
  const profile = useMemo(() => buildPlayerProfile(player, matches, { aliases: workspace.aliases }), [player, matches, workspace.aliases]);
  if (!player || !profile) return null;
  const archetype = player.archetypeSnapshots?.at(-1);
  const archetypeInfo = archetype ? describeEaArchetype(archetype.archetypeId) : null;
  const positions = player.positions?.length ? player.positions.join(" · ") : player.eaPositions?.join(" · ") || "EA FC";
  const rosterEntry = (workspace.players || []).find((item) => String(item.id) === String(player.playerId));
  const shirt = rosterEntry?.shirt_number;
  const photoUrl = rosterEntry?.avatar_path && typeof workspace.assetUrl === "function" ? workspace.assetUrl(rosterEntry.avatar_path) : rosterEntry?.external_avatar_url || "";
  const status = sampleStatus(player);
  const lastGame = profile.appearances.find((row) => row.match);
  const lastMatch = lastGame?.match;
  const lastScore = lastMatch && Number.isFinite(Number(lastMatch.strix_score)) && Number.isFinite(Number(lastMatch.opponent_score)) ? `${Number(lastMatch.strix_score)}–${Number(lastMatch.opponent_score)}` : "";
  const dateLabel = (value) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(value)) : "Data indisponível";
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const contextMetrics = player.goalkeeper ? [["averageRating", "NOTA MÉDIA"], ["savesPerGame", "DEFESAS / JOGO"], ["cleanSheets", "SEM SOFRER GOL"]] : [["averageRating", "NOTA MÉDIA"], ["passAccuracy", "PRECISÃO DE PASSE"], ["tackles", "DESARMES"]];
  const comparisonLabels = player.goalkeeper ? [["rating", "NOTA MÉDIA", ""], ["savesPerGame", "DEFESAS / JOGO", ""]] : [["rating", "NOTA MÉDIA", ""], ["passAccuracy", "PRECISÃO", "%"], ["tacklesPerGame", "DESARMES / JOGO", ""], ["goalAssists", "G+A RECENTE", ""]];
  const seasonMetrics = player.goalkeeper
    ? [["TEMPORADA · NOTA", display(player.averageRating)], ["DEFESAS", observed(player, "saves")], ["DEFESAS / JOGO", player.goalkeeperGames > 0 && player.metricSamples?.saves > 0 ? display(player.savesPerGame) : "—"], ["SEM SOFRER GOL", observed(player, "cleansheetsgk", player.cleanSheetsGk)], ["MOTM", player.metricSamples?.mom > 0 ? display(player.mom) : "—"]]
    : [["TEMPORADA · NOTA", display(player.averageRating)], ["G · A · G+A", `${observed(player, "goals")} · ${observed(player, "assists")} · ${player.metricSamples?.goals > 0 && player.metricSamples?.assists > 0 ? display(player.goalAssists) : "—"}`], ["PASSES CERTOS", observed(player, "passesMade")], ["DESARMES", observed(player, "tackles")], ["MOTM", player.metricSamples?.mom > 0 ? display(player.mom) : "—"]];
  const recordValue = (record) => record.label.includes("PRECISÃO") ? `${Number(record.value).toFixed(1)}%` : record.label === "MAIOR NOTA EA" ? Number(record.value).toFixed(1) : Number.isInteger(Number(record.value)) ? Number(record.value) : Number(record.value).toFixed(1);
  return <section className="statistics-individual-profile">
    <header className="statistics-profile-identity statistics-player-card">
      <div className="statistics-player-card-main">
        {photoUrl ? <ClubLogo className="statistics-player-card-photo" name={player.name} url={photoUrl} kind="photo" size={64} priority /> : <span className="statistics-player-card-number" aria-label={shirt == null ? "Sem número" : `Camisa ${shirt}`}>{shirt == null || shirt === "" ? "—" : String(shirt).padStart(2, "0")}</span>}
        <div><h2>{player.name}</h2><p>{[displayHandle(player.handle) !== displayHandle(player.name) ? displayHandle(player.handle) : "", positions, player.memberType && player.memberType !== "complete" ? player.memberType : ""].filter(Boolean).join(" · ")}{archetypeInfo?.verified ? ` · ${archetypeInfo.name}` : ""}</p></div>
      </div>
      <div className="statistics-player-card-side">
        <ul className="statistics-player-status" aria-label="Status no elenco">
          <li>ATIVO</li>
          {String(player.memberType || "").toLowerCase().startsWith("teste") && <li>EM TESTE</li>}
          <li className={`is-sample is-${status.key}`}>{status.label}</li>
        </ul>
        <small>{player.noSample ? "Sem atuações registradas" : `${player.validGames || 0} atuações válidas · ${player.games || 0} registros EA`}</small>
        {onClose && <CloseButton onClick={onClose} label="Fechar ficha" />}
      </div>
    </header>
    {lastMatch && <section className="statistics-last-game" aria-label="Última atuação"><small>ÚLTIMA ATUAÇÃO</small><b>{lastMatch.opponent_name || lastMatch.opponent || "Partida"}</b>{lastScore && <span>{lastScore}</span>}<span>{dateLabel(lastMatch.played_at)}</span>{lastGame.rating != null && Number.isFinite(Number(lastGame.rating)) && <strong>NOTA {Number(lastGame.rating).toFixed(1)}</strong>}{player.goalkeeper ? (Number.isFinite(Number(lastGame.saves)) ? <em>{Number(lastGame.saves)} defesas</em> : null) : (Number.isFinite(Number(lastGame.goals)) && Number.isFinite(Number(lastGame.assists)) ? <em>G/A {Number(lastGame.goals)}/{Number(lastGame.assists)}</em> : null)}</section>}
    {player.noSample ? <p className="statistics-profile-empty">Ainda não há atuação reconciliada com a EA para {player.name}. Forma, recordes e contexto por posição aparecem depois da primeira partida importada com este jogador.</p> : <>
    <nav className="statistics-profile-shortcuts" aria-label="Atalhos da ficha"><button type="button" onClick={() => jump("statistics-profile-form")}><SheetIcon name="form"/>VER FORMA</button><button type="button" onClick={() => jump("statistics-profile-records")}><SheetIcon name="records"/>VER RECORDES</button></nav>
    <div className="statistics-profile-season">{seasonMetrics.map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
    <div className="statistics-profile-lower">
      <section id="statistics-profile-form" className="statistics-profile-form"><header><div><h3>Forma recente</h3></div></header>{profile.recent.length ? <ol>{profile.recent.map((row, index) => <li key={`${row.match.id || row.match.played_at}-${index}`}><strong>{Number(row.rating).toFixed(1)}</strong><span>{row.match.opponent_name || row.match.opponent || "Adversário"}</span><small>{dateLabel(row.match.played_at)}</small></li>)}</ol> : <p>Sem notas EA válidas neste recorte.</p>}
        <div className="statistics-form-comparisons">{comparisonLabels.map(([key, label, suffix]) => { const item = profile.comparisons[key]; return item ? <article key={key}><small>{label}</small><b>{display(item.recent, suffix)}</b><span>{item.delta > 0 ? "+" : ""}{display(item.delta, item.suffix === "pp" ? " pp" : "")} vs temporada</span></article> : null; })}</div>
      </section>
      <section id="statistics-profile-records" className="statistics-profile-records"><header><div><h3>Recordes FC27</h3></div></header>{profile.records.length ? <ul>{profile.records.slice(0, player.goalkeeper ? 8 : 7).map((record) => <li key={record.label}><span><small>{record.label}</small><b>{recordValue(record)}</b></span><em>{record.match.opponent_name || record.match.opponent || "Partida"} · {dateLabel(record.match.played_at)}</em></li>)}</ul> : <p>Sem amostra individual válida para recordes.</p>}
        <div className="statistics-position-context"><small>CONTEXTO · {player.goalkeeper ? "GOL" : "POSIÇÃO"}</small>{contextMetrics.map(([metric, label]) => { const context = buildPositionContext(player, players, metric); const contextValue = metric === "cleanSheets" ? (player.goalkeeper && player.metricSamples?.cleansheetsgk > 0 ? player.cleanSheetsGk : player.cleanSheets) : player[metric]; const known = contextValue !== null && contextValue !== undefined && contextValue !== "" && Number.isFinite(Number(contextValue)); const hasMetricSample = metric === "averageRating" ? player.ratings > 0 : metric === "cleanSheets" ? (player.metricSamples?.cleansheetsdef || 0) + (player.metricSamples?.cleansheetsgk || 0) > 0 : metric === "savesPerGame" ? player.metricSamples?.saves > 0 && player.goalkeeperGames > 0 : Boolean(player.metricSamples?.[metric]); const groupWord = context.group === "GOL" ? "GKs" : context.group === "DEF" ? "DEFs" : context.group === "ATA" ? "ATAs" : "MEIs"; return <span key={metric}><b>{label}</b><em>{!hasMetricSample || !known ? "Sem amostra suficiente" : context.total > 1 ? `${display(contextValue)} · ${context.rank}º entre ${context.total} ${groupWord}` : display(contextValue)}</em></span>; })}</div>
      </section>
    </div>
    </>}
  </section>;
}
