import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { encodeAgendaMp4 } from "./features/media/encode-mp4.js";
import { loadRelatedNightAssets } from "./features/media/media-assets.js";
import { relatedNightFrameTime, describeRelatedNightFrame, renderRelatedNightFrame } from "./features/media/related-night-frame.js";
import { buildRelatedNightTimeline } from "./features/media/related-night-timeline.js";
import { sampleFrameSignature as agendaSignature, signatureDistance as agendaDistance } from "./features/media/agenda-frame.js";

const dayLabel = "02 DE SET DE 2026";

const sample = [
  { id: "g1", name: "Ceni", photo: "/brand/strix/portrait-ceni.png?v=3", position: "GOL", group: "GOL", kind: "cutout" },
  { id: "g2", name: "João", photo: "/brand/strix/portrait-joao.png?v=3", position: "GOL", group: "GOL", kind: "stadium" },
  { id: "d1", name: "YGO", photo: "/brand/strix/portrait-ygo.png?v=3", position: "ZAG", group: "DEF", kind: "crest" },
  { id: "d2", name: "Cedraz", photo: "", position: "ZAG", group: "DEF", kind: "none" },
  { id: "d3", name: "Léo", photo: "", position: "ZAG", group: "DEF" },
  { id: "d4", name: "Rafa", photo: "", position: "ZAG", group: "DEF" },
  { id: "m1", name: "Oben", photo: "", position: "VOL", group: "MEI" },
  { id: "m2", name: "Nunes", photo: "/brand/strix/portrait-nunes.png?v=3", position: "MC", group: "MEI", kind: "selfie" },
  { id: "m3", name: "Kestol", photo: "", position: "MC", group: "MEI" },
  { id: "m4", name: "Dudu", photo: "", position: "MEI", group: "MEI" },
  { id: "m5", name: "Biel", photo: "", position: "ALA", group: "MEI" },
  { id: "a1", name: "Santozz", photo: "/brand/strix/portrait-santozz.png?v=3", position: "ATA", group: "ATA", kind: "studio" },
  { id: "a2", name: "Vini", photo: "", position: "ATA", group: "ATA" },
];

