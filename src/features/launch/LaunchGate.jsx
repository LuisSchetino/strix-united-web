import React, { useEffect, useState } from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { useReducedMotion } from "../../ui/motion/motion.jsx";
import {
  LAUNCH_CONFIG,
  canShowInternalAccess,
  countdownParts,
  displayRemainingMs,
  isLaunchUnlocked,
  rememberLaunchReturn,
} from "../../launch.js";
import "./launch.css";

function pad2(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
}

function RollingDigit({ digit, reduced }) {
  const value = Number(digit) || 0;
  return (
    <span className="launch-digit">
      <span
        className="launch-digit-track"
        style={reduced ? undefined : { transform: `translateY(${-value * 10}%)` }}
      >
        {reduced
          ? <span>{value}</span>
          : Array.from({ length: 10 }, (_, index) => <span key={index}>{index}</span>)}
      </span>
    </span>
  );
}

function LaunchUnit({ value, label, reduced }) {
  const text = pad2(value);
  return (
    <div className="launch-unit">
      <b aria-hidden="true">
        {text.split("").map((digit, index) => (
          <RollingDigit digit={digit} reduced={reduced} key={`${index}-${reduced}`} />
        ))}
      </b>
      <small>{label}</small>
    </div>
  );
}

export function LaunchGate({ mode = "countdown", config = LAUNCH_CONFIG, onUnlock, onInternalAccess }) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState("");
  const parts = countdownParts(displayRemainingMs(now, config));
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const showInternal = mode === "countdown" && Boolean(onInternalAccess) && canShowInternalAccess(hostname);

  useEffect(() => {
    const tick = () => {
      const next = Date.now();
      setNow(next);
      if (isLaunchUnlocked(next, config)) onUnlock?.();
    };
    tick();
    const id = window.setInterval(tick, reduced ? 1000 : 250);
    return () => window.clearInterval(id);
  }, [config, onUnlock, reduced]);

  const checking = mode === "bootstrap";

  return (
    <main
      className={`launch-gate${checking ? " is-checking" : ""}${reduced ? " is-reduced" : ""}`}
      aria-busy={checking || undefined}
      aria-label="Lançamento FC 27"
    >
      <div className="launch-ambient" aria-hidden="true" />
      <div className="launch-stripes" aria-hidden="true" />
      <div className="launch-sweep" aria-hidden="true" />
      <div className="launch-beam launch-beam-left" aria-hidden="true" />
      <div className="launch-beam launch-beam-right" aria-hidden="true" />
      <div className="launch-grain" aria-hidden="true" />
      <div className="launch-vignette" aria-hidden="true" />
      <p className="launch-wordmark" aria-hidden="true">STRIX</p>
      <div className="launch-frame" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <section className="launch-panel">
        <span className="launch-kicker">STRIX UNITED</span>
        <ClubLogo
          name="Strix United"
          url={STRIX_BRAND.logo}
          className="launch-crest"
          kind="logo"
          priority
          sizes="(max-width:430px) 108px, (max-width:900px) 128px, 148px"
          decorative
        />
        <h1>FC 27</h1>
        <p className="launch-line">
          <i />
          <span>{checking ? "Preparando o vestiário." : "O próximo capítulo começa em"}</span>
          <i />
        </p>
        <div className="launch-counter" aria-hidden="true">
          <LaunchUnit value={parts.days} label="DIAS" reduced={reduced} />
          <em>:</em>
          <LaunchUnit value={parts.hours} label="HORAS" reduced={reduced} />
          <em>:</em>
          <LaunchUnit value={parts.minutes} label="MIN" reduced={reduced} />
          <em>:</em>
          <LaunchUnit value={parts.seconds} label="SEG" reduced={reduced} />
        </div>
        <time className="launch-sr-time" dateTime={config.launchAt}>
          Lançamento FC 27 em {config.launchAt}
        </time>
      </section>
      {showInternal && (
        <button
          type="button"
          className="launch-internal"
          disabled={signingIn}
          onClick={async () => {
            rememberLaunchReturn(`${window.location.pathname}${window.location.search}${window.location.hash}`);
            setSigningIn(true);
            setSignInError("");
            try {
              await onInternalAccess();
            } catch (cause) {
              setSignInError(cause.message || "Não foi possível iniciar o acesso interno.");
              setSigningIn(false);
            }
          }}
        >
          {signingIn ? "Abrindo acesso…" : "Acesso interno"}
        </button>
      )}
      {showInternal && signInError && <small className="launch-internal-error">{signInError}</small>}
    </main>
  );
}
