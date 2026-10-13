import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchDay, requiredStatus } from "../../../shared/night-required.js";
import { mirrorToLibrary, readRequired } from "./required-client.js";

const REFRESH_MS = 30_000;
const EMPTY = { day: "", items: [], progress: [], exempt: false, ready: false, loaded: false };

/**
 * "Obrigatório da noite" for the shell: the day's plays, what the member watched and whether
 * the line-ups are still closed to him. Read after sign-in, when the member moves between
 * pages and when he comes back to the tab (at most every half minute); reading it is also what
 * tells the board he opened the site today. If the server does not answer, nothing is locked.
 */
export function useNightRequired(client, profile, signal = "") {
  const [state, setState] = useState(EMPTY);
  const last = useRef(0);
  const alive = useRef(true);
  const userId = profile?.user_id || "";
  const tier = profile?.access_tier || "";
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async (force = false) => {
    if (!client || !userId) return;
    if (!force && Date.now() - last.current < REFRESH_MS) return;
    last.current = Date.now();
    try {
      const payload = await readRequired(client);
      if (alive.current) setState({ day: payload.day || "", items: payload.items || [], progress: payload.progress || [], exempt: Boolean(payload.exempt), ready: payload.ready !== false, loaded: true });
    } catch {
      if (alive.current) setState((current) => ({ ...current, loaded: true }));
    }
  }, [client, userId]);

  useEffect(() => { void load(); }, [load, signal]);
  useEffect(() => {
    const back = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [load]);

  /** A row the server just answered with, put in place without reading everything again. */
  const apply = useCallback((row) => {
    if (!row?.item_id) return;
    setState((current) => ({ ...current, progress: [...current.progress.filter((entry) => entry.item_id !== row.item_id), { item_id: row.item_id, watched_seconds: row.watched_seconds, completed_at: row.completed_at }] }));
  }, []);
  // What was watched here goes to the member's Library progress too: when a play is done, and
  // every twenty seconds watched on the way. Plays seen earlier tonight are caught up on load.
  const mirrored = useRef(new Map());
  useEffect(() => {
    if (!client || !userId) return;
    for (const row of state.progress) {
      const watched = Number(row.watched_seconds) || 0, done = Boolean(row.completed_at);
      const before = mirrored.current.get(row.item_id);
      if (before && before.done === done && watched - before.watched < 20) continue;
      if (!watched && !done) continue;
      mirrored.current.set(row.item_id, { watched, done });
      const duration = Number(state.items.find((item) => item.item_id === row.item_id)?.duration_seconds) || 0;
      mirrorToLibrary(client, userId, row, duration).catch(() => null);
    }
  }, [client, userId, state.progress, state.items]);
  const refresh = useCallback(() => load(true), [load]);
  const status = useMemo(() => requiredStatus({ items: state.items, progress: state.progress, tier }), [state.items, state.progress, tier]);
  /** Is this game's line-up still closed to the member? */
  const locks = useCallback((match) => status.locked && Boolean(state.day) && matchDay(match) === state.day, [status.locked, state.day]);
  return { ...state, status, apply, refresh, locks };
}
