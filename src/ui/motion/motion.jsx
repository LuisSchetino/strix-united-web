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
  const icons = { loading: "↻", success: "✓", error: "!", idle: "↻" };
  const current = state || "idle";
  return (
    <span className={`motion-state-badge is-${current}`}>
      <span className="motion-state-content" key={current}><i aria-hidden="true">{icons[current]}</i>{labels[state] || idle}</span>
    </span>
  );
}

export function notify(message, tone = "success") {
  window.dispatchEvent(new CustomEvent("strix-toast", { detail: { message, tone } }));
}

function ToastItem({ toast, depth, dismiss }) {
  const start = useRef(null);
  const [drag, setDrag] = useState(0);
  const pointerUp = (event) => {
    if (start.current === null) return;
    const shouldDismiss = Math.abs(drag) > 72;
    start.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (shouldDismiss) dismiss(toast.id);
    else setDrag(0);
  };
  return <button type="button" className={`motion-toast is-${toast.tone || "success"}${toast.leaving ? " is-leaving" : ""}`}
    style={{ "--toast-depth": depth, "--toast-stack-y": `${depth * 8}px`, "--toast-fan-y": `${depth * -72}px`, "--toast-scale": 1 - depth * .025, "--toast-drag": `${drag}px`, zIndex: 10 - depth }}
    onPointerDown={(event) => { start.current = event.clientX; event.currentTarget.setPointerCapture?.(event.pointerId); }}
    onPointerMove={(event) => { if (start.current !== null) setDrag(event.clientX - start.current); }}
    onPointerUp={pointerUp} onPointerCancel={() => { start.current = null; setDrag(0); }} onClick={() => Math.abs(drag) < 5 && dismiss(toast.id)}>
    <span aria-hidden="true">{toast.tone === "error" ? "!" : toast.tone === "warning" ? "i" : "✓"}</span>
    <div><small>{toast.tone === "error" ? "ALGO DEU ERRADO" : toast.tone === "warning" ? "ATENÇÃO" : "TUDO CERTO"}</small><b>{toast.message}</b></div>
    <em aria-hidden="true">×</em><i aria-hidden="true" />
  </button>;
}

export function ToastViewport() {
  const [toasts, setToasts] = useState([]);
  const dismiss = (id) => {
    setToasts((current) => current.map((toast) => toast.id === id ? { ...toast, leaving: true } : toast));
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 180);
  };
  useEffect(() => {
    const receive = (event) => {
      const id = `${Date.now()}-${Math.random()}`;
      const item = { id, ...event.detail };
      setToasts((current) => [...current.slice(-2), item]);
      window.setTimeout(() => dismiss(id), 3600);
    };
    window.addEventListener("strix-toast", receive);
    return () => window.removeEventListener("strix-toast", receive);
  }, []);
  return (
    <div className="motion-toast-viewport" aria-live="polite" aria-atomic="false">
      {[...toasts].reverse().map((toast, depth) => <ToastItem toast={toast} depth={depth} dismiss={dismiss} key={toast.id}/>)}
    </div>
  );
}

export function useSwipeActions(max = 132) {
  const start = useRef(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const handlers = useMemo(() => ({
    onPointerDown: (event) => {
      if (!max) return;
      start.current = { x: event.clientX, y: event.clientY, offset, axis: null };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!start.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      if (!start.current.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
        start.current.axis = Math.abs(dx) > Math.abs(dy) * 1.18 ? "x" : "y";
      }
      if (start.current.axis !== "x") return;
      setDragging(true);
      const raw = start.current.offset + dx;
      const resisted = raw < -max
        ? -max - Math.min(14, (-max - raw) * 0.12)
        : Math.min(0, raw);
      setOffset(resisted);
    },
    onPointerUp: () => {
      setOffset((current) => (current < -max * 0.36 ? -max : 0));
      start.current = null;
      setDragging(false);
    },
    onPointerCancel: () => {
      setOffset(start.current?.offset || 0);
      start.current = null;
      setDragging(false);
    },
  }), [max, offset]);
  return { offset, dragging, close: () => setOffset(0), handlers };
}

export function useSheetDismiss(onDismiss) {
  const start = useRef(null);
  const measure = (event) => {
    if (!start.current) return false;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    return dy > 84 && Math.abs(dy) > Math.abs(dx) * 1.25;
  };
  return {
    onPointerDown: (event) => {
      start.current = { x: event.clientX, y: event.clientY };
      (event.target.setPointerCapture || event.currentTarget.setPointerCapture)?.call(event.target, event.pointerId);
    },
    onPointerMove: (event) => {
      if (!measure(event)) return;
      start.current = null;
      onDismiss();
    },
    onPointerUp: (event) => {
      if (!start.current) return;
      if (measure(event)) onDismiss();
      start.current = null;
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
