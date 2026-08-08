import React, { forwardRef, useMemo, useRef } from "react";
import { STORY_SIZE, clamp } from "./defaults.js";

function AssetImage({ src, alt, className = "" }) {
  return src ? (
    <img
      className={className}
      src={src}
      alt={alt}
      draggable="false"
      crossOrigin="anonymous"
    />
  ) : null;
}

function EditableLayer({
  layer,
  selected,
  onSelect,
  onChange,
  children,
  className = "",
  exportMode,
}) {
  const pointer = useRef(null);
  if (!layer?.visible) return null;
  const start = (event) => {
    if (exportMode || layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(layer.id);
    pointer.current = {
      x: event.clientX,
      y: event.clientY,
      ox: layer.x,
      oy: layer.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    if (!pointer.current || exportMode || layer.locked) return;
    const ratio =
      STORY_SIZE.width /
      Math.max(
        1,
        event.currentTarget.closest(".gameday-story")?.getBoundingClientRect()
          .width || STORY_SIZE.width,
      );
    onChange(layer.id, {
      x: Math.round(
        pointer.current.ox + (event.clientX - pointer.current.x) * ratio,
      ),
      y: Math.round(
        pointer.current.oy + (event.clientY - pointer.current.y) * ratio,
      ),
    });
  };
  const end = () => {
    pointer.current = null;
  };
  return (
    <div
      className={`gd-layer ${className} ${selected && !exportMode ? "is-selected" : ""}`}
      data-layer-id={layer.id}
      style={{
        left: layer.x,
        top: layer.y,
        opacity: layer.opacity,
        zIndex: layer.zIndex,
        transform: `rotate(${layer.rotation}deg) scale(${layer.flipX ? -layer.scale : layer.scale},${layer.scale})`,
        filter: `brightness(${layer.brightness || 100}%) contrast(${layer.contrast || 100}%) saturate(${layer.saturation || 100}%)`,
      }}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {children}
      {selected && !exportMode && !layer.locked && (
        <span className="gd-selection-label">ARRASTE</span>
      )}
    </div>
  );
}

export const GameDayCanvas = forwardRef(function GameDayCanvas(
  {
    project,
    selectedId,
    onSelect,
    onLayerChange,
    exportMode = false,
    format = "story",
  },
  ref,
) {
  const visual = project.visualSettings;
  const players = useMemo(
    () => [...project.players].sort((a, b) => a.zIndex - b.zIndex),
    [project.players],
  );
  const competitionLogos = (project.competitionLogos || []).slice(0, 5);
  const dailyGames = (project.dailyGames || []).slice(0, 6);
  const time = project.matchTime.replace(":", "H");
  const selectBlank = () => !exportMode && onSelect("");
  return (
    <div
      ref={ref}
      className={`gameday-story ${project.mode === "agenda" ? "is-agenda-mode" : "is-group-mode"} ${players.length ? "has-legacy-players" : "is-player-free"} ${format === "feed" ? "is-feed" : ""} ${exportMode ? "is-exporting" : ""}`}
      style={{
        "--gd-blue": visual.primaryColor,
        "--gd-blue-deep": visual.secondaryColor,
        "--texture": visual.textureIntensity / 100,
        "--brush": visual.brushIntensity / 100,
        "--noise": visual.noiseIntensity / 100,
      }}
      onPointerDown={selectBlank}
    >
      <div className="gd-paper" />
      <div className="gd-noise" />
      <div className="gd-black-swipe gd-black-top" />
      <div className="gd-blue-brush gd-brush-top" />
      <div className="gd-blue-brush gd-brush-bottom" />
      {visual.showVerticalText && (
        <div className="gd-vertical-copy">
          GAME
          <br />
          DAY
          <br />
          GAME
          <br />
          DAY
        </div>
      )}
      {visual.showTape && (
        <>
          <div className="gd-tape gd-tape-left" />
          <div className="gd-tape gd-tape-right" />
        </>
      )}

      <EditableLayer
        layer={project.elements.headerTeam}
        selected={selectedId === "header-team"}
        onSelect={onSelect}
        onChange={onLayerChange}
        className="gd-header-team"
        exportMode={exportMode}
      >
        <strong>
          {project.topTeamName.split("\n").map((line, index) => (
            <React.Fragment key={line + index}>
              {line}
              {index === 0 && <br />}
            </React.Fragment>
          ))}
        </strong>
      </EditableLayer>
      <EditableLayer
        layer={project.elements.championship}
        selected={selectedId === "championship"}
        onSelect={onSelect}
        onChange={onLayerChange}
        className="gd-championship"
        exportMode={exportMode}
      >
        {competitionLogos.length ? (
          <div className="gd-championship-logos">
            {competitionLogos.map((logo) => (
              <span key={logo.id} title={logo.name}>
                {logo.url ? (
                  <AssetImage src={logo.url} alt={logo.name} />
                ) : (
                  <b>{String(logo.name || "C").slice(0, 2)}</b>
                )}
              </span>
            ))}
          </div>
        ) : project.championshipLogo ? (
          <AssetImage
            src={project.championshipLogo}
            alt={project.championshipName}
          />
        ) : (
          <>
            <span className="gd-ball-mark" aria-hidden="true" />
            <strong>{project.championshipName}</strong>
          </>
        )}
      </EditableLayer>
      <EditableLayer
        layer={project.elements.season}
        selected={selectedId === "season"}
        onSelect={onSelect}
        onChange={onLayerChange}
        className="gd-season"
        exportMode={exportMode}
      >
        <strong>{project.season}</strong>
      </EditableLayer>

      {players.length > 0 && (
        <>
          <div className="gd-collage-back" />
          <div className="gd-torn-paper gd-tear-left" />
          <div className="gd-torn-paper gd-tear-right" />
        </>
      )}
      {players.map((player) => (
        <EditableLayer
          key={player.id}
          layer={player}
          selected={selectedId === player.id}
          onSelect={onSelect}
          onChange={onLayerChange}
          className={`gd-player gd-player-${player.role}`}
          exportMode={exportMode}
        >
          {player.activeUrl ? (
            <AssetImage src={player.activeUrl} alt={player.name} />
          ) : (
            <div className="gd-player-placeholder">
              <span>
                {player.role === "main"
                  ? "PRINCIPAL"
                  : player.role === "left"
                    ? "ESQUERDO"
                    : "DIREITO"}
              </span>
              <b>FOTO DO JOGADOR</b>
            </div>
          )}
        </EditableLayer>
      ))}

      {players.length > 0 &&
        project.uniform.enabled &&
        project.uniform.assetUrl && (
          <div
            className="gd-uniform-layer"
            style={{
              left: project.uniform.x,
              top: project.uniform.y,
              opacity: project.uniform.opacity / 100,
              transform: `rotate(${project.uniform.rotation}deg) skew(${project.uniform.skewX}deg,${project.uniform.skewY}deg) scale(${project.uniform.scale})`,
              clipPath: `inset(${project.uniform.clipTop}% ${project.uniform.clipRight}% ${project.uniform.clipBottom}% ${project.uniform.clipLeft}%)`,
            }}
          >
            <AssetImage
              src={project.uniform.assetUrl}
              alt="Camada ajustável do uniforme"
            />
          </div>
        )}

      <EditableLayer
        layer={project.elements.timeCard}
        selected={selectedId === "time-card"}
        onSelect={onSelect}
        onChange={onLayerChange}
        className="gd-time-card"
        exportMode={exportMode}
      >
        <div className="gd-time-paper">
          <AssetImage src={project.teamLogo} alt="Strix United" />
        </div>
        <div className="gd-time-blue">
          <small>{project.timePrefix}</small>
          <strong>{time}</strong>
        </div>
      </EditableLayer>
      {visual.showStamp && (
        <EditableLayer
          layer={project.elements.stamp}
          selected={selectedId === "stamp"}
          onSelect={onSelect}
          onChange={onLayerChange}
          className="gd-stamp"
          exportMode={exportMode}
        >
          <span>STRIX UNITED</span>
          <b className="gd-stamp-star" aria-hidden="true">
            S
          </b>
          <small>DESDE 2020 · A UNIÃO FAZ A FORÇA</small>
        </EditableLayer>
      )}

      <EditableLayer
        layer={project.elements.mainLogo}
        selected={selectedId === "main-logo"}
        onSelect={onSelect}
        onChange={onLayerChange}
        className="gd-main-logo"
        exportMode={exportMode}
      >
        <AssetImage src={project.teamLogo} alt="Logo oficial do Strix United" />
      </EditableLayer>

      {project.mode === "group" && (
        <EditableLayer
          layer={project.elements.group}
          selected={selectedId === "group"}
          onSelect={onSelect}
          onChange={onLayerChange}
          className="gd-group"
          exportMode={exportMode}
        >
          <h3>{project.groupTitle}</h3>
          <div>
            {project.groupTeams.map((team, index) => (
              <article key={team.id}>
                <span className="gd-group-logo">
                  {team.logoUrl ? (
                    <AssetImage
                      src={team.logoUrl}
                      alt={`Escudo ${team.name}`}
                    />
                  ) : (
                    <b>
                      {team.name
                        .split(/\s+/)
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </b>
                  )}
                </span>
                <strong>{team.name}</strong>
                <small>0{index + 1}</small>
              </article>
            ))}
          </div>
        </EditableLayer>
      )}
      {project.mode === "agenda" && (
        <EditableLayer
          layer={project.elements.dailyGames}
          selected={selectedId === "daily-games"}
          onSelect={onSelect}
          onChange={onLayerChange}
          className="gd-daily-games"
          exportMode={exportMode}
        >
          <header>
            <span>JOGOS</span>
            <strong>DO DIA</strong>
            <small>
              {project.matchDate.split("-").reverse().slice(0, 2).join("/")}
            </small>
          </header>
          <div>
            {dailyGames.length ? (
              dailyGames.map((game, index) => (
                <article key={game.id || `${game.time}-${index}`}>
                  <time>{String(game.time || "--:--").replace(":", "H")}</time>
                  <span>
                    {game.opponentLogo ? (
                      <AssetImage src={game.opponentLogo} alt={game.opponent} />
                    ) : (
                      <b>
                        {String(game.opponent || "?")
                          .split(/\s+/)
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </b>
                    )}
                  </span>
                  <div>
                    <strong>{game.opponent || "ADVERSÁRIO"}</strong>
                    <small>{game.competition || "AMISTOSO"}</small>
                  </div>
                </article>
              ))
            ) : (
              <p>Nenhum jogo na Agenda para esta data.</p>
            )}
          </div>
        </EditableLayer>
      )}

      <footer className="gd-footer">
        <strong>
          {project.footerLeft.split("\n").map((line) => (
            <span key={line}>{line}</span>
          ))}
        </strong>
        <b>{project.footerCenter}</b>
        <strong>
          {project.footerRight.split("\n").map((line) => (
            <span key={line}>{line}</span>
          ))}
        </strong>
      </footer>
      {!exportMode && visual.showGuides && selectedId && (
        <>
          <i className="gd-guide-x" />
          <i className="gd-guide-y" />
        </>
      )}
    </div>
  );
});

export function LayerControls({
  layer,
  onChange,
  onReset,
  onDuplicate,
  canDelete,
  onDelete,
}) {
  if (!layer)
    return (
      <p className="gd-empty-help">
        Clique em uma foto, logo, horário ou grupo no preview para ajustar a
        camada.
      </p>
    );
  const field = (label, key, min, max, step = 1) => (
    <label>
      <span>
        {label}
        <output>{layer[key]}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={layer[key]}
        onChange={(e) => onChange({ [key]: clamp(e.target.value, min, max) })}
      />
    </label>
  );
  return (
    <div className="gd-layer-controls">
      {field("Posição X", "x", -200, 1080)}
      {field("Posição Y", "y", -200, 1920)}
      {field("Escala", "scale", 0.25, 2.5, 0.01)}
      {field("Rotação", "rotation", -30, 30)}
      {field("Opacidade", "opacity", 0, 1, 0.01)}
      {"brightness" in layer && field("Brilho", "brightness", 40, 160)}
      {"contrast" in layer && field("Contraste", "contrast", 40, 180)}
      {"saturation" in layer && field("Saturação", "saturation", 0, 180)}
      <div className="gd-inline-actions">
        <button type="button" onClick={() => onChange({ flipX: !layer.flipX })}>
          Espelhar
        </button>
        <button
          type="button"
          onClick={() => onChange({ locked: !layer.locked })}
        >
          {layer.locked ? "Desbloquear" : "Bloquear"}
        </button>
        <button type="button" onClick={onReset}>
          Restaurar
        </button>
        {onDuplicate && (
          <button type="button" onClick={onDuplicate}>
            Duplicar
          </button>
        )}
        {canDelete && (
          <button className="danger" type="button" onClick={onDelete}>
            Remover
          </button>
        )}
      </div>
    </div>
  );
}
