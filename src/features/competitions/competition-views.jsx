import React, { useEffect, useMemo, useRef, useState } from "react";
import { IconArrowRight, IconCheck, IconClock } from "@tabler/icons-react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { CopyLinkButton } from "../../ui/CopyLinkButton.jsx";
import { FaceOff, NowCard, NowState } from "../../ui/NowCard.jsx";
import { useMinuteClock } from "../../ui/useMinuteClock.js";
import { AnimatedNumber, MotionBadge, RollingLabel, useReducedMotion } from "../../ui/motion/motion.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { normalizeName } from "../matches/import-core.js";
import { kickoffClock, kickoffDay, matchMoment } from "../agenda/agenda-status.js";
import { qualificationScenarioInput, qualificationState, reconcileCompetitionResults } from "./competition-core.js";
import { qualificationOutlook } from "./scenario-engine.js";
import { viewStake } from "./match-stake.js";
import { goTo } from "../../ui/useDeepTarget.js";
import "./competition-page.css";

const isStrix = (name) => /\bstrix\b/i.test(String(name || ""));
const fixtureLogo = (fixture, side) => fixture.metadata?.[`${side}Logo`] || fixture[`${side}_logo`] || fixture[`${side}Logo`] || "";
const signed = (value) => (value == null ? "—" : Number(value) > 0 ? `+${value}` : String(value));
const whole = new Intl.NumberFormat("pt-BR");
const stamp = (value) => (value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "Nunca");
/** A kick-off as the Agenda writes it: the day small, the time large. */
const kickoff = (value) => {
  if (!value) return { day: "A definir", time: "—" };
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(date).replace(/\./g, "").toUpperCase();
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
  return { day, time };
};

/* --------------------------------------------------------------------- hero */

