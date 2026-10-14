import React, { useEffect, useRef, useState } from "react";
import { crestColor } from "../../ui/crest-color.js";
import { goalBetween } from "./live-goal.js";
import { STRIX_BRAND } from "../../brand.js";
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

  // a goal just arrived and its effect has not run yet: still the old score on this render
  const arriving = goalBetween(last.current, reading) ? last.current : null;
  const shown = goal && !goal.revealed ? goal.before : arriving || reading;

  const tint = goal?.side === "opponent" ? color : STRIX_COLOR;
  const minute = Number.isFinite(live.minute) ? `${live.minute}'` : "";
  const moment = live.phase === "halftime" ? "Intervalo" : live.phase === "ended" ? "Fim de jogo" : minute;
  return (
    <div className={`home-live${goal ? ` is-goal is-goal-${goal.side}` : ""}`} style={{ "--goal": tint }}>
      <strong className="home-live-score" aria-live="polite" aria-label={`Strix United ${reading.strix} a ${reading.opponent} ${match.opponent_name}${minute ? `, ${live.minute} minutos` : ""}`}>
        <span key={`s${shown.strix}`} className={goal?.revealed && goal.side === "strix" ? "is-new" : ""}>{shown.strix}</span>
        <i aria-hidden="true">×</i>
        <span key={`o${shown.opponent}`} className={goal?.revealed && goal.side === "opponent" ? "is-new" : ""}>{shown.opponent}</span>
      </strong>
      <p className="home-live-meta">
        {moment && <b key={moment}>{moment}</b>}
        <span>Começou às {kickoff}</span>
      </p>
      {goal && <GoalBurst key={goal.at} side={goal.side} name={goal.side === "strix" ? "Strix United" : match.opponent_name} crest={goal.side === "strix" ? STRIX_BRAND.logo : match.resolvedLogo} score={`${reading.strix} × ${reading.opponent}`} minute={minute} />}
    </div>
  );
}

// The PNGs of the ball and the goal live in public/assets/gol/ (bola.png, trave.png). Until they
// are there, or if one fails to load, the drawn versions below stand in.
const ASSET_BALL = "/assets/gol/bola.png";
const ASSET_GOAL = "/assets/gol/trave.png";
const assetChecks = new Map();
function assetReady(url) {
  if (typeof Image === "undefined") return Promise.resolve(false);
  if (!assetChecks.has(url)) {
    assetChecks.set(url, new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0);
      image.onerror = () => resolve(false);
      image.src = url;
    }));
  }
  return assetChecks.get(url);
}
function useGoalAssets() {
  const [assets, setAssets] = useState({ ball: false, goal: false });
  useEffect(() => {
    let alive = true;
    Promise.all([assetReady(ASSET_BALL), assetReady(ASSET_GOAL)]).then(([ball, goal]) => { if (alive) setAssets({ ball, goal }); });
    return () => { alive = false; };
  }, []);
  return assets;
}

const CONFETTI = Array.from({ length: 34 }, (_, index) => index);
const TRAIL = [0, 1, 2, 3];

