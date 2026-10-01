import React, { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "../../ui/AccessDenied.jsx";
import { canManageMedia } from "./agenda-media-core.js";
import { subscribeMediaJob } from "./media-jobs.js";
import { preloadCollageAssets } from "../../assets/collage/index.js";
import { preloadCutoutChars } from "./cutout-text.js";
import { MEDIA_SECTIONS, normalizeMediaSection, resolveMediaLook } from "./media-renderer.js";
import { MediaBoundary, MediaNav, MediaViewer } from "./MediaShell.jsx";
import { AgendaSection, RelatedSection, SummarySection } from "./MediaSections.jsx";
import { AnnounceStudio } from "./AnnounceStudio.jsx";
import "./media.css";

/**
 * Warms the collage painter. If its assets cannot load, the renderer falls back
 * to the campaign painter, so a missing asset never blocks a piece.
 */
function useCollageReady(players) {
  const [ready, setReady] = useState(null);
  const names = useMemo(() => (players || []).map((item) => item.display_name || item.name || "").join(" "), [players]);
  useEffect(() => {
    let alive = true;
    Promise.all([
      preloadCollageAssets(),
      preloadCutoutChars(`AGENDA DO DIA RELACIONADOS DA NOITE RESUMO DO DIA DA SEMANA ELENCO ${names}`),
    ]).then(() => { if (alive) setReady(true); }).catch(() => { if (alive) setReady(false); });
    return () => { alive = false; };
  }, [names]);
  return ready;
}

export function MediaPage({ profile, client, workspace }) {
  const allowed = canManageMedia(profile);
  const [section, setSection] = useState("agenda");
  const [job, setJob] = useState(null);
  const [viewer, setViewer] = useState(null);
  const collageReady = useCollageReady(workspace.players);
  const look = resolveMediaLook({ collageReady: collageReady !== false });
  const running = job?.status === "running";
  useEffect(() => subscribeMediaJob(setJob), []);

  if (!allowed) return <AccessDenied page="midia" />;

  const active = normalizeMediaSection(section);
  const shared = { workspace, profile, look, job, running, openViewer: setViewer };

  return (
    <section className="media-page page-enter">
      <header className="media-heading">
        <span>STRIX UNITED · MÍDIA</span>
        <h1>Central de conteúdo.</h1>
        <p>A noite em campo. A história nas redes.</p>
      </header>
      <MediaNav sections={MEDIA_SECTIONS} active={active} onChange={setSection} />
      <div className="media-section" key={active}>
        <MediaBoundary key={active}>
          {active === "agenda" ? <AgendaSection {...shared} />
            : active === "related" ? <RelatedSection {...shared} />
              : active === "summary-day" ? <SummarySection mode="day" {...shared} />
                : active === "summary-week" ? <SummarySection mode="week" {...shared} />
                  : <AnnounceStudio {...shared} />}
        </MediaBoundary>
      </div>
      {viewer && <MediaViewer record={viewer} close={() => setViewer(null)} />}
    </section>
  );
}
