import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { encodeAgendaMp4 } from "./features/media/encode-mp4.js";
import { loadSummaryAssets } from "./features/media/media-assets.js";
import { collectPeriodSummary } from "./features/media/summary-core.js";
import { describeSummaryFrame, renderSummaryFrame, summaryFrameTime } from "./features/media/summary-frame.js";
import { sampleFrameSignature as agendaSignature, signatureDistance as agendaDistance } from "./features/media/agenda-frame.js";
import { buildSummaryTimeline } from "./features/media/summary-timeline.js";

const now = new Date("2026-09-03T18:00:00-03:00");

function rawMatch(id, iso, strix, opponent, name, competition) {
  return {
    id,
    played_at: `${iso}T21:10:00-03:00`,
    opponent_name: name,
    strix_score: strix,
    opponent_score: opponent,
    competition_name: competition,
  };
}

const workspace = {
  matches: [
    rawMatch("w1", "2026-08-31", 2, 0, "Maquina", "Superliga Yeshua"),
    rawMatch("w2", "2026-09-01", 1, 1, "Summit ES", "Master League"),
    rawMatch("d1", "2026-09-03", 3, 1, "POA City FC", "Superliga Yeshua"),
    rawMatch("d2", "2026-09-03", 0, 0, "Genius Esports", "Amistoso"),
    rawMatch("d3", "2026-09-03", 2, 4, "Sinceridade", "Master League"),
    rawMatch("w6", "2026-09-05", 4, 2, "Next Clubs", "Superliga Yeshua"),
    rawMatch("out", "2026-09-07", 5, 0, "Fora da semana", "Amistoso"),
  ],
};

function paintSignature(timeline, assets, time) {
  const canvas = document.createElement("canvas");
  canvas.width = timeline.width;
  canvas.height = timeline.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  renderSummaryFrame(ctx, { timeline, timeSec: time, assets, dayLabel: timeline.period?.rangeLabel });
  return {
    image: canvas.toDataURL("image/png"),
    signature: agendaSignature(ctx, timeline.width, timeline.height),
    scene: describeSummaryFrame(timeline, time),
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

function marksFor(timeline) {
  const result = timeline.scenes.find((scene) => scene.type === "result");
  const lastResult = [...timeline.scenes].reverse().find((scene) => scene.type === "result");
  return [
    { time: 0.45, label: "opening" },
    { time: timeline.statsStart + 0.4, label: "números" },
    { time: (result?.start || 0) + 0.35, label: "jogo 01" },
    { time: (lastResult?.start || 0) + 0.35, label: "último jogo" },
    { time: timeline.finaleStart + 0.7, label: "fechamento" },
    { time: Math.max(0, timeline.duration - 0.05), label: "último" },
  ];
}

async function encodePeriod(mode) {
  const period = collectPeriodSummary(workspace, { mode, now });
  const timeline = buildSummaryTimeline(period, { format: "story" });
  const assets = await loadSummaryAssets(period.matches);
  const blob = await encodeAgendaMp4({
    timeline,
    assets,
    dayLabel: period.rangeLabel,
    renderFrame: renderSummaryFrame,
    frameTime: summaryFrameTime,
  });
  const times = marksFor(timeline);
  const painted = times.map((mark) => ({ ...mark, ...paintSignature(timeline, assets, mark.time) }));
  const url = URL.createObjectURL(blob);
  const captured = await sampleVideoPlayback(url, timeline, times);
  const pairs = painted.map((mark) => {
    const video = captured.find((item) => item.label === mark.label);
    const distance = video ? agendaDistance(mark.signature, video.signature) : -1;
    return `${mark.label} ${mark.scene.sceneType} Δ${distance}`;
  });
  const motion = [
    [times[0].time, times[1].time],
    [times[2].time, times[4].time],
  ].map(([a, b]) => {
    const left = captured.find((item) => Math.abs(item.time - a) < 0.08);
    const right = captured.find((item) => Math.abs(item.time - b) < 0.08);
    return left && right ? agendaDistance(left.signature, right.signature) : 0;
  });
  const frozen = motion.every((value) => value < 8);
  return {
    mode,
    period,
    timeline,
    url,
    blob,
    painted,
    qa: `${pairs.join(" · ")} · ${period.matches.length} jogos · motion ${motion.join("/")} · ${frozen ? "FREEZE" : "MOTION OK"}`,
  };
}

function Block({ title, file, result, error }) {
  if (error) {
    return (
      <section>
        <h2>{title}</h2>
        <p style={{ color: "#ffbdc6" }}>{error}</p>
      </section>
    );
  }
  if (!result) return <section><h2>{title}</h2><p>Gerando…</p></section>;
  return (
    <section style={{ marginBottom: 48 }}>
      <h2>{title}</h2>
      <p>{result.timeline.duration}s · {result.timeline.fps} fps · {result.timeline.totalFrames} frames · {(result.blob.size / 1024 / 1024).toFixed(2)} MB</p>
      <p>{result.period.rangeLabel} · {result.period.stats.wins}V {result.period.stats.draws}E {result.period.stats.losses}D</p>
      <p style={{ color: result.qa.includes("FREEZE") ? "#ffbdc6" : "#b8e0c8" }}>{result.qa}</p>
      <FrameStrip marks={result.painted} />
      <p><a href={result.url} download={file} style={{ color: "#efece6" }}>Baixar {file}</a></p>
      <video src={result.url} controls autoPlay muted playsInline style={{ width: 360, marginTop: 16, background: "#000" }} />
    </section>
  );
}

function App() {
  const [day, setDay] = useState(null);
  const [week, setWeek] = useState(null);
  const [status, setStatus] = useState("Preparando assets…");
  const [error, setError] = useState("");

  useEffect(() => {
    let dayUrl = "";
    let weekUrl = "";
    encodePeriod("day")
      .then((result) => {
        dayUrl = result.url;
        setDay(result);
        setStatus("Renderizando resumo da semana…");
        return encodePeriod("week");
      })
      .then((result) => {
        weekUrl = result.url;
        setWeek(result);
        setStatus("MP4s prontos");
      })
      .catch((item) => setError(item.message || String(item)));
    return () => {
      if (dayUrl) URL.revokeObjectURL(dayUrl);
      if (weekUrl) URL.revokeObjectURL(weekUrl);
    };
  }, []);

  return (
    <main style={{ minHeight: "100vh", margin: 0, padding: 24, background: "#050607", color: "#f5f5f5", fontFamily: "Inter, sans-serif" }}>
      <h1>QA · Resumo do Dia / Semana v1</h1>
      <p>{status}</p>
      {error && <p style={{ color: "#ffbdc6" }}>{error}</p>}
      <Block title="Resumo do Dia" file="strix-resumo-dia-2026-09-03-story.mp4" result={day} />
      <Block title="Resumo da Semana" file="strix-resumo-semana-2026-09-03-story.mp4" result={week} />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
