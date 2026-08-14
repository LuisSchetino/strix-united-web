import React, { useEffect, useState } from "react";
import { STRIX_BRAND } from "../brand.js";
import "./club-logo.css";

const STRIX_LOGO = /(?:strix-logo|brand\/strix\/strix-united-fc27)(?:-\d+)?\.(?:png|webp|avif)(?:\?.*)?$/i;

const initialsOf = (name) => String(name || "?")
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word[0])
  .slice(0, 2)
  .join("");

export function ClubLogo({ name, url, className = "", kind = "logo", priority = false, sizes = "48px", decorative = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const hasAsset = Boolean(url && !failed);
  const isStrix = hasAsset && STRIX_LOGO.test(String(url));
  const alt = decorative ? "" : kind === "photo" ? `Foto de ${name || "jogador"}` : `Escudo ${name || "do clube"}`;
  const imageProps = { alt, width: 512, height: 512, loading: priority ? "eager" : "lazy", fetchPriority: priority ? "high" : "auto", decoding: "async", onError: () => setFailed(true) };
  return (
    <span className={`club-logo ${className}${hasAsset ? " has-image" : " is-fallback"} is-${kind}`.trim()} aria-hidden={decorative || undefined}>
      {isStrix ? <picture><source type="image/avif" srcSet={STRIX_BRAND.avifSet} sizes={sizes}/><source type="image/webp" srcSet={STRIX_BRAND.webpSet} sizes={sizes}/><img src={STRIX_BRAND.logoFallback} sizes={sizes} {...imageProps}/></picture>
        : hasAsset ? <img src={url} {...imageProps}/>
          : <b>{initialsOf(name)}</b>}
    </span>
  );
}
