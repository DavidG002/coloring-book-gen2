"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, Minimize2, Maximize2 } from "lucide-react";
import { getCategory, updateCategory, type CategorySummary, type Category } from "@/lib/api";
import EditListModal from "./EditListModal";

export default function PrepareCategoryPanel({
  categories,
  selectedCategoryId,
}: {
  categories: CategorySummary[];
  selectedCategoryId?: number;
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalKind, setEditModalKind] = useState<"subjects" | "variations" | null>(null);
  const [listsExpanded, setListsExpanded] = useState(false);

  function loadCategory(id: number) {
    setLoading(true);
    getCategory(id)
      .then((cat) => {
        setCategory(cat);
        setSelectedSubject(cat.subjects[0]?.name ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!selectedCategoryId) {
      const timer = setTimeout(() => {
        setCategory(null);
        setSelectedSubject("");
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => loadCategory(selectedCategoryId), 0);
    return () => clearTimeout(timer);
  }, [selectedCategoryId]);

  function handleListSaved(updated: Category) {
    setCategory(updated);
  }

  const subjects = category?.subjects.map((s) => s.name) ?? [];
  const selectedSubjectId = category?.subjects.find((s) => s.name === selectedSubject)?.id;
  const variations = (category?.variations ?? [])
    .filter((v) => v.subject_id === selectedSubjectId)
    .sort((a, b) => a.order - b.order)
    .map((v) => v.text);

  async function handleRemoveSubject(subject: string) {
    if (!selectedCategoryId) return;
    const next = subjects.filter((s) => s !== subject);
    try {
      const updated = await updateCategory(selectedCategoryId, { subjects: next });
      setCategory(updated);
      if (selectedSubject === subject) setSelectedSubject(updated.subjects[0]?.name ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove subject");
    }
  }

  async function handleRemoveVariation(variation: string) {
    if (!selectedCategoryId || !selectedSubjectId) return;
    const next = variations.filter((v) => v !== variation);
    try {
      const updated = await updateCategory(selectedCategoryId, { variations: next, variations_subject_id: selectedSubjectId });
      setCategory(updated);
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

      {loading ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Loading...
        </p>
      ) : (
        <>
        <div className="grid relative rounded-lg" style={{ gridTemplateColumns: "minmax(160px, 0.8fr) 1.6fr", border: "1px solid var(--pencil-light)", background: "#eef2f5cd" }}>
          <div
            className="absolute flex items-center justify-center"
            style={{ gridColumn: "1 / 2", justifySelf: "end", bottom: -13, width: 26, height: 26, position: "absolute", right: -13, zIndex: 10 }}
          >
            <button
              onClick={() => setListsExpanded((v) => !v)}
              className="flex items-center justify-center rounded-full w-full h-full"
              style={{ background: "var(--canvas)", border: "1px solid var(--pencil-light)", color: "var(--pencil)", boxShadow: "0 2px 6px rgba(28,27,26,0.12)" }}
              title={listsExpanded ? "Collapse" : "Expand"}
            >
              {listsExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
          <div className="rounded-l-lg overflow-hidden" style={{ padding: 16, borderRight: "1px solid var(--pencil-light)" }}>
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
            <div className="overflow-y-auto pr-1" style={{ maxHeight: listsExpanded ? 520 : 260, transition: "max-height 0.2s ease" }}>
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
          </div>

          <div className="rounded-r-lg overflow-hidden" style={{ padding: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-display font-normal m-0" style={{ fontSize: 15, color: "var(--ink)" }}>
                  Variations
                </h4>
                <p className="text-[10px] m-0 mt-0.5 capitalize" style={{ color: "var(--pencil)" }}>
                  For {selectedSubject || "—"} · {variations.length} available
                </p>
              </div>
              <button
                onClick={() => setEditModalKind("variations")}
                disabled={!selectedSubjectId}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold disabled:opacity-40"
                style={{ border: "1px solid var(--pencil-light)", color: "var(--teal)" }}
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="overflow-y-auto pr-1" style={{ maxHeight: listsExpanded ? 520 : 260, transition: "max-height 0.2s ease" }}>
            {!selectedSubjectId ? (
              <p className="text-xs" style={{ color: "var(--pencil)" }}>
                Select a subject to manage its variations.
              </p>
            ) : variations.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--pencil)" }}>
                No variations yet for {selectedSubject}.
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
        </div>
        </>
      )}

      {editModalKind && selectedCategoryId && (
        <EditListModal
          categoryId={selectedCategoryId}
          kind={editModalKind}
          currentItems={editModalKind === "subjects" ? subjects : variations}
          onClose={() => setEditModalKind(null)}
          onSaved={handleListSaved}
          variationsSubjectId={editModalKind === "variations" ? selectedSubjectId : undefined}
        />
      )}
    </div>
  );
}
