import React, { useEffect, useState } from "react";
import "./match-display.css";

export function TeamMark({ name, url, className = "", framed = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const initials = String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("");
  return (
    <span className={`match-display-mark${url && !failed ? " has-image" : " is-fallback"}${framed ? " is-framed" : ""} ${className}`.trim()} aria-hidden="true">
      {url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} /> : <b>{initials}</b>}
    </span>
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
}) {
  return (
    <div className={`match-display${compact ? " is-compact" : ""} ${className}`.trim()}>
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
