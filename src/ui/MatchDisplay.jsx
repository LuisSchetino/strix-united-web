import React from "react";
import { ClubLogo } from "./ClubLogo.jsx";
import "./match-display.css";

/** Team crest in a fixed square box; every team (Strix included) gets the same box. */
export function TeamMark({ name, url, className = "", framed = false, priority = false }) {
  return (
    <ClubLogo name={name} url={url} decorative priority={priority} sizes="96px" className={`matchup-mark match-display-mark${framed ? " is-framed" : ""} ${className}`.trim()} />
  );
}

function TeamColumn({ side, name, logo, priority }) {
  return (
    <div className={`matchup-team match-display-team match-display-${side} is-${side}`}>
      <TeamMark name={name} url={logo} priority={priority} />
      <span className="matchup-name match-display-name" title={name}>{name}</span>
    </div>
  );
}

/**
 * The one confrontation component of the product:
 *   [ HOME TEAM ] [ CENTER ] [ AWAY TEAM ]
 * Both team columns share the same width, structure and centring, so "STRIX"
 * and any opponent always line up the same way. The center shows the score,
 * or any custom content (kickoff time, "VS").
 */
export function Matchup({
  homeName,
  homeLogo,
  homeScore,
  awayName,
  awayLogo,
  awayScore,
  center,
  size = "md",
  className = "",
  priority = false,
}) {
  const hasScore = homeScore !== undefined || awayScore !== undefined;
  return (
    <div className={`matchup match-display is-${size} ${className}`.trim()}>
      <TeamColumn side="home" name={homeName} logo={homeLogo} priority={priority} />
      <div className="matchup-center">
        {center ?? (hasScore
          ? <span className="matchup-score"><strong>{homeScore ?? "—"}</strong><i>×</i><strong>{awayScore ?? "—"}</strong></span>
          : <span className="matchup-vs">VS</span>)}
      </div>
      <TeamColumn side="away" name={awayName} logo={awayLogo} priority={priority} />
    </div>
  );
}

/** Historical name kept for existing call sites. */
export const MatchDisplay = Matchup;
