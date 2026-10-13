// A tab that stays open across a deploy still runs the old build, and the old build asks for
// files that no longer exist (every page and every download loads on demand, under a name that
// changes with each build). The server answers those names with the site's HTML, the browser
// refuses it as code, and the member sees "Failed to fetch dynamically imported module" or the
// 500 screen. Three things keep that from reaching anyone:
//   1. the tab notices a new build on its own (when it comes back into view, and every few
//      minutes) and the next move between pages is a full load of the new one;
//   2. a page or download that fails to load for this reason reloads the tab once, on the
//      address the member was going to;
//   3. the 500 screen's "Tentar novamente" reloads when this was the cause.
// Pure where it can be; the browser is passed in so the rules are testable.

const RELOAD_KEY = "strix:reloaded-for-update";
// Two reloads this close together mean the reload did not fix it: stop and show the error.
const RELOAD_GUARD_MS = 30_000;
const CHECK_EVERY_MS = 5 * 60_000;
const CHECK_SPACING_MS = 45_000;

/** True for the errors a browser raises when a build file it asks for is gone. */
export function isChunkLoadError(error) {
  const message = String(error?.message || error || "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS|ChunkLoadError|is not a valid JavaScript MIME type/i.test(message);
}

/** The build a page of HTML belongs to: the name of its entry script, or "". */
export function entryScriptOf(html) {
  return String(html || "").match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] || "";
}

/** Whether a reload for a new build may happen now; remembers that it did. */
export function mayReloadForUpdate(storage, now = Date.now()) {
  try {
    const last = Number(storage?.getItem(RELOAD_KEY)) || 0;
    if (now - last < RELOAD_GUARD_MS) return false;
    storage?.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    // Without storage there is no way to tell a loop from a first try: do not reload.
    return false;
  }
}

/** Reloads the tab onto the new build, once. False when it just did (the caller shows the error). */
export function reloadForUpdate({ storage = globalThis.sessionStorage, location = globalThis.location, now = Date.now() } = {}) {
  if (!location?.reload || !mayReloadForUpdate(storage, now)) return false;
  location.reload();
  return true;
}

/**
 * Wraps an on-demand import: when the file is gone because the site was updated, the tab
 * reloads and the promise stays pending (the caller keeps showing its loading state until the
 * new page arrives). Any other failure, or a second failure right after a reload, is thrown.
 */
export function freshImport(loader, reload = reloadForUpdate) {
  return () => loader().catch((error) => {
    if (isChunkLoadError(error) && reload()) return new Promise(() => {});
    throw error;
  });
}

let stale = false;
/** True once this tab knows a newer build is live. */
export const isStaleBuild = () => stale;
export const markStaleBuild = () => { stale = true; };

/** Compares the live site's build with the one this tab runs. Returns true when they differ. */
export async function checkForNewDeploy({ current, fetcher = globalThis.fetch } = {}) {
  if (!current || !fetcher) return false;
  try {
    const response = await fetcher("/", { cache: "no-store", headers: { accept: "text/html" } });
    if (!response.ok) return false;
    const live = entryScriptOf(await response.text());
    if (live && live !== current) stale = true;
  } catch {
    // Offline or blocked: nothing is known, nothing changes.
  }
  return stale;
}

/**
 * Starts the watch in the browser: a failed on-demand load marks the build as old, and the live
 * build is compared when the tab comes back into view and every few minutes. No-op in
 * development, where there is no built entry script.
 */
export function watchForNewDeploy() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  window.addEventListener("vite:preloadError", markStaleBuild);
  const current = entryScriptOf([...document.querySelectorAll("script[src]")].map((node) => node.getAttribute("src")).join(" "));
  if (!current) return;
  let lastCheck = Date.now();
  const check = () => {
    if (stale || Date.now() - lastCheck < CHECK_SPACING_MS) return;
    lastCheck = Date.now();
    void checkForNewDeploy({ current });
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  window.setInterval(() => { if (document.visibilityState === "visible") check(); }, CHECK_EVERY_MS);
}
