import React, { useEffect, useMemo, useRef, useState } from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { SignaturePad } from "./SignaturePad.jsx";
import {
  CONTRACT_COMMITMENT,
  CONTRACT_METADATA_KEY,
  CONTRACT_SEASON,
  SIGNATURE_VIEWBOX,
  buildContractPayload,
  contractDateLabel,
  resolveContractIdentity,
} from "./contract-core.js";
import "./contract.css";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(null);
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
      window.setTimeout(() => onSigned?.(payload), reducedMotion() ? 500 : 1900);
    } catch (cause) {
      setPhase("idle");
      setError(cause?.message === "signature_empty"
        ? "A assinatura ficou grande demais. Limpe e assine novamente."
        : "Não foi possível registrar a assinatura. Tente novamente.");
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
          <div><span>STRIX UNITED</span><b>FC27</b></div>
          <em>TEMPORADA {CONTRACT_SEASON}</em>
        </header>
        <div className="contract-title">
          <small>CONTRATO STRIX UNITED · FC27</small>
          <h1 id="contract-title">Contrato de vínculo</h1>
        </div>
        <dl className="contract-fields">
          <div><dt>NOME</dt><dd>{identity.name}</dd></div>
          {identity.handle && <div><dt>@</dt><dd>{identity.handle}</dd></div>}
          {identity.role && <div><dt>FUNÇÃO</dt><dd>{identity.role}</dd></div>}
          <div><dt>DATA</dt><dd>{today}</dd></div>
        </dl>
        <p className="contract-commitment">{CONTRACT_COMMITMENT}</p>
        <section className="contract-signature" aria-label="Assinatura">
          <header>
            <span>ASSINATURA</span>
            {phase !== "done" && <div>
              <button type="button" onClick={() => padRef.current?.undo()} disabled={busy}>REFAZER</button>
              <button type="button" onClick={() => padRef.current?.clear()} disabled={busy}>LIMPAR</button>
            </div>}
          </header>
          {phase === "done" && signed ? (
            <div className="contract-signed" role="status">
              <svg viewBox={`0 0 ${SIGNATURE_VIEWBOX.width} ${SIGNATURE_VIEWBOX.height}`} aria-label="Assinatura registrada">
                <path d={signed.signature.d} pathLength="1" />
              </svg>
              <p><b>VÍNCULO CONFIRMADO</b><span>Bem-vindo ao Strix · temporada {CONTRACT_SEASON}</span></p>
            </div>
          ) : (
            <SignaturePad ref={padRef} disabled={busy} onChange={(_strokes, meaningful) => { setReady(meaningful); if (meaningful) setError(""); }} />
          )}
        </section>
        {error && <p className="contract-error" role="alert">{error}</p>}
        {phase !== "done" && <footer className="contract-actions">
          <button type="button" className="primary" disabled={!ready || busy} onClick={() => void sign()}>
            {busy ? "REGISTRANDO…" : "ASSINAR E CONTINUAR"}
          </button>
          <button type="button" className="contract-switch" onClick={onSignOut} disabled={busy}>Não é você? Sair</button>
        </footer>}
      </article>
    </main>
  );
}
