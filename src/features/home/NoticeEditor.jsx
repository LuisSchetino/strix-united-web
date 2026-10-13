import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "../../ui/useDialog.js";
import "../../ui/confirm-dialog.css";

export const NOTICE_MAX = 280;

/**
 * "Recado da diretoria": one short message pinned on the Central for everyone. Publishing
 * replaces the current one; an empty text cannot be published (use "Retirar" instead).
 */
export function NoticeEditor({ current = "", onSave, onCancel }) {
  const [body, setBody] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useDialog(() => { if (!busy) onCancel?.(); }, { enabled: true, lockScroll: true });
  const text = body.trim();
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !text) return;
    setBusy(true);
    setError("");
    try {
      await onSave(text);
    } catch (cause) {
      setError(cause?.message || "Não foi possível publicar o recado.");
      setBusy(false);
    }
  };
  return createPortal(
    <div className="confirm-dialog-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel?.()}>
      <form ref={dialogRef} className="confirm-dialog notice-editor" role="dialog" aria-modal="true" aria-labelledby="notice-editor-title" tabIndex={-1} onSubmit={submit}>
        <small>CENTRAL · RECADO DA DIRETORIA</small>
        <h2 id="notice-editor-title">{current ? "Editar recado" : "Escrever recado"}</h2>
        <div className="confirm-dialog-body"><p>Aparece no topo da Central de todo mundo e vira aviso no sino. Um recado por vez.</p></div>
        <label className="notice-editor-field">
          <span>Recado</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, NOTICE_MAX))} rows={4} maxLength={NOTICE_MAX} autoFocus placeholder="Ex.: Hoje a concentração é às 20h45 no canal de voz." />
          <em aria-live="polite">{body.length}/{NOTICE_MAX}</em>
        </label>
        {error && <p className="confirm-dialog-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>CANCELAR</button>
          <button type="submit" className="primary" disabled={busy || !text}>{busy ? "PUBLICANDO…" : "PUBLICAR"}</button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
