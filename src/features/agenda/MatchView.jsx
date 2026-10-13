import React from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { FaceOff, NowCard, NowState } from "../../ui/NowCard.jsx";
import { useMinuteClock } from "../../ui/useMinuteClock.js";
import { STRIX_BRAND } from "../../brand.js";
import { kickoffDay, matchMoment } from "./agenda-status.js";
import "./match-view.css";

// Strix is written the way the opponent is: capitals beside capitals, title case beside title case.
const strixName = (opponent) => (/\p{Ll}/u.test(String(opponent || "")) ? "Strix United" : "STRIX UNITED");

/**
 * The fixture at the top of the match sheet, drawn as the Central draws its next
 * match: the moment ("Hoje · em 50 min") and the competition on the status line,
 * both clubs face to face around the kick-off in giant numerals, the day under it.
 * The moment follows the clock while the sheet is open.
 */
export function MatchStage({ opponent, logo, date, time, competition, group = "", scheduledAt = "", status = "", stake = "" }) {
  const now = useMinuteClock();
  const moment = scheduledAt ? matchMoment({ scheduled_at: scheduledAt, status }, now) : null;
  return (
    <NowCard
      band
      tone={moment?.tone || "quiet"}
      aria-label="Confronto da partida"
      head={<>
        <NowState>{moment ? moment.label : date}</NowState>
        <p>{[competition, group].filter(Boolean).join(" · ")}</p>
      </>}
    >
      <FaceOff
        home={{ name: strixName(opponent), logo: STRIX_BRAND.logo }}
        away={{ name: opponent || "—", logo }}
        time={time}
        day={scheduledAt ? kickoffDay(scheduledAt) : date}
        dateTime={scheduledAt}
      />
      {stake && <p className="now-card-stake"><span>Em jogo</span>{stake}</p>}
    </NowCard>
  );
}

const RESULT_WORD = { V: "Vitória", E: "Empate", D: "Derrota" };
const briefDate = (value) => (value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(value)) : "");

/**
 * What is known about the opponent before the game: Strix's own results against it and its
 * published results in this competition (see opponent-brief.js). Renders nothing when there is
 * nothing to tell.
 */
export function OpponentBrief({ brief }) {
  if (!brief || brief.empty) return null;
  const { record, games } = brief.history;
  return (
    <section className="match-brief" aria-label={`Ficha de ${brief.name}`}>
      <header><span>ADVERSÁRIO</span><h3>{brief.name}</h3></header>
      <div className="match-brief-grid">
        <article>
          <h4>Strix contra eles</h4>
          {record.games ? <>
            <ul className="match-brief-tally" aria-label="Retrospecto do Strix contra este adversário">
              <li><b>{record.games}</b>{record.games === 1 ? "jogo" : "jogos"}</li>
              <li><b>{record.wins}</b>{record.wins === 1 ? "vitória" : "vitórias"}</li>
              <li><b>{record.draws}</b>{record.draws === 1 ? "empate" : "empates"}</li>
              <li><b>{record.losses}</b>{record.losses === 1 ? "derrota" : "derrotas"}</li>
              <li><b>{record.goalsFor}<i aria-hidden="true">–</i>{record.goalsAgainst}</b>gols</li>
            </ul>
            <ol>
              {games.map((game) => (
                <li key={game.id}>
                  <time>{briefDate(game.playedAt)}</time>
                  <span>Strix <b>{game.strix}–{game.opponent}</b></span>
                  <small>{game.competition}</small>
                  <i className={`is-${game.result}`} title={RESULT_WORD[game.result]}>{game.result}</i>
                </li>
              ))}
            </ol>
          </> : <p className="match-brief-empty">Primeiro confronto registrado contra este adversário.</p>}
        </article>
        <article>
          <h4>No campeonato</h4>
          {brief.form.length ? (
            <ol>
              {brief.form.map((game) => (
                <li key={game.id}>
                  <time>{briefDate(game.playedAt)}</time>
                  <span><b>{game.own}–{game.other}</b> {game.against}</span>
                  <small>{game.round}</small>
                  <i className={`is-${game.result}`} title={RESULT_WORD[game.result]}>{game.result}</i>
                </li>
              ))}
            </ol>
          ) : <p className="match-brief-empty">Sem resultados deste adversário publicados no campeonato.</p>}
        </article>
      </div>
    </section>
  );
}

const signed = (value) => (value == null ? "—" : Number(value) > 0 ? `+${value}` : String(value));
const show = (value) => (value == null ? "—" : value);

