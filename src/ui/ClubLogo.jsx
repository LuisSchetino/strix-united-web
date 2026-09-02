import React, { useEffect, useState } from "react";
import { STRIX_BRAND } from "../brand.js";
import { cacheableProviderAssetUrl } from "./provider-assets.js";
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
  const [loaded, setLoaded] = useState(false);
  const resolvedUrl = cacheableProviderAssetUrl(url);
  useEffect(() => { setFailed(false); setLoaded(false); }, [resolvedUrl]);
  const hasAsset = Boolean(url && !failed);
  const isStrix = hasAsset && STRIX_LOGO.test(String(url));
  const alt = decorative ? "" : kind === "photo" ? `Foto de ${name || "jogador"}` : `Escudo ${name || "do clube"}`;
  const imageProps = {
    alt,
    width: 512,
    height: 512,
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : "auto",
    decoding: "async",
    onLoad: () => setLoaded(true),
    onError: () => setFailed(true),
  };
  return (
    <span className={`club-logo ${className}${hasAsset ? " has-image" : " is-fallback"}${loaded ? " is-loaded" : " is-loading"} is-${kind}`.trim()} aria-hidden={decorative || undefined}>
      {hasAsset && !loaded && <b className="club-logo-placeholder" aria-hidden="true">{initialsOf(name)}</b>}
      {isStrix ? <picture><source type="image/avif" srcSet={STRIX_BRAND.avifSet} sizes={sizes}/><source type="image/webp" srcSet={STRIX_BRAND.webpSet} sizes={sizes}/><img src={STRIX_BRAND.logoFallback} sizes={sizes} {...imageProps}/></picture>
        : hasAsset ? <img src={resolvedUrl} {...imageProps}/>
          : <b>{initialsOf(name)}</b>}
    </span>
  );
}
