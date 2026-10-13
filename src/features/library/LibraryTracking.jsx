import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CloseButton } from "../../ui/CloseButton.jsx";
import { useDialog } from "../../ui/useDialog.js";
import {
  LIBRARY_CATEGORIES,
  PROGRESS_LABEL,
  librarySource,
  libraryThumbnail,
  memberTracking,
  primaryCategory,
  progressStatus,
} from "./library-core.js";

// Acompanhamento: membro → conteúdos → progresso. Every figure here is a
// library_view_progress row; a material without a row reads "Sem registro".

const accessLabel = (value) => value
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date(value)).replace(".", "").replace(",", " ·").toLocaleUpperCase("pt-BR")
  : "—";
const clock = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const rest = `${String(Math.floor((value % 3600) / 60)).padStart(hours ? 2 : 1, "0")}:${String(value % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${rest}` : rest;
};
/** Play time in words: "42 s", "3 min", "1 h 05 min". */
const duration = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  if (value < 60) return `${value} s`;
  const minutes = Math.round(value / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
};
const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR");
const categoryLabel = (id) => LIBRARY_CATEGORIES.find((category) => category.id === id)?.label || "Biblioteca";

/** The member's mark: photo (or initials) inside a ring that fills to the completed share. */
function ProgressRing({ name, avatar = "", done, total, size = 56 }) {
  const [failed, setFailed] = useState(false);
  const radius = size / 2 - 3;
  const length = 2 * Math.PI * radius;
  const share = total ? done / total : 0;
  return (
    <span className="tracking-ring" style={{ "--size": `${size}px` }} aria-hidden="true">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle className="tracking-ring-track" cx={size / 2} cy={size / 2} r={radius} />
        <circle className="tracking-ring-value" cx={size / 2} cy={size / 2} r={radius} strokeDasharray={length} style={{ "--offset": length * (1 - share), "--length": length }} />
      </svg>
      {avatar && !failed ? <img src={avatar} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <b>{initials(name)}</b>}
    </span>
  );
}

