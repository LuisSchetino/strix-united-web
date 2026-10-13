import { useSyncExternalStore } from "react";

// "Instalar como app": the site itself on the home screen, opening full screen. Browsers that
// can install it announce so with `beforeinstallprompt`; the announcement is kept until the
// member asks. iPhone has no such prompt: there the member adds it from the Share sheet.
let deferred = null;
let installed = false;
const listeners = new Set();
const emit = () => { for (const listener of listeners) listener(); };

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export const isStandalone = () => typeof window !== "undefined"
  && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

export const isIos = () => typeof navigator !== "undefined"
  && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** "prompt" when the browser can install now, "ios" when it is done from Share, "" when there is nothing to offer. */
export function installMode() {
  if (installed || isStandalone()) return "";
  if (deferred) return "prompt";
  return isIos() ? "ios" : "";
}

/** Opens the browser's install prompt. Resolves to "accepted", "dismissed", "ios" or "unavailable". */
export async function requestInstall() {
  if (!deferred) return isIos() && !isStandalone() ? "ios" : "unavailable";
  const event = deferred;
  deferred = null;
  emit();
  await event.prompt();
  const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" }));
  return choice?.outcome === "accepted" ? "accepted" : "dismissed";
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The install mode, kept current: "prompt" | "ios" | "". */
export function useInstallMode() {
  return useSyncExternalStore(subscribe, installMode, () => "");
}
