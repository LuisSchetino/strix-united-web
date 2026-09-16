import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { encodeAgendaMp4, encodeStillPng } from "./features/media/encode-mp4.js";
import { loadAnnounceAssets } from "./features/media/media-assets.js";
import { announceFileName, announceTeamTiming, fillAnnouncePhrase, individualAnnounceDuration } from "./features/media/announce-core.js";
import { presentAnnounceFxIds } from "./features/media/announce-fx.js";
import { buildAnnounceTimeline } from "./features/media/announce-timeline.js";
import { announceFrameTime, describeAnnounceFrame, renderAnnounceFrame } from "./features/media/announce-frame.js";

const people = [
  { id: "p1", name: "OBEEN", nick: "alias-ignored", photo: "/brand/strix/portrait-nunes.png?v=3", position: "MC", group: "MEI", extraRole: "diretoria", extraBadge: "DIRETORIA", initials: "OB" },
  { id: "p2", name: "Santozz", nick: "", photo: "/brand/strix/portrait-santozz.png?v=3", position: "ATA", group: "ATA", extraRole: "jogador", extraBadge: "", initials: "SA" },
  { id: "p3", name: "Cedraz", nick: "", photo: "", position: "ZAG", group: "DEF", extraRole: "conselho", extraBadge: "CONSELHO", initials: "CE" },
  { id: "p4", name: "João Pedro da Silva Extra", nick: "", photo: "", position: "GOL", group: "GOL", extraRole: "manager", extraBadge: "MANAGER", initials: "JP" },
  { id: "p5", name: "YGO", nick: "", photo: "/brand/strix/portrait-ygo.png?v=3", position: "ZAG", group: "DEF", extraRole: "jogador", extraBadge: "", initials: "YG" },
  { id: "p6", name: "Ceni", nick: "", photo: "/brand/strix/portrait-ceni.png?v=3", position: "GOL", group: "GOL", extraRole: "staff", extraBadge: "STAFF", initials: "CE" },
  { id: "p7", name: "Nunes", nick: "", photo: "/brand/strix/portrait-nunes.png?v=3", position: "MC", group: "MEI", extraRole: "jogador", extraBadge: "", initials: "NU" },
  { id: "p8", name: "João", nick: "", photo: "/brand/strix/portrait-joao.png?v=3", position: "GOL", group: "GOL", extraRole: "jogador", extraBadge: "", initials: "JO" },
];

const modes = [
  { id: "ind-reels", kind: "individual", format: "story", people: [people[0]], phrase: fillAnnouncePhrase("Mais uma peça confirmada para o FC 27.", people[0]), title: "" },
  { id: "ind-post", kind: "individual", format: "feed", people: [people[0]], phrase: fillAnnouncePhrase("Mais uma peça confirmada para o FC 27.", people[0]), title: "" },
  { id: "team-reels", kind: "team", format: "story", people: people.slice(0, 4), title: "ELENCO FC 27" },
  { id: "team-8", kind: "team", format: "story", people, title: "ELENCO FC 27" },
  { id: "team-post", kind: "team", format: "feed", people, title: "ELENCO FC 27" },
];

function stillsFor(timeline) {
  if (timeline.kind === "individual") {
    return timeline.still
      ? [{ time: 0, label: "post" }]
      : [
          { time: 0.55, label: "0.55s opening" },
          { time: 1.25, label: "1.25s reveal" },
          { time: 2.4, label: "2.4s hero" },
          { time: 2.3, label: "2.3s phrase" },
          { time: 5.4, label: "5.4s reframe" },
          { time: 7.4, label: "7.4s detail" },
          { time: 9.6, label: "9.6s close" },
        ];
  }
  const peopleScenes = (timeline.scenes || []).filter((scene) => scene.type === "person");
  const finaleScenes = (timeline.scenes || []).filter((scene) => scene.type === "finale");
  return timeline.still
    ? [{ time: 0, label: "elenco" }]
    : [
        { time: 0.7, label: "opening" },
        ...peopleScenes.map((scene, index) => ({
          time: scene.start + 1.1,
          label: `hero ${index + 1}`,
        })),
        ...finaleScenes.map((scene, index) => ({
          time: scene.start + 0.7,
          label: scene.pageCount > 1 ? `elenco ${index + 1}` : "elenco",
        })),
      ];
}

