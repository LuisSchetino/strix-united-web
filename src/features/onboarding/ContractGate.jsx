import React, { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { SignaturePad } from "./SignaturePad.jsx";
import { ContractInstrument } from "./ContractInstrument.jsx";
import { renderContractVideo } from "./contract-export-lazy.js";
import { DocumentDownload } from "./DocumentDownload.jsx";
import { downloadBlob } from "../../lib/download-blob.js";
import {
  CONTRACT_METADATA_KEY,
  CONTRACT_SEASON,
  buildContractPayload,
  contractDocumentId,
  contractDateLabel,
  resolveContractIdentity,
} from "./contract-core.js";
import "./contract.css";

/** Enquanto a sessão revalida, o contrato não aparece: nunca mostramos a identidade errada. */
export function ContractValidating() {
  return (
    <main className="contract-screen is-validating" role="status" aria-live="polite" aria-busy="true">
      <div className="contract-backdrop" aria-hidden="true"><i /><i /><b>FC27</b></div>
      <div className="contract-validating">
        <ClubLogo name="Strix United" url={STRIX_BRAND.logo} priority sizes="96px" className="contract-crest" />
        <span>VALIDANDO SUA IDENTIDADE</span>
        <i aria-hidden="true" />
      </div>
    </main>
  );
}

/**
 * Primeiro login: o jogador assina o vínculo da temporada. A assinatura é
 * persistida em user_metadata (ligada ao usuário autenticado) e só então o app abre.
 */
export function ContractGate({ client, session, profile, players = [], onShown, onSigned, onSignOut }) {
  const padRef = useRef(null);
  const sheetRef = useRef(null);
  useEffect(() => { onShown?.(); }, []);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(null);
  const [video, setVideo] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [videoError, setVideoError] = useState("");
  const identity = useMemo(() => resolveContractIdentity({ session, profile, players }), [session, profile, players]);
  const today = useMemo(() => contractDateLabel(), []);
  const busy = phase === "saving";

  const sign = async () => {
    if (!ready || busy || !client) return;
    // Nunca assina em nome de uma identidade que ainda não foi revalidada.
    if (!session?.user?.id || session.user.id !== profile?.user_id) {
      setError("Sua sessão ainda está sendo validada. Aguarde um instante e tente de novo.");
      return;
    }
    setPhase("saving");
    setError("");
    try {
      const payload = buildContractPayload({ strokes: padRef.current.strokes() });
      const { error: updateError } = await client.auth.updateUser({ data: { [CONTRACT_METADATA_KEY]: payload } });
      if (updateError) throw updateError;
      setSigned(payload);
      setPhase("done");
    } catch (cause) {
      setPhase("idle");
      setError(cause?.message === "signature_empty"
        ? "A assinatura ficou grande demais. Limpe e assine novamente."
        : "Não foi possível registrar a assinatura. Tente novamente.");
    }
  };

  const downloadVideo = async () => {
    if (!signed) return;
    setVideoError("");
    try {
      const blob = video || await renderContractVideo(sheetRef.current);
      setVideo(blob);
      const handle = String(identity.handle || identity.name || "strix").replace(/[^\w.-]+/g, "-").toLowerCase();
      downloadBlob(blob, `strix-contrato-${handle}.${blob.type?.includes("webm") ? "webm" : "mp4"}`);
    } catch (cause) {
      setVideoError(cause?.message || "Não foi possível gerar o vídeo da assinatura.");
    } finally {
      setRendering(false);
    }
  };

  return (
    <main className={`contract-screen${phase === "done" ? " is-signed" : ""}`}>
      <div className="contract-backdrop" aria-hidden="true"><i /><i /><b>FC27</b></div>
      <article className="contract-sheet" aria-labelledby="contract-title">
        <i className="contract-corner is-tl" aria-hidden="true" /><i className="contract-corner is-tr" aria-hidden="true" />
        <i className="contract-corner is-bl" aria-hidden="true" /><i className="contract-corner is-br" aria-hidden="true" />
        <header className="contract-head">
          <ClubLogo name="Strix United" url={STRIX_BRAND.logo} priority sizes="64px" className="contract-crest" />
          <div><span>CONTRATO STRIX UNITED · FC27</span><b>FC27</b></div>
          <em>TEMPORADA {CONTRACT_SEASON}</em>
        </header>
        <h1 id="contract-title" className="visually-hidden">Contrato de vínculo</h1>
        <div ref={sheetRef}>
        <ContractInstrument
          identity={identity}
          season={CONTRACT_SEASON}
          signedAtLabel={phase === "done" ? today : ""}
          signature={phase === "done" ? signed?.signature?.d : ""}
          documentId={phase === "done" ? contractDocumentId(signed) : ""}
        >
          <SignaturePad ref={padRef} disabled={busy} onChange={(_strokes, meaningful) => { setReady(meaningful); if (meaningful) setError(""); }} />
        </ContractInstrument>
        </div>
        {phase === "done" && <p className="contract-confirmed" role="status"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="m5 12.5 4.2 4.2L19 7" /></svg>Vínculo registrado no seu perfil · {contractDocumentId(signed)}</p>}
        {phase !== "done" && <div className="contract-pad-tools">
          <button type="button" onClick={() => padRef.current?.undo()} disabled={busy}>REFAZER</button>
          <button type="button" onClick={() => padRef.current?.clear()} disabled={busy}>LIMPAR</button>
        </div>}
        {error && <p className="contract-error" role="alert">{error}</p>}
        {videoError && <p className="contract-error" role="alert">{videoError}</p>}
        {phase !== "done" ? <footer className="contract-actions">
          <button type="button" className="primary" disabled={!ready || busy} onClick={() => void sign()}>
            {busy ? "REGISTRANDO…" : "ASSINAR E CONTINUAR"}
          </button>
          <button type="button" className="contract-switch" onClick={onSignOut} disabled={busy}>Não é você? Sair</button>
        </footer> : <footer className="contract-actions contract-downloads">
          <DocumentDownload contract={signed} identity={identity} onError={setVideoError} />
          <button type="button" className="secondary" disabled={rendering} onClick={() => { setRendering(true); void downloadVideo(); }}>{rendering ? "GERANDO…" : "BAIXAR VÍDEO"}</button>
          <button type="button" className="primary" onClick={() => onSigned?.(signed)}>CONTINUAR</button>
        </footer>}
      </article>
    </main>
  );
}
