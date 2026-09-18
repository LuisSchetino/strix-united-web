import React from "react";
import { SpecialState } from "./special-state/SpecialState.jsx";

export function AccessDenied({ page, onBack, onHome }) {
  return <SpecialState kind="forbidden" page={page} embedded onBack={onBack} onHome={onHome} />;
}
