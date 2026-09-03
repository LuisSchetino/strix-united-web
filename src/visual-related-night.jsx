import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { encodeAgendaMp4 } from "./features/media/encode-mp4.js";
import { loadRelatedNightAssets } from "./features/media/media-assets.js";
import { relatedNightFrameTime, describeRelatedNightFrame, renderRelatedNightFrame } from "./features/media/related-night-frame.js";
import { buildRelatedNightTimeline } from "./features/media/related-night-timeline.js";
import { sampleFrameSignature as agendaSignature, signatureDistance as agendaDistance } from "./features/media/agenda-frame.js";

const sample = [
  { id: "g1", name: "Ceni", photo: "", position: "GOL", group: "GOL" },
  { id: "g2", name: "João", photo: "", position: "GOL", group: "GOL" },
  { id: "d1", name: "YGO", photo: "", position: "ZAG", group: "DEF" },
  { id: "d2", name: "Cedraz", photo: "", position: "ZAG", group: "DEF" },
  { id: "d3", name: "Léo", photo: "", position: "ZAG", group: "DEF" },
  { id: "d4", name: "Rafa", photo: "", position: "ZAG", group: "DEF" },
  { id: "m1", name: "Oben", photo: "", position: "VOL", group: "MEI" },
  { id: "m2", name: "Nunes", photo: "", position: "MC", group: "MEI" },
  { id: "m3", name: "Kestol", photo: "", position: "MC", group: "MEI" },
  { id: "m4", name: "Dudu", photo: "", position: "MEI", group: "MEI" },
  { id: "m5", name: "Biel", photo: "", position: "ALA", group: "MEI" },
  { id: "a1", name: "Santozz", photo: "", position: "ATA", group: "ATA" },
  { id: "a2", name: "Vini", photo: "", position: "ATA", group: "ATA" },
];

const dayLabel = "02 DE SET DE 2026";

function paintSignature(timeline, assets, time) {
  const canvas = document.createElement("canvas");
  canvas.width = timeline.width;
  canvas.height = timeline.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  renderRelatedNightFrame(ctx, { timeline, timeSec: time, assets, dayLabel });
  return {
    image: canvas.toDataURL("image/png"),
    signature: agendaSignature(ctx, timeline.width, timeline.height),
    scene: describeRelatedNightFrame(timeline, time),
  };
}

function FrameStrip({ marks }) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
      {marks.map((mark) => (
        <figure key={mark.label} style={{ margin: 0, color: "#d8dce0" }}>
          <img src={mark.image} alt={mark.label} width={180} />
          <figcaption>{mark.label} · {mark.scene.sceneType} · {mark.scene.onField?.length || 0} no campo</figcaption>
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
          signature: agendaSignature(ctx, timeline.width, timeline.height),
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
  const timeline = buildRelatedNightTimeline(sample, { format: "story" });
  const times = [
    { time: 0.6, label: "opening" },
    { time: timeline.introEnd + 0.4, label: "jogador 1" },
    { time: timeline.introEnd + 1.6, label: "2 goleiros" },
    { time: timeline.introEnd + 4.2, label: "defesa" },
    { time: timeline.introEnd + 8.2, label: "meio" },
    { time: timeline.introEnd + 12.2, label: "ataque" },
    { time: timeline.finaleStart + 0.6, label: "campo completo" },
    { time: Math.max(0, timeline.duration - 0.05), label: "último" },
  ];

  useEffect(() => {
    let url = "";
    loadRelatedNightAssets(sample)
      .then(async (loaded) => {
        setAssets(loaded);
        setStatus("Renderizando MP4 de QA…");
        const blob = await encodeAgendaMp4({
          timeline,
          assets: loaded,
          dayLabel,
          renderFrame: renderRelatedNightFrame,
          frameTime: relatedNightFrameTime,
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
          const distance = video ? agendaDistance(mark.signature, video.signature) : -1;
          return `${mark.label} ${mark.scene.sceneType} Δ${distance}`;
        });
        const lastPainted = painted.at(-1);
        const reservedLook = lastPainted.scene.onField.length < sample.length;
        const motion = [
          [times[1].time, times[2].time],
          [times[4].time, times[6].time],
        ].map(([a, b]) => {
          const left = captured.find((item) => Math.abs(item.time - a) < 0.08);
          const right = captured.find((item) => Math.abs(item.time - b) < 0.08);
          return left && right ? agendaDistance(left.signature, right.signature) : 0;
        });
        const frozen = motion.every((value) => value < 8);
        setQa(`${pairs.join(" · ")} · no campo ${lastPainted.scene.onField.length}/${sample.length} · motion ${motion.join("/")} · ${frozen ? "FREEZE" : "MOTION OK"} · ${reservedLook ? "PARECE RESERVA" : "MAPA ÚNICO"}`);
        setStatus(`MP4 pronto · ${(blob.size / 1024 / 1024).toFixed(2)} MB · ${timeline.duration}s`);
        setAssets((current) => current && { ...current, painted });
      })
      .catch((item) => setError(item.message || String(item)));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, []);

  return (
    <main style={{ minHeight: "100vh", margin: 0, padding: 24, background: "#050607", color: "#f5f5f5", fontFamily: "Inter, sans-serif" }}>
      <h1>QA · Relacionados da Noite</h1>
      <p>{status}</p>
      {blobInfo && <p>{blobInfo.duration}s · {blobInfo.fps} fps · {blobInfo.frames} frames · {(blobInfo.size / 1024 / 1024).toFixed(2)} MB</p>}
      {qa && <p style={{ color: qa.includes("FREEZE") || qa.includes("RESERVA") ? "#ffbdc6" : "#b8e0c8" }}>{qa}</p>}
      {error && <p style={{ color: "#ffbdc6" }}>{error}</p>}
      {assets?.painted && <FrameStrip marks={assets.painted} />}
      {videoUrl && (
        <>
          <p><a href={videoUrl} download="strix-relacionados-2026-09-02-story.mp4" style={{ color: "#efece6" }}>Baixar MP4 dos Relacionados</a></p>
          <video src={videoUrl} controls autoPlay muted playsInline style={{ width: 360, marginTop: 24, background: "#000" }} />
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