async function treatPortrait(bitmap, kind) {
  if (!bitmap || kind === "studio") return bitmap;
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (kind === "cutout") {
    const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
    ctx.drawImage(bitmap, (canvas.width - bitmap.width * scale) / 2, (canvas.height - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.moveTo(86, 720);
    ctx.lineTo(78, 310);
    ctx.quadraticCurveTo(90, 48, 240, 28);
    ctx.quadraticCurveTo(400, 48, 404, 300);
    ctx.lineTo(396, 720);
    ctx.closePath();
    ctx.fill();
    return createImageBitmap(canvas);
  }
  if (kind === "stadium") {
    ctx.fillStyle = "#152033";
    ctx.fillRect(0, 0, 480, 720);
    for (let row = 0; row < 20; row += 1) {
      ctx.fillStyle = row % 2 ? "#22324d" : "#2a3c5c";
      ctx.fillRect(0, row * 36, 480, 34);
    }
    ctx.fillStyle = "rgba(255, 210, 90, 0.28)";
    ctx.beginPath();
    ctx.arc(90, 110, 78, 0, Math.PI * 2);
    ctx.fill();
    const scale = Math.max(340 / bitmap.width, 500 / bitmap.height);
    ctx.drawImage(bitmap, 70, 120, bitmap.width * scale, bitmap.height * scale);
    return createImageBitmap(canvas);
  }
  if (kind === "crest") {
    ctx.fillStyle = "#101318";
    ctx.fillRect(0, 0, 480, 720);
    ctx.fillStyle = "#efece6";
    ctx.beginPath();
    ctx.arc(240, 250, 168, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6f757c";
    ctx.font = "800 84px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FC", 240, 278);
    const scale = Math.max(480 / bitmap.width, 720 / bitmap.height);
    ctx.drawImage(bitmap, (480 - bitmap.width * scale) / 2, (720 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    return createImageBitmap(canvas);
  }
  if (kind === "selfie") {
    ctx.translate(240, 360);
    ctx.rotate(-0.09);
    const scale = Math.max(680 / bitmap.width, 980 / bitmap.height);
    ctx.drawImage(bitmap, -bitmap.width * scale / 2, -bitmap.height * scale * 0.38, bitmap.width * scale, bitmap.height * scale);
    return createImageBitmap(canvas);
  }
  return bitmap;
}

async function applyPhotoCases(loaded) {
  const next = {
    ...loaded,
    players: [...loaded.players],
    byId: { ...loaded.byId },
  };
  for (const [index, player] of sample.entries()) {
    if (!player.kind || player.kind === "none") continue;
    const current = next.players[index];
    if (!current?.bitmap) continue;
    const treated = await treatPortrait(current.bitmap, player.kind);
    next.players[index] = { ...current, bitmap: treated, kind: player.kind };
    next.byId[player.id] = next.players[index];
  }
  return next;
}

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
  const beats = timeline.scenes.filter((scene) => scene.type === "player");
  const times = [
    { time: 0.55, label: "opening" },
    { time: beats[0].start + 0.5, label: "goleiro 1" },
    { time: beats[1].start + 0.45, label: "goleiro 2" },
    { time: beats[2].start + 0.4, label: "defesa" },
    { time: beats[6].start + 0.4, label: "meio" },
    { time: beats[7].start + 0.4, label: "8/13" },
    { time: beats[11].start + 0.4, label: "ataque" },
    { time: beats[11].start + 0.55, label: "12/13" },
    { time: beats[12].start + 0.55, label: "13/13" },
    { time: timeline.finaleStart + 0.85, label: "campo completo" },
    { time: Math.max(0, timeline.duration - 0.05), label: "último" },
  ];

  useEffect(() => {
    let url = "";
    loadRelatedNightAssets(sample)
      .then(async (loaded) => {
        const withPhotos = await applyPhotoCases(loaded);
        const fallbackOnly = {
          ...loaded,
          players: loaded.players.map((asset) => ({ ...asset, bitmap: null })),
          byId: Object.fromEntries(Object.entries(loaded.byId || {}).map(([id, asset]) => [id, { ...asset, bitmap: null }])),
        };
        setAssets(withPhotos);
        setStatus("Renderizando MP4 de QA…");
        const blob = await encodeAgendaMp4({
          timeline,
          assets: withPhotos,
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
        const painted = times.map((mark) => ({ ...mark, ...paintSignature(timeline, withPhotos, mark.time) }));
        const kinds = [
          { label: "cutout", time: beats[0].start + 0.5 },
          { label: "stadium", time: beats[1].start + 0.45 },
          { label: "crest", time: beats[2].start + 0.4 },
          { label: "selfie", time: beats[7].start + 0.4 },
          { label: "sem foto", time: beats[3].start + 0.4 },
        ];
        const cases = kinds.map((mark) => ({ ...mark, ...paintSignature(timeline, withPhotos, mark.time) }));
        const fallback = [times[1], times[2], times[8]].map((mark) => ({
          ...mark,
          label: `fallback ${mark.label}`,
          ...paintSignature(timeline, fallbackOnly, mark.time),
        }));
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
        setAssets((current) => current && { ...current, painted, fallback, cases });
      })
      .catch((item) => setError(item.message || String(item)));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, []);

  return (
    <main style={{ minHeight: "100vh", margin: 0, padding: 24, background: "#050607", color: "#f5f5f5", fontFamily: "Inter, sans-serif" }}>
      <h1>QA · Relacionados da Noite v5</h1>
      <p>{status}</p>
      {blobInfo && <p>{blobInfo.duration}s · {blobInfo.fps} fps · {blobInfo.frames} frames · {(blobInfo.size / 1024 / 1024).toFixed(2)} MB</p>}
      {qa && <p style={{ color: qa.includes("FREEZE") || qa.includes("RESERVA") ? "#ffbdc6" : "#b8e0c8" }}>{qa}</p>}
      {error && <p style={{ color: "#ffbdc6" }}>{error}</p>}
      {assets?.cases && (
        <>
          <h2>5 tipos de foto</h2>
          <FrameStrip marks={assets.cases} />
        </>
      )}
      {assets?.painted && (
        <>
          <h2>Com portraits</h2>
          <FrameStrip marks={assets.painted} />
        </>
      )}
      {assets?.fallback && (
        <>
          <h2>Fallback sem foto</h2>
          <FrameStrip marks={assets.fallback} />
        </>
      )}
      {videoUrl && (
        <>
          <p><a href={videoUrl} download="strix-relacionados-2026-09-02-story.mp4" style={{ color: "#efece6" }}>Baixar MP4 dos Relacionados</a></p>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", marginTop: 24 }}>
            <video src={videoUrl} controls autoPlay muted playsInline style={{ width: 360, background: "#000" }} />
            <video src={videoUrl} controls muted playsInline style={{ width: 320, background: "#000" }} />
          </div>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
