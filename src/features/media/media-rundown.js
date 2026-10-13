// The pauta: every piece the Central can make tonight, with what it uses and
// whether it is ready. Readiness is derived from the same collectors the pieces
// render from, so the pauta can never promise a piece the stage cannot build.
import { collectTodayAgenda } from "./agenda-media-core.js";
import { describeTonightRelated } from "./related-night-core.js";
import { collectPeriodSummary } from "./summary-core.js";
import { collectAnnouncePeople } from "./announce-core.js";
import { MEDIA_SECTIONS } from "./media-renderer.js";

const count = (value, one, many) => `${value} ${value === 1 ? one : many}`;

function describeSection(id, workspace, now) {
  if (id === "agenda") {
    const games = collectTodayAgenda(workspace, now).length;
    return games
      ? { state: "ready", meta: count(games, "jogo hoje", "jogos hoje") }
      : { state: "empty", meta: "Nenhum jogo marcado hoje" };
  }
  if (id === "related") {
    const related = describeTonightRelated(workspace, now);
    if (related.saved && related.video.length) return { state: "ready", meta: count(related.video.length, "relacionado", "relacionados") };
    if (related.suggestion.length) return { state: "incomplete", meta: "Lista sugerida, falta salvar" };
    return { state: "empty", meta: "Sem escalação para sugerir" };
  }
  if (id === "summary-day" || id === "summary-week") {
    const mode = id === "summary-week" ? "week" : "day";
    const games = collectPeriodSummary(workspace, { mode, now }).matches.length;
    if (games) return { state: "ready", meta: count(games, "jogo concluído", "jogos concluídos") };
    return { state: "empty", meta: mode === "week" ? "Nenhum resultado na semana" : "Nenhum resultado hoje" };
  }
  const people = collectAnnouncePeople(workspace).length;
  return people
    ? { state: "ready", meta: count(people, "pessoa no elenco", "pessoas no elenco") }
    : { state: "empty", meta: "Elenco ativo vazio" };
}

export const RUNDOWN_STATE_LABEL = Object.freeze({ ready: "Pronta", incomplete: "Falta um passo", empty: "Sem dados" });

export function describeMediaRundown(workspace = {}, now = new Date()) {
  return MEDIA_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    formats: section.formats,
    output: section.output,
    ...describeSection(section.id, workspace, now),
  }));
}
