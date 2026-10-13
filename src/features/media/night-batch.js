// "Gerar tudo da noite": the pieces of a match night made in one go, one after the other —
// the Agenda do dia in both formats and the Relacionados. Each piece is the same render its own
// section starts; a piece that cannot be made tonight is reported with the reason, never skipped
// in silence.
import { collectTodayAgenda, formatAgendaDay } from "./agenda-media-core.js";
import { describeTonightRelated, squadFaces } from "./related-night-core.js";
import { buildNightAgendaTimeline, buildNightRelatedTimeline, seededPick } from "./night-plan.js";
import { withMediaLook } from "./media-look.js";
import { MEDIA_FORMAT_LABELS } from "./media-renderer.js";

/** What tonight can produce: `[{ id, label, ready, reason }]`. Pure. */
export function nightBatchPlan(workspace = {}, now = new Date()) {
  const matches = collectTodayAgenda(workspace, now);
  const related = describeTonightRelated(workspace, now);
  const noGames = matches.length ? "" : "Sem jogo marcado para hoje.";
  const noList = !related.saved ? "A lista da noite ainda não foi salva." : related.video.length ? "" : "A lista da noite está vazia.";
  return [
    { id: "agenda-story", label: `Agenda do dia · ${MEDIA_FORMAT_LABELS.story}`, ready: !noGames, reason: noGames },
    { id: "agenda-feed", label: `Agenda do dia · ${MEDIA_FORMAT_LABELS.feed}`, ready: !noGames, reason: noGames },
    { id: "related", label: "Relacionados da noite", ready: !noList, reason: noList },
  ];
}

/**
 * Runs the plan. `render` holds the two start functions (media-jobs.js), passed in so this
 * file stays free of the encoder. `onStep(id)` is told which piece is being made. Returns the
 * plan with `status` ("ready" | "error" | "skipped"), the cached `record` and the `error`.
 */
export async function runNightBatch({ workspace, look, render, onStep = () => {}, now = new Date() }) {
  const day = formatAgendaDay(now);
  const matches = collectTodayAgenda(workspace, now);
  const related = describeTonightRelated(workspace, now);
  // The Agenda's face: the one drawn for the day among the squad's players with a photo.
  const face = seededPick(squadFaces(workspace), `${day.iso}:0`);
  const results = [];
  for (const piece of nightBatchPlan(workspace, now)) {
    if (!piece.ready) { results.push({ ...piece, status: "skipped" }); continue; }
    onStep(piece.id);
    const format = piece.id === "agenda-feed" ? "feed" : "story";
    const job = piece.id === "related"
      ? await render.related({ players: related.video, format: "story", day: day.iso, dayLabel: day.label, timeline: withMediaLook(buildNightRelatedTimeline(related.video, { format: "story" }), look) })
      : await render.agenda({ matches, format, day: day.iso, dayLabel: day.label, timeline: withMediaLook(buildNightAgendaTimeline(matches, { format, face }), look) });
    const done = job?.status === "ready" && job.result;
    results.push({ ...piece, status: done ? "ready" : "error", record: done ? job.result : null, error: done ? "" : job?.error || "Não foi possível gerar esta peça." });
  }
  onStep("");
  return results;
}
