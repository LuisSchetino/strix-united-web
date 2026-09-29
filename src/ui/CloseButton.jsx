import React from "react";
import "./close-button.css";

export function CloseIcon({ size = 18, strokeWidth = 1.8 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" focusable="false">
    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function CloseButton({ onClick, disabled = false, label = "Fechar", className = "" }) {
  return (
    <button
      type="button"
      className={`close-button ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <CloseIcon />
    </button>
  );
}
