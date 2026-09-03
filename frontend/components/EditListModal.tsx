"use client";

import { useState } from "react";
import { X, Plus, Trash2, ClipboardList, Rows3 } from "lucide-react";
import { updateCategory, ApiError, type Category } from "@/lib/api";

type Mode = "rows" | "paste";

export default function EditListModal({
  categoryId,
  kind,
  currentItems,
  onClose,
  onSaved,
}: {
  categoryId: number;
  kind: "subjects" | "variations";
  currentItems: string[];
  onClose: () => void;
  onSaved: (updated: Category) => void;
}) {
  const [mode, setMode] = useState<Mode>("rows");
  const [rows, setRows] = useState<string[]>(currentItems.length > 0 ? currentItems : [""]);
  const [pasteText, setPasteText] = useState(currentItems.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = kind === "subjects" ? "Subjects" : "Variations";
  const singular = kind === "subjects" ? "subject" : "variation";

  function updateRow(index: number, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? value : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, ""]);
  }
  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function switchMode(next: Mode) {
    if (next === "paste") {
      setPasteText(rows.map((r) => r.trim()).filter(Boolean).join("\n"));
    } else {
      const parsed = pasteText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      setRows(parsed.length > 0 ? parsed : [""]);
    }
    setMode(next);
  }

  async function handleSave() {
    setError(null);
    const items =
      mode === "rows"
        ? rows.map((r) => r.trim()).filter(Boolean)
        : pasteText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);

    if (items.length === 0) {
      setError(`Add at least one ${singular}.`);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCategory(categoryId, { [kind]: items });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to save ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(28,27,26,0.5)" }} onClick={onClose}>
      <div
        className="rounded-xl overflow-hidden"
        style={{ width: "min(520px, 100%)", maxHeight: "85vh", background: "var(--canvas)", border: "1px solid var(--pencil-light)", boxShadow: "0 20px 60px rgba(28,27,26,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
          <div>
            <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
              Edit
            </p>
            <p className="font-display font-normal m-0 mt-1" style={{ fontSize: 20, color: "var(--ink)" }}>
              {label}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 p-1 mx-6 mt-4 rounded-lg" style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
          <button
            onClick={() => switchMode("rows")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-bold"
            style={mode === "rows" ? { background: "var(--canvas)", color: "var(--teal-dark)", boxShadow: "0 2px 6px rgba(32,33,31,0.06)" } : { color: "var(--pencil)" }}
          >
            <Rows3 size={13} /> Rows
          </button>
          <button
            onClick={() => switchMode("paste")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-bold"
            style={mode === "paste" ? { background: "var(--canvas)", color: "var(--teal-dark)", boxShadow: "0 2px 6px rgba(32,33,31,0.06)" } : { color: "var(--pencil)" }}
          >
            <ClipboardList size={13} /> Paste a list
          </button>
        </div>

        <div className="p-6" style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {error && (
            <div className="mb-4 px-4 py-3 rounded-md text-sm" style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}>
              {error}
            </div>
          )}

          {mode === "rows" ? (
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                spellCheck={true}
                    value={row}
                    onChange={(e) => updateRow(i, e.target.value)}
                    placeholder={`${label.slice(0, -1)} ${i + 1}`}
                    className="flex-1 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                    style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                  />
                  <button
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-md shrink-0 disabled:opacity-30"
                    style={{ border: "1px solid var(--pencil-light)", color: "var(--coral-dark)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1.5 text-xs font-bold mt-1"
                style={{ color: "var(--teal)" }}
              >
                <Plus size={13} /> Add another row
              </button>
            </div>
          ) : (
            <div>
              <textarea
                spellCheck={true}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={10}
                placeholder={kind === "subjects" ? "Car\nTruck\nAirplane" : "side view on a road\nfront three-quarter view"}
                className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
              />
              <p className="mt-1.5 text-[10px]" style={{ color: "var(--pencil)" }}>
                One {singular} per line.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "var(--teal)" }}
          >
            {saving ? "Saving..." : `Save ${label.toLowerCase()}`}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-md text-sm font-medium" style={{ color: "var(--pencil)" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
