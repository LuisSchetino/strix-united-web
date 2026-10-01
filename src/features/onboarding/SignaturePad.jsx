import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { SIGNATURE_VIEWBOX, isMeaningfulSignature } from "./contract-core.js";

/**
 * Área de assinatura desenhada pelo usuário. Pointer Events cobrem mouse,
 * touch e caneta; os traços são guardados normalizados (viewBox 600×200), então
 * redimensionar a tela nunca deforma nem perde a assinatura.
 */
export const SignaturePad = forwardRef(function SignaturePad({ disabled = false, onChange }, ref) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const activeRef = useRef(null);
  const [count, setCount] = useState(0);
  const [drawing, setDrawing] = useState(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#f5f5f5";
    context.lineWidth = 2.6;
    context.lineCap = "round";
    context.lineJoin = "round";
    const sx = width / SIGNATURE_VIEWBOX.width;
    const sy = height / SIGNATURE_VIEWBOX.height;
    for (const stroke of strokesRef.current) {
      if (!stroke.length) continue;
      context.beginPath();
      context.moveTo(stroke[0][0] * sx, stroke[0][1] * sy);
      if (stroke.length === 1) context.lineTo(stroke[0][0] * sx + 0.1, stroke[0][1] * sy);
      for (let index = 1; index < stroke.length - 1; index += 1) {
        const midX = (stroke[index][0] + stroke[index + 1][0]) / 2;
        const midY = (stroke[index][1] + stroke[index + 1][1]) / 2;
        context.quadraticCurveTo(stroke[index][0] * sx, stroke[index][1] * sy, midX * sx, midY * sy);
      }
      if (stroke.length > 1) context.lineTo(stroke.at(-1)[0] * sx, stroke.at(-1)[1] * sy);
      context.stroke();
    }
  }, []);

  const emit = useCallback(() => {
    const strokes = strokesRef.current;
    setCount(strokes.length);
    onChange?.(strokes.map((stroke) => stroke.map((point) => [...point])), isMeaningfulSignature(strokes));
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    clear() { strokesRef.current = []; paint(); emit(); },
    undo() { strokesRef.current = strokesRef.current.slice(0, -1); paint(); emit(); },
    strokes: () => strokesRef.current.map((stroke) => stroke.map((point) => [...point])),
  }), [emit, paint]);

  useEffect(() => {
    paint();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * SIGNATURE_VIEWBOX.width;
    const y = ((event.clientY - rect.top) / rect.height) * SIGNATURE_VIEWBOX.height;
    return [Math.max(0, Math.min(SIGNATURE_VIEWBOX.width, x)), Math.max(0, Math.min(SIGNATURE_VIEWBOX.height, y))];
  };

  const start = (event) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    try { canvasRef.current.setPointerCapture?.(event.pointerId); } catch { /* sem captura, o traço continua dentro do canvas */ }
    const stroke = [point(event)];
    activeRef.current = { id: event.pointerId, stroke };
    strokesRef.current = [...strokesRef.current, stroke];
    setDrawing(true);
    paint();
  };
  const move = (event) => {
    const active = activeRef.current;
    if (!active || active.id !== event.pointerId) return;
    event.preventDefault();
    const coalesced = event.nativeEvent.getCoalescedEvents?.();
    const events = coalesced?.length ? coalesced : [event.nativeEvent];
    for (const item of events) {
      const rect = canvasRef.current.getBoundingClientRect();
      active.stroke.push([
        Math.max(0, Math.min(SIGNATURE_VIEWBOX.width, ((item.clientX - rect.left) / rect.width) * SIGNATURE_VIEWBOX.width)),
        Math.max(0, Math.min(SIGNATURE_VIEWBOX.height, ((item.clientY - rect.top) / rect.height) * SIGNATURE_VIEWBOX.height)),
      ]);
    }
    paint();
  };
  const end = (event) => {
    const active = activeRef.current;
    if (!active || active.id !== event.pointerId) return;
    activeRef.current = null;
    setDrawing(false);
    emit();
  };

  return (
    <div className={`signature-pad${drawing ? " is-drawing" : ""}${count ? " has-ink" : ""}${disabled ? " is-disabled" : ""}`}>
      <canvas
        ref={canvasRef}
        aria-label="Área de assinatura. Desenhe com o mouse, o dedo ou a caneta."
        role="img"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onContextMenu={(event) => event.preventDefault()}
      />
      <span className="signature-pad-line" aria-hidden="true" />
      <span className="signature-pad-hint" aria-hidden="true">ASSINE AQUI</span>
    </div>
  );
});
