import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconDots, IconFileText, IconPencil, IconTrash } from "@tabler/icons-react";
import { motionMs } from "./motion/motion-tokens.js";
import "./action-menu.css";

const OPEN_EVENT = "strix-action-menu-open";
const ICONS = {
  dots: IconDots,
  edit: IconPencil,
  file: IconFileText,
  trash: IconTrash,
};

function placeMenu(trigger, menu) {
  const rect = trigger.getBoundingClientRect();
  const width = menu.offsetWidth || 198;
  const height = menu.offsetHeight || 52;
  const pad = 8;
  let top = rect.bottom + 6;
  let left = rect.right - width;
  if (left < pad) left = pad;
  if (left + width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - width - pad);
  if (top + height > window.innerHeight - pad) top = rect.top - height - 6;
  if (top < pad) top = pad;
  return { top, left };
}

export function ActionMenu({ label, items = [], className = "" }) {
  const id = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const closeTimer = useRef(0);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const visible = (open || leaving) && items.length > 0;

  const close = (immediate = false) => {
    window.clearTimeout(closeTimer.current);
    if (immediate || !open) {
      setOpen(false);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, motionMs("control"));
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onPeer = (event) => {
      if (event.detail !== id) close(true);
    };
    window.addEventListener(OPEN_EVENT, onPeer);
    return () => window.removeEventListener(OPEN_EVENT, onPeer);
  }, [open, id]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      close();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!visible) return undefined;
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return undefined;
    const update = () => setCoords(placeMenu(trigger, menu));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [visible, items.length]);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    setLeaving(false);
    setOpen(true);
  };

  return (
    <div ref={rootRef} className="action-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`action-menu-trigger ${className}`.trim()}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <IconDots size={18} stroke={1.75} aria-hidden="true" />
      </button>
      {visible && createPortal(
        <div
          ref={menuRef}
          className={`action-menu-popover${leaving ? " is-leaving" : ""}`}
          role="menu"
          style={{ top: coords.top, left: coords.left }}
        >
          {items.map((item) => {
            const Icon = ICONS[item.icon] || ICONS.dots;
            return (
              <button
                type="button"
                role="menuitem"
                className={item.tone === "danger" ? "is-danger" : ""}
                key={item.id || item.label}
                onClick={() => {
                  close(true);
                  item.onSelect?.();
                }}
              >
                <Icon size={16} stroke={1.75} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
