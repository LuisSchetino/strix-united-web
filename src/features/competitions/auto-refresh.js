// Competitions keep themselves current while someone who manages them has the site open.
// The hosting plan cannot read a whole edition in one server request (see provider-client.js),
// so the reliable reader is the browser: page by page, the same path ATUALIZAR uses. This file
// decides WHEN to run it: a source that is due, at most one run per source per window, one
// source at a time. Nothing here invents data: a failed run leaves everything as it was and
// says so once.
import { useEffect, useRef } from "react";
import { canManageCompetitions } from "../../access.js";
import { notify } from "../../ui/motion/motion.jsx";
import { dueSources } from "./auto-refresh-core.js";

const CHECK_EVERY_MS = 5 * 60_000;
// The organiser's site and the hosting both slow down a burst of requests: reading three
// competitions back to back made the third fail and wait for the next pass. A breath between
// competitions, and one more try after a longer breath, lets a single pass finish them all.
const BETWEEN_SOURCES_MS = 5_000;
const BEFORE_RETRY_MS = 20_000;
const pause = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });
const FIRST_CHECK_MS = 12_000;

/**
 * Runs the due readings in the background for whoever may manage competitions. `workspace` is
 * the live workspace; the page-by-page reader and the saver load only when a reading starts.
 */
export function useCompetitionAutoRefresh({ client, profile, workspace }) {
  const state = useRef({ running: false, attempted: new Map(), failed: new Set() });
  const latest = useRef(workspace);
  latest.current = workspace;
  const allowed = canManageCompetitions(profile);
  useEffect(() => {
    if (!allowed || !client) return undefined;
    const run = async () => {
      const current = latest.current;
      if (state.current.running || current.loading || document.visibilityState !== "visible" || !navigator.onLine) return;
      const due = dueSources({ sources: current.competitionSources, editions: current.competitionEditions, fixtures: current.competitionFixtures, attempted: state.current.attempted });
      if (!due.length) return;
      state.current.running = true;
      try {
        // Every competition that is due is read in this pass, one after the other.
        let first = true;
        for (const { source, edition } of due) {
          if (!first) await pause(BETWEEN_SOURCES_MS);
          first = false;
          state.current.attempted.set(source.id, Date.now());
          const competition = (current.competitions || []).find((item) => item.id === edition.competition_id);
          const read = async (fresh) => {
            const [{ analyzeCompetition }, { saveCompetitionPreview }] = await Promise.all([import("./competition-analysis.js"), import("./competition-storage.js")]);
            const preview = await analyzeCompetition(client, source.source_url, { fresh });
            await saveCompetitionPreview(client, profile, preview, { editionId: edition.id });
            await latest.current.refresh?.();
            state.current.failed.delete(source.id);
          };
          try {
            try {
              await read(true);
            } catch {
              // The second try keeps the pages that did arrive and asks only for the ones that failed.
              await pause(BEFORE_RETRY_MS);
              await read(false);
            }
          } catch (cause) {
            // Said once per source: the next attempts stay quiet until one works again.
            if (!state.current.failed.has(source.id)) {
              state.current.failed.add(source.id);
              notify(`${competition?.name || "Campeonato"}: a atualização automática falhou (${cause?.message || "sem resposta"}). Os dados seguem como estavam.`, "error");
            }
          }
        }
      } finally {
        state.current.running = false;
      }
    };
    const first = window.setTimeout(run, FIRST_CHECK_MS);
    const every = window.setInterval(run, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [allowed, client, profile?.user_id]);
}
