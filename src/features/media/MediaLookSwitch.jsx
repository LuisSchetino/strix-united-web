import React from "react";
import { MEDIA_LOOKS, MEDIA_LOOK_OPTIONS, mediaLookLabel, normalizeMediaLook } from "./media-look.js";

export function MediaLookSwitch({ value, onChange }) {
  const look = normalizeMediaLook(value);
  return (
    <div className="media-look-switch">
      <span>TEMPLATE VISUAL</span>
      <div role="radiogroup" aria-label="Template visual">
        {MEDIA_LOOK_OPTIONS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={look === id}
            className={look === id ? "is-active" : ""}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MediaLookBadge({ value }) {
  const look = normalizeMediaLook(value);
  return (
    <em className={`media-look-badge is-${look}`}>
      {MEDIA_LOOKS[look]?.kicker || mediaLookLabel(look)}
    </em>
  );
}
