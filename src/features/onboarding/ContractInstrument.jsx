import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CONTRACT_COMMITMENT, CONTRACT_SEASON, SIGNATURE_VIEWBOX } from "./contract-core.js";
import { ENGRAVING, INK, PEN_SVG, SHEET, paperArt } from "./contract-art.js";
import { PEN_LEAD, PEN_TAIL, inkPath, penPose, signatureAt, signatureTimeline } from "./signature-motion.js";
import "./contract.css";

export const CONTRACT_CREST = "/brand/strix/strix-united-fc27-512.webp";

/** The clauses, in order. Shared by the page, the PDF text layer and the video (same sheet). */
export function contractClauses({ season = CONTRACT_SEASON, role = "", signedAtLabel = "" } = {}) {
  const func = role ? `na função ${role}` : "na função definida pela diretoria";
  const when = signedAtLabel ? `, em ${signedAtLabel}` : "";
  return [
    { label: "Preâmbulo", title: "Das partes", text: "De um lado, STRIX UNITED FC27, clube de Pro Clubs com sede em São Paulo, doravante CLUBE, representado por sua diretoria; de outro, o membro qualificado no quadro acima, doravante VINCULADO. As partes celebram o presente instrumento, que se rege pelas cláusulas seguintes." },
    { label: "Cláusula primeira", title: "Do objeto", text: `O VINCULADO passa a integrar o elenco do CLUBE na temporada ${season}, ${func}, representando o Strix United nas partidas, amistosos e campeonatos disputados pelo clube no FC 27.` },
    { label: "Cláusula segunda", title: "Da vigência", text: `Este vínculo vale por toda a temporada ${season}, a contar da data da assinatura, e se encerra com o fim da temporada ou por decisão de qualquer das partes, comunicada à diretoria.` },
    { label: "Cláusula terceira", title: "Dos compromissos do vinculado", text: `${CONTRACT_COMMITMENT} Compromete-se ainda a confirmar presença nas noites de jogo, avisar a diretoria com antecedência sobre ausências e respeitar companheiros, adversários e arbitragem.` },
    { label: "Cláusula quarta", title: "Dos compromissos do clube", text: "O CLUBE se compromete a divulgar a agenda e os relacionados de cada noite, registrar as estatísticas oficiais das partidas e manter o VINCULADO informado pelos canais do clube." },
    { label: "Cláusula quinta", title: "Do nome e da imagem", text: "O VINCULADO autoriza o uso do seu nome, apelido e imagem nas mídias oficiais do clube relativas à temporada, como anúncios, escalações e resumos das partidas." },
    { label: "Cláusula sexta", title: "Do aceite e do foro", text: `A assinatura abaixo, feita no perfil autenticado do VINCULADO${when}, registra o aceite integral deste instrumento. Fica eleito o foro da comarca de São Paulo.` },
  ];
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The stored signature written by the pen: ink appears under the nib stroke by
 * stroke, the pen lifts between strokes and leaves the paper at the end.
 */
function SignatureInk({ d, isStatic, replayKey, onDone }) {
  const pathRef = useRef(null);
  const penRef = useRef(null);
  const areaRef = useRef(null);
  useLayoutEffect(() => {
    const path = pathRef.current;
    const pen = penRef.current;
    const area = areaRef.current;
    if (!path || !area) return undefined;
    if (isStatic || reducedMotion()) {
      path.setAttribute("d", d);
      if (pen) pen.style.opacity = "0";
      onDone?.();
      return undefined;
    }
    const timeline = signatureTimeline(d);
    // The pen writes where it can be seen: a signature below the fold is brought up first.
    const box = area.getBoundingClientRect();
    const hidden = box.top < 0 || box.bottom > window.innerHeight;
    if (hidden) area.scrollIntoView({ behavior: "smooth", block: "center" });
    const started = performance.now() + (hidden ? 650 : 0);
    let frame = 0;
    const place = (time) => {
      const pose = penPose(timeline, time);
      const { width, height } = area.getBoundingClientRect();
      const k = Math.min(width / SIGNATURE_VIEWBOX.width, height / SIGNATURE_VIEWBOX.height);
      const ox = (width - SIGNATURE_VIEWBOX.width * k) / 2;
      const oy = (height - SIGNATURE_VIEWBOX.height * k) / 2;
      const size = pen.offsetWidth || 1;
      const x = ox + pose.x * k - size * 0.05;
      const y = oy + pose.y * k - size * 0.95;
      pen.style.opacity = String(pose.opacity);
      pen.style.setProperty("--lift", pose.lift.toFixed(3));
      pen.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    const tick = (now) => {
      const time = (now - started) / 1000 - PEN_LEAD;
      path.setAttribute("d", inkPath(signatureAt(timeline, Math.min(time, timeline.duration)).ink));
      if (pen) place(time);
      if (time < timeline.duration + PEN_TAIL) frame = requestAnimationFrame(tick);
      else {
        path.setAttribute("d", d);
        if (pen) pen.style.opacity = "0";
        onDone?.();
      }
    };
    path.setAttribute("d", "");
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [d, isStatic, replayKey]);
  return (
    <div ref={areaRef} className="contract-sign-ink" data-layer="signature">
      <svg viewBox={`0 0 ${SIGNATURE_VIEWBOX.width} ${SIGNATURE_VIEWBOX.height}`} role="img" aria-label="Assinatura do contrato">
        <path ref={pathRef} d={isStatic ? d : ""} fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!isStatic && <span ref={penRef} className="contract-pen" data-layer="pen" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PEN_SVG }} />}
    </div>
  );
}

