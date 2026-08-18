"use client";

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
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--ink)" }}>
        {label}
      </label>
      <p className="text-xs mb-1.5" style={{ color: "var(--pencil)" }}>
        {hint}
      </p>
      <input
        type="number"
        value={value}
        step={step ?? 1}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-40 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
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
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tinted?: boolean;
}) {
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
    <div className="flex items-center gap-3 mt-5 pt-4 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
      <button
        onClick={onClick}
        disabled={saving}
        className="px-5 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--teal)" }}
      >
        {saving ? "Saving..." : label ?? "Save"}
      </button>
      {saved && (
        <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
          Saved
        </span>
      )}
    </div>
  );
}
