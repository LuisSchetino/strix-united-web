import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { useDialog } from "../../ui/useDialog.js";
import "./required.css";

const TIER = { player: "Jogador", conselho: "Conselho", diretoria: "Diretoria", dev: "Desenvolvimento" };

/**
 * For the board: ties a site account to this roster entry (functions/api/internal/player-link.js).
 * Used when a member signed in under another name or declared the wrong player; his contract
 * and what he watched then show under the right name.
 */
export function AccountLink({ client, player, close, onLinked }) {
  const dialogRef = useDialog(close);
  const [state, setState] = useState({ status: "loading", accounts: [] });
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const call = async (init) => {
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    const response = await fetch("/api/internal/player-link", { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "player_link_unavailable");
    return payload;
  };
  useEffect(() => {
    call({}).then((payload) => {
      const accounts = (payload.accounts || []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      setState({ status: "ready", accounts });
      setChosen(accounts.find((account) => String(account.playerId) === String(player.id))?.userId || "");
    }).catch(() => setState({ status: "error", accounts: [] }));
  }, []);
  const linked = state.accounts.find((account) => String(account.playerId) === String(player.id));
  const save = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      // One account per roster entry: whoever held it before lets go.
      if (linked && linked.userId !== chosen) await call({ method: "POST", body: JSON.stringify({ userId: linked.userId, playerId: "" }) });
      if (chosen) await call({ method: "POST", body: JSON.stringify({ userId: chosen, playerId: String(player.id) }) });
      onLinked?.(chosen ? state.accounts.find((account) => account.userId === chosen)?.name || "" : "");
      close();
    } catch (cause) {
      setError(cause.message === "insufficient_permission" ? "Só a diretoria vincula conta." : "Não foi possível salvar o vínculo. Tente de novo.");
    } finally { setBusy(false); }
  };
  return createPortal(
    <div className="required-layer" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section ref={dialogRef} className="required-sheet required-picker" role="dialog" aria-modal="true" aria-labelledby="account-link-title">
        <header>
          <div>
            <small>CONTA DO SITE</small>
            <h2 id="account-link-title">Vincular conta a {player.display_name}</h2>
            <p>Escolha a conta do Discord que pertence a este jogador. O contrato assinado e os vídeos assistidos por essa conta passam a aparecer no nome dele.</p>
          </div>
          <CloseButton onClick={close} disabled={busy} />
        </header>
        <div className="required-picker-body">
          {state.status === "loading" && <p className="required-board-note">Lendo as contas…</p>}
          {state.status === "error" && <p className="required-board-note">Não foi possível ler as contas. Feche e tente de novo.</p>}
          <ul>
            {state.status === "ready" && [{ userId: "", name: "Nenhuma conta", tier: "" }, ...state.accounts].map((account) => (
              <li key={account.userId || "none"}>
                <label className={chosen === account.userId ? "is-on" : ""}>
                  <input type="radio" name="account-link" checked={chosen === account.userId} disabled={busy} onChange={() => setChosen(account.userId)} />
                  <span><b>{account.name}</b><small>{TIER[account.tier] || ""}{account.userId ? (account.signed ? " · contrato assinado" : " · ainda não assinou o contrato") : ""}{account.playerId && String(account.playerId) !== String(player.id) && account.playerId !== "none" ? " · já ligada a outro jogador" : ""}</small></span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <footer>
          <span role="status">{error || (busy ? "Salvando…" : "A pessoa precisa atualizar a página para ver a mudança.")}</span>
          <div className="required-picker-actions">
            <button type="button" className="secondary" onClick={close} disabled={busy}>CANCELAR</button>
            <button type="button" className="primary" onClick={save} disabled={busy || state.status !== "ready"}>SALVAR</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
