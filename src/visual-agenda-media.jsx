import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { buildAgendaTimeline } from "./features/media/agenda-timeline.js";
import { describeAgendaFrame, renderAgendaFrame, sampleFrameSignature, signatureDistance } from "./features/media/agenda-frame.js";
import { encodeAgendaMp4 } from "./features/media/encode-mp4.js";
import { loadAgendaAssets } from "./features/media/media-assets.js";

const sample = [
  { id: "1", opponent: "Winner Elevens", kickoff: "22:10", scheduled_at: "2026-09-02T22:10:00-03:00", opponent_logo: "", competition: "Amistoso", competition_logo: "", round: "" },
  { id: "2", opponent: "Genius Esports", kickoff: "22:40", scheduled_at: "2026-09-02T22:40:00-03:00", opponent_logo: "", competition: "Superliga Yeshua", competition_logo: "", round: "Rodada 9" },
  { id: "3", opponent: "CTX Gaming", kickoff: "23:10", scheduled_at: "2026-09-02T23:10:00-03:00", opponent_logo: "", competition: "Master League", competition_logo: "", round: "" },
];

const dayLabel = "02 DE SET DE 2026";

function paintSignature(timeline, assets, time) {
  const canvas = document.createElement("canvas");
  canvas.width = timeline.width;
  canvas.height = timeline.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  renderAgendaFrame(ctx, { timeline, timeSec: time, assets, dayLabel });
  return {
    image: canvas.toDataURL("image/png"),
    signature: sampleFrameSignature(ctx, timeline.width, timeline.height),
    scene: describeAgendaFrame(timeline, time),
  };
}

function FrameStrip({ marks }) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
      {marks.map((mark) => (
        <figure key={mark.label} style={{ margin: 0, color: "#d8dce0" }}>
          <img src={mark.image} alt={mark.label} width={180} />
          <figcaption>{mark.label} · {mark.scene.sceneType}</figcaption>
        </figure>
      ))}
    </div>
  );
}

async function sampleVideoPlayback(url, timeline, targets) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await video.play();
  const canvas = document.createElement("canvas");
  canvas.width = timeline.width;
  canvas.height = timeline.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const remaining = [...targets];
  const captured = [];
  await new Promise((resolve) => {
    const tick = () => {
      const time = video.currentTime;
      while (remaining.length && time >= remaining[0].time - 0.02) {
        const mark = remaining.shift();
        ctx.drawImage(video, 0, 0, timeline.width, timeline.height);
        captured.push({
          label: mark.label,
          time: mark.time,
          videoTime: time,
          signature: sampleFrameSignature(ctx, timeline.width, timeline.height),
        });
      }
      if (!remaining.length || video.ended || time >= timeline.duration - 0.05) resolve();
      else if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(tick);
      else requestAnimationFrame(tick);
    };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(tick);
    else requestAnimationFrame(tick);
    setTimeout(resolve, (timeline.duration + 2) * 1000);
  });
  video.pause();
  return captured;
}

function App() {
  const [assets, setAssets] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState("Preparando assets…");
  const [error, setError] = useState("");
  const [qa, setQa] = useState("");
  const [blobInfo, setBlobInfo] = useState(null);
  const timeline = buildAgendaTimeline(sample, { format: "story" });
  const times = [
    { time: 0.5, label: "0.5s" },
    { time: 1.5, label: "1.5s" },
    { time: 2.3, label: "2.3s" },
    { time: 3.5, label: "3.5s" },
    { time: 5.0, label: "5.0s" },
    { time: 6.5, label: "6.5s" },
    { time: 8.0, label: "8.0s" },
    { time: 9.5, label: "9.5s" },
    { time: 11.0, label: "11.0s" },
    { time: 12.5, label: "12.5s" },
    { time: 14.0, label: "14.0s" },
    { time: Math.max(0, timeline.duration - 0.05), label: "último" },
  ];

  useEffect(() => {
    let url = "";
    loadAgendaAssets(sample)
      .then(async (loaded) => {
        setAssets(loaded);
        setStatus("Renderizando MP4 de QA…");
        const blob = await encodeAgendaMp4({
          timeline,
          assets: loaded,
          dayLabel,
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
        setBlobInfo({
          size: blob.size,
          duration: timeline.duration,
          fps: timeline.fps,
          frames: timeline.totalFrames,
        });
        setStatus("Comparando MP4 com o painter…");
        const painted = times.map((mark) => ({ ...mark, ...paintSignature(timeline, loaded, mark.time) }));
        const captured = await sampleVideoPlayback(url, timeline, times);
        const pairs = painted.map((mark) => {
          const video = captured.find((item) => item.label === mark.label);
          const distance = video ? signatureDistance(mark.signature, video.signature) : -1;
          return `${mark.label} ${mark.scene.sceneType} Δ${distance}`;
        });
        const motion = [
          [3.5, 5.0],
          [6.5, 8.0],
          [11.0, 12.5],
          [14.0, timeline.duration - 0.05],
        ].map(([a, b]) => {
          const left = captured.find((item) => Math.abs(item.time - a) < 0.05);
          const right = captured.find((item) => Math.abs(item.time - b) < 0.08);
          return left && right ? signatureDistance(left.signature, right.signature) : 0;
        });
        const frozen = motion.every((value) => value < 8);
        setQa(`${pairs.join(" · ")} · motion ${motion.join("/")} · ${frozen ? "FREEZE" : "MOTION OK"}`);
        setStatus(`MP4 pronto · ${(blob.size / 1024 / 1024).toFixed(2)} MB · ${timeline.duration}s`);
        setAssets((current) => current && { ...current, painted });
      })
      .catch((item) => setError(item.message || String(item)));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, []);

  return (
    <main style={{ minHeight: "100vh", margin: 0, padding: 24, background: "#050607", color: "#f5f5f5", fontFamily: "Inter, sans-serif" }}>
      <h1>QA · Agenda do Dia</h1>
      <p>{status}</p>
      {blobInfo && <p>{blobInfo.duration}s · {blobInfo.fps} fps · {blobInfo.frames} frames · {(blobInfo.size / 1024 / 1024).toFixed(2)} MB</p>}
      {qa && <p style={{ color: qa.includes("FREEZE") ? "#ffbdc6" : "#b8e0c8" }}>{qa}</p>}
      {error && <p style={{ color: "#ffbdc6" }}>{error}</p>}
      {assets?.painted && <FrameStrip marks={assets.painted} />}
      {videoUrl && <video src={videoUrl} controls autoPlay muted playsInline style={{ width: 360, marginTop: 24, background: "#000" }} />}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