/** A football drawn in SVG: shaded sphere, the classic black pentagons, a highlight. */
function DrawnBall() {
  return (
    <svg viewBox="0 0 100 100" className="goal-ball-art">
      <defs>
        <radialGradient id="gb-shade" cx="38%" cy="32%" r="72%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e9ecef" />
          <stop offset="1" stopColor="#8d949c" />
        </radialGradient>
        <radialGradient id="gb-gloss" cx="34%" cy="26%" r="30%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="gb-clip"><circle cx="50" cy="50" r="47" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#gb-shade)" />
      <g clipPath="url(#gb-clip)" fill="#14171b" stroke="#2b3036" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M50 33l15 11-6 18H41l-6-18z" />
        <path d="M50 -4l12 8-4 13H42l-4-13z" />
        <path d="M86 30l12 4 2 15-11 7-9-9z" />
        <path d="M14 30l-12 4-2 15 11 7 9-9z" />
        <path d="M71 80l12-3 9 11-6 13H72z" />
        <path d="M29 80l-12-3-9 11 6 13h14z" />
      </g>
      <g clipPath="url(#gb-clip)" fill="none" stroke="#6c737b" strokeWidth="1.1" opacity="0.7">
        <path d="M50 33V17M65 44l15-4M59 62l12 18M41 62l-12 18M35 44l-15-4" />
      </g>
      <circle cx="50" cy="50" r="47" fill="url(#gb-gloss)" />
      <circle cx="50" cy="50" r="47" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The goal: posts, crossbar and one continuous net. Where the ball hits, a soft round patch of
 * the same net is pushed back (scaled towards the impact) and springs out again, faded at its
 * edge so there is never a seam.
 */
function DrawnGoal({ id }) {
  return (
    <svg className="goal-frame-art" viewBox="0 0 600 300" preserveAspectRatio="xMidYMax meet">
      <defs>
        <pattern id={`${id}-mesh`} width="16" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 7l8-7 8 7-8 7z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </pattern>
        <linearGradient id={`${id}-post`} x1="0" x2="1">
          <stop offset="0" stopColor="#b9c0c8" />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="1" stopColor="#9aa2ab" />
        </linearGradient>
        <linearGradient id={`${id}-bar`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#aab2bb" />
        </linearGradient>
        <radialGradient id={`${id}-soft`} cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-patch`} maskContentUnits="userSpaceOnUse">
          <circle cx="300" cy="160" r="120" fill={`url(#${id}-soft)`} />
        </mask>
        <mask id={`${id}-hole`} maskContentUnits="userSpaceOnUse">
          <rect width="600" height="300" fill="#fff" />
          <circle cx="300" cy="160" r="120" fill={`url(#${id}-soft)`} className="goal-net-hole" />
        </mask>
      </defs>
      <rect x="60" y="30" width="480" height="264" fill={`url(#${id}-mesh)`} mask={`url(#${id}-hole)`} className="goal-net-mesh" />
      <g mask={`url(#${id}-patch)`}>
        <rect x="60" y="30" width="480" height="264" fill={`url(#${id}-mesh)`} className="goal-net-dent" />
      </g>
      <rect x="50" y="22" width="20" height="272" rx="6" fill={`url(#${id}-post)`} />
      <rect x="530" y="22" width="20" height="272" rx="6" fill={`url(#${id}-post)`} />
      <rect x="50" y="18" width="500" height="18" rx="7" fill={`url(#${id}-bar)`} />
    </svg>
  );
}

/** The celebration itself, drawn over the whole card, in the scoring club's colour. Decorative. */
function GoalBurst({ side, name, crest, score, minute }) {
  const id = useRef(`gol-${Math.random().toString(36).slice(2, 8)}`).current;
  const assets = useGoalAssets();
  return (
    <div className={`goal-burst is-${side}`} aria-hidden="true">
      <i className="goal-flash" />
      <div className="goal-stage">
        <div className="goal-frame">
          {assets.goal ? <img className="goal-frame-img" src={ASSET_GOAL} alt="" /> : <DrawnGoal id={id} />}
          <i className="goal-impact" />
        </div>
        <div className="goal-ball">
          {TRAIL.map((index) => <i key={index} className="goal-ball-trail" style={{ "--k": index }} />)}
          <span className="goal-ball-spin">{assets.ball ? <img src={ASSET_BALL} alt="" /> : <DrawnBall />}</span>
        </div>
      </div>
      <span className="goal-confetti">{CONFETTI.map((index) => (
        <i key={index} style={{
          "--x": `${(index * 37) % 100}%`,
          "--r": `${(index * 53) % 360}deg`,
          "--d": `${(index % 7) * 70}ms`,
          "--s": `${0.7 + (index % 4) * 0.18}`,
          "--drift": `${((index * 29) % 120) - 60}px`,
        }} />
      ))}</span>
      <div className="goal-word">
        <i className="goal-streak" />
        <b>GOL</b>
        <p className="goal-band">
          {crest ? <img className="goal-crest" src={crest} alt="" /> : null}
          <span>{name}</span>
          <strong>{score}</strong>
          {minute ? <small>{minute}</small> : null}
        </p>
      </div>
    </div>
  );
}
