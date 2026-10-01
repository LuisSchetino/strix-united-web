import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { useDialog } from "../../ui/useDialog.js";
import { downloadSignedContractPdf } from "./contract-pdf.js";
import { CONTRACT_COMMITMENT, CONTRACT_SEASON, SIGNATURE_VIEWBOX } from "./contract-core.js";
import { downloadBlob, renderSignatureMp4 } from "./contract-motion.js";
import "./contract-archive.css";

export function ContractArchiveAction({ onClick, compact = false }) {
  return <button type="button" className={compact ? "contract-archive-compact" : "contract-archive-link"} onClick={onClick} aria-label="Abrir contrato assinado FC27" title="Meu contrato FC27">
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3.75h7l4.25 4.3V20a.75.75 0 0 1-.75.75h-10A.75.75 0 0 1 6.75 20V4.5A.75.75 0 0 1 7.5 3.75Z"/><path d="M14 4v4.25h4.1M9 13h6M9 16.5h6"/></svg>
    {!compact && <span>MEU CONTRATO FC27</span>}
  </button>;
}

const dateLabel = (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" }).format(date)
    : "Data não disponível";
};

export function SignedContractArchive({ contract, identity, onClose }) {
  const dialogRef = useDialog(onClose, { enabled: true, lockScroll: true });
  const [replay, setReplay] = useState(0);
  const [video, setVideo] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [videoError, setVideoError] = useState("");
  const backdropRef = useRef(null);
  const downloadVideo = async () => {
    if (rendering) return;
    setVideoError("");
    try {
      const blob = video || await (setRendering(true), renderSignatureMp4({ contract, identity }));
      setVideo(blob);
      const handle = String(identity?.handle || identity?.name || "strix").replace(/[^\w.-]+/g, "-").toLowerCase();
      downloadBlob(blob, `strix-contrato-${handle}.mp4`);
    } catch (error) {
      setVideoError(error?.message || "Não foi possível gerar o vídeo da assinatura.");
    } finally {
      setRendering(false);
    }
  };
  if (!contract?.signature?.d) return null;
  return createPortal(
    <div ref={backdropRef} className="contract-archive-backdrop" onMouseDown={(event) => { if (event.target === backdropRef.current) onClose(); }}>
      <article ref={dialogRef} className="contract-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="contract-archive-title" tabIndex={-1}>
        <header>
          <div><span>ARQUIVO PESSOAL · STRIX UNITED</span><h2 id="contract-archive-title">Seu vínculo FC27.</h2></div>
          <CloseButton onClick={onClose} label="Fechar contrato" />
        </header>
        <div className="contract-archive-document">
          <div className="contract-archive-brand"><b>STRIX UNITED</b><span>FC 27 · TEMPORADA {contract.season || CONTRACT_SEASON}</span></div>
          <h3>Contrato de vínculo</h3>
          <dl>
            <div><dt>NOME</dt><dd>{identity?.name || "Membro Strix"}</dd></div>
            {identity?.handle && <div><dt>IDENTIFICAÇÃO</dt><dd>{identity.handle}</dd></div>}
            <div><dt>FUNÇÃO</dt><dd>{identity?.role || "—"}</dd></div>
            <div><dt>ASSINADO EM</dt><dd>{dateLabel(contract.signedAt)}</dd></div>
          </dl>
          <p className="contract-archive-commitment">{CONTRACT_COMMITMENT}</p>
          <div className="contract-archive-signature">
            <span>ASSINATURA REGISTRADA</span>
            <svg key={replay} viewBox={`0 0 ${SIGNATURE_VIEWBOX.width} ${SIGNATURE_VIEWBOX.height}`} role="img" aria-label="Animação da assinatura do contrato">
              <path d={contract.signature.d} pathLength="1" />
            </svg>
          </div>
          <small>Uma cópia pessoal do compromisso e do traço armazenados no seu perfil.</small>
        </div>
        <footer>
          {videoError && <p className="contract-archive-error" role="alert">{videoError}</p>}
          <button type="button" className="secondary" onClick={() => setReplay((value) => value + 1)}>REVER ANIMAÇÃO</button>
          <button type="button" className="secondary" onClick={() => downloadSignedContractPdf(contract, identity)}>BAIXAR PDF</button>
          <button type="button" className="primary" disabled={rendering} onClick={() => void downloadVideo()}>{rendering ? "GERANDO…" : "BAIXAR VÍDEO"}</button>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
