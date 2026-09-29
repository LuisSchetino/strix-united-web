import React from "react";
import { StaticMediaV2Logo } from "./StaticMediaV2Logo.jsx";
import { SELETIVA_POSTER_SIZE, seletivaHeadingSize } from "./seletiva-template-core.js";

function ChromeField() {
  return (
    <svg className="seletiva-chrome" viewBox="0 0 1080 1920" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="seletiva-chrome-metal" x1="0" y1="0" x2="1" y2=".2">
          <stop offset="0" stopColor="#090a0c" />
          <stop offset=".17" stopColor="#77797b" />
          <stop offset=".22" stopColor="#f7f7f5" />
          <stop offset=".26" stopColor="#353638" />
          <stop offset=".47" stopColor="#090a0b" />
          <stop offset=".67" stopColor="#a7a8a9" />
          <stop offset=".72" stopColor="#f5f5f3" />
          <stop offset=".77" stopColor="#454648" />
          <stop offset="1" stopColor="#08090a" />
        </linearGradient>
        <linearGradient id="seletiva-chrome-edge" x1="0" y1="0" x2="1" y2=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".3" stopColor="#fff" stopOpacity=".78" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".12" />
          <stop offset=".79" stopColor="#fff" stopOpacity=".88" />
          <stop offset="1" stopColor="#fff" stopOpacity=".12" />
        </linearGradient>
        <radialGradient id="seletiva-vignette" cx="50%" cy="48%" r="75%">
          <stop offset="45%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity=".83" />
        </radialGradient>
        <filter id="seletiva-metal-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>
      <rect width="1080" height="1920" fill="#030303" />
      <g fill="none" stroke="url(#seletiva-chrome-metal)" strokeLinecap="round">
        <path d="M-240 -150 C-40 8 7 144 -118 278 C-232 402 -182 552 53 689" strokeWidth="76" />
        <path d="M-240 -150 C-40 8 7 144 -118 278 C-232 402 -182 552 53 689" stroke="url(#seletiva-chrome-edge)" strokeWidth="4" />
        <path d="M1180 360 C1011 464 1000 592 1158 724 C1274 820 1215 932 1050 1030" strokeWidth="62" />
        <path d="M1180 360 C1011 464 1000 592 1158 724 C1274 820 1215 932 1050 1030" stroke="url(#seletiva-chrome-edge)" strokeWidth="4" />
        <path d="M-240 1176 C-26 1264 97 1388 70 1543 C47 1674 -62 1773 -173 1884" strokeWidth="72" />
        <path d="M-240 1176 C-26 1264 97 1388 70 1543 C47 1674 -62 1773 -173 1884" stroke="url(#seletiva-chrome-edge)" strokeWidth="4" />
        <path d="M1166 1016 C957 1154 932 1280 1091 1399 C1216 1493 1229 1647 1097 1786 C1036 1850 1040 1910 1112 1984" strokeWidth="78" />
        <path d="M1166 1016 C957 1154 932 1280 1091 1399 C1216 1493 1229 1647 1097 1786 C1036 1850 1040 1910 1112 1984" stroke="url(#seletiva-chrome-edge)" strokeWidth="4" />
      </g>
      <g opacity=".23" fill="none" stroke="#fff" filter="url(#seletiva-metal-shadow)">
        <path d="M-240 -150 C-40 8 7 144 -118 278 C-232 402 -182 552 53 689" strokeWidth="12" />
        <path d="M1166 1016 C957 1154 932 1280 1091 1399 C1216 1493 1229 1647 1097 1786 C1036 1850 1040 1910 1112 1984" strokeWidth="12" />
      </g>
      <rect width="1080" height="1920" fill="url(#seletiva-vignette)" />
      <path d="M0 0H1080V1920H0Z" fill="none" stroke="#ffffff" strokeOpacity=".045" strokeWidth="2" />
    </svg>
  );
}

function TelegramMark() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M27.7 5.4 23.8 25c-.3 1.4-1.1 1.8-2.2 1.1l-6-4.4-2.9 2.8c-.3.3-.6.6-1.2.6l.4-6.1L23 8.7c.5-.4-.1-.7-.7-.3L8 17.5l-6-1.9c-1.3-.4-1.3-1.3.3-1.9L25.8 4.3c1.1-.4 2.1.3 1.9 1.1Z" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" /></svg>;
}

export function SeletivaTemplate({ copy, posterRef, size = SELETIVA_POSTER_SIZE }) {
  return (
    <article
      className="seletiva-artboard"
      ref={posterRef}
      aria-label="Arte estática da seletiva Strix United"
      style={{ width: size.width, height: size.height }}
    >
      <ChromeField />
      <header className="seletiva-markline">
        <span>{copy.eyebrow}</span>
        <i />
      </header>
      <div className="seletiva-headline" aria-label={`${copy.headlineTop} ${copy.headlineBottom}`}>
        <strong style={{ fontSize: seletivaHeadingSize(copy.headlineTop) }}>{copy.headlineTop}</strong>
        <strong style={{ fontSize: seletivaHeadingSize(copy.headlineBottom, { max: 174, min: 108 }) }}>{copy.headlineBottom}</strong>
      </div>
      <div className="seletiva-crest-wrap">
        <StaticMediaV2Logo />
      </div>
      <div className="seletiva-positions">
        <i />
        <strong style={{ fontSize: seletivaHeadingSize(copy.positions, { max: 77, min: 44 }) }}>{copy.positions}</strong>
        <span><i />{copy.edition}<i /></span>
      </div>
      <div className="seletiva-cta">
        <TelegramMark />
        <span style={{ fontSize: seletivaHeadingSize(copy.cta, { max: 23, min: 15 }), letterSpacing: copy.cta.length > 17 ? ".12em" : ".27em" }}>{copy.cta}</span>
      </div>
      <small className="seletiva-edition-mark">STRIX UNITED · FC 27</small>
    </article>
  );
}
