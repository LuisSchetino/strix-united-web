import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MatchDisplay } from "../../ui/MatchDisplay.jsx";
import { ClubLogo } from "../../ui/ClubLogo.jsx";
import { NextClubsSignature } from "../../ui/NextClubsBrand.jsx";
import { ConfirmDialog } from "../../ui/ConfirmDialog.jsx";
import { notify } from "../../ui/motion/motion.jsx";
import { normalizeName } from "../matches/import-core.js";
import {
  aggregateCompetitionHistory,
  campaignState,
  competitionHistoryStats,
  detectParticipationEnd,
  editionLeaders,
} from "./history-core.js";
import {
  archiveCompetitionEdition,
  deleteCompetitionEdition,
  saveCompetitionPreview,
} from "./competition-storage.js";
import { deriveCompetitionView } from "./competition-core.js";
import { analyzeCompetition } from "./competition-analysis.js";
import { CompetitionHero, CompetitionTabs, GamesPanel, OverviewPanel, ScenariosPanel, StandingsPanel } from "./competition-views.jsx";
import { ImportCompetitionModal } from "./ImportCompetitionModal.jsx";
import { sortBracketFixtures } from "../../../shared/bracket-slots.js";
import { canManageCompetitions } from "../../access.js";
import "./competitions.css";
import { PageHeader } from "../../ui/PageHeader.jsx";
import { clearTarget, openTarget, useDeepTarget } from "../../ui/useDeepTarget.js";
import { readRemembered, useRemembered, writeRemembered } from "../../ui/useRemembered.js";
import { ErrorNote } from "../../ui/ErrorNote.jsx";

const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "Nunca";

const fixtureLogo = (fixture, side) =>
  fixture.metadata?.[`${side}Logo`] ||
  fixture[`${side}_logo`] ||
  fixture[`${side}Logo`] ||
  "";

function FixtureClubs({ fixture }) {
  return <MatchDisplay
    className="fixture-clubs"
    homeName={fixture.home_team_name}
    homeLogo={fixtureLogo(fixture, "home")}
    homeScore={fixture.home_score}
    awayName={fixture.away_team_name}
    awayLogo={fixtureLogo(fixture, "away")}
    awayScore={fixture.away_score}
  />;
}

const fixtureTitle = (fixture) =>
  `${fixture.home_team_name} × ${fixture.away_team_name}`;

function BracketConnectors({ gridRef, version }) {
  const [drawing, setDrawing] = useState({ width: 0, height: 0, paths: [] });
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    let frame = 0;
    let alive = true;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!alive || window.matchMedia("(max-width: 800px)").matches) {
          if (alive) setDrawing({ width: 0, height: 0, paths: [] });
          return;
        }
        const gridRect = grid.getBoundingClientRect();
        const rounds = [...grid.querySelectorAll("[data-bracket-round]")];
        const paths = [];
        for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
          const sourceSlots = [...rounds[roundIndex - 1].querySelectorAll(".bracket-slot")];
          const targets = [...rounds[roundIndex].querySelectorAll(".bracket-slot article")];
          targets.forEach((target, targetIndex) => {
            const routed = sourceSlots.filter((slot) => Number(slot.dataset.feedsIntoPosition) === targetIndex);
            const sourceCards = (routed.length ? routed : sourceSlots.slice(targetIndex * 2, targetIndex * 2 + 2))
              .map((slot) => slot.querySelector("article"))
              .filter(Boolean);
            if (!sourceCards.length) return;
            const targetRect = target.getBoundingClientRect();
            const endX = targetRect.left - gridRect.left;
            const targetY = targetRect.top - gridRect.top + targetRect.height / 2;
            const sourcePoints = sourceCards.map((source) => {
              const rect = source.getBoundingClientRect();
              return {
                x: rect.right - gridRect.left,
                y: rect.top - gridRect.top + rect.height / 2,
              };
            });
            const startX = Math.max(...sourcePoints.map((point) => point.x));
            const jointX = startX + Math.max(24, (endX - startX) * 0.52);
            let path = sourcePoints.map((point) => `M ${point.x} ${point.y} H ${jointX}`).join(" ");
            const ys = [...sourcePoints.map((point) => point.y), targetY];
            if (Math.max(...ys) !== Math.min(...ys)) {
              path += ` M ${jointX} ${Math.min(...ys)} V ${Math.max(...ys)}`;
            }
            path += ` M ${jointX} ${targetY} H ${endX}`;
            paths.push({ key: `${roundIndex}-${targetIndex}`, d: path });
          });
        }
        setDrawing({ width: grid.scrollWidth, height: grid.scrollHeight, paths });
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    grid.querySelectorAll(".bracket-slot article").forEach((card) => observer.observe(card));
    window.addEventListener("resize", measure);
    document.fonts?.ready?.then(measure);
    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [gridRef, version]);
  if (!drawing.paths.length) return null;
  return (
    <svg
      className="bracket-connectors"
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      width={drawing.width}
      height={drawing.height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {drawing.paths.map((path, index) => (
        <path key={path.key} d={path.d} pathLength="1" style={{ "--connector-index": index }} />
      ))}
    </svg>
  );
}

