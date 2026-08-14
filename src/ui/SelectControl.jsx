import React, { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconCheck } from "@tabler/icons-react";
import "./select-control.css";

const normalizeOptions = (options) => options.map((option) => Array.isArray(option)
  ? { value: option[0], label: option[1] }
  : option);

export function SelectControl({ value, options, onChange, label, className = "" }) {
  const root = useRef(null);
  const items = useMemo(() => normalizeOptions(options), [options]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(() => Math.max(0, items.findIndex((item) => item.value === value)));
  const selected = items.find((item) => item.value === value) || items[0];

  useEffect(() => {
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    setHighlighted(Math.max(0, items.findIndex((item) => item.value === value)));
  }, [items, value]);

  const choose = (item) => {
    onChange(item.value);
    setOpen(false);
    root.current?.querySelector("button")?.focus();
  };
  const keyDown = (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(items[highlighted]); else setOpen(true);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className={`select-control ${className}`.trim()} onKeyDown={keyDown}>
      <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{selected?.label || "Selecionar"}</span><IconChevronDown size={15} aria-hidden="true" />
      </button>
      {open && <div className="select-control-menu" role="listbox" aria-label={label}>
        {items.map((item, index) => <button type="button" role="option" aria-selected={item.value === value} className={index === highlighted ? "is-highlighted" : ""} key={item.value} onMouseEnter={() => setHighlighted(index)} onClick={() => choose(item)}>
          <span>{item.label}</span>{item.value === value && <IconCheck size={14} aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );
}
