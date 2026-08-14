import React from "react";
import { NEXT_CLUBS_BRAND } from "../brand.js";

export function NextClubsSignature() {
  return (
    <div className="next-clubs-signature" aria-label="Competições powered by Next Clubs">
      <img src={NEXT_CLUBS_BRAND.logo} alt="" width="1536" height="1024" loading="lazy" decoding="async" />
      <div>
        <span>Competições powered by <b>Next Clubs</b></span>
        <small>Calendário e ecossistema de campeonatos</small>
      </div>
    </div>
  );
}
