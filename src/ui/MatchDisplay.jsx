import React from "react";
import { ClubLogo } from "./ClubLogo.jsx";
import "./match-display.css";

export function TeamMark({ name, url, className = "", framed = false }) {
  return (
    <ClubLogo name={name} url={url} decorative sizes="42px" className={`match-display-mark${framed ? " is-framed" : ""} ${className}`.trim()} />
  );
}

export function MatchDisplay({
  homeName,
  homeLogo,
  homeScore,
  awayName,
  awayLogo,
  awayScore,
  className = "",
  compact = false,
  layout = "inline",
}) {
  return (
    <div className={`match-display${compact ? " is-compact" : ""}${layout === "ledger" ? " is-ledger" : ""} ${className}`.trim()}>
      <div className="match-display-team match-display-home">
        <span className="match-display-name">{homeName}</span>
        <TeamMark name={homeName} url={homeLogo} />
        <strong>{homeScore ?? "—"}</strong>
      </div>
      <i>×</i>
      <div className="match-display-team match-display-away">
        <strong>{awayScore ?? "—"}</strong>
        <TeamMark name={awayName} url={awayLogo} />
        <span className="match-display-name">{awayName}</span>
      </div>
    </div>
  );
}
