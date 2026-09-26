"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Plus, Minimize2, Maximize2 } from "lucide-react";
import { getCategory, updateCategory, type CategorySummary, type Category } from "@/lib/api";
import EditListModal from "./EditListModal";

export default function PrepareCategoryPanel({
  categories,
  selectedCategoryId,
  onCategoryUpdated,
  autoOpenSubjectsForCategoryId,
}: {
  categories: CategorySummary[];
  selectedCategoryId?: number;
  onCategoryUpdated?: () => void;
  autoOpenSubjectsForCategoryId?: number;
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalKind, setEditModalKind] = useState<"subjects" | "variations" | null>(null);
  const [listsExpanded, setListsExpanded] = useState(false);
  const autoOpenedForIdRef = useRef<number | undefined>(undefined);

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

  useEffect(() => {
    // Right after a brand-new category is created (and becomes the
    // selected one here), jump straight into "Add subjects" so the user
    // doesn't have to hunt for the Add button to start setting it up.
    // Guarded by a ref (not state) so this only fires once per newly
    // created category, even though selectedCategoryId keeps matching it
    // on every re-render until the user picks something else.
    //
    // Gated on `category` (the fetched data), not just
    // `selectedCategoryId` (the id alone) — selectedCategoryId flips to
    // the new category immediately, but its subjects/variations load
    // asynchronously via loadCategory(). Opening on the id alone raced
    // that fetch: the modal could mount (and capture its initial list)
    // while `category` — and the `subjects` derived from it — still held
    // the PREVIOUS category's data, showing someone else's subjects in a
    // supposedly-empty new category. Waiting for `category.id` to match
    // guarantees the right data is already in state first.
    if (!autoOpenSubjectsForCategoryId) return;
    if (!category || category.id !== autoOpenSubjectsForCategoryId) return;
    if (autoOpenedForIdRef.current === autoOpenSubjectsForCategoryId) return;
    autoOpenedForIdRef.current = autoOpenSubjectsForCategoryId;
    setEditModalKind("subjects");
  }, [autoOpenSubjectsForCategoryId, category]);

  function handleListSaved(updated: Category) {
    if (editModalKind === "subjects") {
      // Highlight the newly added subject so the user can go straight to
      // "Add" on variations, without hunting for it in the list. If more
      // than one was added at once, pick the last one (assumed newest,
      // since the backend appends in creation order).
      const prevNames = new Set(subjects);
      const newlyAdded = updated.subjects.filter((s) => !prevNames.has(s.name));
      const newest = newlyAdded[newlyAdded.length - 1];
      if (newest) {
        setSelectedSubject(newest.name);
      } else if (!updated.subjects.some((s) => s.name === selectedSubject)) {
        // Previous selection no longer exists (e.g. it was removed as part
        // of this edit) — fall back rather than leaving a stale selection.
        setSelectedSubject(updated.subjects[0]?.name ?? "");
      }
    }
    setCategory(updated);
    onCategoryUpdated?.();
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
      onCategoryUpdated?.();
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
      onCategoryUpdated?.();
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
        {/* Same fix as the sequence page's Subjects/Variations grid: a fixed
            two-column layout crowded Variations into almost no space below
            ~640px. Stacks to a single column below sm (640px) instead. */}
        <div className="grid relative rounded-lg grid-cols-1 sm:grid-cols-[minmax(160px,0.8fr)_1.6fr]" style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
          <div
            className="absolute flex items-center justify-center"
            style={{ gridColumn: "1 / 2", justifySelf: "end", bottom: -13, width: 26, height: 26, position: "absolute", right: -13, zIndex: 10 }}
          >
            <button
              onClick={() => setListsExpanded((v) => !v)}
              className="flex items-center justify-center rounded-full w-full h-full"
              style={{ background: "var(--shell)", border: "1px solid var(--shell-border)", color: "var(--pencil)", boxShadow: "0 2px 6px rgba(28,27,26,0.12)" }}
              title={listsExpanded ? "Collapse" : "Expand"}
            >
              {listsExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
          <div
            className="rounded-t-lg sm:rounded-t-none sm:rounded-l-lg overflow-hidden border-b sm:border-b-0 sm:border-r border-[color:var(--pencil-light)]"
            style={{ padding: 16 }}
          >
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
                      border: `1px solid ${active ? "var(--teal)" : "transparent"}`,
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

          <div className="rounded-b-lg sm:rounded-b-none sm:rounded-r-lg overflow-hidden" style={{ padding: 16 }}>
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
