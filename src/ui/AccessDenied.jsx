import React from "react";
import { deniedPageCopy } from "../access.js";

export function AccessDenied({ page, onBack }) {
  const copy = deniedPageCopy(page);
  return (
    <section className="placeholder page-enter" role="alert">
      <span>ACESSO NEGADO</span>
      <h1>{copy.title}</h1>
      <p>{copy.message}</p>
      {onBack && (
        <button type="button" className="secondary" onClick={onBack}>
          VOLTAR À CENTRAL
        </button>
      )}
    </section>
  );
}
