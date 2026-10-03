import React, { useMemo } from "react";
import { useMinuteClock } from "../../ui/useMinuteClock.js";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { RESULT_LABEL, STARTED_WINDOW_MIN, buildHomeModel, kickoffTime, shortDate } from "./home-core.js";
import { AnimatedNumber } from "../../ui/motion/motion.jsx";
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
const ARROW = "M5 12h14M13 6l6 6-6 6";
const CHECK = "m5 12.5 4.2 4.2L19 7";
const DOT = "M12 12h.01";

function NowBlock({ next, navigate }) {
  const { match, state, lineup, isToday } = next;
  return (
    <section className={`home-now home-intro is-${state.kind}`} aria-labelledby="home-now-title">
      <i className="home-intro-sweep" aria-hidden="true" />
      <header className="home-now-head">
        <p className="home-now-when"><span className="home-now-pulse" aria-hidden="true" /><span key={state.label} className="home-now-state">{isToday ? "Hoje" : "Próxima partida"} · {state.label}</span></p>
        <p className="home-now-competition">{match.round_label || match.competition_name || "Amistoso"}</p>
      </header>
      <time className="home-kickoff" dateTime={match.scheduled_at}>{kickoffTime(match.scheduled_at)}</time>
      <h2 id="home-now-title" className="home-fixture">
        <span className="home-fixture-side"><Strix size={52} priority /><b>Strix United</b></span>
        <span className="home-fixture-x" aria-label="contra">×</span>
        <span className="home-fixture-side is-away"><Opponent match={match} size={52} priority /><b>{match.opponent_name}</b></span>
      </h2>
      <footer className="home-now-foot">
        <p className={`home-lineup is-${lineup.kind}`}><Icon path={lineup.kind === "ready" ? CHECK : DOT} size={lineup.kind === "ready" ? 16 : 22} />{lineup.label}</p>
        <div className="home-now-actions">
          <button type="button" className="primary" onClick={() => navigate("agenda")}>{lineup.kind === "pending" ? "Abrir Agenda" : "Ver escalação"}<Icon path={ARROW} /></button>
        </div>
      </footer>
    </section>
  );
}

