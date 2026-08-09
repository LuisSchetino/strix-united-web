import React, { useEffect, useState } from "react";
import "./club-logo.css";

const STRIX_LOGO = /(?:^|\/)strix-logo(?:-\d+)?\.(?:png|webp|avif)(?:\?.*)?$/i;
const AVIF_SET = [128, 256, 384, 512].map((size) => `/assets/strix-logo-${size}.avif ${size}w`).join(", ");
const WEBP_SET = [128, 256, 384, 512].map((size) => `/assets/strix-logo-${size}.webp ${size}w`).join(", ");

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
      {isStrix ? <picture><source type="image/avif" srcSet={AVIF_SET} sizes={sizes}/><source type="image/webp" srcSet={WEBP_SET} sizes={sizes}/><img src="/assets/strix-logo-256.webp" sizes={sizes} {...imageProps}/></picture>
        : hasAsset ? <img src={url} {...imageProps}/>
          : <b>{initialsOf(name)}</b>}
    </span>
  );
}
