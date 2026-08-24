"use client";

import { useState } from "react";
import { ChevronUp } from "lucide-react";

export const PAPER_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "A4 (595 × 842)", width: 595, height: 842 },
  { label: "US Letter (612 × 792)", width: 612, height: 792 },
  { label: "A5 (420 × 595)", width: 420, height: 595 },
  { label: "Square (800 × 800)", width: 800, height: 800 },
];

export const PRODUCT_NOUN_PRESETS = ["coloring page", "stencil", "icon", "sticker", "logo", "print"];

export function Field({
  label,
  hint,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-0.5" style={{ color: "var(--ink)" }}>
        {label}
      </label>
      <p className="text-[10px] mb-1.5" style={{ color: "var(--pencil)" }}>
        {hint}
      </p>
      <input
        type="number"
        value={value}
        step={step ?? 1}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full px-2.5 py-1.5 rounded-md border-[1.5px] outline-none text-xs"
        style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
      />
    </div>
  );
}

export function Card({
  title,
  description,
  children,
  tinted,
  collapsible,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tinted?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <section
        className="rounded-lg border-[1.5px] p-6"
        style={{ borderColor: "var(--pencil-light)", background: tinted ? "var(--paper)" : "var(--canvas)" }}
      >
        <h2 className="font-display text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
        {description && (
          <p className="text-sm mb-4" style={{ color: "var(--pencil)" }}>
            {description}
          </p>
        )}
        {children}
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border-[1.5px] overflow-hidden"
      style={{ borderColor: "var(--pencil-light)", background: tinted ? "var(--paper)" : "var(--canvas)" }}
    >
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-6 py-4 text-left">
        <h2 className="font-display text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
        <span
          className="text-sm transition-transform"
          style={{ color: "var(--pencil)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          {"\u25BE"}
        </span>
      </button>
      {open && (
        <div className="px-6 pb-6 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
          {description && (
            <p className="text-sm mb-4 mt-4" style={{ color: "var(--pencil)" }}>
              {description}
            </p>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

export function SaveRow({
  onClick,
  saving,
  saved,
  label,
}: {
  onClick: () => void;
  saving: boolean;
  saved: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mt-4 pt-3 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
      <button
        onClick={onClick}
        disabled={saving}
        className="px-3.5 py-1.5 rounded-md text-xs font-medium text-white disabled:opacity-60"
        style={{ background: "var(--teal)" }}
      >
        {saving ? "Saving..." : label ?? "Save"}
      </button>
      {saved && (
        <span className="text-[11px] font-medium" style={{ color: "var(--teal)" }}>
          Saved
        </span>
      )}
    </div>
  );
}

export function Panel({
  kicker,
  title,
  right,
  children,
  collapsible,
  defaultOpen = true,
  compact,
}: {
  kicker?: string;
  title: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (compact) {
    return (
      <div className="rounded-[13px] overflow-hidden" style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
        <button
          onClick={collapsible ? () => setOpen((v) => !v) : undefined}
          className="w-full flex items-center justify-between gap-4"
          style={{ padding: "16px 20px", cursor: collapsible ? "pointer" : "default", background: "transparent", border: 0 }}
        >
          <h2 className="text-[13px] font-bold m-0" style={{ color: "var(--ink)" }}>
            {title}
          </h2>
          <div className="flex items-center gap-3 shrink-0">
            {right}
            {collapsible && (
              <ChevronUp
                size={16}
                style={{ color: "var(--pencil)", transform: open ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}
              />
            )}
          </div>
        </button>
        {open && <div style={{ padding: "0 20px 20px" }}>{children}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-[13px]" style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)", padding: 22 }}>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          {kicker && (
            <p className="text-[10px] uppercase font-bold m-0 mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
              {kicker}
            </p>
          )}
          <h2 className="font-display font-normal m-0" style={{ fontSize: 24, letterSpacing: "-0.035em", color: "var(--ink)" }}>
            {title}
          </h2>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function PanelSection({
  label,
  defaultOpen,
  open: controlledOpen,
  onToggle,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function toggle() {
    if (isControlled) onToggle?.();
    else setInternalOpen((v) => !v);
  }

  return (
    <div className="pt-4 mt-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between text-xs font-bold"
        style={{ color: "var(--ink)" }}
      >
        {label}
        <span
          className="text-sm transition-transform"
          style={{ color: "var(--pencil)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          {"\u25BE"}
        </span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function SubCard({
  title,
  description,
  children,
  defaultOpen,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-md border-[1.5px] overflow-hidden" style={{ borderColor: "var(--pencil-light)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: "var(--paper)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </span>
        <span
          className="text-xs transition-transform"
          style={{ color: "var(--pencil)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          {"\u25BE"}
        </span>
      </button>
      {open && (
        <div className="p-4 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}>
          {description && (
            <p className="text-xs mb-3" style={{ color: "var(--pencil)" }}>
              {description}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}