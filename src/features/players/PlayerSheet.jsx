import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "../../ui/useDialog.js";
import { motionMs } from "../../ui/motion/motion-tokens.js";
import { aggregatePlayerStatistics, buildPlayerProfileChoices } from "../statistics/statistics-core.js";
import { PlayerProfile } from "./PlayerProfile.jsx";
import "../statistics/statistics.css";
import "./player-sheet.css";

/**
 * The ficha of one roster player, opened from the Elenco. It reads the same
 * reconciled EA data as Estatísticas and adds nothing of its own.
 */
export function PlayerSheet({ rosterPlayer, workspace, actions = null, onClose }) {
  const [closing, setClosing] = useState(false);
  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, motionMs("modal"));
  };
  const dialogRef = useDialog(dismiss);
  const choices = useMemo(() => {
    const statistics = aggregatePlayerStatistics(workspace.matches, { players: workspace.players, aliases: workspace.aliases });
    return buildPlayerProfileChoices(statistics, workspace.players, workspace.aliases);
  }, [workspace.matches, workspace.players, workspace.aliases]);
  const player = choices.find((choice) => String(choice.playerId) === String(rosterPlayer?.id)) || null;
  return createPortal(
    <div className={`player-sheet-layer${closing ? " is-closing" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
      <section ref={dialogRef} tabIndex={-1} className="player-sheet" role="dialog" aria-modal="true" aria-label={`Ficha de ${rosterPlayer?.display_name || "jogador"}`}>
        {player
          ? <PlayerProfile player={player} players={choices} matches={workspace.matches} workspace={workspace} onClose={dismiss} />
          : <div className="player-sheet-empty"><h2>{rosterPlayer?.display_name}</h2><p>Este jogador ainda não tem atuações reconciliadas com a EA. A ficha aparece depois da primeira partida importada.</p></div>}
        {actions && <footer className="player-sheet-actions">{actions}</footer>}
      </section>
    </div>,
    document.body,
  );
}

export default PlayerSheet;
