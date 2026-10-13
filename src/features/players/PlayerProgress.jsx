import React, { useMemo } from "react";
import { DataTrend } from "../../ui/DataTrend.jsx";
import { useMinuteClock } from "../../ui/useMinuteClock.js";
import { saoPauloDay } from "../agenda/agenda-time.js";
import { playerMilestones, playerWeek } from "./milestones.js";
import "./player-progress.css";

const shortDate = (value) => (value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(value)) : "");
const trendOf = (current, previous) => (current > previous ? "up" : current < previous ? "down" : "stable");

/**
 * The player's last seven days against the seven before, and the round numbers he has
 * reached with what is left to the next ones. Counted from his real appearances.
 */
export function PlayerProgress({ appearances = [], goalkeeper = false }) {
  const now = useMinuteClock();
  const day = saoPauloDay(now);
  const week = useMemo(() => playerWeek(appearances, now), [appearances, day]);
  const marks = useMemo(() => playerMilestones(appearances, { goalkeeper }), [appearances, goalkeeper]);
  const reached = [...marks.reached].reverse().slice(0, 6);
  if (!week && !reached.length && !marks.upcoming.length) return null;
  const cells = week ? [
    ["JOGOS", week.current.games, week.previous.games, ""],
    [goalkeeper ? "ASSISTÊNCIAS" : "GOLS", goalkeeper ? week.current.assists : week.current.goals, goalkeeper ? week.previous.assists : week.previous.goals, ""],
    ...(goalkeeper ? [] : [["ASSISTÊNCIAS", week.current.assists, week.previous.assists, ""]]),
    ["NOTA MÉDIA", week.current.rating, week.previous.rating, ""],
  ] : [];
  return (
    <section className="player-progress" aria-label="Semana e marcos">
      {week && (
        <div className="player-week">
          <header><h3>Últimos 7 dias</h3><small>contra os 7 dias anteriores</small></header>
          <div className="player-week-grid">
            {cells.map(([label, current, previous]) => {
              const comparable = current !== null && previous !== null && (week.previous.games > 0);
              return (
                <article key={label}>
                  <small>{label}</small>
                  <strong className={current === null ? "" : "data-value"}>{current === null ? "—" : current}</strong>
                  {comparable
                    ? <DataTrend trend={trendOf(current, previous)} delta={Number((current - previous).toFixed(1))} unit={current > previous ? "a mais" : current < previous ? "a menos" : ""} against={`${previous} antes`} />
                    : <em>{week.previous.games ? "sem nota antes" : "sem jogo na semana anterior"}</em>}
                </article>
              );
            })}
          </div>
        </div>
      )}
      {(reached.length > 0 || marks.upcoming.length > 0) && (
        <div className="player-marks">
          <header><h3>Marcos</h3></header>
          {reached.length > 0 && (
            <ol>
              {reached.map((mark) => (
                <li key={mark.id}>
                  <b>{mark.label}</b>
                  <small>{[shortDate(mark.at), mark.opponent && `contra ${mark.opponent}`].filter(Boolean).join(" · ")}</small>
                </li>
              ))}
            </ol>
          )}
          {marks.upcoming.length > 0 && (
            <p className="player-marks-next"><span>Próximos</span>{marks.upcoming.map((item) => item.text).join(" · ")}</p>
          )}
        </div>
      )}
    </section>
  );
}
