import React, { useMemo, useRef, useState } from "react";
import { useReducedMotion } from "../../ui/motion/motion.jsx";
import { STATIC_MEDIA_V2_CANVAS } from "./static-media-v2-core.js";
import { STATIC_MEDIA_V2_TEMPLATE_REGISTRY } from "./static-media-v2-templates.js";
import { StaticMediaV2Canvas } from "./StaticMediaV2Canvas.jsx";
import { exportStaticMediaV2Png } from "./static-media-v2-export.js";
import "./static-media-v2.css";

const AVAILABLE_TEMPLATES = Object.values(STATIC_MEDIA_V2_TEMPLATE_REGISTRY);

export function StaticMediaV2Studio() {
  const [templateId, setTemplateId] = useState(AVAILABLE_TEMPLATES[0]?.id || "");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState(() => Object.fromEntries(AVAILABLE_TEMPLATES.map((template) => [template.id, template.defaultCopy])));
  const artboardRef = useRef(null);
  const reduced = useReducedMotion();
  const template = STATIC_MEDIA_V2_TEMPLATE_REGISTRY[templateId] || AVAILABLE_TEMPLATES[0];
  const draft = drafts[template.id];
  const fileName = useMemo(() => template.fileName(draft), [template, draft]);
  const Template = template.Component;

  const update = (key, value) => {
    setDrafts((current) => ({
      ...current,
      [template.id]: { ...current[template.id], [key]: template.sanitizeInput(key, value) },
    }));
    setStatus("idle");
    setError("");
  };

  const exportPng = async () => {
    if (!artboardRef.current || status === "exporting") return;
    setStatus("exporting");
    setError("");
    try {
      await exportStaticMediaV2Png(artboardRef.current, fileName, STATIC_MEDIA_V2_CANVAS);
      setStatus("ready");
    } catch (exportError) {
      setError(exportError?.message || "Não foi possível exportar o PNG.");
      setStatus("error");
    }
  };

  return (
    <section className={`static-media-v2${reduced ? " reduce-motion" : ""}`}>
      <header className="static-v2-heading">
        <div><span>ESTÚDIO DE ARTE ESTÁTICA · V2</span><h1>Templates estáticos.</h1><p>Uma base compartilhada para criar peças do Strix. Novos formatos poderão usar o mesmo canvas e exportação.</p></div>
        <b>STORY · {STATIC_MEDIA_V2_CANVAS.width} × {STATIC_MEDIA_V2_CANVAS.height}</b>
      </header>

      <div className="static-v2-template-picker" aria-label="Templates de arte estática">
        <div><span>TEMPLATES</span><small>{AVAILABLE_TEMPLATES.length} disponível</small></div>
        {AVAILABLE_TEMPLATES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === template.id ? "is-active" : ""}
            aria-pressed={item.id === template.id}
            onClick={() => { setTemplateId(item.id); setStatus("idle"); setError(""); }}
          >
            <span>{item.category}</span><b>{item.name}</b><small>{item.description}</small>
          </button>
        ))}
      </div>

      <div className="static-v2-workbench" key={template.id}>
        <aside className="static-v2-controls" aria-label={`Editar conteúdo: ${template.name}`}>
          <div className="static-v2-section-heading"><span>CONTEÚDO</span><small>PRÉ-VISUALIZAÇÃO AO VIVO</small></div>
          {template.fields.map(({ key, label, maxLength, prominent }) => (
            <label key={key} className={prominent ? "is-headline" : ""}>
              <span>{label}</span>
              <input value={draft[key]} maxLength={maxLength} onChange={(event) => update(key, event.target.value)} />
            </label>
          ))}
          <div className="static-v2-export">
            <button type="button" className="primary" disabled={status === "exporting"} onClick={() => void exportPng()}>
              {status === "exporting" ? "PREPARANDO PNG…" : "EXPORTAR PNG"}
            </button>
            <p>{fileName}</p>
            {status === "ready" && <span role="status">PNG {STATIC_MEDIA_V2_CANVAS.width} × {STATIC_MEDIA_V2_CANVAS.height} exportado.</span>}
            {status === "error" && <span role="alert">{error}</span>}
          </div>
        </aside>

        <section className="static-v2-preview" aria-label={`Preview do template ${template.name}`}>
          <div className="static-v2-preview-header"><div><span>PREVIEW</span><b>{template.name} · 9:16</b></div><small>SEM CORTE · ALTA RESOLUÇÃO</small></div>
          <StaticMediaV2Canvas artboardRef={artboardRef} label={`Canvas do template ${template.name}`}>
            <Template copy={draft} />
          </StaticMediaV2Canvas>
        </section>
      </div>
    </section>
  );
}