function Knockout({ view }) {
  const [activeRound, setActiveRound] = useState(0);
  const gridRef = useRef(null);
  const rounds = view.knockout.knockout?.rounds || [];
  const grouped = rounds.map((round) => ({
    ...round,
    fixtures: sortBracketFixtures(view.fixtures.filter(
      (fixture) =>
        normalizeName(fixture.round_label) === normalizeName(round.name),
    )),
  }));
  let previousCount = grouped[0]?.fixtures.length || 0;
  const bracketRounds = grouped
    .map((round, roundIndex) => {
      const count =
        round.fixtures.length ||
        (roundIndex ? Math.max(1, Math.ceil(previousCount / 2)) : 0);
      previousCount = count;
      const previousName = grouped[roundIndex - 1]?.name || "fase anterior";
      const feeder = /quarta/i.test(previousName)
        ? "QF"
        : /semi/i.test(previousName)
          ? "SF"
          : /oitava/i.test(previousName)
            ? "R16"
            : "fase anterior ";
      const slots = round.fixtures.length
        ? round.fixtures
        : Array.from({ length: count }, (_, index) => ({
            placeholder: true,
            external_match_id: `${round.name}-${index}`,
            round_label: round.name,
            home_team_name: `Vencedor ${feeder}${index * 2 + 1}`,
            away_team_name: `Vencedor ${feeder}${index * 2 + 2}`,
          }));
      return { ...round, slots };
    })
    .filter((round) => round.slots.length);
  const firstRoundSize = bracketRounds[0]?.slots.length || 1;
  useEffect(() => setActiveRound(0), [view.currentStage]);
  return (
    <section
      className="competition-section knockout-section"
    >
      <header>
        <div>
          <span>MATA-MATA</span>
          <h2>Chaveamento · {view.currentStage}</h2>
        </div>
      </header>
      <nav className="bracket-round-nav" aria-label="Navegar pelas fases">
        <button type="button" disabled={activeRound === 0} onClick={() => setActiveRound((value) => Math.max(0, value - 1))}>← FASE ANTERIOR</button>
        <strong>{bracketRounds[activeRound]?.name}</strong>
        <button type="button" disabled={activeRound >= bracketRounds.length - 1} onClick={() => setActiveRound((value) => Math.min(bracketRounds.length - 1, value + 1))}>PRÓXIMA →</button>
      </nav>
      <div className="bracket-scroll">
        <div className="bracket-grid is-drawing has-svg-connectors" ref={gridRef}>
          <BracketConnectors gridRef={gridRef} version={`${view.currentStage}-${bracketRounds.map((round) => round.slots.length).join("-")}`} />
          {bracketRounds.map((round, roundIndex) => (
            <section
              className={`bracket-round bracket-round-${roundIndex}`}
              data-mobile-active={roundIndex === activeRound}
              data-bracket-round={roundIndex}
              key={round.name}
            >
              <h3>{round.name}</h3>
              {round.scheduledAt && <time>{dateTime(round.scheduledAt)}</time>}
              <div
                className="bracket-round-matches"
                style={{ gridTemplateRows: `repeat(${firstRoundSize}, 96px)` }}
              >
                {round.slots.map((fixture, fixtureIndex) => {
                  const rowSpan = Math.max(1, Math.round(firstRoundSize / round.slots.length));
                  return (
                    <div
                      className="bracket-slot"
                      data-bracket-slot={fixtureIndex}
                      data-feeds-into-position={fixture.feeds_into_position ?? fixture.feedsIntoPosition ?? fixture.metadata?.feedsIntoPosition ?? Math.floor(fixtureIndex / 2)}
                      style={{ gridRow: `${fixtureIndex * rowSpan + 1} / span ${rowSpan}`, "--bracket-card-delay": `${roundIndex * 85 + fixtureIndex * 28}ms` }}
                      key={fixture.external_match_id}
                    >
                      <article
                        className={`${/\bstrix\b/i.test(fixtureTitle(fixture)) ? "is-strix " : ""}${fixture.placeholder ? "is-pending" : ""}`}
                      >
                        <FixtureClubs fixture={fixture} />
                      </article>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
      <p className="provider-note">
        A ordem oficial define o caminho dos vencedores até a final.
      </p>
    </section>
  );
}

function HistoryCompetitionCard({ group, workspace }) {
  const [selectedId, setSelectedId] = useState(group.editions.at(-1)?.id || "");
  const selected = group.editions.find((edition) => edition.id === selectedId) || group.editions.at(-1);
  // Retrospective of the selected edition, from the club's own matches imported for it.
  const leaders = useMemo(
    () => (selected ? editionLeaders((workspace?.statMatches || workspace?.matches || []).filter((match) => match.competition_edition_id === selected.id), { players: workspace?.players, aliases: workspace?.aliases }) : null),
    [selected?.id, workspace?.statMatches, workspace?.matches, workspace?.players, workspace?.aliases],
  );
  return (
          <article className="history-competition-card">
            <header className="history-competition-header">
              <div>
                <h3>{group.name}</h3>
                <span>
                  {group.editions.length} participações · {group.titles}{" "}
                  título(s)
                </span>
              </div>
              <div className="history-efficiency">
                <small>APROVEITAMENTO</small>
                <b className="data-value">{group.efficiency}%</b>
              </div>
            </header>
            <dl className="history-metrics">
              <div>
                <dt>J</dt>
                <dd>{group.games}</dd>
              </div>
              <div>
                <dt>V</dt>
                <dd>{group.wins}</dd>
              </div>
              <div>
                <dt>E</dt>
                <dd>{group.draws}</dd>
              </div>
              <div>
                <dt>D</dt>
                <dd>{group.losses}</dd>
              </div>
              <div>
                <dt>SG</dt>
                <dd>{group.goalDifference}</dd>
              </div>
              <div>
                <dt>FINAIS</dt>
                <dd>{group.finals}</dd>
              </div>
            </dl>
            <div className="history-form-chart" role="img" aria-label={`${group.wins} vit\u00f3rias, ${group.draws} empates e ${group.losses} derrotas em ${group.games} jogos`}>
              <span className="wins" style={{ flexGrow: group.wins || 0 }} />
              <span className="draws" style={{ flexGrow: group.draws || 0 }} />
              <span className="losses" style={{ flexGrow: group.losses || 0 }} />
            </div>
            <div className="history-form-legend">
              <span><i className="wins" />{"VIT\u00d3RIAS \u00b7 "}{group.wins}</span>
              <span><i className="draws" />{"EMPATES \u00b7 "}{group.draws}</span>
              <span><i className="losses" />{"DERROTAS \u00b7 "}{group.losses}</span>
            </div>
            <div className="history-evolution" aria-label={`Edições de ${group.name}`}>
              {group.editions.map((edition) => <button type="button" className={`${campaignState(edition)} ${selected?.id === edition.id ? "selected" : ""}`} key={edition.id} onClick={() => setSelectedId(edition.id)} aria-pressed={selected?.id === edition.id}><i/><span>{edition.label}</span><small>{edition.outcome || edition.final_stage || "Encerrada"}</small></button>)}
            </div>
            {selected && <section className="history-edition-summary" aria-live="polite"><div><small>EDIÇÃO SELECIONADA</small><b>{selected.label}</b></div><strong>{selected.outcome || selected.final_stage || "Participação encerrada"}</strong><span>Nível da campanha · {selected.campaignLevel}%</span></section>}
            {selected && leaders && (
              <dl className="history-leaders" aria-label={`Destaques do Strix em ${selected.label}`}>
                <div><dt>Artilheiro</dt><dd>{leaders.topScorer ? <><b>{leaders.topScorer.names.join(" · ")}</b><span className="data-value">{leaders.topScorer.goals} {leaders.topScorer.goals === 1 ? "gol" : "gols"}</span></> : <em>{leaders.games ? "Nenhum gol registrado nas partidas importadas" : "Sem partidas importadas desta edição"}</em>}</dd></div>
                <div><dt>Melhor nota média</dt><dd>{leaders.bestRating ? <><b>{leaders.bestRating.names.join(" · ")}</b><span className="data-value">{leaders.bestRating.value.toFixed(1)}</span><small>mínimo de {leaders.bestRating.minimum} {leaders.bestRating.minimum === 1 ? "jogo" : "jogos"}</small></> : <em>{leaders.games ? "Sem notas registradas nas partidas importadas" : "Sem partidas importadas desta edição"}</em>}</dd></div>
              </dl>
            )}
          </article>
  );
}

function HistoryPanel({ editions, workspace }) {
  const groups = aggregateCompetitionHistory(editions);
  return (
    <section className="competition-section history-panel">
      <header>
        <div>
          <span>HISTÓRICO</span>
          <h2>Evolução do Strix</h2>
        </div>
      </header>
      {groups.length ? (
        groups.map((group) => <HistoryCompetitionCard group={group} workspace={workspace} key={group.competitionId} />)
      ) : (
        <p className="competition-empty">
          Nenhuma edição foi enviada ao histórico.
        </p>
      )}
    </section>
  );
}

function CompetitionExplorer({
  competition,
  edition,
  sources,
  fixtures,
  workspace,
  client,
  profile,
}) {
  const view = useMemo(
    () => deriveCompetitionView(sources, fixtures, edition),
    [sources, fixtures, edition],
  );
  // Each edition reopens on the section it was left on.
  const [tab, setTabState] = useState(() => readRemembered(`competition-tab:${edition?.id}`, "overview"));
  const setTab = (next) => {
    setTabState(next);
    writeRemembered(`competition-tab:${edition?.id}`, next);
  };
  const [busy, setBusy] = useState("");
  const [syncState, setSyncState] = useState("");
  const [error, setError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [outcome, setOutcome] = useState(
    edition?.outcome || "Participação encerrada",
  );
  const tabs = [
    ["overview", "Visão geral"],
    view.standings.groups?.length && ["standings", "Classificação"],
    ["games", "Jogos", view.upcoming.length || null],
    view.hasKnockout && ["knockout", "Mata-mata"],
    !view.hasKnockout &&
      view.standings.groups?.length && ["scenarios", "Cenários"],
  ].filter(Boolean);
  useEffect(() => {
    const remembered = readRemembered(`competition-tab:${edition?.id}`, "overview");
    setTabState(tabs.some(([id]) => id === remembered) ? remembered : "overview");
  }, [edition?.id]);
  const sync = async () => {
    const source = view.standingsSource || sources[0];
    if (!source) return;
    setBusy("Sincronizando");
    setSyncState("loading");
    setError("");
    try {
      const preview = await analyzeCompetition(client, source.source_url, { fresh: true });
      await saveCompetitionPreview(client, profile, preview, { editionId: edition.id });
      await workspace.refresh();
      setSyncState("success");
      notify(`${competition.name} atualizada.`);
      window.setTimeout(() => setSyncState(""), 1800);
    } catch (cause) {
      setError(cause.message);
      setSyncState("error");
      notify(`Erro ao atualizar ${competition.name}.`, "error");
      window.setTimeout(() => setSyncState(""), 2600);
    } finally {
      setBusy("");
    }
  };
  const endDetection = detectParticipationEnd({
    edition,
    fixtures: view.fixtures,
  });
  // When the end is certain, the archive preview opens already filled with what happened.
  useEffect(() => {
    if (!edition?.outcome && endDetection.ended && endDetection.outcome) setOutcome(endDetection.outcome);
  }, [edition?.id, endDetection.ended, endDetection.outcome]);
  // Participants as published by the provider: every distinct team across the standings groups.
  const participants = new Set((view.standings.groups || []).flatMap((group) => (group.standings || []).map((row) => row.team))).size;
  const isHistorical = edition?.status === "historical";
  const setQualificationSlots = async (qualificationSlots) => {
    setBusy("Salvando vagas");
    setError("");
    try {
      const { error: updateError } = await client
        .from("competition_editions")
        .update({
          qualification_slots: qualificationSlots,
          updated_by: profile.user_id,
        })
        .eq("id", edition.id);
      if (updateError) throw updateError;
      await workspace.refresh();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="competition-detail competition-inline">
      <CompetitionHero
        competition={competition}
        edition={edition}
        view={view}
        isHistorical={isHistorical}
        canSync={canManageCompetitions(profile) && Boolean(sources[0])}
        busy={!!busy}
        syncState={syncState}
        onSync={() => void sync()}
      />
      <ErrorNote message={error} onRetry={syncState === "error" || /atualiz|sincroniz|páginas|servidor/i.test(error) ? () => sync() : undefined} retryLabel="Atualizar de novo" />
      <CompetitionTabs items={tabs} active={tab} onChange={setTab} />
      {tab === "overview" && (
        <div className="motion-panel-enter competition-tab-panel" key="overview">
          <OverviewPanel competition={competition} edition={edition} view={view} participants={participants} goTo={setTab}>
            {canManageCompetitions(profile) && edition?.status !== "historical" && (
              <section className={`archive-callout${endDetection.ended ? " is-ended" : ""}`}>
                <div>
                  <span>{endDetection.ended ? "CAMPANHA ENCERRADA" : "ENCERRAMENTO"}</span>
                  <h2>{endDetection.outcome || "Enviar edição ao histórico"}</h2>
                  <p>{endDetection.ended ? "A participação do Strix nesta edição terminou. Envie ao Histórico para ela sair das ativas; nenhuma partida ou fonte será apagada." : "Nenhuma partida ou fonte será apagada."}</p>
                </div>
                <button onClick={() => setArchiveOpen(true)}>
                  ENVIAR PARA HISTÓRICO
                </button>
              </section>
            )}
          </OverviewPanel>
        </div>
      )}
      {tab === "standings" && (
        <div className="motion-panel-enter competition-tab-panel" key="standings">
          <StandingsPanel
            groups={view.standings.groups || []}
            slots={view.qualificationSlots}
            canEdit={canManageCompetitions(profile)}
            onSlotsChange={(value) => void setQualificationSlots(value)}
          />
        </div>
      )}
      {tab === "games" && (
        <div className="motion-panel-enter competition-tab-panel" key="games">
          <GamesPanel competition={competition} view={view} workspace={workspace} />
        </div>
      )}
      {tab === "knockout" && (
        <div className="motion-panel-enter competition-tab-panel" key="knockout">
        <Knockout view={view} />
        </div>
      )}
      {tab === "scenarios" && (
        <div className="motion-panel-enter competition-tab-panel" key="scenarios">
          <ScenariosPanel edition={edition} snapshot={view.standings} qualificationSlots={view.qualificationSlots} />
        </div>
      )}
      {archiveOpen && createPortal((
        <div className="competition-modal-layer" onMouseDown={(event) => event.target === event.currentTarget && setArchiveOpen(false)}>
          <section className="archive-preview">
            <span>PREVIEW DO HISTÓRICO</span>
            <h2>
              {competition.name} · {edition.label}
            </h2>
            <label>
              SITUAÇÃO FINAL
              <input
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
              />
            </label>
            <p>Jogos, classificação e fontes permanecem vinculados.</p>
            <footer>
              <button type="button" className="secondary archive-cancel" onClick={() => setArchiveOpen(false)}>CANCELAR</button>
              <button
                className="primary"
                onClick={async () => {
                  setBusy("Arquivando");
                  try {
                    await archiveCompetitionEdition(
                      client,
                      profile,
                      edition,
                      outcome,
                    );
                    await workspace.refresh();
                    setArchiveOpen(false);
                  } catch (cause) {
                    setError(cause.message);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                CONFIRMAR HISTÓRICO
              </button>
            </footer>
          </section>
        </div>
      ), document.body)}
    </section>
  );
}

export function CompetitionsPage({ profile, workspace, client }) {
  const [viewMode, setViewMode] = useRemembered("competition-view", "active", { allowed: ["active", "historical"] });
  // The competition being followed stays selected on this device.
  const [selectedEditionId, setSelectedEditionId] = useRemembered("competition-edition", "", { scope: "device" });
  const [modal, setModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const competitionEditions = Array.isArray(workspace.competitionEditions) ? workspace.competitionEditions : [];
  const competitions = Array.isArray(workspace.competitions) ? workspace.competitions : [];
  const competitionSources = Array.isArray(workspace.competitionSources) ? workspace.competitionSources : [];
  const competitionFixtures = Array.isArray(workspace.competitionFixtures) ? workspace.competitionFixtures : [];
  const available = useMemo(
    () =>
      competitionEditions
        .filter((edition) =>
          viewMode === "historical"
            ? edition.status === "historical"
            : edition.status !== "historical",
        )
        .map((edition) => ({
          edition,
          competition: competitions.find(
            (item) => item.id === edition.competition_id,
          ),
        }))
        .filter((item) => item.competition),
    [competitionEditions, competitions, viewMode],
  );
  // A direct link (/campeonatos/<edition id>) opens that edition, in whichever list it lives.
  const target = useDeepTarget("campeonatos");
  useEffect(() => {
    if (!target?.id) return;
    const edition = competitionEditions.find((item) => String(item.id) === target.id);
    if (!edition) return;
    setViewMode(edition.status === "historical" ? "historical" : "active");
    setSelectedEditionId(edition.id);
  }, [target?.id, competitionEditions.length]);
  useEffect(() => {
    if (!available.some((item) => item.edition.id === selectedEditionId))
      setSelectedEditionId(available[0]?.edition.id || "");
  }, [available, selectedEditionId]);
  const selectEdition = (id) => {
    setSelectedEditionId(id);
    openTarget("campeonatos", id);
  };
  const changeViewMode = (mode) => {
    setViewMode(mode);
    clearTarget("campeonatos");
  };
  const selected =
    available.find((item) => item.edition.id === selectedEditionId) ||
    available[0];
  const sources = competitionSources.filter(
    (source) => source.edition_id === selected?.edition.id,
  );
  const fixtures = competitionFixtures.filter(
    (fixture) => fixture.edition_id === selected?.edition.id,
  );
  const historicalEditions = competitionEditions
    .filter((edition) => edition.status === "historical")
    .map((edition) => ({
      ...edition,
      stats: competitionHistoryStats(edition, competitionFixtures.filter((fixture) => fixture.edition_id === edition.id)),
      competition: competitions.find(
        (competition) => competition.id === edition.competition_id,
      ),
    }));
  return (
    <section className="competitions-page page-enter">
      <PageHeader
        title="Competições."
        description="Temporadas, fases e confrontos oficiais do Strix."
        aside={<NextClubsSignature />}
        actions={<>
          {canManageCompetitions(profile) && (
            <button className="primary" onClick={() => setModal(true)}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>ADICIONAR CAMPEONATO
            </button>
          )}
        </>}
      />
      {workspace.schemaPending && (
        <p className="competition-warning">
          A estrutura de Competições ainda não está disponível.
        </p>
      )}
      <CompetitionTabs
        label="Estado das competições"
        items={[
          ["active", "Ativas", competitionEditions.filter((edition) => edition.status !== "historical").length || null],
          ["historical", "Histórico", competitionEditions.filter((edition) => edition.status === "historical").length || null],
        ]}
        active={viewMode}
        onChange={changeViewMode}
      />
      {available.length ? (
        <>
          <div
            className="competition-selector"
            aria-label="Selecionar competição"
          >
            {available.map(({ competition, edition }) => (
              <div className="competition-selector-item" key={edition.id}>
              <button className={selected?.edition.id === edition.id ? "active" : ""} aria-pressed={selected?.edition.id === edition.id} onClick={() => selectEdition(edition.id)}>
                <ClubLogo name={competition.name} url={competition.logo_url} className="competition-selector-logo" decorative />
                <div className="competition-selector-copy">
                  <b>{competition.name}</b>
                  <small>{edition.label}{competition.organization ? ` · ${competition.organization}` : ""}</small>
                </div>
              </button>
              {canManageCompetitions(profile) && <button type="button" className="competition-delete-trigger" aria-label={`Excluir ${competition.name} · ${edition.label}`} title="Excluir competição" onClick={() => setPendingDelete({ competition, edition })}><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button>}
              </div>
            ))}
          </div>
          {selected && (
            <CompetitionExplorer
              competition={selected.competition}
              edition={selected.edition}
              sources={sources}
              fixtures={fixtures}
              workspace={workspace}
              client={client}
              profile={profile}
            />
          )}
        </>
      ) : (
        <p className="competition-empty">Nenhuma competição nesta seção.</p>
      )}
      {viewMode === "historical" && (
        <HistoryPanel editions={historicalEditions} workspace={workspace} />
      )}
      {modal && (
        <ImportCompetitionModal
          client={client}
          profile={profile}
          workspace={workspace}
          close={() => setModal(false)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          kicker="EXCLUSÃO DEFINITIVA"
          title={`Excluir ${pendingDelete.competition.name}?`}
          confirmLabel="EXCLUIR COMPETIÇÃO"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await deleteCompetitionEdition(client, profile, pendingDelete.edition);
            await workspace.refresh();
            notify(`${pendingDelete.competition.name} excluída.`);
            setPendingDelete(null);
          }}
        >
          <p>A edição <b>{pendingDelete.edition.label}</b> e os dados do provider serão removidos. Partidas e Agenda permanecem, apenas sem o vínculo da competição.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
