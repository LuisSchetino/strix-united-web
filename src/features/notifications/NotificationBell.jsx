import React, { useEffect, useMemo, useRef, useState } from "react";
import { IconAward, IconBell, IconBooks, IconClock, IconMessageReport, IconShirtSport, IconSoccerField, IconSpeakerphone, IconTrophy } from "@tabler/icons-react";
import { useMinuteClock } from "../../ui/useMinuteClock.js";
import { agoLabel, markSeen, readSeen } from "./notifications-core.js";
import "./notifications.css";

const KIND_ICON = {
  notice: IconSpeakerphone,
  lineup: IconShirtSport,
  reschedule: IconClock,
  result: IconSoccerField,
  material: IconBooks,
  milestone: IconAward,
  competition: IconTrophy,
  problem: IconMessageReport,
};

/**
 * The bell in the top bar: what changed for whoever is signed in. The count is what this
 * device has not shown yet; opening the panel and closing it marks everything as seen.
 * Pressing a notice goes to the thing it is about.
 */
export function NotificationBell({ notices = [], onOpen }) {
  const now = useMinuteClock();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(window.localStorage));
  const root = useRef(null);
  const unread = useMemo(() => notices.filter((notice) => !seen.has(notice.key)), [notices, seen]);
  const close = () => {
    setOpen(false);
    setSeen(markSeen(window.localStorage, notices.map((notice) => notice.key)));
  };
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!root.current?.contains(event.target)) close(); };
    const onKey = (event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, notices]);
  const label = unread.length ? `Avisos: ${unread.length} ${unread.length === 1 ? "novo" : "novos"}` : "Avisos";
  return (
    <div className="notice-bell" ref={root}>
      <button type="button" data-tour="bell" className={`notice-bell-trigger${open ? " is-open" : ""}`} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <IconBell size={19} stroke={1.75} aria-hidden="true" />
        {unread.length > 0 && <b aria-hidden="true">{unread.length > 9 ? "9+" : unread.length}</b>}
      </button>
      {open && (
        <section className="notice-panel" role="dialog" aria-label="Avisos">
          <header>
            <h2>Avisos</h2>
            <p>{unread.length ? `${unread.length} ${unread.length === 1 ? "novo" : "novos"}` : "Tudo visto"}</p>
          </header>
          {notices.length ? (
            <ol>
              {notices.map((notice) => {
                const Glyph = KIND_ICON[notice.kind] || IconBell;
                return (
                  <li key={notice.key} className={seen.has(notice.key) ? "" : "is-new"}>
                    <button type="button" onClick={() => { close(); onOpen?.(notice.target); }}>
                      <i aria-hidden="true"><Glyph size={17} stroke={1.75} /></i>
                      <span><b>{notice.title}</b><small>{notice.text}</small></span>
                      <time dateTime={notice.at}>{agoLabel(notice.at, now)}</time>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : <p className="notice-empty">Nada novo por aqui. Escalação, horário que muda, resultado e material novo aparecem neste sino.</p>}
        </section>
      )}
    </div>
  );
}
