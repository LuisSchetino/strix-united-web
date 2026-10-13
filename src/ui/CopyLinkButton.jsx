import React from "react";
import { IconLink } from "@tabler/icons-react";
import { copyLink } from "./useDeepTarget.js";
import "./copy-link.css";

/** Copies the address of one item (a match, a player, a competition, a material) to send to someone. */
export function CopyLinkButton({ page, id, params, label = "Copiar link", className = "" }) {
  if (!id) return null;
  return (
    <button type="button" className={`copy-link${className ? ` ${className}` : ""}`} onClick={() => void copyLink(page, id, params)}>
      <IconLink size={15} stroke={1.8} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
