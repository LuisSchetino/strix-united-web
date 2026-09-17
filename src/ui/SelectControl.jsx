import React, { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconCheck } from "@tabler/icons-react";
import "./select-control.css";

const normalizeOptions = (options) => options.map((option) => Array.isArray(option)
  ? { value: option[0], label: option[1] }
  : option);

export function SelectControl({ value, options, onChange, label, className = "" }) {
  const root = useRef(null);
  const leaveTimer = useRef(0);
  const items = useMemo(() => normalizeOptions(options), [options]);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [highlighted, setHighlighted] = useState(() => Math.max(0, items.findIndex((item) => item.value === value)));
  const selected = items.find((item) => item.value === value) || items[0];
  const expanded = open || leaving;

  const close = (immediate = false) => {
    window.clearTimeout(leaveTimer.current);
    if (!open && !leaving) return;
    if (immediate) {
      setOpen(false);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    setOpen(false);
    leaveTimer.current = window.setTimeout(() => setLeaving(false), 150);
  };

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!root.current?.contains(event.target)) close();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        root.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setHighlighted(Math.max(0, items.findIndex((item) => item.value === value)));
  }, [items, value]);

  const choose = (item) => {
    onChange(item.value);
    close(true);
    root.current?.querySelector("button")?.focus();
  };
  const keyDown = (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setLeaving(false);
      setHighlighted((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(items[highlighted]); else { setLeaving(false); setOpen(true); }
    } else if (event.key === "Escape") {
      close();
    }
  };

  return (
    <div ref={root} className={`select-control ${className}`.trim()} onKeyDown={keyDown}>
      <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => open ? close() : (setLeaving(false), setOpen(true))}>
        <span>{selected?.label || "Selecionar"}</span><IconChevronDown size={15} stroke={1.75} aria-hidden="true" />
      </button>
      {expanded && <div className={`select-control-menu${leaving ? " is-leaving" : ""}`} role="listbox" aria-label={label}>
        {items.map((item, index) => <button type="button" role="option" aria-selected={item.value === value} className={index === highlighted ? "is-highlighted" : ""} key={item.value} onMouseEnter={() => setHighlighted(index)} onClick={() => choose(item)}>
          <span>{item.label}</span>{item.value === value && <IconCheck size={14} aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );
}
