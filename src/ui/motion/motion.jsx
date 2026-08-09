import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./motion.css";

const seenNumbers = new Set();

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function MotionTabs({ items, active, onChange, className = "", label }) {
  const rootRef = useRef(null);
  const reduced = useReducedMotion();
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });
  useLayoutEffect(() => {
    const root = rootRef.current;
    const button = root?.querySelector(`[data-motion-tab="${CSS.escape(String(active))}"]`);
    if (!root || !button) return undefined;
    const measure = () => {
      setIndicator({ left: button.offsetLeft, width: button.offsetWidth, ready: true });
      button.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "nearest" });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [active, reduced, items.length]);
  return (
    <nav ref={rootRef} className={`motion-tabs ${className}`.trim()} aria-label={label} role="tablist">
      <span
        className={`motion-tabs-indicator${indicator.ready ? " is-ready" : ""}`}
        style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        aria-hidden="true"
      />
      {items.map((item) => {
        const [id, text] = Array.isArray(item) ? item : [item.id, item.label];
        return (
          <button
            type="button"
            role="tab"
            data-motion-tab={id}
            className={active === id ? "active" : ""}
            aria-selected={active === id}
            onClick={() => onChange(id)}
            key={id}
          >
            {text}
          </button>
        );
      })}
    </nav>
  );
}

export function AnimatedNumber({ value, id, suffix = "", duration = 650 }) {
  const reduced = useReducedMotion();
  const numeric = Number(value);
  const cacheKey = id || String(value);
  const shouldAnimate = Number.isFinite(numeric) && !reduced && !seenNumbers.has(cacheKey);
  const [display, setDisplay] = useState(shouldAnimate ? 0 : numeric);
  useEffect(() => {
    if (!Number.isFinite(numeric)) return undefined;
    if (reduced || seenNumbers.has(cacheKey)) {
      setDisplay(numeric);
      return undefined;
    }
    seenNumbers.add(cacheKey);
    const started = performance.now();
    let frame = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(numeric * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numeric, cacheKey, duration, reduced]);
  const formatted = Number.isInteger(numeric) ? Math.round(display) : display.toFixed(1);
  return <>{formatted}{suffix}</>;
}

export function RollingLabel({ children }) {
  return (
    <span className="rolling-label">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  );
}

export function MotionBadge({ state, idle = "Atualizar" }) {
  const labels = {
    loading: "Sincronizando…",
    success: "Atualizado ✓",
    error: "Erro",
  };
  return <span className={`motion-state-badge is-${state || "idle"}`}>{labels[state] || idle}</span>;
}

export function notify(message, tone = "success") {
  window.dispatchEvent(new CustomEvent("strix-toast", { detail: { message, tone } }));
}

export function ToastViewport() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const receive = (event) => {
      const id = `${Date.now()}-${Math.random()}`;
      const item = { id, ...event.detail };
      setToasts((current) => [...current.slice(-2), item]);
      window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600);
    };
    window.addEventListener("strix-toast", receive);
    return () => window.removeEventListener("strix-toast", receive);
  }, []);
  return (
    <div className="motion-toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <button
          type="button"
          className={`motion-toast is-${toast.tone || "success"}`}
          onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
          key={toast.id}
        >
          <span aria-hidden="true">{toast.tone === "error" ? "!" : "✓"}</span>
          <b>{toast.message}</b>
          <small>DISPENSAR</small>
        </button>
      ))}
    </div>
  );
}

export function useSwipeActions(max = 132) {
  const start = useRef(null);
  const [offset, setOffset] = useState(0);
  const handlers = useMemo(() => ({
    onPointerDown: (event) => {
      start.current = { x: event.clientX, y: event.clientY, offset };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!start.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      if (Math.abs(dx) < Math.abs(dy) + 7) return;
      setOffset(Math.max(-max, Math.min(0, start.current.offset + dx)));
    },
    onPointerUp: () => {
      setOffset((current) => (current < -max * 0.32 ? -max : 0));
      start.current = null;
    },
    onPointerCancel: () => {
      setOffset(0);
      start.current = null;
    },
  }), [max, offset]);
  return { offset, close: () => setOffset(0), handlers };
}

export function useSheetDismiss(onDismiss) {
  const start = useRef(null);
  return {
    onPointerDown: (event) => {
      start.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerUp: (event) => {
      if (!start.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      if (dy > 84 && Math.abs(dy) > Math.abs(dx) * 1.25) onDismiss();
      start.current = null;
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
