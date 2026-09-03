"use client";

import { useState, useEffect } from "react";
import { X, Maximize2 } from "lucide-react";

export default function ExpandableTextModal({
  label,
  value,
  onChange,
  onSave,
  saving,
  saved,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: (value: string) => void;
  saving: boolean;
  saved: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setDraft(value), 0);
    return () => clearTimeout(timer);
  }, [open, value]);

  function handleSave() {
    onChange(draft);
    onSave(draft);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-6 h-6 flex items-center justify-center rounded-md shrink-0"
        style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
        title={`Expand ${label}`}
      >
        <Maximize2 size={11} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(28,27,26,0.5)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-xl overflow-hidden flex flex-col"
            style={{ width: "min(640px, 100%)", maxHeight: "80vh", background: "var(--canvas)", border: "1px solid var(--pencil-light)", boxShadow: "0 20px 60px rgba(28,27,26,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
              <p className="font-display font-normal m-0" style={{ fontSize: 20, color: "var(--ink)" }}>
                {label}
              </p>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="p-6 flex-1" style={{ overflowY: "auto" }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                spellCheck={true}
                autoFocus
                rows={14}
                className="w-full px-4 py-3 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
                style={{ borderColor: "var(--pencil-light)", background: "var(--paper)", color: "var(--ink)", resize: "vertical" }}
              />
            </div>

            <div className="flex items-center gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "var(--teal)" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {saved && (
                <span className="text-sm font-medium" style={{ color: "var(--teal)" }}>
                  Saved
                </span>
              )}
              <button onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-md text-sm font-medium ml-auto" style={{ color: "var(--pencil)" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
