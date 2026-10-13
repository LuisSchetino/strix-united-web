import React from "react";
import { NEXT_CLUBS_BRAND } from "../brand.js";

/**
 * Powered by Next Clubs: a lockup, not a footnote. The partner mark, one lime
 * hairline that draws in once, and the line that says what the partner does.
 * Lime stays inside this lockup; the page around it remains Strix.
 */
export function NextClubsSignature() {
  return (
    <div className="next-clubs-signature" aria-label="Competições powered by Next Clubs">
      <img src={NEXT_CLUBS_BRAND.logo} alt="" width="1407" height="385" loading="lazy" decoding="async" />
      <i aria-hidden="true" />
      <div>
        <span>Powered by <b>Next Clubs</b></span>
        <small>Calendário e ecossistema de campeonatos</small>
      </div>
    </div>
  );
}
