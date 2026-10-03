import React from "react";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { STRIX_BRAND } from "../../brand.js";
import { CONTRACT_COMMITMENT, CONTRACT_SEASON, SIGNATURE_VIEWBOX } from "./contract-core.js";

export function ContractInstrument({
  identity = {},
  season = CONTRACT_SEASON,
  signedAtLabel = "",
  signature = "",
  replayKey = 0,
  children = null,
}) {
  const name = identity.name || "MEMBRO STRIX";
  const handle = identity.handle || "";
  const role = identity.role || "membro do elenco";
  const when = signedAtLabel ? `, em ${signedAtLabel}` : "";
  return (
    <article className="contract-instrument">
      <header className="contract-instrument-brand">
        <ClubLogo name="Strix United" url={STRIX_BRAND.logo} sizes="72px" className="contract-instrument-crest" />
        <div>
          <b>STRIX UNITED</b>
          <span>FC 27 · SÃO PAULO</span>
        </div>
        <em>Nº FC27-{season}</em>
      </header>
      <h3>Contrato de vínculo esportivo</h3>
      <section>
        <h4>Identificação das partes</h4>
        <p><b>Clube.</b> Strix United FC27, agremiação com sede em São Paulo, neste instrumento representada pela sua direção. Registro interno da temporada {season}.</p>
        <p><b>Vinculado.</b> {name}{handle ? `, identificado como ${handle}` : ""}, função {role}.</p>
        <p>As partes acima identificadas ajustam o presente contrato, que se rege pelas cláusulas seguintes.</p>
      </section>
      <section>
        <h4>Do objeto</h4>
        <p><b>Cláusula 1ª.</b> O vinculado integra o elenco do Strix United na temporada {season}, na função {role}, em caráter exclusivo para as atividades do clube nesta temporada.</p>
      </section>
      <section>
        <h4>Do compromisso</h4>
        <p><b>Cláusula 2ª.</b> {CONTRACT_COMMITMENT}</p>
      </section>
      <section>
        <h4>Do aceite</h4>
        <p><b>Cláusula 3ª.</b> A assinatura abaixo registra o aceite no perfil autenticado{when}. Foro de São Paulo.</p>
      </section>
      <div className="contract-instrument-sign">
        <span>ASSINATURA DO VINCULADO</span>
        {signature ? (
          <svg key={replayKey} viewBox={`0 0 ${SIGNATURE_VIEWBOX.width} ${SIGNATURE_VIEWBOX.height}`} role="img" aria-label="Assinatura do contrato">
            <path d={signature} pathLength="1" />
          </svg>
        ) : children}
        <i aria-hidden="true" />
        <em>{name}</em>
        <small>{handle ? `${handle} · ` : ""}São Paulo · temporada {season}</small>
      </div>
    </article>
  );
}
