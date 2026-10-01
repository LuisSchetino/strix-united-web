import React, { useEffect, useRef, useState } from "react";
import { STATIC_MEDIA_V2_CANVAS } from "./static-media-v2-core.js";
import "./static-media-v2.css";

/** Shared preview canvas: fixed export coordinates, responsive on-screen scale. */
export function StaticMediaV2Canvas({ children, artboardRef, label, size = STATIC_MEDIA_V2_CANVAS }) {
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const update = () => setScale(frame.clientWidth / size.width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [size.width]);

  return (
    <div className="static-v2-preview-stage" ref={frameRef} aria-label={label}>
      <div className="static-v2-scaled" style={{ transform: `scale(${scale})` }}>
        {React.cloneElement(children, { posterRef: artboardRef, size })}
      </div>
    </div>
  );
}
