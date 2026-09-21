import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { withMediaLook } from "./features/media/media-look.js";
import { buildAgendaTimeline } from "./features/media/agenda-timeline.js";
import { renderAgendaFrame } from "./features/media/agenda-frame.js";
import { loadAgendaAssets, loadAnnounceAssets, loadRelatedNightAssets, loadSummaryAssets } from "./features/media/media-assets.js";
import { buildRelatedNightTimeline } from "./features/media/related-night-timeline.js";
import { renderRelatedNightFrame } from "./features/media/related-night-frame.js";
import { buildAnnounceTimeline } from "./features/media/announce-timeline.js";
import { renderAnnounceFrame } from "./features/media/announce-frame.js";
import { collectPeriodSummary } from "./features/media/summary-core.js";
import { buildSummaryTimeline } from "./features/media/summary-timeline.js";
import { renderSummaryFrame } from "./features/media/summary-frame.js";
import { preloadCutoutText, CUTOUT_TEMPLATE_SEEDS } from "./features/media/cutout-text.js";

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
    { id: "d2", played_at: "2026-09-20T22:10:00-03:00", opponent_name: "Maquina FC", strix_score: 3, opponent_score: 0, competition_name: "Copa Yeshua" },
    { id: "d3", played_at: "2026-09-20T23:10:00-03:00", opponent_name: "CTX Gamingg", strix_score: 1, opponent_score: 1, competition_name: "Yeshua League" },
  ],
};

function paint(renderFrame, timeline, assets, time, label) {
  const canvas = document.createElement("canvas");
  canvas.width = timeline.width;
  canvas.height = timeline.height;
  canvas.dataset.qa = label;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  renderFrame(ctx, { timeline, timeSec: time, assets, dayLabel });
  return canvas;
}

function pair(left, right, dest) {
  const canvas = document.createElement("canvas");
  canvas.width = left.width + right.width;
  canvas.height = left.height;
  canvas.dataset.qa = dest;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(left, 0, 0);
  ctx.drawImage(right, left.width, 0);
  ctx.fillStyle = "#efece6";
  ctx.fillRect(24, 24, 220, 44);
  ctx.fillRect(left.width + 24, 24, 220, 44);
  ctx.fillStyle = "#050607";
  ctx.font = "800 22px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("V1 CAMPANHA", 36, 54);
  ctx.fillText("V2 COLLAGE", left.width + 36, 54);
  return canvas;
}

async function blobOf(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function App() {
  const [status, setStatus] = useState("Renderizando V1 × V2…");
  const [frames, setFrames] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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

      const agendaV1 = withMediaLook(buildAgendaTimeline(matches, { format: "story" }), "campaign");
      const agendaV2 = withMediaLook(buildAgendaTimeline(matches, { format: "story" }), "collage");
      const relatedV1 = withMediaLook(buildRelatedNightTimeline(related, { format: "story" }), "campaign");
      const relatedV2 = withMediaLook({ ...buildRelatedNightTimeline(related, { format: "story" }), still: true }, "collage");
      const announceV1 = withMediaLook(buildAnnounceTimeline({
        kind: "individual",
        format: "story",
        people: [nunes],
        phrase: "Mais uma peça confirmada para o FC 27.",
      }), "campaign");
      const announceV2 = withMediaLook(buildAnnounceTimeline({
        kind: "individual",
        format: "story",
        people: [nunes],
        phrase: "Mais uma peça confirmada para o FC 27.",
      }), "collage");
      const summary = collectPeriodSummary(summaryWorkspace, { mode: "day", now: new Date("2026-09-20T18:00:00-03:00") });
      const summaryV1 = withMediaLook(buildSummaryTimeline(summary, { format: "story" }), "campaign");
      const summaryV2 = withMediaLook(buildSummaryTimeline(summary, { format: "story" }), "collage");

      const v1Agenda = paint(renderAgendaFrame, agendaV1, agendaAssets, 1.35, "v1-agenda");
      const v2Agenda = paint(renderAgendaFrame, agendaV2, agendaAssets, 1.35, "v2-agenda");
      const v2AgendaFinale = paint(renderAgendaFrame, agendaV2, agendaAssets, agendaV2.finaleStart + 0.7, "v2-agenda-finale");
      const v1Related = paint(renderRelatedNightFrame, relatedV1, relatedAssets, 0.85, "v1-related");
      const v2Related = paint(renderRelatedNightFrame, relatedV2, relatedAssets, 0.85, "v2-related");
      const relatedHeroTime = relatedV2.scenes.find((scene) => scene.type === "player")?.start + 0.45;
      const v2RelatedHero = paint(renderRelatedNightFrame, { ...relatedV2, still: false }, relatedAssets, relatedHeroTime, "v2-related-hero");
      const v1Announce = paint(renderAnnounceFrame, announceV1, announceAssets, 2.6, "v1-announce");
      const v2Announce = paint(renderAnnounceFrame, announceV2, announceAssets, 2.6, "v2-announce");
      const v1Summary = paint(renderSummaryFrame, summaryV1, summaryAssets, 1.35, "v1-summary");
      const v2Summary = paint(renderSummaryFrame, summaryV2, summaryAssets, 1.35, "v2-summary");

      const items = [
        { id: "v1-agenda", canvas: v1Agenda },
        { id: "v2-agenda", canvas: v2Agenda },
        { id: "v2-agenda-finale", canvas: v2AgendaFinale },
        { id: "v1-related", canvas: v1Related },
        { id: "v2-related", canvas: v2Related },
        { id: "v2-related-hero", canvas: v2RelatedHero },
        { id: "v1-announce", canvas: v1Announce },
        { id: "v2-announce", canvas: v2Announce },
        { id: "v1-summary", canvas: v1Summary },
        { id: "v2-summary", canvas: v2Summary },
        { id: "v1-v2-agenda", canvas: pair(v1Agenda, v2Agenda, "v1-v2-agenda") },
        { id: "v1-v2-related", canvas: pair(v1Related, v2Related, "v1-v2-related") },
        { id: "v1-v2-announce", canvas: pair(v1Announce, v2Announce, "v1-v2-announce") },
        { id: "v1-v2-summary", canvas: pair(v1Summary, v2Summary, "v1-v2-summary") },
      ];
      const blobs = {};
      for (const item of items) {
        blobs[item.id] = await blobOf(item.canvas);
      }
      window.__STRIX_V1V2_QA__ = {
        ready: true,
        blobs,
        names: items.map((item) => item.id),
      };
      setFrames(items);
      setStatus("V2 reaplicada sobre V1 · pronto para revisão");
    })().catch((error) => {
      setStatus(String(error?.message || error));
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <main style={{ background: "#050607", color: "#efece6", minHeight: "100vh", padding: 24, fontFamily: "Inter, sans-serif" }}>
      <p id="qa-status" data-ready={frames.length ? "1" : "0"}>{status}</p>
      <div style={{ display: "grid", gap: 28 }}>
        {frames.map((item) => (
          <figure key={item.id} style={{ margin: 0 }}>
            <figcaption style={{ marginBottom: 8, letterSpacing: ".16em", fontSize: 12, fontWeight: 800 }}>{item.id}</figcaption>
            <img data-qa={item.id} src={item.canvas.toDataURL("image/png")} alt={item.id} style={{ width: "min(100%, 720px)", background: "#050607" }} />
          </figure>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
