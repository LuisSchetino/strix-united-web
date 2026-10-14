import React, { useMemo, useState } from "react";
import { useMinuteClock } from "../../ui/useMinuteClock.js";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { RESULT_LABEL, STARTED_WINDOW_MIN, buildHomeModel, kickoffTime, myNight, nightChecklist, shortDate } from "./home-core.js";
import { matchStake } from "../competitions/match-stake.js";
import { canEditLineup, canPublishNotice } from "../../access.js";
import { notify } from "../../ui/motion/motion.jsx";
import { agoLabel, rescheduleLabel, rescheduleOf } from "../notifications/notifications-core.js";
import { NoticeEditor } from "./NoticeEditor.jsx";
import { AnimatedNumber } from "../../ui/motion/motion.jsx";
import { LiveBoard } from "./LiveBoard.jsx";
import "./home.css";

const ZONE = "America/Sao_Paulo";
const TIER_LABEL = { dev: "Desenvolvimento", diretoria: "Diretoria", conselho: "Conselho", player: "Jogador", teste: "Teste" };

const commitmentDate = (value) => new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, weekday: "short", day: "2-digit", month: "short" })
  .format(new Date(value)).replace(/\./g, "").replace(",", " ·").replace(/ de /i, " ").toLocaleUpperCase("pt-BR");
const longDate = (now) => new Intl.DateTimeFormat("pt-BR", { timeZone: ZONE, weekday: "long", day: "numeric", month: "long" }).format(now);
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

function Strix({ size = 44, priority = false }) {
  return <ClubLogo name="Strix United" url={STRIX_BRAND.logo} size={size} sizes={`${size}px`} priority={priority} className="home-crest" />;
}

function Opponent({ match, size = 44, priority = false }) {
  return <ClubLogo name={match?.opponent_name} url={match?.resolvedLogo} size={size} sizes={`${size}px`} priority={priority} className="home-crest is-opponent" />;
}