/** The club's stamp: a ring of engraved type around the crest. */
function ContractSeal({ season, documentId, sealed }) {
  const uid = useId().replace(/:/g, "");
  const ring = `STRIX UNITED FC27 · VÍNCULO REGISTRADO · TEMPORADA ${season} · ${documentId || "STX"} · `;
  return (
    <div className={`contract-seal${sealed ? " is-stamped" : ""}`} data-layer="seal" aria-hidden="true">
      <svg data-capture viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <path id={`${uid}-ring`} d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
          <filter id={`${uid}-ink`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.7" result="holes" />
            <feComposite in="SourceGraphic" in2="holes" operator="in" />
          </filter>
        </defs>
        <g filter={`url(#${uid}-ink)`} fill="none" stroke={INK}>
          <circle cx="100" cy="100" r="95" strokeWidth="3.2" />
          <circle cx="100" cy="100" r="89" strokeWidth="1" />
          <circle cx="100" cy="100" r="60" strokeWidth="1.6" />
          <circle cx="100" cy="100" r="56" strokeWidth=".7" />
          <text fill={INK} stroke="none" fontFamily="Arial, Helvetica, sans-serif" fontSize="11.2" fontWeight="700" letterSpacing="1.15" transform="rotate(-96 100 100)">
            <textPath href={`#${uid}-ring`}>{ring.repeat(2).slice(0, 78)}</textPath>
          </text>
        </g>
      </svg>
      <img src={CONTRACT_CREST} alt="" decoding="sync" />
    </div>
  );
}

/** The engraved paper: aged tone, guilloche rosettes behind the crest, the security frame and microtext. */
function PaperArt({ season }) {
  const uid = useId().replace(/:/g, "");
  const { frame, rosettes } = paperArt();
  const micro = `STRIX UNITED FC27 · INSTRUMENTO PARTICULAR DE VÍNCULO · TEMPORADA ${season} · `.repeat(9);
  const { left, right, top, bottom } = frame.box;
  return (
    <svg className="contract-art" data-capture aria-hidden="true" viewBox={`0 0 ${SHEET.width} ${SHEET.height}`} width={SHEET.width} height={SHEET.height} preserveAspectRatio="none">
      <defs>
        <radialGradient id={`${uid}-paper`} cx="50%" cy="40%" r="78%">
          <stop offset="0" stopColor="#fcfaf5" />
          <stop offset="0.68" stopColor="#f5f1e7" />
          <stop offset="1" stopColor="#e8e1d1" />
        </radialGradient>
        <clipPath id={`${uid}-inner`}><rect x={left + 16} y={top + 10} width={right - left - 32} height={bottom - top - 20} /></clipPath>
      </defs>
      <rect width={SHEET.width} height={SHEET.height} fill={`url(#${uid}-paper)`} />
      <g fill="none" stroke={ENGRAVING}>
        <path d={rosettes[0]} strokeOpacity="0.075" strokeWidth="0.7" />
        <path d={rosettes[1]} strokeOpacity="0.06" strokeWidth="0.6" />
        <path d={frame.waves} strokeOpacity="0.3" strokeWidth="0.55" />
        <rect x={left - 9} y={top - 9} width={right - left + 18} height={bottom - top + 18} strokeOpacity="0.55" strokeWidth="1.3" />
        <rect x={left + 9} y={top + 9} width={right - left - 18} height={bottom - top - 18} strokeOpacity="0.38" strokeWidth="0.6" />
        {frame.corners.map((corner, index) => <path key={index} d={corner} fill="#f3eee3" strokeOpacity="0.5" strokeWidth="0.6" />)}
      </g>
      <g clipPath={`url(#${uid}-inner)`} fill={ENGRAVING} fillOpacity="0.5" fontFamily="Arial, Helvetica, sans-serif" fontSize="4.4" fontWeight="700" letterSpacing="0.9">
        <text x={left + 16} y={top + 16}>{micro}</text>
        <text x={left + 16} y={bottom - 12}>{micro}</text>
      </g>
    </svg>
  );
}

/**
 * The contract as a document on the club's letterhead. One sheet for every
 * copy: the page shows it, the PDF and the video rasterise this same sheet
 * (contract-render.jsx), so the three are identical.
 */
export function ContractInstrument({
  identity = {},
  season = CONTRACT_SEASON,
  signedAtLabel = "",
  signature = "",
  documentId = "",
  replayKey = 0,
  isStatic = false,
  children = null,
}) {
  const name = identity.name || "MEMBRO STRIX";
  const handle = identity.handle || "";
  const signed = Boolean(signature);
  const [stage, setStage] = useState(signed ? (isStatic ? "sealed" : "writing") : "blank");
  useEffect(() => { setStage(signed ? (isStatic || reducedMotion() ? "sealed" : "writing") : "blank"); }, [signed, replayKey, isStatic]);
  const clauses = contractClauses({ season, role: identity.role, signedAtLabel });
  return (
    <div className="contract-paper">
      <article className={`contract-instrument is-${stage}${isStatic ? " is-static" : ""}`} lang="pt-BR">
        <PaperArt season={season} />
        <img className="contract-watermark" src={CONTRACT_CREST} alt="" decoding="sync" />
        <header className="contract-letterhead">
          <img className="contract-letterhead-crest" src={CONTRACT_CREST} alt="Escudo Strix United" decoding="sync" />
          <div className="contract-letterhead-name">
            <b>STRIX UNITED</b>
            <span>Pro Clubs · FC 27 · São Paulo</span>
          </div>
          <dl className="contract-letterhead-ref">
            <div><dt>Instrumento</dt><dd>{`Nº FC27-${season}`}</dd></div>
            <div><dt>Registro</dt><dd>{documentId || "Gerado na assinatura"}</dd></div>
          </dl>
        </header>
        <div className="contract-rule" aria-hidden="true"><i /><i /></div>
        <div className="contract-title-block">
          <span>{`Temporada ${season}`}</span>
          <h3>Contrato de vínculo</h3>
          <p>Instrumento particular de vínculo esportivo entre o Strix United FC27 e o membro do elenco qualificado abaixo.</p>
        </div>
        <section className="contract-ledger" aria-label="Quadro de identificação">
          <h4>Quadro de identificação</h4>
          <dl>
            <div><dt>Vinculado</dt><dd>{name}</dd></div>
            <div><dt>Identificação</dt><dd>{handle || "—"}</dd></div>
            <div><dt>Função</dt><dd>{identity.role || "—"}</dd></div>
            <div><dt>Temporada</dt><dd>{season}</dd></div>
            <div><dt>Assinado em</dt><dd>{signedAtLabel || "—"}</dd></div>
            <div><dt>Registro</dt><dd>{documentId || "—"}</dd></div>
          </dl>
        </section>
        <section className="contract-clauses">
          {clauses.map((clause) => (
            <div key={clause.label} className="contract-clause">
              <h4><b>{clause.label}</b><span>{clause.title}.</span></h4>
              <p>{clause.text}</p>
            </div>
          ))}
        </section>
        <p className="contract-place">São Paulo, {signedAtLabel || "na data registrada pela assinatura"}.</p>
        <div className="contract-signatures">
          <div className="contract-instrument-sign">
            <div className="contract-sign-area">
              {signed ? <SignatureInk d={signature} isStatic={isStatic} replayKey={replayKey} onDone={() => setStage("sealed")} /> : children}
            </div>
            <i className="contract-sign-line" aria-hidden="true" />
            <em>{name}</em>
            <small>Vinculado{handle ? ` · ${handle}` : ""}</small>
          </div>
          <div className="contract-club-sign">
            <div className="contract-seal-area">
              {signed ? <ContractSeal season={season} documentId={documentId} sealed={stage === "sealed"} /> : <span className="contract-seal-pending">Selo aplicado na assinatura</span>}
            </div>
            <i className="contract-sign-line" aria-hidden="true" />
            <em>Strix United FC27</em>
            <small>Clube · selo de registro digital</small>
          </div>
        </div>
        <footer className="contract-foot">
          <span>Documento emitido pelo STRIX FC27 a partir do aceite registrado no perfil autenticado do vinculado.</span>
          <span>{documentId ? `Registro ${documentId}` : "Registro gerado na assinatura"} · Página 1 de 1</span>
        </footer>
      </article>
    </div>
  );
}
