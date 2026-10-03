import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { useDialog } from "../../ui/useDialog.js";
import { renderContractVideo } from "./contract-export-lazy.js";
import { CONTRACT_SEASON, contractDocumentId } from "./contract-core.js";
import { DocumentDownload } from "./DocumentDownload.jsx";
import { ContractInstrument } from "./ContractInstrument.jsx";
import { downloadBlob } from "../../lib/download-blob.js";
import "./contract.css";
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
  const sheetRef = useRef(null);
  const downloadVideo = async () => {
    if (rendering) return;
    setVideoError("");
    try {
      const blob = video || await (setRendering(true), renderContractVideo(sheetRef.current));
      setVideo(blob);
      const handle = String(identity?.handle || identity?.name || "strix").replace(/[^\w.-]+/g, "-").toLowerCase();
      downloadBlob(blob, `strix-contrato-${handle}.${blob.type?.includes("webm") ? "webm" : "mp4"}`);
    } catch (error) {
      setVideoError(error?.message || "Não foi possível gerar o vídeo da assinatura.");
    } finally {
      setRendering(false);
    }
  };
  if (!contract?.signature?.d) {
    return createPortal(
      <div ref={backdropRef} className="contract-archive-backdrop" onMouseDown={(event) => { if (event.target === backdropRef.current) onClose(); }}>
        <article ref={dialogRef} className="contract-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="contract-archive-title" tabIndex={-1}>
          <header><div><span>STRIX UNITED · FC27</span><h2 id="contract-archive-title">Sem vínculo assinado.</h2></div><CloseButton onClick={onClose} label="Fechar contrato" /></header>
          <p className="contract-archive-missing">{identity?.name || "Este membro"} ainda não assinou o contrato da temporada {CONTRACT_SEASON}.</p>
          <footer><button type="button" className="primary" onClick={onClose}>FECHAR</button></footer>
        </article>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div ref={backdropRef} className="contract-archive-backdrop" onMouseDown={(event) => { if (event.target === backdropRef.current) onClose(); }}>
      <article ref={dialogRef} className="contract-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="contract-archive-title" tabIndex={-1}>
        <header>
          <div><span>ARQUIVO PESSOAL · STRIX UNITED</span><h2 id="contract-archive-title">Seu vínculo FC27.</h2></div>
          <CloseButton onClick={onClose} label="Fechar contrato" />
        </header>
        <div className="contract-archive-document" ref={sheetRef}>
          <ContractInstrument identity={identity} season={contract.season || CONTRACT_SEASON} signedAtLabel={dateLabel(contract.signedAt)} signature={contract.signature.d} documentId={contractDocumentId(contract)} replayKey={replay} />
        </div>
        <footer>
          {videoError && <p className="contract-archive-error" role="alert">{videoError}</p>}
          <button type="button" className="secondary" onClick={() => setReplay((value) => value + 1)}>REVER ANIMAÇÃO</button>
          <DocumentDownload contract={contract} identity={identity} onError={setVideoError} />
          <button type="button" className="primary" disabled={rendering} onClick={() => void downloadVideo()}>{rendering ? "GERANDO…" : "BAIXAR VÍDEO"}</button>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
