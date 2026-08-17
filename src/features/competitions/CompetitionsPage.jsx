import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MatchDisplay } from "../../ui/MatchDisplay.jsx";
import { NextClubsSignature } from "../../ui/NextClubsBrand.jsx";
import { STRIX_BRAND } from "../../brand.js";
import {
  AnimatedNumber,
  MotionBadge,
  SegmentedControl,
  RollingLabel,
  notify,
} from "../../ui/motion/motion.jsx";
import { normalizeName } from "../matches/import-core.js";
import {
  aggregateCompetitionHistory,
  campaignState,
  competitionHistoryStats,
  detectParticipationEnd,
} from "./history-core.js";
import { calculateQualificationScenarios } from "./scenario-engine.js";
import {
  archiveCompetitionEdition,
  deleteCompetitionEdition,
  saveCompetitionPreview,
} from "./competition-storage.js";
import {
  deriveCompetitionView,
  qualificationState,
  reconcileCompetitionResults,
} from "./competition-core.js";
import { extractPalette } from "./palette-core.js";
import { sortBracketFixtures } from "../../../shared/bracket-slots.js";
import "./competitions.css";
import "./competitions-inline.css";

const fallbackPalettes = {
  ccb: ["#793cff", "#fab721", "#cf4cff", "#1b8cff"],
  lb_esports: ["#26c96f", "#00b7ff", "#ffd54a", "#754aff"],
};
const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "Nunca";
const canDevelop = (profile) => profile?.access_tier === "dev";

