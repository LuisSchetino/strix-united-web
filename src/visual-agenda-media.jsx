import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { buildAgendaTimeline } from "./features/media/agenda-timeline.js";
import { paintAgendaFrame } from "./features/media/agenda-paint.js";
import { encodeAgendaMp4 } from "./features/media/encode-mp4.js";
import { loadAgendaAssets } from "./features/media/media-assets.js";

const sample = [
  { id: "1", opponent: "Winner Elevens", kickoff: "22:10", scheduled_at: "2026-09-02T22:10:00-03:00", opponent_logo: "", competition: "Amistoso", competition_logo: "", round: "" },
  { id: "2", opponent: "Genius Esports", kickoff: "22:40", scheduled_at: "2026-09-02T22:40:00-03:00", opponent_logo: "", competition: "Superliga Yeshua", competition_logo: "", round: "Rodada 9" },
  { id: "3", opponent: "CTX Gaming", kickoff: "23:10", scheduled_at: "2026-09-02T23:10:00-03:00", opponent_logo: "", competition: "Master League", competition_logo: "", round: "" },
];

function FrameStrip({ timeline, assets, marks }) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
      {marks.map(({ time, label }) => {
        const canvas = document.createElement("canvas");
        canvas.width = timeline.width;
        canvas.height = timeline.height;
        paintAgendaFrame(canvas.getContext("2d"), { timeline, time, assets, dayLabel: "02 SET 2026" });
        return (
          <figure key={label} style={{ margin: 0, color: "#d8dce0" }}>
            <img src={canvas.toDataURL("image/png")} alt={label} width={180} />
            <figcaption>{label} · {time.toFixed(2)}s</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function App() {
  const [assets, setAssets] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState("Preparando assets…");
  const [error, setError] = useState("");
  const timeline = buildAgendaTimeline(sample, { format: "story" });

  useEffect(() => {
    let url = "";
    loadAgendaAssets(sample)
      .then(async (loaded) => {
        setAssets(loaded);
        setStatus("Renderizando MP4 de QA…");
        const blob = await encodeAgendaMp4({
          timeline,
          assets: loaded,
          dayLabel: "02 SET 2026",
          onProgress: (progress) => {
            if (progress.stage === "rendering") {
              setStatus(`Renderizando ${progress.frame}/${progress.totalFrames}`);
            } else {
              setStatus(progress.stage);
            }
          },
        });
        url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setStatus(`MP4 pronto · ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      })
      .catch((item) => setError(item.message || String(item)));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, []);

  const marks = assets ? [
    { time: 0.5, label: "0.5s" },
    { time: 1.0, label: "1.0s" },
    { time: 2.0, label: "2.0s" },
    { time: 3.5, label: "3.5s" },
    { time: 5.0, label: "5.0s" },
    { time: 6.5, label: "6.5s" },
    { time: 8.0, label: "8.0s" },
    { time: Math.max(0, timeline.duration - 0.05), label: "último" },
  ] : [];

  return (
    <main style={{ minHeight: "100vh", margin: 0, padding: 24, background: "#050607", color: "#f5f5f5", fontFamily: "Inter, sans-serif" }}>
      <h1>QA · Agenda do Dia</h1>
      <p>{status}</p>
      {error && <p style={{ color: "#ffbdc6" }}>{error}</p>}
      {assets && <FrameStrip timeline={timeline} assets={assets} marks={marks} />}
      {videoUrl && <video src={videoUrl} controls autoPlay muted playsInline style={{ width: 360, marginTop: 24, background: "#000" }} />}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
