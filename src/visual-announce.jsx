import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { encodeAgendaMp4, encodeStillPng } from "./features/media/encode-mp4.js";
import { loadAnnounceAssets } from "./features/media/media-assets.js";
import { announceFileName, fillAnnouncePhrase } from "./features/media/announce-core.js";
import { buildAnnounceTimeline } from "./features/media/announce-timeline.js";
import { announceFrameTime, describeAnnounceFrame, renderAnnounceFrame } from "./features/media/announce-frame.js";

const people = [
  { id: "p1", name: "Oben", nick: "OBEEN", photo: "/brand/strix/portrait-nunes.png?v=3", position: "MC", group: "MEI", extraRole: "diretoria", extraBadge: "DIRETORIA", initials: "OB" },
  { id: "p2", name: "Santozz", nick: "", photo: "/brand/strix/portrait-santozz.png?v=3", position: "ATA", group: "ATA", extraRole: "jogador", extraBadge: "", initials: "SA" },
  { id: "p3", name: "Cedraz", nick: "", photo: "", position: "ZAG", group: "DEF", extraRole: "conselho", extraBadge: "CONSELHO", initials: "CE" },
  { id: "p4", name: "João Pedro da Silva Extra", nick: "", photo: "", position: "GOL", group: "GOL", extraRole: "jogador", extraBadge: "", initials: "JP" },
  { id: "p5", name: "YGO", nick: "", photo: "/brand/strix/portrait-ygo.png?v=3", position: "ZAG", group: "DEF", extraRole: "jogador", extraBadge: "", initials: "YG" },
  { id: "p6", name: "Ceni", nick: "", photo: "/brand/strix/portrait-ceni.png?v=3", position: "GOL", group: "GOL", extraRole: "staff", extraBadge: "STAFF", initials: "CE" },
  { id: "p7", name: "Nunes", nick: "", photo: "/brand/strix/portrait-nunes.png?v=3", position: "MC", group: "MEI", extraRole: "jogador", extraBadge: "", initials: "NU" },
  { id: "p8", name: "João", nick: "", photo: "/brand/strix/portrait-joao.png?v=3", position: "GOL", group: "GOL", extraRole: "jogador", extraBadge: "", initials: "JO" },
];

const modes = [
  { id: "ind-reels", kind: "individual", format: "story", people: [people[0]], phrase: fillAnnouncePhrase("Pronto para escrever a próxima temporada.", people[0]), title: "" },
  { id: "ind-post", kind: "individual", format: "feed", people: [people[0]], phrase: fillAnnouncePhrase("Mais uma peça confirmada para o FC 27.", people[0]), title: "" },
  { id: "team-reels", kind: "team", format: "story", people, title: "ELENCO FC 27" },
  { id: "team-post", kind: "team", format: "feed", people, title: "PLANTEL FC 27" },
];

function stillsFor(timeline) {
  if (timeline.kind === "individual") {
    return timeline.still
      ? [{ time: 0, label: "post" }]
      : [
          { time: 0.5, label: "entrada" },
          { time: 3.2, label: "nome" },
          { time: 7.2, label: "frase" },
          { time: Math.max(0, timeline.duration - 0.2), label: "fecho" },
        ];
  }
  return timeline.still
    ? [{ time: 0, label: "grid" }]
    : [
        { time: 0.5, label: "abertura" },
        { time: timeline.introEnd + 0.35, label: "primeiro" },
        { time: timeline.finaleStart + 0.5, label: "elenco" },
      ];
}

function paintStill(timeline, assets, time) {
  const canvas = document.createElement("canvas");
  canvas.width = timeline.width;
  canvas.height = timeline.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  renderAnnounceFrame(ctx, { timeline, timeSec: time, assets });
  return {
    image: canvas.toDataURL("image/png"),
    scene: describeAnnounceFrame(timeline, time),
  };
}

async function encodeMode(mode, assets) {
  const timeline = buildAnnounceTimeline(mode);
  if (mode.format === "feed") {
    const blob = await encodeStillPng({ timeline, assets, renderFrame: renderAnnounceFrame, timeSec: 0 });
    return { blob, fileName: announceFileName(mode), timeline };
  }
  const blob = await encodeAgendaMp4({
    timeline,
    assets,
    renderFrame: renderAnnounceFrame,
    frameTime: announceFrameTime,
  });
  return { blob, fileName: announceFileName(mode), timeline };
}

function App() {
  const [frames, setFrames] = useState([]);
  const [exports, setExports] = useState([]);
  const [status, setStatus] = useState("Carregando assets…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const assets = await loadAnnounceAssets(people);
      if (cancelled) return;
      const captured = modes.map((mode) => {
        const timeline = buildAnnounceTimeline(mode);
        return {
          id: mode.id,
          title: `${mode.kind} / ${mode.format === "feed" ? "post" : "reels"}`,
          marks: stillsFor(timeline).map((mark) => ({ ...mark, ...paintStill(timeline, assets, mark.time) })),
        };
      });
      setFrames(captured);
      setStatus("Stills prontos. Encode dos 4 formatos em andamento…");
      const done = [];
      for (const mode of modes) {
        setStatus(`Gerando ${mode.id}…`);
        const result = await encodeMode(mode, assets);
        const url = URL.createObjectURL(result.blob);
        done.push({ ...result, url, id: mode.id });
        setExports([...done]);
      }
      setStatus("LOCALMENTE PRONTO · os 4 formatos foram gerados nesta página de QA.");
    })().catch((error) => setStatus(error.message || "Falha no QA de anúncios."));
    return () => { cancelled = true; };
  }, []);

  return (
    <main style={{ fontFamily: "Inter, sans-serif", background: "#050607", color: "#efece6", minHeight: "100dvh", padding: 24 }}>
      <h1>Anúncios FC 27 · QA</h1>
      <p>{status}</p>
      {frames.map((group) => (
        <section key={group.id} style={{ marginTop: 28 }}>
          <h2>{group.title}</h2>
          <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
            {group.marks.map((mark) => (
              <figure key={mark.label} style={{ margin: 0 }}>
                <img src={mark.image} alt={mark.label} width={160} />
                <figcaption>{mark.label} · {mark.scene.sceneType}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      <section style={{ marginTop: 32, display: "grid", gap: 18 }}>
        {exports.map((item) => (
          <article key={item.id}>
            <h3>{item.fileName}</h3>
            {item.fileName.endsWith(".png")
              ? <img src={item.url} alt={item.fileName} width={220} />
              : <video src={item.url} controls playsInline width={220} />}
            <div><a href={item.url} download={item.fileName}>baixar</a></div>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
