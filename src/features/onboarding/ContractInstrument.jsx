import React from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { CONTRACT_COMMITMENT, CONTRACT_SEASON, SIGNATURE_VIEWBOX } from "./contract-core.js";

/**
 * The contract as a document on the club's letterhead: identification, the
 * clauses, the signature and the record. The PDF (contract-pdf.js) draws the
 * same document from the same payload.
 */
export function ContractInstrument({
  identity = {},
  season = CONTRACT_SEASON,
  signedAtLabel = "",
  signature = "",
  documentId = "",
  replayKey = 0,
  children = null,
}) {
  const name = identity.name || "MEMBRO STRIX";
  const handle = identity.handle || "";
  const role = identity.role || "membro do elenco";
  const when = signedAtLabel ? `, em ${signedAtLabel}` : "";
  const signed = Boolean(signature);
  return (
    <article className={`contract-instrument${signed ? " is-signed" : ""}`}>
      <header className="contract-letterhead">
        <ClubLogo name="Strix United" url={STRIX_BRAND.logo} sizes="64px" className="contract-instrument-crest" />
        <div>
          <b>STRIX UNITED</b>
          <span>FC 27 · SÃO PAULO · TEMPORADA {season}</span>
        </div>
        <p>
          <em>Nº FC27-{season}</em>
          <small>{documentId || "Aguardando assinatura"}</small>
        </p>
      </header>
      <div className="contract-title-block">
        <h3>Contrato de vínculo</h3>
        <p>Instrumento particular de vínculo esportivo do elenco Strix United FC27.</p>
      </div>
      <dl className="contract-ledger">
        <div><dt>Vinculado</dt><dd>{name}</dd></div>
        <div><dt>Identificação</dt><dd>{handle || "—"}</dd></div>
        <div><dt>Função</dt><dd>{identity.role || "—"}</dd></div>
        <div><dt>Temporada</dt><dd>{season}</dd></div>
        <div><dt>Assinado em</dt><dd>{signedAtLabel || "—"}</dd></div>
        <div><dt>Documento</dt><dd>{documentId || "—"}</dd></div>
      </dl>
      <section className="contract-clauses">
        <h4>Das partes</h4>
        <p>Strix United FC27, agremiação com sede em São Paulo, representada pela sua direção, e o vinculado identificado acima ajustam este contrato, que se rege pelas cláusulas seguintes.</p>
        <h4>Cláusula 1ª · Do objeto</h4>
        <p>O vinculado integra o elenco do Strix United na temporada {season}, na função {role}, em caráter exclusivo para as atividades do clube nesta temporada.</p>
        <h4>Cláusula 2ª · Do compromisso</h4>
        <p>{CONTRACT_COMMITMENT}</p>
        <h4>Cláusula 3ª · Do aceite</h4>
        <p>A assinatura abaixo registra o aceite no perfil autenticado{when}. Foro de São Paulo.</p>
      </section>
      <div className="contract-instrument-sign">
        <span>Assinatura do vinculado</span>
        {signed ? (
          <svg key={replayKey} viewBox={`0 0 ${SIGNATURE_VIEWBOX.width} ${SIGNATURE_VIEWBOX.height}`} role="img" aria-label="Assinatura do contrato">
            <path d={signature} pathLength="1" />
          </svg>
        ) : children}
        <i aria-hidden="true" />
        <em>{name}</em>
        <small>{handle ? `${handle} · ` : ""}São Paulo · temporada {season}</small>
        {signed && <span key={`seal-${replayKey}`} className="contract-seal" aria-hidden="true"><b>Assinado</b><small>{documentId}</small></span>}
      </div>
      <footer className="contract-foot">
        <span>Documento gerado no STRIX FC27 a partir do aceite registrado no perfil autenticado.</span>
        <span>Página 1 de 1</span>
      </footer>
    </article>
  );
}
