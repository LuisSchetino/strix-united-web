import React, { useState } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import "./error-note.css";

/**
 * The one way a page says something failed: what happened, in the product's voice, and the
 * way out. `onRetry` shows "Tentar de novo" (the button waits while the retry runs);
 * `detail` is the technical line for whoever is asked for help.
 */
export function ErrorNote({ message, detail = "", onRetry, retryLabel = "Tentar de novo", className = "" }) {
  const [busy, setBusy] = useState(false);
  if (!message) return null;
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try { await onRetry(); } catch { /* the page reports the new failure through `message` */ } finally { setBusy(false); }
  };
  return (
    <div className={`error-note${className ? ` ${className}` : ""}`} role="alert">
      <IconAlertTriangle size={18} stroke={1.8} aria-hidden="true" />
      <p>{message}{detail && <small>{detail}</small>}</p>
      {onRetry && <button type="button" onClick={() => void retry()} disabled={busy}>{busy ? "Tentando…" : retryLabel}</button>}
    </div>
  );
}
