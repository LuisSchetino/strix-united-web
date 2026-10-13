import React, { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { SignaturePad } from "./SignaturePad.jsx";
import { ContractInstrument } from "./ContractInstrument.jsx";
import { renderContractVideo } from "./contract-export-lazy.js";
import { isChunkLoadError } from "../../ui/fresh-deploy.js";
import { DocumentDownload } from "./DocumentDownload.jsx";
import { downloadBlob } from "../../lib/download-blob.js";
import {
  CONTRACT_METADATA_KEY,
  hasSignedContract,
  markContractOpen,
  readContract,
  PLAYER_LINK_KEY,
  PLAYER_LINK_NONE,
  resolveOwnPlayer,
  CONTRACT_SEASON,
  buildContractPayload,
  contractDocumentId,
  contractSignedLabel,
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
  useEffect(() => { onShown?.(); }, []);
  const [ready, setReady] = useState(false);
  // Reopened after a reload (the site was updated while the member was here): the contract is
  // already signed, so the screen comes back on its confirmation, with the downloads.
  const [reopened] = useState(() => (hasSignedContract(session?.user) ? readContract(session.user) : null));
  const [phase, setPhase] = useState(reopened ? "done" : "idle");
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(reopened);
  const [video, setVideo] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [videoError, setVideoError] = useState("");
  // The roster has no account column: the member is found by name. When no name of the account
  // is on the roster, the member says who they are here, once, and the site remembers it.
  const [chosen, setChosen] = useState("");
  const roster = useMemo(() => (players || []).filter((player) => player?.is_active !== false && player?.id)
    .sort((left, right) => String(left.display_name).localeCompare(String(right.display_name), "pt-BR")), [players]);
  const known = useMemo(() => resolveOwnPlayer({ session, profile, players }), [session, profile, players]);
  const mustChoose = !known && roster.length > 0;
  const identity = useMemo(() => resolveContractIdentity({ session, profile, players, playerId: mustChoose ? chosen : "" }), [session, profile, players, mustChoose, chosen]);
  const busy = phase === "saving";

  const sign = async () => {
    if (!ready || busy || !client) return;
    if (mustChoose && !chosen) {
      setError("Escolha quem é você no elenco antes de assinar.");
      return;
    }
    // Nunca assina em nome de uma identidade que ainda não foi revalidada.
    if (!session?.user?.id || session.user.id !== profile?.user_id) {
      setError("Sua sessão ainda está sendo validada. Aguarde um instante e tente de novo.");
      return;
    }
    setPhase("saving");
    setError("");
    try {
      const payload = buildContractPayload({ strokes: padRef.current.strokes() });
      const { error: updateError } = await client.auth.updateUser({ data: { [CONTRACT_METADATA_KEY]: payload, ...(mustChoose && chosen ? { [PLAYER_LINK_KEY]: chosen } : {}) } });
      if (updateError) throw updateError;
      markContractOpen(session.user.id);
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
      const blob = video || await renderContractVideo({ contract: signed, identity });
      setVideo(blob);
      const handle = String(identity.handle || identity.name || "strix").replace(/[^\w.-]+/g, "-").toLowerCase();
      downloadBlob(blob, `strix-contrato-${handle}.${blob.type?.includes("webm") ? "webm" : "mp4"}`);
    } catch (cause) {
      setVideoError(isChunkLoadError(cause) ? "O site foi atualizado enquanto você estava aqui. Recarregue a página e baixe de novo." : cause?.message || "Não foi possível gerar o vídeo da assinatura.");
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
        <ContractInstrument
          identity={identity}
          season={CONTRACT_SEASON}
          signedAtLabel={phase === "done" ? contractSignedLabel(signed?.signedAt) : ""}
          signature={phase === "done" ? signed?.signature?.d : ""}
          documentId={phase === "done" ? contractDocumentId(signed) : ""}
        >
          <SignaturePad ref={padRef} disabled={busy} onChange={(_strokes, meaningful) => { setReady(meaningful); if (meaningful) setError(""); }} />
        </ContractInstrument>
        {phase === "done" && <p className="contract-confirmed" role="status"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="m5 12.5 4.2 4.2L19 7" /></svg>Vínculo registrado no seu perfil · {contractDocumentId(signed)}</p>}
        {phase !== "done" && mustChoose && <label className="contract-who">
          <span>Quem é você no elenco?</span>
          <select value={chosen} disabled={busy} onChange={(event) => { setChosen(event.target.value); setError(""); }}>
            <option value="">Escolha o seu nome</option>
            {roster.map((player) => <option key={player.id} value={String(player.id)}>{player.display_name}</option>)}
            <option value={PLAYER_LINK_NONE}>Não estou no elenco (comissão ou diretoria)</option>
          </select>
          <small>Seu nome no Discord não bate com nenhum nome do elenco. Escolha o seu: é assim que o site sabe quando você está escalado.</small>
        </label>}
        {phase !== "done" && <div className="contract-pad-tools">
          <button type="button" onClick={() => padRef.current?.undo()} disabled={busy}>REFAZER</button>
          <button type="button" onClick={() => padRef.current?.clear()} disabled={busy}>LIMPAR</button>
        </div>}
        {error && <p className="contract-error" role="alert">{error}</p>}
        {videoError && <p className="contract-error" role="alert">{videoError}</p>}
        {phase !== "done" ? <footer className="contract-actions">
          <button type="button" className="primary" disabled={!ready || busy || (mustChoose && !chosen)} onClick={() => void sign()}>
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
