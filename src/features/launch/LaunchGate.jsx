import React, { useEffect, useRef, useState } from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { useReducedMotion } from "../../ui/motion/motion.jsx";
import {
  LAUNCH_CONFIG,
  canShowInternalAccess,
  countdownParts,
  displayRemainingMs,
  isLaunchUnlocked,
  isOfficialLaunchHost,
  rememberLaunchReturn,
} from "../../launch.js";
import { ZERO_HOLD_MS } from "./opening-core.js";
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

export function LaunchGate({ mode = "countdown", config = LAUNCH_CONFIG, previouslyVerified = false, onUnlock, onInternalAccess }) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState("");
  // The countdown was running in front of someone and reached zero: it rests there for a
  // moment ("É agora.") and the opening takes over. A gate that mounts already past the hour
  // was never a countdown for anyone: it just lets the site in.
  const [zero, setZero] = useState(false);
  const sawCountdown = useRef(false);
  // The shell passes a new function on every render; the timer below must not restart for that.
  const unlockRef = useRef(onUnlock);
  unlockRef.current = onUnlock;
  const parts = countdownParts(displayRemainingMs(now, config));
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const showInternal = mode === "countdown" && Boolean(onInternalAccess) && canShowInternalAccess(hostname);

  const handleInternalAccess = async () => {
    rememberLaunchReturn(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    setSigningIn(true);
    setSignInError("");
    try {
      await onInternalAccess();
    } catch (cause) {
      setSignInError(cause.message || "Não foi possível iniciar o acesso interno.");
      setSigningIn(false);
    }
  };
  // The keyboard path always runs the latest handler and the latest `signingIn`,
  // without re-subscribing the listener on every render.
  const internalAccessRef = useRef({ run: handleInternalAccess, busy: signingIn });
  internalAccessRef.current = { run: handleInternalAccess, busy: signingIn };

  useEffect(() => {
    if (mode !== "countdown" || !onInternalAccess || !isOfficialLaunchHost(window.location.hostname)) return undefined;
    const handleKeyDown = (event) => {
      if (!(event.ctrlKey && event.shiftKey && event.altKey && String(event.key).toLowerCase() === "d")) return;
      event.preventDefault();
      if (event.repeat || internalAccessRef.current.busy) return;
      void internalAccessRef.current.run();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, onInternalAccess]);

  useEffect(() => {
    if (mode === "bootstrap") return undefined;
    let handover = 0;
    let released = false;
    const tick = () => {
      const next = Date.now();
      setNow(next);
      if (!isLaunchUnlocked(next, config)) {
        if (mode === "countdown") sawCountdown.current = true;
        return;
      }
      if (released) return;
      released = true;
      if (!sawCountdown.current) { unlockRef.current?.(); return; }
      setZero(true);
      handover = window.setTimeout(() => unlockRef.current?.({ live: true }), reduced ? Math.round(ZERO_HOLD_MS / 2) : ZERO_HOLD_MS);
    };
    tick();
    const id = window.setInterval(tick, reduced ? 1000 : 250);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(handover);
    };
  }, [config, mode, reduced]);

  const checking = mode === "bootstrap";

  if (checking) {
    return <main className="launch-bootstrap" role="status" aria-busy="true">
      <ClubLogo name="Strix United" url={STRIX_BRAND.logo} className="launch-bootstrap-crest" kind="logo" priority decorative />
      <span>{previouslyVerified ? "Validando sessão" : "Preparando acesso"}</span>
    </main>;
  }

  return (
    <main
      className={`launch-gate${checking ? " is-checking" : ""}${reduced ? " is-reduced" : ""}${zero ? " is-zero" : ""}`}
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
          <span key={zero ? "zero" : "count"}>{checking ? "Preparando o vestiário." : zero ? "É agora." : "O próximo capítulo começa em"}</span>
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
          onClick={handleInternalAccess}
        >
          {signingIn ? "Abrindo acesso…" : "Acesso interno"}
        </button>
      )}
      {showInternal && signInError && <small className="launch-internal-error">{signInError}</small>}
    </main>
  );
}
