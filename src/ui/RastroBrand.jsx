import React from "react";
import { RASTRO_BRAND } from "../brand.js";

export function RastroSignature({ compact = false }) {
  return (
    <div className={`rastro-signature${compact ? " is-compact" : ""}`} aria-label="Tecnologia por Rastro">
      <img src={RASTRO_BRAND.logoCompact} alt="" width="256" height="256" loading="lazy" decoding="async" />
      <span>Powered by <b>Rastro</b></span>
    </div>
  );
}

export function RastroDataSignature({ label = "Powered by" }) {
  return (
    <div className="rastro-data-signature" aria-label="Dados e tecnologia por Rastro">
      <img src={RASTRO_BRAND.logoCompact} alt="" width="256" height="256" loading="lazy" decoding="async" />
      <span>{label} <b>Rastro</b></span>
    </div>
  );
}

export function RastroWatermark({ label = "Rastro Data" }) {
  return (
    <div className="rastro-watermark" aria-hidden="true">
      <img src={RASTRO_BRAND.logoCompact} alt="" width="256" height="256" loading="lazy" decoding="async" />
      <span>{label}</span>
    </div>
  );
}
