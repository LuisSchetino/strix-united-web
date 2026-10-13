import React from "react";
import { ClubLogo } from "./ClubLogo.jsx";
import "./now-card.css";

/**
 * The product's one elevated object, as the Central draws it: an ink panel with a
 * faint light from its top-left corner, a status line, one giant element, and a
 * foot above a hairline. The now line sweeps along its top edge on entrance and
 * again every few seconds; a shine travels the lower rule. Nothing else moves.
 *
 * `band` is the same object set flush inside a sheet (a dialog): no frame of its
 * own, the lower rule is its bottom edge.
 *
 * `head` and `foot` are rows of `<p>` (label type on top, quiet text below).
 */
export function NowCard({ band = false, tone = "", className = "", head, foot, children, ...rest }) {
  return (
    <section className={`now-card${band ? " is-band" : ""}${tone ? ` is-${tone}` : ""}${className ? ` ${className}` : ""}`} {...rest}>
      <i className="now-card-sweep" aria-hidden="true" />
      {head && <div className="now-card-head">{head}</div>}
      {children}
      {foot && <div className="now-card-foot">{foot}</div>}
    </section>
  );
}

/** The status at the left of the head: a dot and what is happening, in the card's strongest label. */
export function NowState({ children }) {
  return <p className="now-card-state"><span className="now-card-dot" aria-hidden="true" />{children}</p>;
}

/**
 * A fixture face to face: each club's crest over its name, the kick-off between
 * them in the product's giant numerals with the day underneath. On a narrow card
 * the kick-off takes its own row above the clubs, as on the Central on a phone.
 * Names wrap; they are never cut.
 */
export function FaceOff({ home, away, time, day, dateTime, labelledBy }) {
  return (
    <div className="faceoff" role="group" aria-label={labelledBy ? undefined : `${home.name} contra ${away.name}`} aria-labelledby={labelledBy}>
      <span className="faceoff-side is-home">
        <ClubLogo name={home.name} url={home.logo} className="faceoff-crest" sizes="96px" priority decorative />
        <b>{home.name}</b>
      </span>
      <span className="faceoff-clock">
        <time className="faceoff-time" dateTime={dateTime || undefined}>{time}</time>
        {day && <small>{day}</small>}
      </span>
      <i className="faceoff-x" aria-hidden="true">×</i>
      <span className="faceoff-side is-away">
        <ClubLogo name={away.name} url={away.logo} className="faceoff-crest" sizes="96px" priority decorative />
        <b>{away.name}</b>
      </span>
    </div>
  );
}
