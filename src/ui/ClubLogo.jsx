import React, { useCallback, useEffect, useState } from "react";
import { STRIX_BRAND } from "../brand.js";
import { cacheableProviderAssetUrl } from "./provider-assets.js";
import { photoFocus } from "./photo-focus.js";
import { cleanLogo } from "./logo-clean.js";
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
  // A player's photo taller than wide may be a body shot cut out of its background: the round
  // token then frames the head instead of the middle of the picture (see ui/photo-focus.js).
  const [focus, setFocus] = useState(null);
  // A crest that came on a white card, or small inside an empty canvas, is shown cleaned (see
  // ui/logo-clean.js). The picture as it came is what shows until then, and whenever in doubt.
  const [clean, setClean] = useState("");
  useEffect(() => {
    let alive = true;
    if (kind !== "logo" || !url || STRIX_LOGO.test(String(url))) return undefined;
    cleanLogo(resolvedUrl).then((cleaned) => { if (alive && cleaned) setClean(cleaned); });
    return () => { alive = false; };
  }, [resolvedUrl, kind, url]);
  const measure = (image) => {
    if (kind !== "photo" || !(image?.naturalWidth > 0) || image.naturalHeight / image.naturalWidth <= 1.1) return;
    void photoFocus(resolvedUrl).then((frame) => { if (frame) setFocus(frame); });
  };
  const imageRef = useCallback((image) => {
    if (image?.complete && image.naturalWidth > 0) { setLoaded(true); measure(image); }
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
  const sized = Number.isFinite(px) && px > 0 ? { "--avatar-size": `${px}px`, width: px, height: px } : null;
  const framed = focus ? { "--focus-top": `${focus.top * 100}%`, "--focus-zoom": focus.zoom, "--focus-x": `${focus.x}%`, "--focus-y": `${focus.y}%` } : null;
  const style = sized || framed ? { ...sized, ...framed } : undefined;
  const imageProps = {
    ref: imageRef,
    alt,
    width: 512,
    height: 512,
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : "auto",
    decoding: "async",
    onLoad: async (event) => {
      const image = event.currentTarget;
      measure(image);
      try { await image.decode?.(); } catch { /* cached or already decoded */ }
      setLoaded(true);
    },
    onError: () => (clean ? setClean("") : setFailed(true)),
  };
  return (
    <span className={`club-logo ${className}${hasAsset ? " has-image" : " is-fallback"}${loaded ? " is-loaded" : " is-loading"} is-${kind}${focus ? " has-focus" : ""}`.trim()} style={style} aria-hidden={decorative || undefined}>
      {hasAsset && !loaded && <b className="club-logo-placeholder" aria-hidden="true" />}
      {isStrix ? <picture><source type="image/avif" srcSet={STRIX_BRAND.avifSet} sizes={sizes}/><source type="image/webp" srcSet={STRIX_BRAND.webpSet} sizes={sizes}/><img src={STRIX_BRAND.logoFallback} sizes={sizes} {...imageProps}/></picture>
        : hasAsset ? <img src={clean || resolvedUrl} {...imageProps}/>
          : <b>{initialsOf(name)}</b>}
    </span>
  );
}
