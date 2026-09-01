"use client";

import { useState, useEffect } from "react";
import { getCategory, updateCategory, ApiError, type CategorySummary } from "@/lib/api";
import { SaveRow } from "./SettingsUI";

function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function PrepareCategoryPanel({
  categories,
  defaultCategoryId,
}: {
  categories: CategorySummary[];
  defaultCategoryId?: number;
}) {
  const [selected, setSelected] = useState<number | undefined>(defaultCategoryId ?? categories[0]?.id);
  const [subjectsText, setSubjectsText] = useState("");
  const [variationsText, setVariationsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultCategoryId) setSelected(defaultCategoryId);
  }, [defaultCategoryId]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    getCategory(selected)
      .then((cat) => {
        if (cancelled) return;
        setSubjectsText(cat.subjects.map((s) => s.name).join("\n"));
        setVariationsText(cat.variations.sort((a, b) => a.order - b.order).map((v) => v.text).join("\n"));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function handleSave() {
    if (!selected) return;
    setError(null);
    setSaving(true);
    try {
      const subjects = parseLines(subjectsText);
      const variations = parseLines(variationsText);
      if (subjects.length === 0 || variations.length === 0) {
        setError("Add at least one subject and one variation.");
        setSaving(false);
        return;
      }
      await updateCategory(selected, { subjects, variations });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save category setup");
    } finally {
      setSaving(false);
    }
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--pencil)" }}>
        Create a category first.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: "var(--pencil)" }}>
        Add the subjects and pose variations that guide every generated image.
      </p>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
          Category
        </label>
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(parseInt(e.target.value, 10))}
          className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm capitalize"
          style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="capitalize">
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Loading...
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Subjects
            </label>
            <textarea
              value={subjectsText}
              onChange={(e) => setSubjectsText(e.target.value)}
              rows={6}
              placeholder={"Car\nTruck\nAirplane"}
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
            <p className="mt-1 text-[10px]" style={{ color: "var(--pencil)" }}>
              One subject per line.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Variations
            </label>
            <textarea
              value={variationsText}
              onChange={(e) => setVariationsText(e.target.value)}
              rows={6}
              placeholder={"side view on a road\nfront three-quarter view"}
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
            <p className="mt-1 text-[10px]" style={{ color: "var(--pencil)" }}>
              One pose/variation per line.
            </p>
          </div>
        </div>
      )}

      <SaveRow onClick={handleSave} saving={saving} saved={saved} label="Save category setup" />
    </div>
  );
}