async function analyzeCompetition(client, url) {
  const { data } = await client.auth.getSession();
  const response = await fetch("/api/competitions/analyze", {
    method: "POST",
    headers: {
      authorization: `Bearer ${data.session?.access_token || ""}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(
      payload.message ||
        payload.error ||
        "Não foi possível analisar a competição.",
    );
  return payload.preview;
}

function ImportCompetitionModal({ client, profile, workspace, close }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [palette, setPalette] = useState([]);
  const [accent, setAccent] = useState("#168cff");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const analyze = async () => {
    setBusy("Analisando provider");
    setError("");
    try {
      const result = await analyzeCompetition(client, url);
      setPreview(result);
      const colors = await extractPalette(client, result.logo).catch(() => []);
      const next = colors.length
        ? colors
        : fallbackPalettes[result.provider] || ["#168cff"];
      setPalette(next);
      setAccent(next[0]);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  };
  const add = async () => {
    setBusy("Adicionando competição");
    setError("");
    try {
      await saveCompetitionPreview(client, profile, preview, palette, accent);
      await workspace.refresh();
      notify(`${preview.name || "Campeonato"} adicionado.`);
      close();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  };
  const relatedKnockout = preview?.relatedPreviews?.find(
    (item) => item.sourceKind === "knockout",
  );
  return createPortal((
    <div className="competition-modal-layer" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section
        className="competition-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar competição"
      >
        <header>
          <div>
            <span>DEV · PROVIDER EXTERNO</span>
            <h2>Adicionar campeonato</h2>
            <p>A análise procura classificação e mata-mata da mesma edição.</p>
          </div>
          <button onClick={close} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="competition-url-row">
          <label>
            URL DO CAMPEONATO
            <input
              autoFocus
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://ccbclubs.com.br/fifa.php?..."
            />
          </label>
          <button
            className="primary"
            disabled={!url || !!busy}
            onClick={() => void analyze()}
          >
            {busy || "ANALISAR"}
          </button>
        </div>
        {error && (
          <p className="competition-error" role="alert">
            {error}
          </p>
        )}
        {preview && (
          <section
            className="competition-import-preview"
            style={{ "--competition-accent": accent }}
          >
            <div className="competition-preview-hero">
              {preview.logo ? (
                <img src={preview.logo} alt="" />
              ) : (
                <span>{preview.name.slice(0, 2)}</span>
              )}
              <div>
                <small>
                  {preview.organization} · {preview.provider}
                </small>
                <h3>{preview.name}</h3>
                <p>
                  {relatedKnockout
                    ? `${relatedKnockout.knockout.currentStage} detectada`
                    : preview.type || preview.phase}
                </p>
              </div>
            </div>
            <dl>
              <div>
                <dt>Fase atual</dt>
                <dd>
                  {relatedKnockout?.knockout.currentStage || preview.phase}
                </dd>
              </div>
              <div>
                <dt>Grupos</dt>
                <dd>{preview.groups.length || "—"}</dd>
              </div>
              <div>
                <dt>Fontes</dt>
                <dd>{1 + (preview.relatedPreviews?.length || 0)}</dd>
              </div>
              <div>
                <dt>Atualização</dt>
                <dd>{dateTime(preview.fetchedAt)}</dd>
              </div>
            </dl>
            <div className="palette-picker">
              <span>ACCENT DA COMPETIÇÃO</span>
              <div>
                {palette.map((color) => (
                  <button
                    key={color}
                    className={accent === color ? "selected" : ""}
                    style={{ background: color }}
                    onClick={() => setAccent(color)}
                    aria-label={`Usar cor ${color}`}
                  />
                ))}
              </div>
            </div>
            <footer>
              <a href={preview.source} target="_blank" rel="noreferrer">
                ABRIR FONTE
              </a>
              <button
                className="primary"
                disabled={!!busy}
                onClick={() => void add()}
              >
                {busy || "ADICIONAR CAMPEONATO"}
              </button>
            </footer>
          </section>
        )}
      </section>
    </div>
  ), document.body);
}

function Standings({ groups, accent, slots, canEdit, onSlotsChange }) {
  const initial =
    groups.find((group) => group.isStrixGroup)?.name || groups[0]?.name;
  const [selected, setSelected] = useState(initial);
  useEffect(() => {
    if (!groups.some((group) => group.name === selected)) setSelected(initial);
  }, [groups, initial, selected]);
  const group = groups.find((item) => item.name === selected) || groups[0];
  if (!group)
    return (
      <p className="competition-empty">
        O provider ainda não publicou classificação.
      </p>
    );
  const appliedSlots =
    Number(group.qualificationSlots || group.qualification_slots || slots) ||
    null;
  return (
    <section className="competition-section">
      <header>
        <div>
          <span>CLASSIFICAÇÃO</span>
          <h2>{group.name}</h2>
          {appliedSlots && (
            <small className="qualification-legend">
              ZONA DE CLASSIFICAÇÃO · TOP {appliedSlots}
            </small>
          )}
        </div>
        <div className="standings-tools">
          {groups.length > 1 && (
            <nav>
              {groups.map((item) => (
                <button
                  className={item.name === group.name ? "active" : ""}
                  onClick={() => setSelected(item.name)}
                  key={item.name}
                >
                  {item.name}
                </button>
              ))}
            </nav>
          )}
          {canEdit && (
            <label>
              CLASSIFICAM
              <input
                type="number"
                min="1"
                max={group.standings.length}
                value={appliedSlots || ""}
                placeholder="—"
                onChange={(event) =>
                  onSlotsChange(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              />
            </label>
          )}
        </div>
      </header>
      <div className="standings-scroll">
        <div
          className="standings-table"
          role="table"
          style={{ "--competition-accent": accent }}
        >
          <header role="row">
            <span>#</span>
            <span>CLUBE</span>
            <span>P</span>
            <span>J</span>
            <span>V</span>
            <span>E</span>
            <span>D</span>
            <span>GP</span>
            <span>GC</span>
            <span>SG</span>
            <span>FORMA</span>
          </header>
          {group.standings.map((row) => {
            const inZone = appliedSlots && Number(row.position) <= appliedSlots;
            const boundary =
              appliedSlots && Number(row.position) === appliedSlots;
            return (
              <article
                role="row"
                className={`${row.isStrix ? "is-strix " : ""}${inZone ? "is-qualification-zone " : ""}${boundary ? "is-qualification-boundary" : ""}`}
                key={row.team}
              >
                <b>{row.position}</b>
                <div>
                  {row.logo ? (
                    <img src={row.logo} alt="" />
                  ) : (
                    <i>{row.team.slice(0, 2)}</i>
                  )}
                  <strong>
                    {row.team}
                    {row.isStrix && <small>STRIX</small>}
                  </strong>
                </div>
                <b>{row.points}</b>
                <span>{row.played}</span>
                <span>{row.wins}</span>
                <span>{row.draws}</span>
                <span>{row.losses}</span>
                <span>{row.goalsFor}</span>
                <span>{row.goalsAgainst}</span>
                <span>
                  {row.goalDifference > 0
                    ? `+${row.goalDifference}`
                    : row.goalDifference}
                </span>
                <div className="form-five">
                  {(row.form || []).map((form, index) => (
                    <i key={`${form}-${index}`} className={form.toLowerCase()}>
                      {form}
                    </i>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

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

function CompetitionGames({ competition, view, workspace, organization }) {
  const internal = workspace.matches.filter(
    (match) =>
      match.competition_id === competition.id ||
      (!match.competition_id &&
        normalizeName(match.competition_name) ===
          normalizeName(competition.name)),
  );
  const results = reconcileCompetitionResults(view.providerResults, internal);
  const internalOnly = internal.filter(
    (match) =>
      !results.some((fixture) => fixture.internalMatch?.id === match.id),
  );
  return (
    <div className="competition-games-stack">
      <section className="competition-section">
        <header>
          <div>
            <span>{organization || "FONTE OFICIAL"}</span>
            <h2>Próximos jogos do Strix</h2>
          </div>
        </header>
        {view.upcoming.length ? (
          <div className="competition-timeline" tabIndex="0">
            {view.upcoming.map((fixture) => (
              <article
                className="is-strix"
                key={fixture.external_match_id || fixture.externalMatchId}
              >
                <small>{fixture.round_label || "Próxima fase"}</small>
                <time>{dateTime(fixture.scheduled_at)}</time>
                <FixtureClubs fixture={fixture} />
                {fixture.agenda_match_id && <p>Agenda do clube conectada</p>}
              </article>
            ))}
          </div>
        ) : (
          <p className="competition-empty">
            {view.awaitingKnockout
              ? "Fase encerrada. Aguardando a publicação do mata-mata."
              : "Nenhum próximo confronto do Strix foi publicado pela fonte oficial."}
          </p>
        )}
      </section>
      <section className="competition-section">
        <header>
          <div>
            <span>RESULTADOS DO STRIX</span>
            <h2>Fonte oficial + histórico FC27</h2>
          </div>
        </header>
        {results.length || internalOnly.length ? (
          <div className="competition-results">
            {results.map((fixture) => (
              <article key={fixture.external_match_id}>
                <time>{dateTime(fixture.scheduled_at)}</time>
                <FixtureClubs fixture={fixture} />
                <small>
                  {fixture.internalMatch
                    ? "Dados FC27 reconciliados"
                    : organization || "Fonte oficial"}
                </small>
              </article>
            ))}
            {internalOnly.map((match) => (
              <article key={match.id}>
                <time>{dateTime(match.played_at)}</time>
                <FixtureClubs fixture={{
                  home_team_name: "STRIX UNITED",
                  away_team_name: match.opponent_name,
                  home_score: match.strix_score,
                  away_score: match.opponent_score,
                  home_logo: STRIX_BRAND.logo,
                  away_logo: match.opponent_logos?.storage_path
                    ? workspace.assetUrl(match.opponent_logos.storage_path)
                    : "",
                }} />
                <small>Histórico FC27</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="competition-empty">
            Nenhum resultado do Strix publicado ou reconciliado.
          </p>
        )}
      </section>
    </div>
  );
}

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

function Knockout({ view, accent }) {
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
      style={{ "--competition-accent": accent }}
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

function ScenarioPanel({ edition, snapshot, qualificationSlots }) {
  const group =
    snapshot?.groups?.find((item) => item.isStrixGroup) ||
    snapshot?.groups?.[0];
  if (!group || !qualificationSlots || !snapshot.fixtures?.length)
    return (
      <section className="competition-section scenario-panel">
        <header>
          <div>
            <span>CENÁRIOS</span>
            <h2>Classificação matemática</h2>
          </div>
        </header>
        <p className="competition-empty">
          Sem fixtures completas suficientes para calcular cenários confiáveis.
        </p>
      </section>
    );
  const result = calculateQualificationScenarios({
    standings: group.standings.map((row) => ({ name: row.team, ...row })),
    fixtures: snapshot.fixtures,
    qualificationSlots,
    tieBreakRules: edition.tie_break_rules || [],
  });
  return (
    <section className="competition-section scenario-panel">
      <header>
        <div>
          <span>CENÁRIOS</span>
          <h2>Para classificar</h2>
        </div>
      </header>
      <div className="scenario-metrics">
        <article>
          <small>POSIÇÃO</small>
          <b><AnimatedNumber id={`scenario-position-${edition.id}`} value={result.currentPosition} suffix="º" /></b>
        </article>
        <article>
          <small>DISTÂNCIA</small>
          <b>{result.tiedAtCutoff ? "Empatado" : `${result.distanceToCutoff} pts`}</b>
          {result.tiedAtCutoff && (
            <em className="scenario-context">
              Fora pelos critérios · corte {result.cutoffPosition}º
            </em>
          )}
        </article>
        <article>
          <small>JOGOS</small>
          <b><AnimatedNumber id={`scenario-games-${edition.id}`} value={result.remainingMatches} /></b>
        </article>
        <article>
          <small>DISPONÍVEIS</small>
          <b><AnimatedNumber id={`scenario-points-${edition.id}`} value={result.pointsAvailable} suffix=" pts" /></b>
        </article>
      </div>
    </section>
  );
}

function HistoryCompetitionCard({ group }) {
  const [selectedId, setSelectedId] = useState(group.editions.at(-1)?.id || "");
  const selected = group.editions.find((edition) => edition.id === selectedId) || group.editions.at(-1);
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
                <b>{group.efficiency}%</b>
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
          </article>
  );
}

function HistoryPanel({ editions }) {
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
        groups.map((group) => <HistoryCompetitionCard group={group} key={group.competitionId} />)
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
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState("");
  const [syncState, setSyncState] = useState("");
  const [error, setError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [outcome, setOutcome] = useState(
    edition?.outcome || "Participação encerrada",
  );
  useEffect(() => setTab("overview"), [edition?.id]);
  const tabs = [
    ["overview", "Visão geral"],
    view.standings.groups?.length && ["standings", "Classificação"],
    ["games", "Jogos"],
    view.hasKnockout && ["knockout", "Mata-mata"],
    !view.hasKnockout &&
      view.standings.groups?.length && ["scenarios", "Cenários"],
  ].filter(Boolean);
  const sync = async () => {
    const source = view.standingsSource || sources[0];
    if (!source) return;
    setBusy("Sincronizando");
    setSyncState("loading");
    setError("");
    try {
      const preview = await analyzeCompetition(client, source.source_url);
      await saveCompetitionPreview(
        client,
        profile,
        preview,
        competition.palette,
        competition.accent_color,
        { editionId: edition.id },
      );
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
  const strixStanding = view.standings.groups
    ?.flatMap((group) => group.standings || [])
    .find((row) => row.isStrix);
  const zone = qualificationState(strixStanding, view.qualificationSlots);
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
    <section
      className="competition-detail competition-inline"
      style={{ "--competition-accent": competition.accent_color }}
    >
      <header className="competition-detail-hero">
        {competition.logo_url ? (
          <img src={competition.logo_url} alt="" />
        ) : (
          <span>{competition.name.slice(0, 2)}</span>
        )}
        <div>
          <small>{competition.organization || "COMPETIÇÃO"}</small>
          <h1>{competition.name}</h1>
          <p>
            {edition?.label} · {view.currentStage}
          </p>
        </div>
        <aside>
          <span>ÚLTIMA ATUALIZAÇÃO</span>
          <b>{dateTime(view.lastSyncedAt)}</b>
          {canDevelop(profile) && sources[0] && (
            <button className="rolling-action" disabled={!!busy} onClick={() => void sync()}>
              {syncState ? <MotionBadge state={syncState} /> : <RollingLabel>ATUALIZAR</RollingLabel>}
            </button>
          )}
        </aside>
      </header>
      {error && <p className="competition-error">{error}</p>}
      <SegmentedControl className="competition-tabs" label="Seções da competição" items={tabs} active={tab} onChange={setTab} />
      {tab === "overview" && (
        <div className="motion-panel-enter competition-tab-panel" key="overview">
          <section className="competition-overview-grid">
            <article>
              <small>FASE ATUAL</small>
              <b>{view.currentStage}</b>
            </article>
            <article>
              <small>GRUPO ANTERIOR</small>
              <b>{view.standings.strixGroup || "—"}</b>
            </article>
            <article>
              <small>POSIÇÃO</small>
              <b>{strixStanding ? <AnimatedNumber id={`overview-position-${edition.id}`} value={strixStanding.position} suffix="º" /> : "—"}</b>
              {zone && <em className={zone.inside ? "inside" : "outside"}>{zone.label}</em>}
            </article>
            <article>
              <small>{view.strixFixture ? "FONTE DO CONFRONTO" : "PRÓXIMO CONFRONTO"}</small>
              <b>
                {view.strixFixture
                  ? competition.organization || view.standings.organization || "Provider oficial"
                  : view.awaitingKnockout
                    ? "Aguardando mata-mata"
                    : "A definir"}
              </b>
            </article>
          </section>
          {view.strixFixture && (
            <section className="provider-next-match">
              <span>{view.strixFixture.round_label} · {competition.organization || view.standings.organization || "FONTE OFICIAL"}</span>
              <FixtureClubs fixture={view.strixFixture} />
              <p>{dateTime(view.strixFixture.scheduled_at)}</p>
            </section>
          )}
          {view.awaitingKnockout && (
            <section className="competition-waiting">
              <span>PRÓXIMA FASE</span>
              <h2>Aguardando mata-mata</h2>
              <p>A fase atual terminou e a fonte oficial ainda não publicou o chaveamento.</p>
            </section>
          )}
          {canDevelop(profile) && edition?.status !== "historical" && (
            <section className="archive-callout">
              <div>
                <span>ENCERRAMENTO</span>
                <h2>{endDetection.outcome || "Enviar edição ao histórico"}</h2>
                <p>Nenhuma partida ou fonte será apagada.</p>
              </div>
              <button onClick={() => setArchiveOpen(true)}>
                ENVIAR PARA HISTÓRICO
              </button>
            </section>
          )}
        </div>
      )}
      {tab === "standings" && (
        <div className="motion-panel-enter competition-tab-panel" key="standings">
        <Standings
          groups={view.standings.groups || []}
          accent={competition.accent_color}
          slots={view.qualificationSlots}
          canEdit={canDevelop(profile)}
          onSlotsChange={(value) => void setQualificationSlots(value)}
        />
        </div>
      )}
      {tab === "games" && (
        <div className="motion-panel-enter competition-tab-panel" key="games">
        <CompetitionGames
          competition={competition}
          view={view}
          workspace={workspace}
          organization={competition.organization}
        />
        </div>
      )}
      {tab === "knockout" && (
        <div className="motion-panel-enter competition-tab-panel" key="knockout">
        <Knockout view={view} accent={competition.accent_color} />
        </div>
      )}
      {tab === "scenarios" && (
        <div className="motion-panel-enter competition-tab-panel" key="scenarios">
        <ScenarioPanel
          edition={edition}
          snapshot={view.standings}
          qualificationSlots={view.qualificationSlots}
        />
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
  const [viewMode, setViewMode] = useState("active");
  const [selectedEditionId, setSelectedEditionId] = useState("");
  const [modal, setModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const available = useMemo(
    () =>
      workspace.competitionEditions
        .filter((edition) =>
          viewMode === "historical"
            ? edition.status === "historical"
            : edition.status !== "historical",
        )
        .map((edition) => ({
          edition,
          competition: workspace.competitions.find(
            (item) => item.id === edition.competition_id,
          ),
        }))
        .filter((item) => item.competition),
    [workspace.competitionEditions, workspace.competitions, viewMode],
  );
  useEffect(() => {
    if (!available.some((item) => item.edition.id === selectedEditionId))
      setSelectedEditionId(available[0]?.edition.id || "");
  }, [available, selectedEditionId]);
  const selected =
    available.find((item) => item.edition.id === selectedEditionId) ||
    available[0];
  const sources = workspace.competitionSources.filter(
    (source) => source.edition_id === selected?.edition.id,
  );
  const fixtures = (workspace.competitionFixtures || []).filter(
    (fixture) => fixture.edition_id === selected?.edition.id,
  );
  const historicalEditions = workspace.competitionEditions
    .filter((edition) => edition.status === "historical")
    .map((edition) => ({
      ...edition,
      stats: competitionHistoryStats(edition, (workspace.competitionFixtures || []).filter((fixture) => fixture.edition_id === edition.id)),
      competition: workspace.competitions.find(
        (competition) => competition.id === edition.competition_id,
      ),
    }));
  return (
    <section className="competitions-page page-enter">
      <header className="data-page-header competitions-header">
        <div className="competitions-header-copy">
          <span>COMPETIÇÕES</span>
          <h1>Competições</h1>
          <p>Temporadas, fases e confrontos oficiais do Strix.</p>
        </div>
        <div className="competitions-header-actions">
          <NextClubsSignature />
          {canDevelop(profile) && (
            <button className="primary" onClick={() => setModal(true)}>
              + ADICIONAR CAMPEONATO
            </button>
          )}
        </div>
      </header>
      {workspace.schemaPending && (
        <p className="competition-warning">
          A estrutura de Competições ainda não está disponível.
        </p>
      )}
      <SegmentedControl
        className="competition-view-tabs"
        label="Estado das competições"
        items={[["active", "ATIVAS"], ["historical", "HISTÓRICO"]]}
        active={viewMode}
        onChange={setViewMode}
      />
      {available.length ? (
        <>
          <div
            className="competition-selector"
            aria-label="Selecionar competição"
          >
            {available.map(({ competition, edition }) => (
              <div className="competition-selector-item" key={edition.id} style={{ "--competition-accent": competition.accent_color }}>
              <button className={selected?.edition.id === edition.id ? "active" : ""} aria-pressed={selected?.edition.id === edition.id} onClick={() => setSelectedEditionId(edition.id)}>
                {competition.logo_url ? (
                  <img src={competition.logo_url} alt="" />
                ) : (
                  <span>{competition.name.slice(0, 2)}</span>
                )}
                <div className="competition-selector-copy">
                  <b>{competition.name}</b>
                  <small>{edition.label}</small>
                </div>
              </button>
              {canDevelop(profile) && <button type="button" className="competition-delete-trigger" aria-label={`Excluir ${competition.name} · ${edition.label}`} title="Excluir competição" onClick={() => { setDeleteError(""); setPendingDelete({ competition, edition }); }}>⌫</button>}
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
        <HistoryPanel editions={historicalEditions} />
      )}
      {modal && (
        <ImportCompetitionModal
          client={client}
          profile={profile}
          workspace={workspace}
          close={() => setModal(false)}
        />
      )}
      {pendingDelete && createPortal(<div className="competition-modal-layer" onMouseDown={(event) => event.target === event.currentTarget && setPendingDelete(null)}><section className="competition-delete-dialog" role="alertdialog" aria-modal="true"><span>EXCLUSÃO DEFINITIVA</span><h2>Excluir {pendingDelete.competition.name}?</h2><p>A edição <b>{pendingDelete.edition.label}</b> e os dados do provider serão removidos. Partidas e Agenda permanecem, apenas sem o vínculo da competição.</p>{deleteError && <p className="competition-error">{deleteError}</p>}<footer><button type="button" className="secondary" onClick={() => setPendingDelete(null)}>CANCELAR</button><button type="button" className="competition-danger" onClick={async () => { try { await deleteCompetitionEdition(client, profile, pendingDelete.edition); await workspace.refresh(); notify(`${pendingDelete.competition.name} excluída.`); setPendingDelete(null); } catch (cause) { setDeleteError(cause.message); } }}>EXCLUIR COMPETIÇÃO</button></footer></section></div>, document.body)}
    </section>
  );
}
