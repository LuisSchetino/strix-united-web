import { useMemo, useSyncExternalStore } from "react";
import { deepLinkPath, parseDeepLink, shareUrl } from "../deep-link.js";
import { locationForPage } from "../access.js";
import { notify } from "./motion/motion.jsx";

// The address bar is the store: opening an item writes its address, closing it restores the page's.
const listeners = new Set();
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener) => {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
};
const snapshot = () => `${window.location.pathname}${window.location.search}`;
const current = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

/** Tells every open page that the address changed (the shell calls it after its own navigation). */
export const announceLocation = emit;

/** Puts an item's address in the bar without leaving the page. */
export function openTarget(page, id, params) {
  const next = deepLinkPath(page, id, params);
  if (current() !== next) window.history.replaceState(window.history.state, "", next);
  emit();
}

/** Back to the page's own address once its item is closed. */
export function clearTarget(page) {
  const target = parseDeepLink(window.location);
  if (!target || target.page !== page) return;
  window.history.replaceState(window.history.state, "", locationForPage(page));
  emit();
}

/** The item the address points at on this page: `{ id, params }`, or null. */
export function useDeepTarget(page) {
  const key = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => {
    const target = parseDeepLink(window.location);
    return target && target.page === page ? { id: target.id, params: target.params } : null;
  }, [key, page]);
}

/**
 * Asks the shell to go to a page (and open one of its items) from anywhere in the app:
 * `goTo("agenda", "<match id>")`. The shell owns navigation; this only asks.
 */
export function goTo(page, id, params) {
  window.dispatchEvent(new CustomEvent("strix-navigate", { detail: { page, target: id ? { id, params } : undefined } }));
}

/** Copies an item's address and says so. Falls back to a selectable field where the clipboard is blocked. */
export async function copyLink(page, id, params, label = "Link copiado.") {
  const url = shareUrl(window.location.origin, page, id, params);
  try {
    await navigator.clipboard.writeText(url);
    notify(label);
    return true;
  } catch {
    try {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.append(field);
      field.select();
      const done = document.execCommand("copy");
      field.remove();
      if (done) { notify(label); return true; }
    } catch { /* reported below */ }
    notify("Não foi possível copiar o link neste navegador.", "error");
    return false;
  }
}
