import React from "react";
import { STRIX_BRAND } from "../../brand.js";

/** Canonical club mark for static V2 artboards; preserves aspect ratio and transparent edges. */
export function StaticMediaV2Logo({ src = STRIX_BRAND.logo, alt = "Escudo Strix United", className = "" }) {
  return <img className={`static-v2-brand-mark ${className}`.trim()} src={src} alt={alt} crossOrigin="anonymous" />;
}
