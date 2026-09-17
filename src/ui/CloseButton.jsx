import React from "react";
import "./close-button.css";

export function CloseButton({ onClick, disabled = false, label = "Fechar" }) {
  return (
    <button
      type="button"
      className="close-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}
