import React, { useMemo } from "react";
import { SelectControl } from "../../ui/SelectControl.jsx";
import { useRemembered } from "../../ui/useRemembered.js";
import { DuelRow } from "../agenda/MatchView.jsx";
import { compareRows, compareValue } from "./compare-core.js";
import "./player-compare.css";

const keyOf = (player) => String(player.playerId || player.eaPlayerIds?.[0] || player.handle);

/**
 * Two players of the roster face to face, with the numbers the season already holds.
 * The choice of both is remembered while the site is open.
 */
export function PlayerCompare({ players = [] }) {
  const eligible = useMemo(() => players.filter((player) => player.active !== false && !player.noSample && (player.games || 0) > 0).sort((left, right) => String(left.name).localeCompare(String(right.name), "pt-BR")), [players]);
  const [first, setFirst] = useRemembered("statistics-compare-a", "");
  const [second, setSecond] = useRemembered("statistics-compare-b", "");
  if (eligible.length < 2) return null;
  const options = [["", "Escolher jogador"], ...eligible.map((player) => [keyOf(player), `${player.name}${player.positions?.length ? ` · ${player.positions.join("/")}` : ""}`])];
  const a = eligible.find((player) => keyOf(player) === first) || null;
  const b = eligible.find((player) => keyOf(player) === second) || null;
  return (
    <section className="player-compare" aria-labelledby="player-compare-title">
      <header>
        <div><span>FRENTE A FRENTE</span><h2 id="player-compare-title">Comparar dois jogadores.</h2><p>Os números da temporada lado a lado, só com o que foi registrado.</p></div>
        <div className="player-compare-pick">
          <SelectControl value={first} onChange={setFirst} label="Primeiro jogador" options={options.filter(([value]) => !value || value !== second)} />
          <i aria-hidden="true">×</i>
          <SelectControl value={second} onChange={setSecond} label="Segundo jogador" options={options.filter(([value]) => !value || value !== first)} />
        </div>
      </header>
      {a && b ? (
        <div className="match-duel player-compare-duel">
          <div className="match-duel-head">
            <div><strong>{compareValue(a.averageRating) ?? "—"}</strong><span>{a.name}</span></div>
            <i aria-hidden="true">×</i>
            <div><strong>{compareValue(b.averageRating) ?? "—"}</strong><span>{b.name}</span></div>
          </div>
          {/* The average rating is the headline above; the rest follows row by row. */}
          {compareRows(a, b).filter(([label]) => label !== "NOTA MÉDIA").map(([label, left, right, format]) => (
            <DuelRow key={label} label={label} strix={left} opponent={right} {...(format ? { format } : {})} />
          ))}
          {Boolean(a.goalkeeper) !== Boolean(b.goalkeeper) && <p>Um é goleiro e o outro joga na linha: só entram os números que os dois têm.</p>}
        </div>
      ) : <p className="player-compare-hint">Escolha dois jogadores com partidas registradas para ver a comparação.</p>}
    </section>
  );
}
