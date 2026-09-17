import React, { useEffect, useState } from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { useReducedMotion } from "../../ui/motion/motion.jsx";
import {
  LAUNCH_CONFIG,
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
      className={`launch-gate${checking ? " is-checking" : ""}`}
      aria-busy={checking || undefined}
      aria-label="Lançamento FC 27"
    >
      <div className="launch-grain" aria-hidden="true" />
      <div className="launch-stripes" aria-hidden="true" />
      <div className="launch-vignette" aria-hidden="true" />
      <p className="launch-wordmark" aria-hidden="true">STRIX</p>
      <section className="launch-panel">
        <ClubLogo
          name="Strix United"
          url={STRIX_BRAND.logo}
          className="launch-crest"
          kind="logo"
          priority
          size={112}
          sizes="(max-width:580px) 88px, 128px"
          decorative
        />
        <span>STRIX UNITED</span>
        <h1>FC 27</h1>
        <p>{checking ? "Preparando o vestiário." : "O próximo capítulo começa em"}</p>
        <div className="launch-counter" aria-hidden="true">
          <LaunchUnit value={parts.days} label="DIAS" reduced={reduced} />
          <i>:</i>
          <LaunchUnit value={parts.hours} label="HORAS" reduced={reduced} />
          <i>:</i>
          <LaunchUnit value={parts.minutes} label="MIN" reduced={reduced} />
          <i>:</i>
          <LaunchUnit value={parts.seconds} label="SEG" reduced={reduced} />
        </div>
        <time className="launch-sr-time" dateTime={config.launchAt}>
          Lançamento FC 27 em {config.launchAt}
        </time>
      </section>
      {mode === "countdown" && onInternalAccess && (
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
      {signInError && <small className="launch-internal-error">{signInError}</small>}
    </main>
  );
}
