import { useEffect, useRef, useState } from "react";

const REFRESH_MS = 60_000;

/**
 * The Library rows the shell needs (Central, search, notices): the materials the member may see
 * and his own progress. Loaded once after sign-in and again when `signal` changes (the shell
 * passes the page it is on), at most once a minute. A table that does not exist yet reads as
 * an empty Library; any other failure is kept in `error` for whoever shows the block.
 */
export function useLibraryGlance(client, profile, signal = "") {
  const [state, setState] = useState({ items: [], progress: [], loaded: false, error: "" });
  const lastLoad = useRef(0);
  const mounted = useRef(true);
  const userId = profile?.user_id || "";
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!client || !userId) return;
    if (Date.now() - lastLoad.current < REFRESH_MS) return;
    lastLoad.current = Date.now();
    Promise.all([
      client.from("library_items").select("*").order("published_at", { ascending: false }),
      client.from("library_view_progress").select("*").eq("user_id", userId),
    ]).then(([itemsResult, progressResult]) => {
      if (!mounted.current) return;
      const missing = (result) => ["42P01", "PGRST205"].includes(result.error?.code);
      const failure = [itemsResult, progressResult].find((result) => result.error && !missing(result))?.error;
      setState({
        items: Array.isArray(itemsResult.data) ? itemsResult.data.filter((item) => item.status !== "archived") : [],
        progress: Array.isArray(progressResult.data) ? progressResult.data : [],
        loaded: true,
        error: failure?.message || "",
      });
    }).catch((cause) => {
      if (mounted.current) setState((current) => ({ ...current, loaded: true, error: cause?.message || "Biblioteca indisponível." }));
    });
  }, [client, userId, signal]);
  return state;
}