function paintStill(timeline, assets, time) {
  const canvas = document.createElement("canvas");
  canvas.width = timeline.width;
  canvas.height = timeline.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  renderAnnounceFrame(ctx, { timeline, timeSec: time, assets });
  return { image: canvas.toDataURL("image/png"), scene: describeAnnounceFrame(timeline, time) };
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
  const [timing, setTiming] = useState("");
  const [status, setStatus] = useState("Carregando assets…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const assets = await loadAnnounceAssets(people);
      if (cancelled) return;
      const four = announceTeamTiming(4);
      const eight = announceTeamTiming(8);
      const present = presentAnnounceFxIds(assets.fx);
      setTiming(`FX ${present.join(", ") || "none"} · Individual ${individualAnnounceDuration()}s · Team4 ${four.duration}s · Team8 ${eight.duration}s`);
      const captured = modes.map((mode) => {
        const timeline = buildAnnounceTimeline(mode);
        return {
          id: mode.id,
          title: `${mode.id} · ${mode.format === "feed" ? "post" : "reels"}`,
          marks: stillsFor(timeline).map((mark) => ({ ...mark, ...paintStill(timeline, assets, mark.time) })),
        };
      });
      captured.push(
        ...[
          { id: "finale-1", people: people.slice(0, 1) },
          { id: "finale-2", people: people.slice(0, 2) },
        ].map((item) => {
          const timeline = buildAnnounceTimeline({ kind: "team", format: "story", people: item.people, title: "ELENCO FC 27" });
          const time = timeline.finaleStart + 0.55;
          return {
            id: item.id,
            title: `${item.id} · still`,
            marks: [{ time, label: item.id, ...paintStill(timeline, assets, time) }],
          };
        }),
      );
      setFrames(captured);
      if (new URLSearchParams(window.location.search).has("stills")) {
        setStatus("Stills prontos. Encode ignorado (?stills).");
        return;
      }
      const done = [];
      for (const mode of modes) {
        setStatus(`Gerando ${mode.id}…`);
        const result = await encodeMode(mode, assets);
        const url = URL.createObjectURL(result.blob);
        const fileName = (mode.id === "team-8" ? "strix-anuncio-elenco-8-reels.mp4" : result.fileName).replace(/(\.\w+)$/, "-v37$1");
        done.push({ ...result, url, fileName, id: mode.id });
        setExports([...done]);
      }
      setStatus("LOCALMENTE PRONTO · Individual + Team gerados. NÃO PUBLICADO.");
    })().catch((error) => setStatus(error.message || "Falha no QA de anúncios."));
    return () => { cancelled = true; };
  }, []);

  return (
    <main style={{ fontFamily: "Inter, sans-serif", background: "#050607", color: "#efece6", minHeight: "100dvh", padding: 24 }}>
      <h1>Anúncios FC 27 · polish visual v3.7</h1>
      <p>{status}</p>
      <p>{timing}</p>
      {frames.map((group) => (
        <section key={group.id} style={{ marginTop: 28 }}>
          <h2>{group.title}</h2>
          <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
            {group.marks.map((mark) => (
              <figure key={mark.label} style={{ margin: 0 }}>
                <img src={mark.image} alt={mark.label} width={220} style={{ background: "#050607", display: "block" }} />
                <figcaption>{mark.label} · {mark.scene.sceneType}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      <section style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
        {exports.map((item) => (
          <article key={item.id}>
            <h3>{item.fileName}</h3>
            {item.fileName.endsWith(".png")
              ? <img src={item.url} alt={item.fileName} width={320} />
              : <video src={item.url} controls playsInline width={320} />}
            <div><a href={item.url} download={item.fileName}>baixar</a></div>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
