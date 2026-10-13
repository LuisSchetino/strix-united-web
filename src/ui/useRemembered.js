import { useCallback, useState } from "react";

// "Lembrar onde você estava": a tab, a filter or a selection comes back as it was left.
// `session` lasts while the site is open in this tab (tabs and filters); `device` stays on this
// device (the collapsed menu, the competition being followed). A stored value is only used when
// it is still one of the allowed ones, so a removed option never comes back.
const PREFIX = "strix:view:";
const store = (scope) => (scope === "device" ? window.localStorage : window.sessionStorage);

export function readRemembered(key, initial, { scope = "session", allowed } = {}) {
  try {
    const raw = store(scope).getItem(`${PREFIX}${key}`);
    if (raw === null) return initial;
    const value = JSON.parse(raw);
    if (Array.isArray(allowed)) return allowed.includes(value) ? value : initial;
    return typeof value === typeof initial ? value : initial;
  } catch {
    return initial;
  }
}

export function writeRemembered(key, value, { scope = "session" } = {}) {
  try { store(scope).setItem(`${PREFIX}${key}`, JSON.stringify(value)); } catch { /* storage full or blocked: the view just starts fresh next time */ }
}

/** `useState` whose value survives leaving the page. Same signature: `[value, setValue]`. */
export function useRemembered(key, initial, options = {}) {
  const [value, setValue] = useState(() => readRemembered(key, typeof initial === "function" ? initial() : initial, options));
  const set = useCallback((next) => {
    setValue((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      writeRemembered(key, resolved, options);
      return resolved;
    });
  }, [key, options.scope]);
  return [value, set];
}
