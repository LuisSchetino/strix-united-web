import { useEffect, useRef } from "react";

const stack = [];
let savedOverflow = "";

/** Keyboard and scroll ownership for custom dialog surfaces, including nesting. */
export function useDialog(close) {
  const ref = useRef(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const previous = document.activeElement;
    if (!stack.length) { savedOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    stack.push(element);
    const targets = () => Array.from(element.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(node => node.getClientRects().length);
    (targets()[0] || element).focus({ preventScroll: true });
    const keydown = event => {
      if (stack.at(-1) !== element) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const nodes = targets();
      const first = nodes[0]; const last = nodes.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    element.addEventListener("keydown", keydown);
    return () => {
      element.removeEventListener("keydown", keydown);
      stack.splice(stack.indexOf(element), 1);
      if (!stack.length) document.body.style.overflow = savedOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
