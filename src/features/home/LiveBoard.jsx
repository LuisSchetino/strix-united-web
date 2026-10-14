import React, { useEffect, useRef, useState } from "react";
import { crestColor } from "../../ui/crest-color.js";
import { goalBetween } from "./live-goal.js";
import "./live-board.css";

const STRIX_COLOR = "#2F80FF";
const OPPONENT_FALLBACK = "#f1f1f1";
const GOAL_MS = 3800;
const REVEAL_MS = 3000;

/**
 * The live game in the Home's giant numerals: the score from the PC watcher, the minute and the
 * kick-off under it. When a new reading brings a goal, the card celebrates it: the ball goes in,
 * the net shakes and "GOL" lands, in Strix blue or in the colour of the opponent's crest.
 */
export function LiveBoard({ match, live, kickoff }) {
  const [goal, setGoal] = useState(null);
  const [color, setColor] = useState(OPPONENT_FALLBACK);
  const last = useRef(null);
  const reading = { id: match.id, strix: live.strix ?? 0, opponent: live.opponent ?? 0 };

  useEffect(() => {
    let alive = true;
    crestColor(match.resolvedLogo).then((value) => { if (alive && value) setColor(value); });
    return () => { alive = false; };
  }, [match.resolvedLogo]);

  useEffect(() => {
    const previous = last.current;
    const side = goalBetween(previous, reading);
    last.current = reading;
    if (!side) return undefined;
    // the old score stays up while the ball goes in; the new one lands as "GOL" fades
    setGoal({ side, at: Date.now(), before: previous, revealed: false });
    const reveal = window.setTimeout(() => setGoal((value) => value && { ...value, revealed: true }), REVEAL_MS);
    const timer = window.setTimeout(() => setGoal(null), GOAL_MS + 900);
    return () => { window.clearTimeout(reveal); window.clearTimeout(timer); };
  }, [reading.id, reading.strix, reading.opponent]);

  const shown = goal && !goal.revealed ? goal.before : reading;

  const tint = goal?.side === "opponent" ? color : STRIX_COLOR;
  const minute = Number.isFinite(live.minute) ? `${live.minute}'` : "";
  return (
    <div className={`home-live${goal ? ` is-goal is-goal-${goal.side}` : ""}`} style={{ "--goal": tint }}>
      <strong className="home-live-score" aria-live="polite" aria-label={`Strix United ${reading.strix} a ${reading.opponent} ${match.opponent_name}${minute ? `, ${live.minute} minutos` : ""}`}>
        <span key={`s${shown.strix}`} className={goal?.revealed && goal.side === "strix" ? "is-new" : ""}>{shown.strix}</span>
        <i aria-hidden="true">×</i>
        <span key={`o${shown.opponent}`} className={goal?.revealed && goal.side === "opponent" ? "is-new" : ""}>{shown.opponent}</span>
      </strong>
      <p className="home-live-meta">
        {minute && <b key={minute}>{minute}</b>}
        <span>Começou às {kickoff}</span>
      </p>
      {goal && <GoalBurst key={goal.at} side={goal.side} name={goal.side === "strix" ? "Strix United" : match.opponent_name} />}
    </div>
  );
}

const SPARKS = Array.from({ length: 18 }, (_, index) => index);

/** The celebration itself, drawn over the whole card. Purely decorative. */
function GoalBurst({ side, name }) {
  // each burst gets its own filter id: two cards on screen never share one
  const id = useRef(`net-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <div className={`goal-burst is-${side}`} aria-hidden="true">
      <i className="goal-flash" />
      <svg className="goal-net" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`${id}-mesh`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0H16M0 0V16" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </pattern>
          <radialGradient id={`${id}-fade`} cx="50%" cy="55%" r="60%">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`${id}-mask`}><rect width="400" height="220" fill={`url(#${id}-fade)`} /></mask>
          <filter id={`${id}-shake`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="2" seed="4">
              <animate attributeName="baseFrequency" dur="0.9s" values="0.018 0.03;0.03 0.05;0.018 0.03" repeatCount="3" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="0">
              <animate attributeName="scale" begin="0.42s" dur="2.4s" values="0;46;-30;20;-10;4;0" keyTimes="0;0.12;0.28;0.45;0.62;0.8;1" fill="freeze" />
            </feDisplacementMap>
          </filter>
        </defs>
        <g filter={`url(#${id}-shake)`} mask={`url(#${id}-mask)`}>
          <rect className="goal-net-mesh" x="-40" y="-40" width="480" height="300" fill={`url(#${id}-mesh)`} />
        </g>
        <path className="goal-net-frame" d="M30 214V22H370V214" fill="none" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <i className="goal-ball"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" /><path d="M20 11l7 5-3 8h-8l-3-8z" /><path d="M20 2v9M33 10l-6 6M37 26l-13-2M26 37l-2-13M8 34l8-10M3 20l10-4M8 8l5 8" /></svg></i>
      <span className="goal-sparks">{SPARKS.map((index) => <i key={index} style={{ "--a": `${index * 20 + (index % 3) * 7}deg`, "--d": `${110 + (index % 4) * 42}px`, "--t": `${(index % 5) * 40}ms` }} />)}</span>
      <p className="goal-word"><b>GOL</b><small>{side === "strix" ? "do Strix" : name}</small></p>
    </div>
  );
}
