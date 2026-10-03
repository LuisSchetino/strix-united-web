import React from "react";

const fmt = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Math.abs(value));

const ARROWS = {
  up: "M7 17 17 7M9 7h8v8",
  down: "M7 7l10 10M17 9v8H9",
  stable: "M5 12h14",
};

/**
 * Trend of a measured value against a real previous sample. Only rendered when
 * the caller has both sides of the comparison; never a guess.
 *   <DataTrend trend="up" delta={0.4} unit="p.p." against="5 anteriores" />
 */
export function DataTrend({ trend = "stable", delta = null, unit = "", against = "" }) {
  const label = trend === "up" ? "Melhora" : trend === "down" ? "Queda" : "Estável";
  const amount = delta == null || delta === 0 ? "" : `${fmt(delta)}${unit ? ` ${unit}` : ""}`;
  return (
    <span className={`data-trend is-${trend}`} title={against ? `${label} vs ${against}` : label}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12"><path d={ARROWS[trend] || ARROWS.stable} /></svg>
      <b>{amount || label.toLocaleUpperCase("pt-BR")}</b>
      {against && <small>vs {against}</small>}
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
