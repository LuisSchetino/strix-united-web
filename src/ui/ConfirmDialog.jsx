import React, { useState } from "react";
import { createPortal } from "react-dom";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useDialog } from "./useDialog.js";
import "./confirm-dialog.css";

/**
 * A destructive action asks first, in the product's own dialog: what will be
 * removed, what stays, and two clear answers. Escape and the backdrop cancel.
 */
export function ConfirmDialog({ kicker = "CONFIRMAÇÃO", title, children, confirmLabel = "CONFIRMAR", cancelLabel = "CANCELAR", onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useDialog(() => { if (!busy) onCancel?.(); }, { enabled: true, lockScroll: true });
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm?.();
    } catch (cause) {
      setError(cause?.message || "Não foi possível concluir.");
      setBusy(false);
    }
  };
  return createPortal(
    <div className="confirm-dialog-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel?.()}>
      <section ref={dialogRef} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" tabIndex={-1}>
        <span className="confirm-dialog-mark" aria-hidden="true"><IconAlertTriangle size={20} stroke={1.8} /></span>
        <small>{kicker}</small>
        <h2 id="confirm-dialog-title">{title}</h2>
        {children && <div className="confirm-dialog-body">{children}</div>}
        {error && <p className="confirm-dialog-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="secondary" onClick={onCancel} disabled={busy} autoFocus>{cancelLabel}</button>
          <button type="button" className="confirm-dialog-danger" onClick={() => void confirm()} disabled={busy}>{busy ? "EXCLUINDO…" : confirmLabel}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
