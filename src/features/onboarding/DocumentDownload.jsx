import React, { useEffect, useRef, useState } from "react";
import { downloadSignedContractPdf } from "./contract-export-lazy.js";

/** BAIXAR DOCUMENTO → GERANDO… → DOCUMENTO GERADO. Errors go back to the caller. */
export function DocumentDownload({ contract, identity, onError, className = "secondary" }) {
  const [state, setState] = useState("idle");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = async () => {
    if (state === "busy") return;
    setState("busy");
    onError?.("");
    try {
      await downloadSignedContractPdf({ contract, identity });
      setState("done");
      timer.current = window.setTimeout(() => setState("idle"), 2600);
    } catch (cause) {
      setState("idle");
      onError?.(cause?.message === "signed_contract_unavailable" ? "Não há contrato assinado para gerar o documento." : cause?.message || "Não foi possível gerar o documento.");
    }
  };
  return (
    <button type="button" className={`${className} document-download is-${state}`} disabled={state === "busy"} onClick={() => void run()} aria-live="polite">
      {state === "done" && <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15"><path d="m5 12.5 4.2 4.2L19 7" /></svg>}
      {state === "busy" ? "GERANDO…" : state === "done" ? "DOCUMENTO GERADO" : "BAIXAR DOCUMENTO"}
    </button>
  );
}