/** One measured value of two sides, face to face: two bars growing from the centre. */
export function DuelRow({ label, strix, opponent, format = show }) {
  const a = Number(strix);
  const b = Number(opponent);
  const top = Math.max(Math.abs(a) || 0, Math.abs(b) || 0);
  const share = (value) => (top ? Math.max(0.04, Math.abs(Number(value) || 0) / top) : 0);
  return (
    <div className="match-duel-row">
      <b className={Number.isFinite(a) && Number.isFinite(b) && a > b ? "is-ahead" : ""}>{format(strix)}</b>
      <span className="match-duel-bar is-left" aria-hidden="true"><i style={{ "--value": share(strix) }} /></span>
      <small>{label}</small>
      <span className="match-duel-bar" aria-hidden="true"><i style={{ "--value": share(opponent) }} /></span>
      <b className={Number.isFinite(a) && Number.isFinite(b) && b > a ? "is-ahead" : ""}>{format(opponent)}</b>
    </div>
  );
}

const STANDINGS_REASON = {
  no_standings: "A tabela deste campeonato ainda não foi publicada.",
  strix_missing: "O Strix ainda não aparece na tabela deste campeonato.",
  opponent_missing: "O adversário ainda não aparece na tabela deste campeonato.",
  ambiguous_opponent: "Há mais de um clube com este nome na tabela; não dá para comparar com segurança.",
};

/** The table beside a competition fixture: both clubs face to face, then their stretch of the standings. */
export function MatchStandings({ standings, competition }) {
  if (!standings?.available) {
    return (
      <aside className="match-table">
        <header><span>CLASSIFICAÇÃO</span><small>{competition}</small></header>
        <p className="match-table-note">{STANDINGS_REASON[standings?.reason] || "Sem classificação disponível para esta partida."}</p>
      </aside>
    );
  }
  const { strix, opponent } = standings;
  const gap = standings.pointsGap;
  const reading = gap == null ? "" : gap === 0 ? "Empatados em pontos." : `Strix ${Math.abs(gap)} ${Math.abs(gap) === 1 ? "ponto" : "pontos"} ${gap > 0 ? "à frente" : "atrás"}.`;
  return (
    <aside className="match-table">
      <header><span>CLASSIFICAÇÃO</span><small>{[standings.competition || competition, standings.group].filter(Boolean).join(" · ")}</small></header>
      <div className="match-duel">
        <div className="match-duel-head">
          <div><strong>{strix.position ? `${strix.position}º` : "—"}</strong><span>{strixName(opponent.team)}</span></div>
          <i aria-hidden="true">×</i>
          <div><strong>{opponent.position ? `${opponent.position}º` : "—"}</strong><span>{opponent.team}</span></div>
        </div>
        <DuelRow label="PONTOS" strix={strix.points} opponent={opponent.points} />
        <DuelRow label="VITÓRIAS" strix={strix.wins} opponent={opponent.wins} />
        <DuelRow label="GOLS PRÓ" strix={strix.goalsFor} opponent={opponent.goalsFor} />
        <DuelRow label="SALDO" strix={strix.goalDifference} opponent={opponent.goalDifference} format={signed} />
        {reading && <p>{reading}</p>}
      </div>
      {standings.table.length > 0 && (
        <div className="match-table-rows" role="table" aria-label="Trecho da classificação">
          <div role="row" className="is-head"><span role="columnheader">#</span><span role="columnheader">CLUBE</span><span role="columnheader">PTS</span><span role="columnheader">J</span><span role="columnheader">SG</span></div>
          {standings.table.map((row, index) => (
            <React.Fragment key={`${row.position}-${row.team}`}>
              {row.gap && <i aria-hidden="true" />}
              <div role="row" className={row.isStrix ? "is-strix" : row.isOpponent ? "is-opponent" : ""} style={{ "--i": index }}>
                <span role="cell">{row.position ?? "—"}</span>
                <span role="cell"><ClubLogo name={row.team} url={row.logo} className="match-table-logo" sizes="24px" decorative /><b>{row.team}</b></span>
                <span role="cell" className="is-points">{show(row.points)}</span>
                <span role="cell">{show(row.played)}</span>
                <span role="cell">{signed(row.goalDifference)}</span>
              </div>
            </React.Fragment>
          ))}
          {standings.teams > 0 && <small>{standings.teams} clubes no grupo</small>}
        </div>
      )}
    </aside>
  );
}
