import React, { useEffect, useMemo, useState } from "react";
import { AccessDenied } from "../../ui/AccessDenied.jsx";
import { PageHeader } from "../../ui/PageHeader.jsx";
import { canManageMedia } from "./agenda-media-core.js";
import { subscribeMediaJob } from "./media-jobs.js";
import { normalizeMediaSection, resolveMediaLook } from "./media-renderer.js";
import { RUNDOWN_STATE_LABEL, describeMediaRundown } from "./media-rundown.js";
import { MediaBoundary, MediaNav, MediaViewer } from "./MediaShell.jsx";
import { AgendaSection, RelatedSection, SummarySection } from "./MediaSections.jsx";
import { AnnounceStudio } from "./AnnounceStudio.jsx";
import "./media.css";

/**
 * Central de mídia: pauta → peça → resultado. The pauta says what tonight can
 * produce and what each piece still needs; the studio shows the piece at scale,
 * generates it on the stage and hands back the file in the same place.
 */
export function MediaPage({ profile, client, workspace }) {
  const allowed = canManageMedia(profile);
  const [section, setSection] = useState("agenda");
  const [job, setJob] = useState(null);
  const [viewer, setViewer] = useState(null);
  const look = resolveMediaLook();
  const running = job?.status === "running";
  useEffect(() => subscribeMediaJob(setJob), []);
  const rundown = useMemo(
    () => describeMediaRundown(workspace).map((item) => ({ ...item, stateLabel: RUNDOWN_STATE_LABEL[item.state] })),
    [workspace.agenda, workspace.matches, workspace.players, workspace.aliases, workspace.nightRelated, workspace.competitions, workspace.competitionFixtures],
  );

  if (!allowed) return <AccessDenied page="midia" />;

  const active = normalizeMediaSection(section);
  const shared = { workspace, profile, look, job, running, openViewer: setViewer };

  return (
    <section className="media-page page-enter">
      <PageHeader title="Central de mídia." description="Escolha a peça da noite, confira a prévia e baixe pronta para postar." />
      <div className="media-studio">
        <MediaNav sections={rundown} active={active} onChange={setSection} />
        <div className="media-section" key={active}>
          <MediaBoundary key={active}>
            {active === "agenda" ? <AgendaSection {...shared} />
              : active === "related" ? <RelatedSection {...shared} />
                : active === "summary-day" ? <SummarySection mode="day" {...shared} />
                  : active === "summary-week" ? <SummarySection mode="week" {...shared} />
                    : <AnnounceStudio {...shared} />}
          </MediaBoundary>
        </div>
      </div>
      {viewer && <MediaViewer record={viewer} close={() => setViewer(null)} />}
    </section>
  );
}