function FreeNight({ upcoming, navigate }) {
  return (
    <section className="home-now home-intro is-free-night" aria-labelledby="home-free-title">
      <div className="free-night-composition" aria-hidden="true">
        <i className="free-night-ring is-a" /><i className="free-night-ring is-b" />
        <i className="home-intro-sweep" />
        <div className="free-night-logo"><Strix size={148} priority /></div>
      </div>
      <div className="free-night-copy">
        {upcoming ? <>
          <p className="home-intro-label" id="home-free-title">Próximo compromisso</p>
          <p className="free-night-when"><time dateTime={upcoming.scheduled_at}>{commitmentDate(upcoming.scheduled_at)}</time><span>{kickoffTime(upcoming.scheduled_at)}</span></p>
          <p className="free-night-fixture"><Opponent match={upcoming} size={26} /><b>{upcoming.opponent_name}</b><small>{upcoming.round_label || upcoming.competition_name || "Amistoso"}</small></p>
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
        <span className="home-fixture-side"><Strix size={52} priority /><b>Strix United</b></span>
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
          <button type="button" className="primary" onClick={() => navigate("estatisticas")}>Resumo da noite<Icon path={ARROW} /></button>
        </div>
      </footer>
    </section>
  );
}

function statusFor(match, heroId, now) {
  const minutes = (new Date(match.scheduled_at).getTime() - now.getTime()) / 60_000;
  // "Agora" only inside the window after kickoff; before it, the hero is simply next.
  if (match.id === heroId) return minutes > 0 ? { label: "Próximo", tone: "is-now" } : minutes > -STARTED_WINDOW_MIN ? { label: "Agora", tone: "is-now" } : { label: "Horário passou", tone: "is-past" };
  if (minutes <= 0) return { label: "Horário passou", tone: "is-past" };
  return { label: "Agendado", tone: "" };
}

function Tonight({ tonight, heroId, now, navigate }) {
  const nowIndex = tonight.findIndex((match) => new Date(match.scheduled_at).getTime() > now.getTime());
  const lineAt = nowIndex === -1 ? tonight.length : nowIndex;
  return (
    <section className="home-section home-tonight" aria-labelledby="home-tonight-title">
      <header className="home-section-head">
        <h2 id="home-tonight-title">Esta noite</h2>
        <button type="button" className="home-link" onClick={() => navigate("agenda")}>Agenda<Icon path={ARROW} size={14} /></button>
      </header>
      <ol className="home-timetable">
        {tonight.map((match, index) => {
          const status = statusFor(match, heroId, now);
          return (
            <React.Fragment key={match.id}>
              {index === lineAt && <li className="home-now-line" aria-label={`Agora, ${kickoffTime(now)}`}><time>{kickoffTime(now)}</time><i /></li>}
              <li className={`home-timetable-row ${status.tone}`.trim()}>
                <time dateTime={match.scheduled_at}>{kickoffTime(match.scheduled_at)}</time>
                <Opponent match={match} size={28} />
                <span className="home-timetable-name"><b>{match.opponent_name}</b><small>{match.round_label || match.competition_name || "Amistoso"}</small></span>
                <em>{status.label}</em>
              </li>
            </React.Fragment>
          );
        })}
        {lineAt === tonight.length && <li className="home-now-line is-end" aria-label={`Agora, ${kickoffTime(now)}`}><time>{kickoffTime(now)}</time><i /></li>}
      </ol>
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

export function HomePage({ workspace, profile, navigate }) {
  const now = useMinuteClock();
  const logoOf = (match) => match.resolved_opponent_logo_url || (match.opponent_logos?.storage_path ? workspace.assetUrl(match.opponent_logos.storage_path) : "");
  const agenda = useMemo(() => workspace.agenda.map((match) => ({ ...match, resolvedLogo: logoOf(match) })), [workspace.agenda]);
  const matches = useMemo(() => workspace.matches.map((match) => ({ ...match, resolvedLogo: logoOf(match) })), [workspace.matches]);
  const model = useMemo(() => buildHomeModel({ agenda, matches, now, players: workspace.players, aliases: workspace.aliases }), [agenda, matches, now, workspace.players, workspace.aliases]);
  const name = firstName(profile?.display_name);
  const hasTonight = model.tonight.length > 0;
  return (
    <section className="home page-enter">
      <header className="home-greeting">
        <h1>{model.greeting}{name ? `, ${name}` : ""}.</h1>
        <p><span>{TIER_LABEL[profile?.access_tier] || "Membro"}</span><span>Temporada 2026/27</span><span className="home-date">{longDate(now)}</span></p>
      </header>
      <div className={`home-stage is-${model.mode}${hasTonight ? "" : " is-solo"}`}>
        {model.mode === "next" ? <NowBlock next={model.next} navigate={navigate} />
          : model.mode === "recent" ? <RecentBlock recent={model.recent} navigate={navigate} />
            : <FreeNight upcoming={model.upcoming} navigate={navigate} />}
        {hasTonight
          ? <Tonight tonight={model.tonight} heroId={model.mode === "next" ? model.next?.match.id : null} now={now} navigate={navigate} />
          : model.upcoming && model.nextDays.some((match) => match.id !== model.upcoming.id) && <NextDays matches={model.nextDays.filter((match) => match.id !== model.upcoming.id)} navigate={navigate} title="Depois disso" />}
      </div>
      <div className="home-ledger">
        {model.mode !== "recent" && <LastResult last={model.last} navigate={navigate} />}
        <Season season={model.season} navigate={navigate} />
      </div>
      {hasTonight && model.nextDays.length > 0 && <NextDays matches={model.nextDays} navigate={navigate} />}
    </section>
  );
}