export function CompetitionHero({ competition, edition, view, isHistorical, canSync, busy, syncState, onSync }) {
  const group = view.standings.strixGroup;
  return (
    <NowCard
      className="cx-hero"
      tone={isHistorical ? "past" : "today"}
      aria-label={competition.name}
      head={<>
        <NowState>{isHistorical ? "Histórico" : "Em andamento"}{competition.organization && <em>· {competition.organization}</em>}</NowState>
        {edition?.label && <p>{edition.label}</p>}
      </>}
      foot={<>
        <p><IconClock size={15} stroke={1.8} aria-hidden="true" />Atualizado {stamp(view.lastSyncedAt)}</p>
        <span className="cx-hero-actions">
          <CopyLinkButton page="campeonatos" id={edition?.id} />
          {canSync && (
            <button type="button" className="rolling-action cx-hero-sync" disabled={busy} onClick={onSync}>
              {syncState ? <MotionBadge state={syncState} /> : <RollingLabel>ATUALIZAR</RollingLabel>}
            </button>
          )}
        </span>
      </>}
    >
      <div className="cx-hero-id">
        <ClubLogo name={competition.name} url={competition.logo_url} className="cx-hero-logo" sizes="96px" priority />
        <div>
          <h2 className="now-card-giant">{competition.name}</h2>
          <p>{[view.currentStage, group && `Strix no ${group}`].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
    </NowCard>
  );
}

/* --------------------------------------------------------------------- tabs */

export function CompetitionTabs({ items, active, onChange, label = "Seções da competição" }) {
  return (
    <nav className="cx-tabs" role="tablist" aria-label={label}>
      {items.map(([id, label, count]) => (
        <button key={id} type="button" role="tab" aria-selected={id === active} className={id === active ? "selected" : ""} onClick={() => onChange(id)}>
          {label}{count != null && <b>{count}</b>}
        </button>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ fixture */

/** A fixture with both names in full: they wrap, they are never cut. */
function FixtureLine({ fixture }) {
  const played = fixture.home_score != null && fixture.away_score != null;
  return (
    <div className="cx-fixture">
      <span className={`cx-fixture-club is-home${isStrix(fixture.home_team_name) ? " is-strix" : ""}`}>
        <b>{fixture.home_team_name}</b>
        <ClubLogo name={fixture.home_team_name} url={fixtureLogo(fixture, "home")} className="cx-fixture-logo" sizes="40px" decorative />
      </span>
      <strong className={played ? "is-score" : ""}>{played ? <>{fixture.home_score}<i>–</i>{fixture.away_score}</> : "×"}</strong>
      <span className={`cx-fixture-club${isStrix(fixture.away_team_name) ? " is-strix" : ""}`}>
        <ClubLogo name={fixture.away_team_name} url={fixtureLogo(fixture, "away")} className="cx-fixture-logo" sizes="40px" decorative />
        <b>{fixture.away_team_name}</b>
      </span>
    </div>
  );
}

function FixtureRow({ fixture, note, index = 0 }) {
  const at = kickoff(fixture.scheduled_at || fixture.played_at);
  return (
    <article className="cx-game data-arrive" style={{ "--i": Math.min(index, 10) }}>
      <time><span>{at.day}</span><b>{at.time}</b></time>
      <FixtureLine fixture={fixture} />
      <small>{fixture.round_label || ""}</small>
      {note ? <em>{note}</em> : <span />}
    </article>
  );
}

/* ----------------------------------------------------------------- standings */

function GroupTable({ group, slots, compact = false }) {
  return (
    <div className={`cx-table${compact ? " is-compact" : ""}`} role="table" aria-label={`Classificação · ${group.name}`}>
      <header role="row">
        <span>#</span><span>CLUBE</span><span>P</span><span>J</span>
        <span className="is-wide">V</span><span className="is-wide">E</span><span className="is-wide">D</span>
        <span className="is-wide">GP</span><span className="is-wide">GC</span><span>SG</span>
        {!compact && <span className="is-wide">FORMA</span>}
      </header>
      {group.standings.map((row, index) => {
        const inZone = slots && Number(row.position) <= slots;
        const boundary = slots && Number(row.position) === slots && index < group.standings.length - 1;
        return (
          <React.Fragment key={row.team}>
            <article role="row" className={`data-arrive${row.isStrix ? " is-strix" : ""}${inZone ? " is-in" : ""}`} style={{ "--i": Math.min(index, 12) }}>
              <b>{row.position}</b>
              <div><ClubLogo name={row.team} url={row.logo} className="cx-table-logo" sizes="28px" decorative /><strong>{row.team}</strong></div>
              <b className="is-points">{row.points}</b>
              <span>{row.played}</span>
              <span className="is-wide">{row.wins}</span><span className="is-wide">{row.draws}</span><span className="is-wide">{row.losses}</span>
              <span className="is-wide">{row.goalsFor}</span><span className="is-wide">{row.goalsAgainst}</span>
              <span>{signed(row.goalDifference)}</span>
              {!compact && <div className="form-five is-wide">{(row.form || []).map((form, order) => <i key={`${form}-${order}`} className={form.toLowerCase()}>{form}</i>)}</div>}
            </article>
            {boundary && <p className="cx-table-cut" role="presentation"><span>ZONA DE CLASSIFICAÇÃO</span></p>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function StandingsPanel({ groups, slots, canEdit, onSlotsChange }) {
  const initial = groups.find((group) => group.isStrixGroup)?.name || groups[0]?.name;
  const [selected, setSelected] = useState(initial);
  useEffect(() => {
    if (!groups.some((group) => group.name === selected)) setSelected(initial);
  }, [groups, initial, selected]);
  const group = groups.find((item) => item.name === selected) || groups[0];
  if (!group) return <p className="cx-empty">A CCB Clubs ainda não publicou a classificação.</p>;
  const applied = Number(group.qualificationSlots || group.qualification_slots || slots) || null;
  return (
    <section className="cx-section">
      <header>
        <div><span>CLASSIFICAÇÃO</span><h2>{group.name}{group.isStrixGroup && <em>GRUPO DO STRIX</em>}</h2></div>
        {groups.length > 1 && (
          <nav className="cx-tabs is-small" aria-label="Grupos">
            {groups.map((item) => (
              <button key={item.name} type="button" aria-pressed={item.name === group.name} className={item.name === group.name ? "selected" : ""} onClick={() => setSelected(item.name)}>{item.name}</button>
            ))}
          </nav>
        )}
      </header>
      <GroupTable group={group} slots={applied} />
      {applied ? (
        <p className="cx-rule">Classificam os {applied} primeiros{groups.length > 1 ? " de cada grupo" : ""}, conforme a regra publicada pela organização.</p>
      ) : canEdit ? (
        // Only when the organiser did not publish the rule: without it there is no zone and no scenario.
        <label className="cx-rule is-missing">
          A organização não publicou quantos classificam. Informe para marcar a zona:
          <input type="number" min="1" max={group.standings.length} placeholder="—" onChange={(event) => onSlotsChange(event.target.value ? Number(event.target.value) : null)} />
        </label>
      ) : null}
    </section>
  );
}

/* --------------------------------------------------------------------- games */

export function GamesPanel({ competition, view, workspace }) {
  const internal = workspace.matches.filter((match) => match.competition_id === competition.id
    || (!match.competition_id && normalizeName(match.competition_name) === normalizeName(competition.name)));
  const results = reconcileCompetitionResults(view.providerResults, internal);
  const internalOnly = internal.filter((match) => !results.some((fixture) => fixture.internalMatch?.id === match.id));
  return (
    <div className="cx-stack">
      <section className="cx-section">
        <header><div><span>{competition.organization || "FONTE OFICIAL"}</span><h2>Próximos jogos do Strix</h2></div><b className="cx-count">{view.upcoming.length}</b></header>
        {view.upcoming.length ? (
          <div className="cx-games">
            {view.upcoming.map((fixture, index) => (
              <FixtureRow key={`${fixture.external_match_id || fixture.externalMatchId || "jogo"}-${index}`} fixture={fixture} index={index} note={fixture.agenda_match_id ? "NA AGENDA" : ""} />
            ))}
          </div>
        ) : (
          <p className="cx-empty">{view.awaitingKnockout ? "Fase encerrada. Aguardando a publicação do mata-mata." : "Nenhum próximo confronto do Strix foi publicado pela fonte oficial."}</p>
        )}
      </section>
      <section className="cx-section">
        <header><div><span>RESULTADOS DO STRIX</span><h2>Jogos disputados</h2></div><b className="cx-count">{results.length + internalOnly.length}</b></header>
        {results.length || internalOnly.length ? (
          <div className="cx-games">
            {results.map((fixture, index) => (
              <FixtureRow key={`${fixture.external_match_id || "resultado"}-${index}`} fixture={fixture} index={index} note={fixture.internalMatch ? "DADOS FC27" : "FONTE OFICIAL"} />
            ))}
            {internalOnly.map((match, index) => (
              <FixtureRow
                key={match.id}
                index={results.length + index}
                note="HISTÓRICO FC27"
                fixture={{
                  scheduled_at: match.played_at,
                  home_team_name: "STRIX UNITED", away_team_name: match.opponent_name,
                  home_score: match.strix_score, away_score: match.opponent_score,
                  home_logo: STRIX_BRAND.logo,
                  away_logo: match.opponent_logos?.storage_path ? workspace.assetUrl(match.opponent_logos.storage_path) : "",
                }}
              />
            ))}
          </div>
        ) : (
          <p className="cx-empty">Nenhum resultado do Strix publicado ou importado ainda.</p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ overview */

// How long the "next game" card stays on one game before showing the other of the same night,
// and how long the outgoing one takes to leave.
const NEXT_GAME_DWELL_MS = 8000;
const NEXT_GAME_LEAVE_MS = 240;

/**
 * Which of the night's games the card is showing. With more than one it takes turns by itself,
 * on one steady clock: the pointer resting on the card does not stop it (the card is the middle
 * of the page, a pointer is nearly always there), and neither does the page refreshing its data
 * underneath. Picking a game shows it and starts its time again. With reduced motion it never
 * turns by itself. `leaving` is the short moment the outgoing game takes to go; `cycle` changes
 * each time the time of the game on show starts over.
 */
function useNightTurns(games) {
  const reduced = useReducedMotion();
  const count = games.length;
  const [slot, setSlot] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [cycle, setCycle] = useState(0);
  const index = Math.min(slot, Math.max(0, count - 1));
  const current = useRef(index);
  current.current = index;
  const swap = useRef(0);
  const go = (next) => {
    window.clearTimeout(swap.current);
    if (reduced) { setSlot(next); return; }
    setLeaving(true);
    swap.current = window.setTimeout(() => { setSlot(next); setLeaving(false); }, NEXT_GAME_LEAVE_MS);
  };
  useEffect(() => () => window.clearTimeout(swap.current), []);
  const turning = count > 1 && !reduced;
  useEffect(() => {
    if (!turning) return undefined;
    // A hidden tab keeps the game it had: nothing turns where nobody is looking.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") go((current.current + 1) % count);
    }, NEXT_GAME_DWELL_MS + NEXT_GAME_LEAVE_MS);
    return () => window.clearInterval(timer);
  }, [turning, count, cycle]);
  const show = (next) => {
    if (next === current.current || next < 0 || next >= count) return;
    go(next);
    setCycle((value) => value + 1);
  };
  return { index, game: games[index] || null, leaving, turning, cycle, show };
}

export function OverviewPanel({ competition, edition, view, participants, goTo, children }) {
  const strixGroup = (view.standings.groups || []).find((group) => group.isStrixGroup) || null;
  const row = (view.standings.groups || []).flatMap((group) => group.standings || []).find((item) => item.isStrix) || null;
  const zone = qualificationState(row, view.qualificationSlots);
  // The next game; when the competition has more than one that night, the card shows them in turns.
  const night = view.strixNightFixtures?.length ? view.strixNightFixtures : view.strixFixture ? [view.strixFixture] : [];
  const turns = useNightTurns(night);
  const next = turns.game;
  const now = useMinuteClock();
  const moment = next?.scheduled_at ? matchMoment({ scheduled_at: next.scheduled_at, status: next.status === "completed" ? "completed" : "" }, now) : null;
  // The opponent's place in the table, when the group is published.
  const rivalName = next ? (isStrix(next.home_team_name) ? next.away_team_name : next.home_team_name) : "";
  const rival = strixGroup?.standings.find((item) => normalizeName(item.team) === normalizeName(rivalName)) || null;
  // What that game is worth, in the Cenários tab's own words.
  const stake = useMemo(() => (next ? viewStake(view, rivalName).text : ""), [view, rivalName]);
  return (
    <div className="cx-stack">
      <section className="cx-facts">
        <article className="data-arrive" style={{ "--i": 0 }}>
          <small>FASE ATUAL</small>
          <b>{view.currentStage}</b>
          {participants > 0 && <em>{participants} clubes no torneio</em>}
        </article>
        <article className="data-arrive" style={{ "--i": 1 }}>
          <small>{strixGroup ? "GRUPO DO STRIX" : "PARTICIPANTES"}</small>
          <b>{strixGroup ? strixGroup.name : participants || "—"}</b>
          {strixGroup && <em>{strixGroup.standings.length} clubes{view.qualificationSlots ? ` · classificam ${view.qualificationSlots}` : ""}</em>}
        </article>
        <article className="data-arrive" style={{ "--i": 2 }}>
          <small>POSIÇÃO</small>
          <b className={row ? "data-value" : ""}>{row ? <AnimatedNumber id={`overview-position-${edition.id}`} value={row.position} suffix="º" /> : "—"}</b>
          {zone && <em className={zone.inside ? "is-in" : ""}>{zone.label}</em>}
        </article>
        <article className="data-arrive" style={{ "--i": 3 }}>
          <small>CAMPANHA</small>
          <b className={row ? "data-value" : ""}>{row ? <>{row.points}<i> pts</i></> : "—"}</b>
          {row && <em>{row.played} J · {row.wins}V {row.draws}E {row.losses}D · SG {signed(row.goalDifference)}</em>}
        </article>
      </section>

      {next && (
        <NowCard
          tone={moment?.tone || "quiet"}
          className={`cx-next${night.length > 1 ? " has-turns" : ""}${turns.leaving ? " is-leaving" : ""}`}
          aria-label={night.length > 1 ? `Jogos do Strix na noite: ${turns.index + 1} de ${night.length}` : "Próximo jogo do Strix"}
          head={<>
            <NowState key={`state-${turns.index}`}>{!moment ? "Próximo jogo" : moment.tone === "today" ? moment.label : `Próximo jogo · ${moment.label}`}</NowState>
            <p key={`round-${turns.index}`}>{[night.length > 1 ? `Jogo ${turns.index + 1} de ${night.length}` : "", next.round_label, competition.organization].filter(Boolean).join(" · ")}</p>
          </>}
          foot={<>
            <p key={`agenda-${turns.index}`} className={next.agenda_match_id ? "is-set" : ""}>{next.agenda_match_id ? <><IconCheck size={16} stroke={2} aria-hidden="true" />Na Agenda do clube</> : "Ainda fora da Agenda do clube"}</p>
            {rival && <p key={`rival-${turns.index}`}><b>{rival.team}</b>{rival.position}º do {strixGroup.name} · {rival.points} pts</p>}
            {next.agenda_match_id && <button type="button" className="now-card-link" onClick={() => goTo("agenda", next.agenda_match_id)}>Abrir partida<IconArrowRight size={15} stroke={2} aria-hidden="true" /></button>}
          </>}
        >
          <FaceOff
            key={`game-${turns.index}`}
            home={{ name: next.home_team_name, logo: fixtureLogo(next, "home") }}
            away={{ name: next.away_team_name, logo: fixtureLogo(next, "away") }}
            time={next.scheduled_at ? kickoffClock(next.scheduled_at) : "—"}
            day={next.scheduled_at ? kickoffDay(next.scheduled_at) : "A definir"}
            dateTime={next.scheduled_at}
          />
          {stake && <p key={`stake-${turns.index}`} className="now-card-stake"><span>Em jogo</span>{stake}</p>}
          {night.length > 1 && (
            <div className="cx-next-turns" role="group" aria-label="Jogos desta noite">
              {night.map((game, index) => {
                const rivalOf = isStrix(game.home_team_name) ? game.away_team_name : game.home_team_name;
                const on = index === turns.index;
                return (
                  <button key={game.id || index} type="button" className={on ? "is-on" : ""} aria-current={on ? "true" : undefined} aria-label={`Mostrar o jogo contra ${rivalOf}${game.scheduled_at ? `, às ${kickoffClock(game.scheduled_at)}` : ""}`} onClick={() => turns.show(index)}>
                    <i>{on && <b key={`fill-${turns.index}-${turns.cycle}`} className={turns.turning ? "is-running" : ""} style={{ "--dwell": `${NEXT_GAME_DWELL_MS}ms` }} />}</i>
                  </button>
                );
              })}
            </div>
          )}
        </NowCard>
      )}
      {view.awaitingKnockout && (
        <section className="cx-note">
          <span>PRÓXIMA FASE</span>
          <h2>Aguardando mata-mata</h2>
          <p>A fase atual terminou e a fonte oficial ainda não publicou o chaveamento.</p>
        </section>
      )}

      {strixGroup && (
        <section className="cx-section">
          <header>
            <div><span>CLASSIFICAÇÃO</span><h2>{strixGroup.name}</h2></div>
            <button type="button" className="cx-link" onClick={() => goTo("standings")}>VER TODOS OS GRUPOS</button>
          </header>
          <GroupTable group={strixGroup} slots={view.qualificationSlots} compact />
        </section>
      )}

      {view.upcoming.length > 1 && (
        <section className="cx-section">
          <header>
            <div><span>SEQUÊNCIA</span><h2>Depois deste jogo</h2></div>
            <button type="button" className="cx-link" onClick={() => goTo("games")}>VER TODOS OS JOGOS</button>
          </header>
          <div className="cx-games">
            {view.upcoming.slice(1, 4).map((fixture, index) => (
              <FixtureRow key={`${fixture.external_match_id || fixture.externalMatchId || "jogo"}-${index}`} fixture={fixture} index={index} note={fixture.agenda_match_id ? "NA AGENDA" : ""} />
            ))}
          </div>
        </section>
      )}
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- scenarios */

const RESULT_WORD = { V: "Vitória sobre", E: "Empate com", D: "Derrota para" };
const RESULT_SHORT = { V: "VITÓRIA", E: "EMPATE", D: "DERROTA" };
const share = (part, sum) => (sum ? Math.round((part / sum) * 100) : 0);
/** A share in words: never "100%" for almost all, never "0%" for a few. */
const percent = (part, sum) => {
  const value = sum ? (part / sum) * 100 : 0;
  if (part > 0 && value < 1) return "menos de 1%";
  if (part < sum && value > 99) return "mais de 99%";
  return `${Math.round(value)}%`;
};

/** How many of the combinations end inside, at the tie-break or outside: one bar, three stretches. */
function OutcomeBar({ entry }) {
  const sum = entry.total || 1;
  return (
    <span className="cx-odds" role="img" aria-label={`${share(entry.in, sum)}% classificam, ${share(entry.tie, sum)}% no desempate, ${share(entry.out, sum)}% fora`}>
      <i className="is-in" style={{ "--value": entry.in / sum }} />
      <i className="is-tie" style={{ "--value": entry.tie / sum }} />
    </span>
  );
}

const outcomeText = (entry) => {
  if (!entry.total) return "sem combinações";
  if (entry.in === entry.total) return "classifica em todas as combinações";
  if (!entry.in && !entry.tie) return "fora em todas as combinações";
  if (entry.tie === entry.total) return "sempre empatado em pontos na linha de corte: decide o desempate";
  const parts = [];
  if (entry.in) parts.push(`classifica em ${percent(entry.in, entry.total)}`);
  if (entry.tie) parts.push(`${percent(entry.tie, entry.total)} no desempate`);
  if (!entry.in) parts.push("nunca direto");
  return parts.join(" · ");
};

export function ScenariosPanel({ edition, snapshot, qualificationSlots }) {
  const outlook = useMemo(() => {
    const input = qualificationScenarioInput(snapshot, qualificationSlots);
    return input ? qualificationOutlook({ ...input, qualificationSlots }) : null;
  }, [snapshot, qualificationSlots]);

  if (!outlook || outlook.status === "insufficient_data") {
    return (
      <section className="cx-section">
        <header><div><span>CENÁRIOS</span><h2>Para classificar</h2></div></header>
        <p className="cx-empty">{qualificationSlots ? "A fonte oficial ainda não publicou os jogos do grupo: sem eles não há cenário para calcular." : "A organização não publicou quantos clubes classificam: sem a regra não há cenário para calcular."}</p>
      </section>
    );
  }

  if (outlook.status === "schedule_incomplete") {
    return (
      <section className="cx-section">
        <header><div><span>CENÁRIOS</span><h2>Para classificar</h2></div></header>
        <p className="cx-empty">A fonte oficial ainda não publicou todos os jogos do grupo. Com o calendário pela metade qualquer conta fecharia o grupo antes da hora; os cenários abrem quando o restante for publicado.</p>
      </section>
    );
  }

  const remaining = outlook.remainingMatches;
  const headline = outlook.status === "too_many" ? "Cedo demais para fechar a conta."
    : outlook.status === "guaranteed" ? `Vaga garantida entre os ${outlook.cutoffPosition} que passam.`
      : outlook.status === "impossible" ? "Sem chance matemática."
        : outlook.guarantee ? `Garante a vaga com ${outlook.guarantee.points} pontos.`
          : "Não depende só do Strix.";
  const detail = outlook.status === "too_many" ? `Faltam ${outlook.pendingInGroup} jogos no grupo: são combinações demais para simular com segurança. A conta abre quando restarem até 13.`
    : outlook.status === "guaranteed" ? `A conta considera ${outlook.cutoffPosition} ${outlook.cutoffPosition === 1 ? "vaga" : "vagas"} neste grupo: em nenhuma combinação dos jogos que faltam o Strix termina abaixo do ${outlook.finish?.worst || outlook.cutoffPosition}º lugar${outlook.finish && outlook.finish.best !== outlook.finish.worst ? ` (pode ficar do ${outlook.finish.best}º ao ${outlook.finish.worst}º)` : ""}. Se o regulamento classifica menos times, corrija as vagas da edição e a conta muda.`
      : outlook.status === "impossible" ? "Em nenhuma combinação dos jogos que faltam o Strix alcança a zona de classificação."
        : outlook.guarantee
          ? `${outlook.guarantee.gained === 0 ? "Já tem os pontos" : `Faltam ${outlook.guarantee.gained} ${outlook.guarantee.gained === 1 ? "ponto" : "pontos"}`} para não depender de ninguém, com ${remaining} ${remaining === 1 ? "jogo" : "jogos"} e ${outlook.pointsAvailable} pontos em disputa.${outlook.alive && outlook.alive.points < outlook.guarantee.points ? ` Com menos, ainda dá a partir de ${outlook.alive.points}, mas depende dos outros resultados.` : ""}`
          : `Mesmo vencendo ${remaining === 1 ? "o jogo que falta" : `os ${remaining} jogos que faltam`}, a vaga não fica garantida${outlook.alive ? `: ainda dá a partir de ${outlook.alive.points} pontos, com outros resultados ou no critério de desempate` : ""}.`;
  const ladder = outlook.ladder || [];
  const firstOut = ladder.findIndex((step) => step.verdict === "impossible");
  const shown = firstOut < 0 ? ladder : ladder.slice(0, firstOut + 1);

  return (
    <div className="cx-stack">
      <section className="cx-verdict">
        <span>PARA CLASSIFICAR · TOP {outlook.cutoffPosition}</span>
        <h2>{headline}</h2>
        <p>{detail}</p>
      </section>
      <section className="cx-facts">
        <article className="data-arrive" style={{ "--i": 0 }}>
          <small>POSIÇÃO</small>
          <b className="data-value"><AnimatedNumber id={`scenario-position-${edition.id}`} value={outlook.position} suffix="º" /></b>
          <em>{outlook.points} pts</em>
        </article>
        <article className="data-arrive" style={{ "--i": 1 }}>
          <small>LINHA DE CORTE</small>
          <b className="data-value">{outlook.tiedAtCutoff ? "Empatado" : outlook.position <= outlook.cutoffPosition ? "Dentro" : <>{outlook.distanceToCutoff}<i> pts</i></>}</b>
          <em>{outlook.cutoffPosition}º colocado com {outlook.cutoffPoints} pts</em>
        </article>
        <article className="data-arrive" style={{ "--i": 2 }}>
          <small>JOGOS DO STRIX</small>
          <b className="data-value"><AnimatedNumber id={`scenario-games-${edition.id}`} value={remaining} /></b>
          <em>{outlook.pendingInGroup} no grupo</em>
        </article>
        <article className="data-arrive" style={{ "--i": 3 }}>
          <small>EM DISPUTA</small>
          <b className="data-value">{outlook.pointsAvailable}<i> pts</i></b>
          <em>máximo de {outlook.points + outlook.pointsAvailable} pts</em>
        </article>
      </section>

      {outlook.nextMatch && outlook.status === "possible" && (
        <section className="cx-section">
          <header><div><span>PRÓXIMO JOGO</span><h2>Contra {outlook.nextMatch.opponent}</h2></div></header>
          <div className="cx-odds-list">
            {outlook.nextMatch.byResult.map((entry) => (
              <article key={entry.result}>
                <b>{RESULT_SHORT[entry.result]}</b>
                <OutcomeBar entry={entry} />
                <span>{outcomeText(entry)}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {outlook.conditions?.length > 0 && outlook.status === "possible" && (
        <section className="cx-section">
          <header><div><span>COMBINAÇÕES</span><h2>O que precisa acontecer</h2></div></header>
          <div className="cx-paths">
            {outlook.conditions.map((path) => (
              <article key={path.results.map((item) => item.result).join("")} className={`is-${path.verdict}`}>
                <header>
                  <b>{path.results.map((item) => `${RESULT_WORD[item.result]} ${item.opponent}`).join(" + ")}</b>
                  <em>{path.verdict === "guaranteed" ? "CLASSIFICA" : path.verdict === "impossible" ? "FORA" : path.in ? "DEPENDE" : "SÓ NO DESEMPATE"}</em>
                </header>
                {path.verdict === "guaranteed" && <p>Não depende de mais ninguém.</p>}
                {path.verdict === "impossible" && <p>Nenhum resultado dos outros jogos resolve.</p>}
                {path.verdict === "possible" && path.needs.length > 0 && (
                  <ul>{path.needs.map((need) => <li key={need}>{need}</li>)}</ul>
                )}
                {path.verdict === "possible" && (
                  <small>
                    {path.in > 0 && (path.exact ? "Acontecendo isso, classifica direto." : `Classifica direto em ${path.in} de ${path.total} combinações dos outros jogos.`)}
                    {path.tie > 0 && ` ${path.in ? "Em" : "Empata em pontos na linha de corte em"} ${path.tie} ${path.tie === 1 ? "combinação" : "combinações"}${path.in ? ", empata em pontos na linha de corte" : ""}: decide o critério de desempate.`}
                  </small>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {shown.length > 0 && outlook.status === "possible" && (
        <section className="cx-section">
          <header><div><span>PONTUAÇÃO FINAL</span><h2>Onde cada total de pontos deixa o Strix</h2></div></header>
          <div className="cx-ladder">
            {shown.map((step, index) => (
              <article key={step.points} className={`is-${step.verdict}`}>
                <b>{index === shown.length - 1 && step.verdict === "impossible" && firstOut >= 0 ? `≤ ${step.points}` : step.points}<i> pts</i></b>
                <OutcomeBar entry={step} />
                <span>{step.verdict === "guaranteed" ? "classifica sempre" : step.verdict === "impossible" ? "fora" : step.tie === step.total ? "empatado na linha de corte: desempate" : outcomeText(step)}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {outlook.combinations > 0 && outlook.status !== "too_many" && (
        <p className="cx-rule">
          Conta feita sobre as {whole.format(outlook.combinations)} combinações possíveis dos {outlook.pendingInGroup} jogos que faltam no grupo (vitória, empate ou derrota em cada um). Terminar empatado em pontos na linha de corte depende do critério de desempate da competição e aparece separado.
          {outlook.conditions?.length === 0 && outlook.status === "possible" && outlook.pendingInGroup > 8 && " A lista jogo a jogo (quem precisa vencer ou perder) abre quando restarem até 8 jogos no grupo e 2 do Strix."}
        </p>
      )}
    </div>
  );
}