function Icon({ path, size = 16 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>;
}
// The club is written the way the opponent is: an all-caps fixture reads "STRIX UNITED".
const strixName = (opponent) => (/\p{Ll}/u.test(String(opponent || "")) ? "Strix United" : "STRIX UNITED");
const ARROW = "M5 12h14M13 6l6 6-6 6";
const CHECK = "m5 12.5 4.2 4.2L19 7";
const DOT = "M12 12h.01";

function NowBlock({ next, navigate, stake, now }) {
  const { match, state, lineup, isToday } = next;
  const moved = rescheduleOf(match, now);
  return (
    <section className={`home-now home-intro is-${state.kind}${state.live && state.live.phase !== "live" ? ` is-${state.live.phase}` : ""}`} aria-labelledby="home-now-title">
      <i className="home-intro-sweep" aria-hidden="true" />
      <header className="home-now-head">
        <p className="home-now-when"><span className="home-now-pulse" aria-hidden="true" /><span key={state.label} className="home-now-state">{state.live ? state.label : `${isToday ? "Hoje" : "Próxima partida"} · ${state.label}`}</span></p>
        <p className="home-now-competition">{match.round_label || match.competition_name || "Amistoso"}</p>
      </header>
      {state.live
        ? <LiveBoard match={match} live={state.live} kickoff={kickoffTime(match.scheduled_at)} />
        : <time className="home-kickoff" dateTime={match.scheduled_at}>{kickoffTime(match.scheduled_at)}</time>}
      {!state.live && moved && <p className="home-moved"><span>Horário mudou</span>{rescheduleLabel(moved)}</p>}
      <h2 id="home-now-title" className="home-fixture">
        <span className="home-fixture-side"><Strix size={52} priority /><b>{strixName(match.opponent_name)}</b></span>
        <span className="home-fixture-x" aria-label="contra">×</span>
        <span className="home-fixture-side is-away"><Opponent match={match} size={52} priority /><b>{match.opponent_name}</b></span>
      </h2>
      {stake && <p className="home-stake"><span>Em jogo</span>{stake.text}</p>}
      <footer className="home-now-foot">
        <p className={`home-lineup is-${lineup.kind}`}><Icon path={lineup.kind === "ready" ? CHECK : DOT} size={lineup.kind === "ready" ? 16 : 22} />{lineup.label}</p>
        <div className="home-now-actions">
          <button type="button" className="primary" onClick={() => navigate("agenda", { id: match.id })}>{lineup.kind === "pending" ? "Abrir partida" : "Ver escalação"}<Icon path={ARROW} /></button>
        </div>
      </footer>
    </section>
  );
}

function FreeNight({ upcoming, navigate }) {
  return (
    <section className="home-now home-intro is-free-night" aria-labelledby="home-free-title">
      <div className="free-night-composition" aria-hidden="true">
        <i className="free-night-ring is-a" /><i className="free-night-ring is-b" /><i className="free-night-orbit" />
        <i className="home-intro-sweep" />
        <div className="free-night-logo"><Strix size={188} priority /></div>
      </div>
      <div className="free-night-copy">
        {upcoming ? <>
          <p className="home-intro-label" id="home-free-title">Próximo compromisso</p>
          <p className="free-night-when"><time dateTime={upcoming.scheduled_at}>{commitmentDate(upcoming.scheduled_at)}</time><span>{kickoffTime(upcoming.scheduled_at)}</span></p>
          <p className="free-night-fixture">
            <span><small>{upcoming.round_label || upcoming.competition_name || "Amistoso"}</small><b>{upcoming.opponent_name}</b></span>
            <Opponent match={upcoming} size={64} />
          </p>
        </> : <>
          <p className="home-intro-label" id="home-free-title">Agenda livre</p>
          <p className="free-night-when is-quiet">Nenhum jogo marcado.</p>
        </>}
        <button type="button" className="secondary" onClick={() => navigate("agenda")}>Abrir Agenda<Icon path={ARROW} /></button>
      </div>
    </section>
  );
}

/** A result from tonight leads the Home until the night is over. */
function RecentBlock({ recent, navigate }) {
  const { match, result, teamRating, standout, night } = recent;
  return (
    <section className={`home-now home-intro is-recent is-${result || "none"}`} aria-labelledby="home-recent-title">
      <i className="home-intro-sweep" aria-hidden="true" />
      <header className="home-now-head">
        <p className="home-now-when" id="home-recent-title">Último jogo · {kickoffTime(match.played_at)}</p>
        <p className="home-now-competition">{match.competition_name || "Amistoso"}</p>
      </header>
      <div className="home-recent-score" aria-label={`Strix United ${match.strix_score} a ${match.opponent_score} ${match.opponent_name}`}>
        <span className="home-fixture-side"><Strix size={52} priority /><b>{strixName(match.opponent_name)}</b></span>
        <strong><span>{match.strix_score}</span><i aria-hidden="true">–</i><span>{match.opponent_score}</span></strong>
        <span className="home-fixture-side is-away"><Opponent match={match} size={52} priority /><b>{match.opponent_name}</b></span>
      </div>
      {result && <p className="home-recent-result">{RESULT_LABEL[result]}</p>}
      {(teamRating != null || standout || night) && <dl className="home-recent-facts">
        {teamRating != null && <div><dt>Nota média do time</dt><dd className="data-value"><AnimatedNumber id={`home-team-rating-${match.id}`} value={teamRating} /></dd></div>}
        {standout && <div><dt>Maior nota da noite</dt><dd><span>{standout.names.join(" · ")}</span><b className="data-value">{standout.value}</b></dd></div>}
        {night && <div><dt>A noite</dt><dd className="data-value">{night.wins}V {night.draws}E {night.losses}D</dd></div>}
      </dl>}
      <footer className="home-now-foot">
        <p className="home-lineup">{night ? `${night.games} jogos importados hoje` : "Resultado importado da EA"}</p>
        <div className="home-now-actions">
          <button type="button" className="secondary" onClick={() => navigate("partidas", { id: match.id })}>Ver partida</button>
          <button type="button" className="primary" onClick={() => navigate("estatisticas")}>Resumo da noite<Icon path={ARROW} /></button>
        </div>
      </footer>
    </section>
  );
}

/** The club notice, pinned under the greeting. Whoever may publish it can edit it or take it down here. */
function Notice({ notice, canEdit, canWrite, now, onEdit, onRemove }) {
  if (!notice) {
    return canWrite ? <p className="home-notice-add"><button type="button" className="home-link" onClick={onEdit}>Escrever recado da diretoria<Icon path={ARROW} size={14} /></button></p> : null;
  }
  return (
    <aside className="home-notice" aria-label="Recado da diretoria">
      <header>
        <p><span className="home-now-pulse" aria-hidden="true" />Recado da diretoria</p>
        <div className="home-notice-meta">
          <small>{notice.author_name ? `${notice.author_name} · ` : ""}{agoLabel(notice.updated_at || notice.created_at, now)}</small>
          {canEdit && <><button type="button" className="home-link" onClick={onEdit}>Editar</button><button type="button" className="home-link" onClick={onRemove}>Retirar</button></>}
        </div>
      </header>
      <p className="home-notice-body">{notice.body}</p>
    </aside>
  );
}

const check = (done) => <Icon path={done ? CHECK : DOT} size={done ? 15 : 20} />;

/** "Preparo da noite": what is ready and what is missing, for whoever builds the night. */
function Checklist({ list, navigate }) {
  const lineupsDone = list.lineups.total > 0 && list.lineups.ready === list.lineups.total;
  const resultsDone = list.results.due > 0 && list.results.imported === list.results.due;
  return (
    <section className="home-prep" aria-label="Preparo da noite">
      <h3>Preparo da noite</h3>
      <ul>
        {list.lineups.total > 0 && <li className={lineupsDone ? "is-done" : ""}>{check(lineupsDone)}<span>{list.lineups.ready} de {list.lineups.total} {list.lineups.total === 1 ? "escalação definida" : "escalações definidas"}</span><button type="button" className="home-link" onClick={() => navigate("agenda")}>Agenda<Icon path={ARROW} size={14} /></button></li>}
        {list.results.due > 0 && <li className={resultsDone ? "is-done" : ""}>{check(resultsDone)}<span>{list.results.imported} de {list.results.due} {list.results.due === 1 ? "resultado importado" : "resultados importados"}</span><button type="button" className="home-link" onClick={() => navigate("partidas")}>Partidas<Icon path={ARROW} size={14} /></button></li>}
      </ul>
    </section>
  );
}

function statusFor(match, heroId, now) {
  const minutes = (new Date(match.scheduled_at).getTime() - now.getTime()) / 60_000;
  // "Agora" only inside the window after kickoff; before it, the hero is simply next.
  if (match.id === heroId) return minutes > 0 ? { label: "Próximo", tone: "is-now" } : minutes > -STARTED_WINDOW_MIN ? { label: "Agora", tone: "is-now" } : { label: "Aguardando resultado", tone: "is-past" };
  if (minutes <= 0) return { label: "Aguardando resultado", tone: "is-past" };
  return { label: "Agendado", tone: "" };
}

/**
 * One line that tells the member where he stands tonight. It reads the line-ups and nothing
 * else: taken out of a line-up, the line changes at once. While no line-up has anyone yet,
 * it says nothing.
 */
function mineLine(mine) {
  if (!mine) return "";
  const games = mine.games.length;
  if (mine.starting) {
    if (mine.starting < games) return `Você está escalado em ${mine.starting} de ${games} jogos de hoje.`;
    return games === 1 ? "Você está escalado no jogo de hoje." : `Você está escalado nos ${games} jogos de hoje.`;
  }
  if (mine.open === games) return "";
  return mine.open ? "Você ainda não está em nenhuma escalação de hoje." : games === 1 ? "Você não está escalado no jogo de hoje." : "Você não está escalado nos jogos de hoje.";
}

function Tonight({ tonight, played = [], mine, heroId, now, navigate, checklist = null, required = null }) {
  const rows = [...played.map((item) => ({ ...item, played: true })), ...tonight].sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
  const nowIndex = rows.findIndex((match) => new Date(match.scheduled_at).getTime() > now.getTime());
  const lineAt = nowIndex === -1 ? rows.length : nowIndex;
  // While the day's required plays are owed, where he stands in the line-ups is not told.
  const locked = Boolean(required?.status?.locked) && tonight.some((match) => required.locks(match));
  const position = new Map(locked ? [] : (mine?.games || []).map((game) => [game.id, game.position]));
  const line = locked ? "" : mineLine(mine);
  return (
    <section className="home-section home-tonight" aria-labelledby="home-tonight-title">
      <header className="home-section-head">
        <h2 id="home-tonight-title">Esta noite</h2>
        <button type="button" className="home-link" onClick={() => navigate("agenda")}>Agenda<Icon path={ARROW} size={14} /></button>
      </header>
      {locked && <p className="home-mine home-required">{required.status.total === 1 ? "Assista à jogada de hoje para ver a escalação." : `Assista às ${required.status.total} jogadas de hoje para ver a escalação.`}<button type="button" className="home-link" onClick={required.open}>{required.status.done ? `Continuar (${required.status.done} de ${required.status.total})` : "Assistir"}<Icon path={ARROW} size={14} /></button></p>}
      {line && <p className={`home-mine${mine.starting ? " is-in" : ""}`}>{line}</p>}
      <ol className="home-timetable">
        {rows.map((match, index) => {
          const status = match.played ? { label: RESULT_LABEL[match.result] || "Jogado", tone: "is-played" } : statusFor(match, heroId, now);
          const role = position.get(match.id);
          return (
            <React.Fragment key={match.id}>
              {index === lineAt && <li className="home-now-line" aria-label={`Agora, ${kickoffTime(now)}`}><time>{kickoffTime(now)}</time><i /></li>}
              <li className={`home-timetable-row ${status.tone}`.trim()}>
                <button type="button" className="home-row-open" aria-label={match.played ? `Abrir o resultado contra ${match.opponent_name}` : `Abrir a partida contra ${match.opponent_name}`} onClick={() => (match.played ? navigate("partidas", { id: match.matchId }) : navigate("agenda", { id: match.id }))} />
                <time dateTime={match.scheduled_at}>{kickoffTime(match.scheduled_at)}</time>
                <Opponent match={match} size={28} />
                <span className="home-timetable-name"><b>{match.opponent_name}</b><small>{match.played ? match.competition : match.round_label || match.competition_name || "Amistoso"}</small></span>
                {match.played
                  ? <strong className="home-row-score" aria-label={`${match.strix} a ${match.opponent}`}>{match.strix}<i aria-hidden="true">–</i>{match.opponent}</strong>
                  : role && <i className="home-row-mine" title="Sua posição nesta escalação">Você · {role}</i>}
                <em>{status.label}</em>
              </li>
            </React.Fragment>
          );
        })}
        {lineAt === rows.length && <li className="home-now-line is-end" aria-label={`Agora, ${kickoffTime(now)}`}><time>{kickoffTime(now)}</time><i /></li>}
      </ol>
      {checklist && <Checklist list={checklist} navigate={navigate} />}
    </section>
  );
}

function NextDays({ matches, navigate, title = "Próximos dias" }) {
  return (
    <section className="home-section home-next-days" aria-labelledby="home-next-days-title">
      <header className="home-section-head">
        <h2 id="home-next-days-title">{title}</h2>
        <button type="button" className="home-link" onClick={() => navigate("agenda")}>Agenda<Icon path={ARROW} size={14} /></button>
      </header>
      {matches.length ? (
        <ol className="home-days">
          {matches.map((match) => (
            <li key={match.id}>
              <button type="button" className="home-row-open" aria-label={`Abrir a partida contra ${match.opponent_name}`} onClick={() => navigate("agenda", { id: match.id })} />
              <time dateTime={match.scheduled_at}><b>{shortDate(match.scheduled_at)}</b>{kickoffTime(match.scheduled_at)}</time>
              <span className="home-timetable-name"><b>{match.opponent_name}</b><small>{match.round_label || match.competition_name || "Amistoso"}</small></span>
            </li>
          ))}
        </ol>
      ) : <p className="home-empty">Os próximos jogos aparecem aqui assim que entrarem na Agenda.</p>}
    </section>
  );
}

function LastResult({ last, navigate }) {
  if (!last) {
    return (
      <section className="home-section home-last" aria-labelledby="home-last-title">
        <header className="home-section-head"><h2 id="home-last-title">Último resultado</h2></header>
        <p className="home-empty">O primeiro resultado da temporada aparece aqui depois da importação da EA.</p>
      </section>
    );
  }
  const { match, result } = last;
  return (
    <section className="home-section home-last" aria-labelledby="home-last-title">
      <header className="home-section-head">
        <h2 id="home-last-title">Último resultado</h2>
        <button type="button" className="home-link" onClick={() => navigate("partidas")}>Partidas<Icon path={ARROW} size={14} /></button>
      </header>
      <div className={`home-score is-${result || "none"}`}>
        <span className="home-score-side"><Strix size={40} /><b>Strix</b></span>
        <strong aria-label={`${match.strix_score} a ${match.opponent_score}`}><span>{match.strix_score}</span><i aria-hidden="true">–</i><span>{match.opponent_score}</span></strong>
        <span className="home-score-side is-away"><Opponent match={match} size={40} /><b>{match.opponent_name}</b></span>
      </div>
      <p className="home-score-meta">{result && <em>{RESULT_LABEL[result]}</em>}<span>{match.competition_name || "Amistoso"}</span><span>{shortDate(match.played_at)} · {kickoffTime(match.played_at)}</span></p>
    </section>
  );
}

function Season({ season, navigate }) {
  return (
    <section className="home-section home-season" aria-labelledby="home-season-title">
      <header className="home-section-head">
        <h2 id="home-season-title">Temporada</h2>
        <button type="button" className="home-link" onClick={() => navigate("estatisticas")}>Estatísticas<Icon path={ARROW} size={14} /></button>
      </header>
      {season ? (
        <>
          <dl className="home-record">
            <div><dt>Vitórias</dt><dd>{season.wins}</dd></div>
            <div><dt>Empates</dt><dd>{season.draws}</dd></div>
            <div><dt>Derrotas</dt><dd>{season.losses}</dd></div>
            <div className="is-wide"><dt>Aproveitamento</dt><dd>{season.efficiency}<small>%</small></dd></div>
          </dl>
          <div className="home-season-foot">
            <p>{season.games} {season.games === 1 ? "jogo" : "jogos"} · {season.goalsFor} gols marcados · {season.goalsAgainst} sofridos</p>
            {season.form.length > 0 && (
              <ol className="home-form" aria-label="Últimos resultados, do mais recente ao mais antigo">
                {season.form.map((item) => <li key={item.id} className={`is-${item.result}`} title={`${RESULT_LABEL[item.result]} · ${item.opponent}`}>{item.result}</li>)}
              </ol>
            )}
          </div>
        </>
      ) : <p className="home-empty">A temporada começa a contar no primeiro jogo importado.</p>}
    </section>
  );
}

export function HomePage({ workspace, profile, navigate, ownPlayer = null, required = null }) {
  const [editingNotice, setEditingNotice] = useState(false);
  const now = useMinuteClock();
  const logoOf = (match) => match.resolved_opponent_logo_url || (match.opponent_logos?.storage_path ? workspace.assetUrl(match.opponent_logos.storage_path) : "");
  const agenda = useMemo(() => workspace.agenda.map((match) => ({ ...match, resolvedLogo: logoOf(match) })), [workspace.agenda]);
  const matches = useMemo(() => workspace.matches.map((match) => ({ ...match, resolvedLogo: logoOf(match) })), [workspace.matches]);
  const model = useMemo(() => buildHomeModel({ agenda, matches, now, players: workspace.players, aliases: workspace.aliases }), [agenda, matches, now, workspace.players, workspace.aliases]);
  const name = firstName(profile?.display_name);
  const hasTonight = model.tonight.length > 0 || model.played.length > 0;
  // What the next game is worth in its competition (the Cenários tab's own count, in one sentence).
  const stake = useMemo(
    () => (model.next?.match ? matchStake(model.next.match, { editions: workspace.competitionEditions, sources: workspace.competitionSources, fixtures: workspace.competitionFixtures }) : null),
    [model.next?.match, workspace.competitionEditions, workspace.competitionSources, workspace.competitionFixtures],
  );
  const mine = useMemo(() => myNight({ player: ownPlayer, tonight: model.tonight }), [ownPlayer, model.tonight]);
  const checklist = useMemo(
    () => (canEditLineup(profile) ? nightChecklist({ tonight: model.tonight, played: model.played, now }) : null),
    [profile, model.tonight, model.played, now],
  );
  const canWriteNotice = canPublishNotice(profile) && workspace.noticeAvailable;
  const removeNotice = () => {
    workspace.removeNotice?.()
      .then(() => notify("Recado retirado da Central."))
      .catch((cause) => notify(cause.message || "Não foi possível retirar o recado.", "error"));
  };
  return (
    <section className="home page-enter">
      <header className="home-greeting">
        <h1>{model.greeting}{name ? `, ${name}` : ""}.</h1>
        <p><span>{TIER_LABEL[profile?.access_tier] || "Membro"}</span><span>Temporada 2026/27</span><span className="home-date">{longDate(now)}</span></p>
      </header>
      <Notice notice={workspace.notice} canEdit={canWriteNotice} canWrite={canWriteNotice} now={now} onEdit={() => setEditingNotice(true)} onRemove={removeNotice} />
      <div className={`home-stage is-${model.mode}${hasTonight ? "" : " is-solo"}`}>
        {model.mode === "next" ? <NowBlock next={model.next} navigate={navigate} stake={stake} now={now} />
          : model.mode === "recent" ? <RecentBlock recent={model.recent} navigate={navigate} />
            : <FreeNight upcoming={model.upcoming} navigate={navigate} />}
        {hasTonight
          ? <Tonight tonight={model.tonight} played={model.played} mine={mine} checklist={checklist} required={required} heroId={model.mode === "next" ? model.next?.match.id : null} now={now} navigate={navigate} />
          : model.upcoming && model.nextDays.some((match) => match.id !== model.upcoming.id) && <NextDays matches={model.nextDays.filter((match) => match.id !== model.upcoming.id)} navigate={navigate} title="Depois disso" />}
      </div>
      <div className="home-ledger">
        {model.mode !== "recent" && <LastResult last={model.last} navigate={navigate} />}
        <Season season={model.season} navigate={navigate} />
      </div>
      {hasTonight && model.nextDays.length > 0 && <NextDays matches={model.nextDays} navigate={navigate} />}
      {editingNotice && <NoticeEditor current={workspace.notice?.body || ""} onCancel={() => setEditingNotice(false)} onSave={async (body) => { await workspace.saveNotice(body); setEditingNotice(false); notify("Recado publicado na Central."); }} />}
    </section>
  );
}
