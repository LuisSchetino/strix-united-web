// Local QA fixture (not part of the production entry): a contact sheet of every
// generated piece, sampled across its timeline, so the video direction can be
// reviewed side by side. Sample data below is synthetic and labeled as such.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { buildAgendaTimeline } from "./features/media/agenda-timeline.js";
import { agendaFrameTime, renderAgendaFrame } from "./features/media/agenda-frame.js";
import { buildRelatedNightTimeline } from "./features/media/related-night-timeline.js";
import { relatedNightFrameTime, renderRelatedNightFrame } from "./features/media/related-night-frame.js";
import { collectPeriodSummary } from "./features/media/summary-core.js";
import { buildSummaryTimeline } from "./features/media/summary-timeline.js";
import { renderSummaryFrame, summaryFrameTime } from "./features/media/summary-frame.js";
import { buildAnnounceTimeline } from "./features/media/announce-timeline.js";
import { announceFrameTime, renderAnnounceFrame } from "./features/media/announce-frame.js";
import { fillAnnouncePhrase } from "./features/media/announce-core.js";
import { loadAgendaAssets, loadAnnounceAssets, loadRelatedNightAssets, loadSummaryAssets } from "./features/media/media-assets.js";
import { withMediaLook } from "./features/media/media-look.js";

const dayLabel = "02 DE OUT DE 2026";
const agenda = [
  { id: "1", opponent: "Maquina", kickoff: "21:10", scheduled_at: "2026-10-02T21:10:00-03:00", opponent_logo: "", competition: "Amistoso", competition_logo: "", round: "" },
  { id: "2", opponent: "Sinceridade FC", kickoff: "21:40", scheduled_at: "2026-10-02T21:40:00-03:00", opponent_logo: "", competition: "Superliga Yeshua", competition_logo: "", round: "Rodada 9" },
  { id: "3", opponent: "POA City FC", kickoff: "22:10", scheduled_at: "2026-10-02T22:10:00-03:00", opponent_logo: "", competition: "Master League", competition_logo: "", round: "" },
];
const roster = [
  { id: "g1", name: "Ceni", photo: "/brand/strix/portrait-ceni.png?v=3", position: "GOL", group: "GOL", number: 1 },
  { id: "d1", name: "YGO", photo: "/brand/strix/portrait-ygo.png?v=3", position: "ZAG", group: "DEF", number: 4 },
  { id: "d2", name: "Cedraz", photo: "", position: "ZAG", group: "DEF", number: 3 },
  { id: "m1", name: "Nunes", photo: "/brand/strix/portrait-nunes.png?v=3", position: "MC", group: "MEI", number: 8 },
  { id: "m2", name: "Kestol", photo: "", position: "ALA", group: "MEI", number: 7 },
  { id: "a1", name: "Santozz", photo: "/brand/strix/portrait-santozz.png?v=3", position: "ATA", group: "ATA", number: 9 },
];
const raw = (id, iso, strix, opp, name, competition) => ({ id, played_at: `${iso}T21:10:00-03:00`, opponent_name: name, strix_score: strix, opponent_score: opp, competition_name: competition });
const summaryWorkspace = { matches: [raw("w1", "2026-09-29", 2, 0, "Maquina", "Superliga Yeshua"), raw("w2", "2026-09-30", 1, 1, "Summit ES", "Master League"), raw("d1", "2026-10-02", 3, 1, "POA City FC", "Superliga Yeshua"), raw("d2", "2026-10-02", 0, 0, "Genius Esports", "Amistoso"), raw("d3", "2026-10-02", 2, 4, "Sinceridade", "Master League")] };
const now = new Date("2026-10-02T23:30:00-03:00");
const people = [
  { id: "p1", name: "OBEEN", photo: "/brand/strix/portrait-nunes.png?v=3", position: "MC", group: "MEI", extraRole: "diretoria", extraBadge: "DIRETORIA", initials: "OB" },
  { id: "p2", name: "Santozz", photo: "/brand/strix/portrait-santozz.png?v=3", position: "ATA", group: "ATA", extraRole: "jogador", extraBadge: "", initials: "SA" },
  { id: "p3", name: "Cedraz", photo: "", position: "ZAG", group: "DEF", extraRole: "conselho", extraBadge: "CONSELHO", initials: "CE" },
  { id: "p4", name: "YGO", photo: "/brand/strix/portrait-ygo.png?v=3", position: "ZAG", group: "DEF", extraRole: "jogador", extraBadge: "", initials: "YG" },
];

