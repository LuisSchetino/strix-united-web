import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { useReducedMotion } from "../../ui/motion/motion.jsx";
import { OPENING_STILL_MS, OPENING_TOTAL_MS } from "./opening-core.js";
import "./season-opening.css";

/**
 * The opening of the season, over whatever comes next (the sign-in, the contract, the Central):
 * two ink halves closed over the screen, the crest coming into focus on the upper one, the
 * season written on the lower one, the now line drawn along the seam; then the halves part
 * along that line and the site is there. About three seconds, once, and it can be skipped
 * (click, Enter, Space or Escape). With reduced motion the composition stands still and leaves.
 */
export function SeasonOpening({ live = false, onDone }) {
  const reduced = useReducedMotion();
  const done = useRef(onDone);
  done.current = onDone;
  const skipRef = useRef(null);
  useEffect(() => {
    const timer = window.setTimeout(() => done.current?.(), reduced ? OPENING_STILL_MS : OPENING_TOTAL_MS);
    const onKey = (event) => {
      if (!["Escape", "Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      done.current?.();
    };
    window.addEventListener("keydown", onKey, true);
    skipRef.current?.focus({ preventScroll: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [reduced]);
  return createPortal(
    <div className={`season-opening${reduced ? " is-still" : ""}`} role="dialog" aria-modal="true" aria-label="Abertura da temporada 2026/27" onClick={() => done.current?.()}>
      <div className="season-opening-half is-top">
        <ClubLogo name="Strix United" url={STRIX_BRAND.logo} className="season-opening-crest" kind="logo" priority decorative sizes="(max-width: 600px) 104px, 136px" />
      </div>
      <div className="season-opening-half is-bottom">
        <h2>Temporada 2026/27</h2>
        <p><span aria-hidden="true" />{live ? "Aberta agora" : "A central do clube está aberta"}</p>
      </div>
      <i className="season-opening-line" aria-hidden="true" />
      <button ref={skipRef} type="button" className="season-opening-skip" onClick={(event) => { event.stopPropagation(); done.current?.(); }}>Pular</button>
    </div>,
    document.body,
  );
}
