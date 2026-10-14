import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconMessageReport, IconPhotoPlus, IconX } from "@tabler/icons-react";
import { useDialog } from "../../ui/useDialog.js";
import { shrinkImage } from "../../ui/shrink-image.js";
import { notify } from "../../ui/motion/motion.jsx";
import { PROBLEM_BUCKET, PROBLEM_MESSAGE_MAX, buildProblemRow, describeDevice, deviceInfo, problemErrors, problemPicturePath } from "./problem-core.js";
import "./report-problem.css";

/**
 * "Reportar problema": the member says what happened, in their words, and may add a picture.
 * The page, the device and the last errors the site met go along by themselves (listed under
 * "O que vai junto", so nothing is sent unseen).
 */
export function ReportProblem({ client, profile, onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useDialog(() => { if (!busy) onClose(); }, { enabled: true, lockScroll: true });
  const page = typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}`;
  const device = useMemo(() => deviceInfo(), []);
  const errors = useMemo(() => problemErrors.list(), []);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const send = async () => {
    if (busy) return;
    setError("");
    let row;
    try {
      row = buildProblemRow({ message, profile, page, device, errors });
    } catch (cause) {
      setError(cause.message);
      return;
    }
    setBusy(true);
    let pictureLost = false;
    try {
      if (file) {
        const picture = await shrinkImage(file, { max: 1600 });
        const path = problemPicturePath(profile.user_id, picture);
        const { error: uploadError } = await client.storage.from(PROBLEM_BUCKET).upload(path, picture, { contentType: picture.type || "image/jpeg", upsert: false });
        // the report matters more than the picture: it goes without it
        if (uploadError) pictureLost = true;
        else row.screenshot_path = path;
      }
      const { error: insertError } = await client.from("problem_reports").insert(row);
      if (insertError) throw insertError;
      notify(pictureLost ? "Recebido, mas o print não foi junto. Você recebe um aviso quando resolver." : "Recebido. Você recebe um aviso no sininho quando resolver.");
      onClose();
      onSent?.();
    } catch (cause) {
      setError(["42P01", "PGRST205"].includes(cause?.code) ? "O reporte ainda não foi ativado no banco do site." : cause?.message || "Não foi possível enviar agora.");
      setBusy(false);
    }
  };

  const pick = (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    if (!/^image\//.test(chosen.type)) { setError("O print precisa ser uma imagem."); return; }
    setError("");
    setFile(chosen);
  };

  return createPortal(
    <div className="report-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section ref={dialogRef} className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title" tabIndex={-1}>
        <header>
          <span className="report-mark" aria-hidden="true"><IconMessageReport size={20} stroke={1.8} /></span>
          <div>
            <small>REPORTAR PROBLEMA</small>
            <h2 id="report-title">O que aconteceu?</h2>
          </div>
        </header>
        <label className="report-field">
          <span className="sr-only">Descreva o problema</span>
          <textarea
            value={message}
            maxLength={PROBLEM_MESSAGE_MAX}
            rows={5}
            placeholder="Ex.: cliquei em salvar a escalação e nada aconteceu."
            onChange={(event) => setMessage(event.target.value)}
            disabled={busy}
          />
        </label>
        <div className="report-picture">
          {file ? (
            <figure>
              <img src={preview} alt="Print anexado" />
              <figcaption>{file.name || "print"}</figcaption>
              <button type="button" className="report-remove" onClick={() => setFile(null)} disabled={busy} aria-label="Tirar o print"><IconX size={16} stroke={2} /></button>
            </figure>
          ) : (
            <label className="report-attach">
              <IconPhotoPlus size={18} stroke={1.8} aria-hidden="true" />
              <span><b>Anexar print</b><small>Opcional · ajuda a achar o problema</small></span>
              <input type="file" accept="image/*" onChange={pick} disabled={busy} />
            </label>
          )}
        </div>
        <details className="report-context">
          <summary>O que vai junto</summary>
          <dl>
            <div><dt>Página</dt><dd>{page || "—"}</dd></div>
            <div><dt>Aparelho</dt><dd>{describeDevice(device) || "—"}</dd></div>
            <div><dt>Erros recentes</dt><dd>{errors.length ? `${errors.length} registrado${errors.length > 1 ? "s" : ""} nesta visita` : "Nenhum nesta visita"}</dd></div>
          </dl>
        </details>
        {error && <p className="report-error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>CANCELAR</button>
          <button type="button" className="primary" onClick={() => void send()} disabled={busy || message.trim().length < 3}>{busy ? "ENVIANDO…" : "ENVIAR"}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
