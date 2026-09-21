import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { withMediaLook } from "./features/media/media-look.js";
import { buildAgendaTimeline } from "./features/media/agenda-timeline.js";
import { renderAgendaFrame } from "./features/media/agenda-frame.js";
import { agendaFrameTime } from "./features/media/agenda-frame.js";
import { loadAgendaAssets, loadAnnounceAssets, loadRelatedNightAssets, loadSummaryAssets } from "./features/media/media-assets.js";
import { buildRelatedNightTimeline } from "./features/media/related-night-timeline.js";
import { relatedNightFrameTime, renderRelatedNightFrame } from "./features/media/related-night-frame.js";
import { buildAnnounceTimeline } from "./features/media/announce-timeline.js";
import { announceFrameTime, renderAnnounceFrame } from "./features/media/announce-frame.js";
import { collectPeriodSummary } from "./features/media/summary-core.js";
import { buildSummaryTimeline } from "./features/media/summary-timeline.js";
import { summaryFrameTime, renderSummaryFrame } from "./features/media/summary-frame.js";
import { CUTOUT_TEMPLATE_SEEDS, preloadCutoutText } from "./features/media/cutout-text.js";
import { encodeAgendaMp4 } from "./features/media/encode-mp4.js";

const dayLabel = "20 SET 2026";

const matches = [
  { id: "1", opponent: "Maquina", kickoff: "21:10", scheduled_at: "2026-09-20T21:10:00-03:00", opponent_logo: "", competition: "Amistoso", competition_logo: "", round: "" },
  { id: "2", opponent: "Sinceridade FC", kickoff: "21:40", scheduled_at: "2026-09-20T21:40:00-03:00", opponent_logo: "", competition: "Amistoso", competition_logo: "", round: "" },
  { id: "3", opponent: "POA City", kickoff: "22:10", scheduled_at: "2026-09-20T22:10:00-03:00", opponent_logo: "", competition: "Amistoso", competition_logo: "", round: "" },
];

const related = [
  { id: "g1", name: "Ceni", photo: "/brand/strix/portrait-ceni.png?v=3", position: "GOL", group: "GOL" },
  { id: "d1", name: "YGO", photo: "/brand/strix/portrait-ygo.png?v=3", position: "ZAG", group: "DEF" },
  { id: "m2", name: "Nunes", photo: "/brand/strix/portrait-nunes.png?v=3", position: "MC", group: "MEI" },
  { id: "a1", name: "Santozz", photo: "/brand/strix/portrait-santozz.png?v=3", position: "ATA", group: "ATA" },
];

const nunes = {
  id: "p7",
  name: "Nunes",
  nick: "",
  photo: "/brand/strix/portrait-nunes.png?v=3",
  position: "MC",
  group: "MEI",
  extraRole: "jogador",
  extraBadge: "CAPITÃO",
  shirt_number: 8,
  initials: "NU",
};

const summaryWorkspace = {
  matches: [
    { id: "d1", played_at: "2026-09-20T21:10:00-03:00", opponent_name: "POA City", strix_score: 2, opponent_score: 1, competition_name: "Copa Yeshua" },
    { id: "d2", played_at: "2026-09-20T22:10:00-03:00", opponent_name: "Maquina", strix_score: 3, opponent_score: 0, competition_name: "Copa Yeshua" },
    { id: "d3", played_at: "2026-09-20T23:10:00-03:00", opponent_name: "Sinceridade FC", strix_score: 1, opponent_score: 1, competition_name: "Yeshua League" },
  ],
};

function App() {
  const [status, setStatus] = useState("Preparando encode V2…");
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      const [agendaAssets, relatedAssets, announceAssets, summaryAssets] = await Promise.all([
        loadAgendaAssets(matches),
        loadRelatedNightAssets(related),
        loadAnnounceAssets([nunes]),
        loadSummaryAssets(summaryWorkspace.matches.map((match) => ({
          opponent: match.opponent_name,
          opponent_logo: "",
        }))),
      ]);
      await Promise.all([
        preloadCutoutText("AGENDA DO DIA", { seed: CUTOUT_TEMPLATE_SEEDS.agenda, mode: "chaos" }),
        preloadCutoutText("RELACIONADOS DA NOITE", { seed: CUTOUT_TEMPLATE_SEEDS.related, mode: "chaos" }),
        preloadCutoutText("NUNES", { seed: CUTOUT_TEMPLATE_SEEDS.announce, mode: "chaos" }),
        preloadCutoutText("RESUMO DO DIA", { seed: CUTOUT_TEMPLATE_SEEDS.summary, mode: "chaos" }),
      ]);
      if (cancelled) return;

      const agenda = withMediaLook(buildAgendaTimeline(matches, { format: "story" }), "collage");
      const relatedTl = withMediaLook(buildRelatedNightTimeline(related, { format: "story" }), "collage");
      const announce = withMediaLook(buildAnnounceTimeline({
        kind: "individual",
        format: "story",
        people: [nunes],
        phrase: "Mais uma peça confirmada para o FC 27.",
      }), "collage");
      const summary = collectPeriodSummary(summaryWorkspace, { mode: "day", now: new Date("2026-09-20T18:00:00-03:00") });
      const summaryTl = withMediaLook(buildSummaryTimeline(summary, { format: "story" }), "collage");

      const jobs = [
        { id: "v2-agenda", timeline: agenda, assets: agendaAssets, renderFrame: renderAgendaFrame, frameTime: agendaFrameTime },
        { id: "v2-related", timeline: relatedTl, assets: relatedAssets, renderFrame: renderRelatedNightFrame, frameTime: relatedNightFrameTime },
        { id: "v2-summary", timeline: summaryTl, assets: summaryAssets, renderFrame: renderSummaryFrame, frameTime: summaryFrameTime },
        { id: "v2-announce", timeline: announce, assets: announceAssets, renderFrame: renderAnnounceFrame, frameTime: announceFrameTime },
      ];
      const blobs = {};
      const items = [];
      for (const job of jobs) {
        setStatus(`Encodando ${job.id} · ${job.timeline.totalFrames} frames`);
        const blob = await encodeAgendaMp4({
          timeline: job.timeline,
          assets: job.assets,
          dayLabel,
          renderFrame: job.renderFrame,
          frameTime: job.frameTime,
        });
        blobs[job.id] = blob;
        items.push({ id: job.id, url: URL.createObjectURL(blob), frames: job.timeline.totalFrames });
        setVideos([...items]);
      }
      window.__STRIX_V2_MP4_QA__ = {
        ready: true,
        blobs,
        names: jobs.map((job) => job.id),
        frames: Object.fromEntries(jobs.map((job) => [job.id, job.timeline.totalFrames])),
      };
      setStatus("MP4 V2 prontos");
    })().catch((error) => {
      setStatus(String(error?.message || error));
      window.__STRIX_V2_MP4_QA__ = { ready: false, error: String(error?.message || error) };
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <main style={{ background: "#050607", color: "#efece6", minHeight: "100vh", padding: 24, fontFamily: "Inter, sans-serif" }}>
      <p id="qa-status" data-ready={videos.length === 4 ? "1" : "0"}>{status}</p>
      <div style={{ display: "grid", gap: 28 }}>
        {videos.map((item) => (
          <figure key={item.id} style={{ margin: 0 }}>
            <figcaption style={{ marginBottom: 8, letterSpacing: ".16em", fontSize: 12, fontWeight: 800 }}>{item.id} · {item.frames}f</figcaption>
            <video data-qa={item.id} src={item.url} controls playsInline style={{ width: "min(100%, 420px)", background: "#050607" }} />
          </figure>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
