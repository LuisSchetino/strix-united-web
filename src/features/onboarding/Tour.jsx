import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tourCardPosition, tourSteps } from "./tour-core.js";
import "./tour.css";

const visibleTarget = (selectors = []) => {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth) return rect;
  }
  return null;
};

/**
 * The first-visit walk: four cards, each pointing at the real control it talks about.
 * Arrow keys and Enter move through it, Escape leaves. It never blocks the site for good:
 * "Pular" closes it and it does not come back on this device.
 */
export function Tour({ profile, canSeeAnalysis = false, onDone }) {
  const steps = tourSteps({ firstName: String(profile?.display_name || "").trim().split(/\s+/)[0], canSeeAnalysis });
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [box, setBox] = useState({ width: 340, height: 220 });
  const cardRef = useRef(null);
  const step = steps[index];
  const last = index === steps.length - 1;
  useLayoutEffect(() => {
    const measure = () => {
      setRect(visibleTarget(step.targets));
      const card = cardRef.current;
      if (card) setBox({ width: card.offsetWidth, height: card.offsetHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [index]);
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === "Escape") { event.stopPropagation(); onDone(); }
      if (event.key === "ArrowRight" || event.key === "Enter") { event.preventDefault(); if (last) onDone(); else setIndex((value) => value + 1); }
      if (event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, last]);
  const place = tourCardPosition(rect, { width: window.innerWidth, height: window.innerHeight }, box);
  const pad = 6;
  return createPortal(
    <div className="tour-layer" role="presentation">
      {rect
        ? <i className="tour-spot" aria-hidden="true" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        : <i className="tour-veil" aria-hidden="true" />}
      <section ref={cardRef} className={`tour-card is-${place.placement}`} role="dialog" aria-modal="true" aria-labelledby="tour-title" tabIndex={-1} style={{ left: place.left, top: place.top, width: place.width }} key={step.id}>
        <p className="tour-count">{String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.text}</p>
        <footer>
          <button type="button" className="tour-skip" onClick={onDone}>{last ? "Fechar" : "Pular"}</button>
          <div>
            {index > 0 && <button type="button" className="secondary" onClick={() => setIndex(index - 1)}>Voltar</button>}
            <button type="button" className="primary" onClick={() => (last ? onDone() : setIndex(index + 1))}>{last ? "Começar" : "Próximo"}</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