function MemberPanel({ member, items, close }) {
  const dialogRef = useDialog(close);
  const rows = useMemo(() => items.map((item) => {
    const row = member.rows.find((entry) => entry.item_id === item.id) || null;
    return { item, row, status: progressStatus(row, item), trackable: librarySource(item.source_url).trackable };
  }).sort((left, right) => String(right.row?.last_accessed_at || "").localeCompare(String(left.row?.last_accessed_at || ""))), [items, member]);
  return createPortal(
    <div className="tracking-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section ref={dialogRef} tabIndex={-1} className="tracking-panel" role="dialog" aria-modal="true" aria-labelledby="tracking-panel-title">
        <header className="tracking-panel-head">
          <ProgressRing name={member.name} avatar={member.avatar} done={member.completed} total={member.total} size={64} />
          <div>
            <h2 id="tracking-panel-title">{member.name}</h2>
            <p><b className="data-value">{member.completed}</b> de {member.total} concluídos · {member.opened} {member.opened === 1 ? "aberto" : "abertos"}{member.externalOpens > 0 ? ` · ${member.externalOpens}× em outra aba` : ""} · último acesso {accessLabel(member.lastAccess)}</p>
          </div>
          <CloseButton onClick={close} label="Fechar acompanhamento" />
        </header>
        <div className="tracking-panel-body">
          <section className="tracking-shelves" aria-label="Progresso por categoria">
            {member.byCategory.map((entry, index) => (
              <article key={entry.id} className="data-arrive" style={{ "--i": index }}>
                <img src={`/assets/library/${entry.id}.svg`} alt="" loading="lazy" decoding="async" />
                <div>
                  <b>{entry.label}</b>
                  <small><span className="data-value">{entry.done}</span>/{entry.total} concluídos</small>
                  <span className="data-meter" aria-hidden="true"><i style={{ "--value": entry.total ? entry.done / entry.total : 0 }} /></span>
                </div>
              </article>
            ))}
          </section>
          <ol className="tracking-contents">
            {rows.map(({ item, row, status, trackable }, index) => (
              <li key={item.id} className={`data-arrive is-${status}`} style={{ "--i": Math.min(index + member.byCategory.length, 14) }}>
                <img src={libraryThumbnail(item)} alt="" loading="lazy" decoding="async" />
                <div className="tracking-content-title">
                  <b>{item.title}</b>
                  <small>{categoryLabel(primaryCategory(item))}{item.duration_seconds ? ` · ${clock(item.duration_seconds)}` : ""}</small>
                </div>
                <div className="tracking-content-progress">
                  {row && trackable && (Number(row.progress_percent) > 0 || row.completed_at) ? <>
                    <strong className="data-value">{Math.round(Number(row.progress_percent) || 0)}%</strong>
                    <span className="data-meter" aria-hidden="true"><i style={{ "--value": (Number(row.progress_percent) || 0) / 100 }} /></span>
                  </> : status === "timed" ? <>
                    <strong className="data-value">{duration(row.watched_seconds)}</strong>
                    <small className="tracking-timed">no player</small>
                  </> : <strong className="is-quiet">{!row ? "—" : status === "external" ? "Fora do site" : trackable ? "Não iniciado" : "Só abriu"}</strong>}
                </div>
                <dl>
                  <div><dt>Status</dt><dd className={`tracking-status is-${status}`}>{PROGRESS_LABEL[status]}</dd></div>
                  <div><dt>Último acesso</dt><dd>{accessLabel(row?.last_accessed_at)}</dd></div>
                  {row && trackable && Number(row.progress_percent) > 0 && <div><dt>Parou em</dt><dd>{clock(row.last_position_seconds)}</dd></div>}
                  {row && trackable && Number(row.watched_seconds) > 0 && <div><dt>Tempo assistido</dt><dd>{duration(row.watched_seconds)}</dd></div>}
                  {Number(row?.external_open_count) > 0 && <div><dt>Em outra aba</dt><dd className="tracking-external">{row.external_open_count}× · {accessLabel(row.last_external_open_at)}</dd></div>}
                </dl>
              </li>
            ))}
          </ol>
          <p className="tracking-note">O percentual conta o tempo realmente reproduzido no player da Biblioteca: pular para a frente não conclui o vídeo. Vídeos do Google Drive não informam a posição; neles fica registrado o tempo com o player aberto depois do play. "Em outra aba" registra quando a pessoa saiu do site pelo player (por exemplo, o botão de abrir do Drive).</p>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function LibraryTracking({ items, progress }) {
  const members = useMemo(() => memberTracking(items, progress), [items, progress]);
  const [openId, setOpenId] = useState("");
  const open = members.find((member) => member.userId === openId) || null;
  if (!items.length) return <div className="library-empty">Nenhum material publicado ainda. O acompanhamento começa com o primeiro conteúdo.</div>;
  return (
    <section className="tracking" aria-label="Acompanhamento por membro">
      <p className="tracking-summary"><b className="data-value">{members.length}</b> {members.length === 1 ? "membro" : "membros"} com registro · <b className="data-value">{items.length}</b> materiais publicados</p>
      {members.length ? (
        <ul className="tracking-members">
          {members.map((member, index) => (
            <li key={member.userId} className="data-arrive" style={{ "--i": Math.min(index, 12) }}>
              <button type="button" onClick={() => setOpenId(member.userId)} aria-haspopup="dialog">
                <ProgressRing name={member.name} avatar={member.avatar} done={member.completed} total={member.total} />
                <span className="tracking-member-name"><b>{member.name}</b><small>Último acesso {accessLabel(member.lastAccess)}{member.externalOpens > 0 ? ` · ${member.externalOpens}× em outra aba` : ""}</small></span>
                <span className="tracking-member-score"><strong><span className="data-value">{member.completed}</span>/{member.total}</strong><small>concluídos</small></span>
                <span className="tracking-member-shelves" aria-hidden="true">{member.byCategory.slice(0, 4).map((entry) => <i key={entry.id} title={`${entry.label} ${entry.done}/${entry.total}`}><em>{entry.label}</em><span className="data-meter"><i style={{ "--value": entry.total ? entry.done / entry.total : 0 }} /></span></i>)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="tracking-empty">
          <b>Sem dados de progresso</b>
          <p>Ninguém abriu um material desde que o acompanhamento foi ativado. Cada abertura no player da Biblioteca cria o primeiro registro do membro.</p>
        </div>
      )}
      {open && <MemberPanel member={open} items={items} close={() => setOpenId("")} />}
    </section>
  );
}

