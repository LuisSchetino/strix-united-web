import React, { useCallback, useEffect, useState } from "react";
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

export function ClubLogo({ name, url, className = "", kind = "logo", priority = false, sizes = "48px", decorative = false, size }) {
  const resolvedUrl = cacheableProviderAssetUrl(url);
  // A source owns its lifecycle. Never reset a loaded image in a passive effect:
  // cached image events can arrive before that effect runs.
  return <LogoAsset key={resolvedUrl} {...{ name, url, resolvedUrl, className, kind, priority, sizes, decorative, size }} />;
}

function LogoAsset({ name, url, resolvedUrl, className, kind, priority, sizes, decorative, size }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const imageRef = useCallback((image) => {
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, []);
  useEffect(() => {
    if (!failed) return undefined;
    const retry = () => { setFailed(false); setLoaded(false); setAttempt(value => value + 1); };
    const timer = attempt < 2 ? window.setTimeout(retry, 1000 * (attempt + 1)) : null;
    window.addEventListener("online", retry);
    return () => { window.clearTimeout(timer); window.removeEventListener("online", retry); };
  }, [failed, attempt]);
  const hasAsset = Boolean(url && !failed);
  const isStrix = hasAsset && attempt === 0 && STRIX_LOGO.test(String(url));
  const alt = decorative ? "" : kind === "photo" ? `Foto de ${name || "jogador"}` : `Escudo ${name || "do clube"}`;
  const px = Number(size);
  const style = Number.isFinite(px) && px > 0 ? { "--avatar-size": `${px}px`, width: px, height: px } : undefined;
  const imageProps = {
    ref: imageRef,
    alt,
    width: 512,
    height: 512,
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : "auto",
    decoding: priority ? "sync" : "async",
    onLoad: () => setLoaded(true),
    onError: () => setFailed(true),
  };
  return (
    <span className={`club-logo ${className}${hasAsset ? " has-image" : " is-fallback"}${loaded ? " is-loaded" : " is-loading"} is-${kind}`.trim()} style={style} aria-hidden={decorative || undefined}>
      {hasAsset && !loaded && <b className="club-logo-placeholder" aria-hidden="true" />}
      {isStrix ? <picture><source type="image/avif" srcSet={STRIX_BRAND.avifSet} sizes={sizes}/><source type="image/webp" srcSet={STRIX_BRAND.webpSet} sizes={sizes}/><img src={STRIX_BRAND.logoFallback} sizes={sizes} {...imageProps}/></picture>
        : hasAsset ? <img src={resolvedUrl} {...imageProps}/>
          : <b>{initialsOf(name)}</b>}
    </span>
  );
}
