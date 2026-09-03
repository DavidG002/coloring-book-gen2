"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus } from "lucide-react";
import { getCategory, updateCategory, type CategorySummary, type Category } from "@/lib/api";
import EditListModal from "./EditListModal";

export default function PrepareCategoryPanel({
  categories,
  defaultCategoryId,
}: {
  categories: CategorySummary[];
  defaultCategoryId?: number;
}) {
  const [selected, setSelected] = useState<number | undefined>(defaultCategoryId ?? categories[0]?.id);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [variations, setVariations] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalKind, setEditModalKind] = useState<"subjects" | "variations" | null>(null);

  useEffect(() => {
    if (!defaultCategoryId) return;
    const timer = setTimeout(() => setSelected(defaultCategoryId), 0);
    return () => clearTimeout(timer);
  }, [defaultCategoryId]);

  function loadCategory(id: number) {
    setLoading(true);
    getCategory(id)
      .then((cat) => {
        const subjNames = cat.subjects.map((s) => s.name);
        const varTexts = cat.variations.sort((a, b) => a.order - b.order).map((v) => v.text);
        setSubjects(subjNames);
        setVariations(varTexts);
        setSelectedSubject(subjNames[0] ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => loadCategory(selected), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function handleListSaved(updated: Category) {
    setSubjects(updated.subjects.map((s) => s.name));
    setVariations(updated.variations.sort((a, b) => a.order - b.order).map((v) => v.text));
  }

  async function handleRemoveSubject(subject: string) {
    if (!selected) return;
    const next = subjects.filter((s) => s !== subject);
    setSubjects(next);
    try {
      await updateCategory(selected, { subjects: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove subject");
    }
  }

  async function handleRemoveVariation(variation: string) {
    if (!selected) return;
    const next = variations.filter((v) => v !== variation);
    setVariations(next);
    try {
      await updateCategory(selected, { variations: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove variation");
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
        <div className="grid grid-cols-2 rounded-lg overflow-hidden" style={{ border: "1px solid var(--pencil-light)" }}>
          <div style={{ padding: 16, borderRight: "1px solid var(--pencil-light)" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-display font-normal m-0" style={{ fontSize: 15, color: "var(--ink)" }}>
                  Subjects
                </h4>
                <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>
                  {subjects.length} available
                </p>
              </div>
              <button
                onClick={() => setEditModalKind("subjects")}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold"
                style={{ border: "1px solid var(--pencil-light)", color: "var(--teal)" }}
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {subjects.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--pencil)" }}>
                No subjects yet.
              </p>
            ) : (
              subjects.map((subject) => {
                const active = selectedSubject === subject;
                return (
                  <div
                    key={subject}
                    className="flex items-center gap-1 mt-1.5 rounded-lg"
                    style={{
                      border: `1px solid ${active ? "#c9ddd2" : "transparent"}`,
                      background: active ? "var(--teal-tint)" : "transparent",
                    }}
                  >
                    <button
                      onClick={() => handleRemoveSubject(subject)}
                      className="shrink-0 flex items-center justify-center"
                      style={{ width: 26, height: 26, marginLeft: 4, color: "var(--pencil)" }}
                      title={`Remove ${subject}`}
                    >
                      <Trash2 size={12} />
                    </button>
                    <button
                      onClick={() => setSelectedSubject(subject)}
                      className="flex-1 flex items-center justify-between text-left text-xs"
                      style={{ padding: "9px 8px 9px 0", color: active ? "var(--teal-dark)" : "var(--ink)" }}
                    >
                      <span className="capitalize">{subject}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ padding: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-display font-normal m-0" style={{ fontSize: 15, color: "var(--ink)" }}>
                  Variations
                </h4>
                <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>
                  {variations.length} available
                </p>
              </div>
              <button
                onClick={() => setEditModalKind("variations")}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold"
                style={{ border: "1px solid var(--pencil-light)", color: "var(--teal)" }}
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {variations.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--pencil)" }}>
                No variations yet.
              </p>
            ) : (
              variations.map((variation) => (
                <div
                  key={variation}
                  className="flex items-center gap-2 py-2 text-xs"
                  style={{ borderBottom: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
                >
                  <span className="flex-1">{variation}</span>
                  <button
                    onClick={() => handleRemoveVariation(variation)}
                    className="shrink-0"
                    style={{ color: "var(--pencil)", padding: 3 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {editModalKind && selected && (
        <EditListModal
          categoryId={selected}
          kind={editModalKind}
          currentItems={editModalKind === "subjects" ? subjects : variations}
          onClose={() => setEditModalKind(null)}
          onSaved={handleListSaved}
        />
      )}
    </div>
  );
}