const pieces = [
  { id: "agenda-story", label: "Agenda do dia · Reels", timeline: () => buildAgendaTimeline(agenda, { format: "story" }), assets: () => loadAgendaAssets(agenda), render: renderAgendaFrame, frameTime: agendaFrameTime },
  { id: "agenda-feed", label: "Agenda do dia · Post", timeline: () => buildAgendaTimeline(agenda, { format: "feed" }), assets: () => loadAgendaAssets(agenda), render: renderAgendaFrame, frameTime: agendaFrameTime },
  { id: "related", label: "Relacionados da noite", timeline: () => buildRelatedNightTimeline(roster, { format: "story" }), assets: () => loadRelatedNightAssets(roster), render: renderRelatedNightFrame, frameTime: relatedNightFrameTime },
  { id: "summary-day", label: "Resumo do dia", timeline: () => buildSummaryTimeline(collectPeriodSummary(summaryWorkspace, { mode: "day", now }), { format: "story" }), assets: () => loadSummaryAssets(collectPeriodSummary(summaryWorkspace, { mode: "day", now }).matches), render: renderSummaryFrame, frameTime: summaryFrameTime },
  { id: "summary-week", label: "Resumo da semana", timeline: () => buildSummaryTimeline(collectPeriodSummary(summaryWorkspace, { mode: "week", now }), { format: "story" }), assets: () => loadSummaryAssets(collectPeriodSummary(summaryWorkspace, { mode: "week", now }).matches), render: renderSummaryFrame, frameTime: summaryFrameTime },
  { id: "announce-ind", label: "Anúncio · Individual", timeline: () => buildAnnounceTimeline({ kind: "individual", format: "story", people: [people[0]], phrase: fillAnnouncePhrase("Mais uma peça confirmada para o FC 27.", people[0]), title: "", announceType: "jogador" }), assets: () => loadAnnounceAssets([people[0]]), render: renderAnnounceFrame, frameTime: announceFrameTime },
  { id: "announce-team", label: "Anúncio · Time", timeline: () => buildAnnounceTimeline({ kind: "team", format: "story", people, phrase: "", title: "ELENCO FC 27", announceType: "jogador" }), assets: () => loadAnnounceAssets(people), render: renderAnnounceFrame, frameTime: announceFrameTime },
];

const FRAMES = Number(new URLSearchParams(location.search).get("frames") || 8);
const HEIGHT = Number(new URLSearchParams(location.search).get("h") || 300);
const HEAD = Number(new URLSearchParams(location.search).get("head") || 0);

function Piece({ piece }) {
  const [frames, setFrames] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      const timeline = withMediaLook(piece.timeline(), "editorial");
      const assets = await piece.assets();
      const total = timeline.totalFrames || 1;
      const out = [];
      for (let index = 0; index < FRAMES; index += 1) {
        // `head=2` samples the opening instead (frame 0, then evenly up to 2s): what the file's first frame, its thumbnail, looks like.
        const frame = timeline.still ? 0 : HEAD > 0
          ? Math.min(total - 1, Math.round((index / Math.max(1, FRAMES - 1)) * HEAD * (timeline.fps || 30)))
          : Math.min(total - 1, Math.round(((index + 0.5) / FRAMES) * total));
        const canvas = document.createElement("canvas");
        canvas.width = timeline.width;
        canvas.height = timeline.height;
        const ctx = canvas.getContext("2d");
        const timeSec = piece.frameTime(frame, timeline);
        piece.render(ctx, { timeline, timeSec, assets, dayLabel });
        out.push({ time: timeSec, image: canvas.toDataURL("image/jpeg", 0.82) });
        if (timeline.still) break;
      }
      if (alive) setFrames(out);
    })().catch((cause) => alive && setError(String(cause?.stack || cause)));
    return () => { alive = false; };
  }, [piece]);
  return (
    <section style={{ marginBottom: 28 }} data-piece={piece.id}>
      <h2 style={{ font: "700 14px Inter", margin: "0 0 8px", color: "#f5f5f5" }}>{piece.label}</h2>
      {error && <pre style={{ color: "#e5484d", whiteSpace: "pre-wrap" }}>{error}</pre>}
      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {frames.map((frame, index) => (
          <figure key={index} style={{ margin: 0 }}>
            <img src={frame.image} alt="" style={{ height: HEIGHT, display: "block", borderRadius: 6 }} />
            <figcaption style={{ font: "500 11px Inter", color: "#8e969f", marginTop: 4 }}>{frame.time.toFixed(2)}s</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Sheet() {
  const only = new URLSearchParams(location.search).get("piece");
  return (
    <main style={{ padding: 20, background: "#050607", minHeight: "100vh" }}>
      <p style={{ font: "500 12px Inter", color: "#8e969f", margin: "0 0 16px" }}>QA local · dados de exemplo sintéticos · não faz parte do produto</p>
      {pieces.filter((piece) => !only || piece.id === only).map((piece) => <Piece key={piece.id} piece={piece} />)}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<Sheet />);
