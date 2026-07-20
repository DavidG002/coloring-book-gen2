"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCategory, updateCategory, deleteCategory, ApiError, type Category } from "@/lib/api";
import GeneratePanel from "@/components/GeneratePanel";
import TranslationsPanel from "@/components/TranslationsPanel";
import PublishPanel from "@/components/PublishPanel";

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const categoryName = decodeURIComponent(params.name);

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [basePrompt, setBasePrompt] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [variations, setVariations] = useState<string[]>([]);

  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingSubjects, setSavingSubjects] = useState(false);
  const [savingVariations, setSavingVariations] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [promptSaved, setPromptSaved] = useState(false);
  const [subjectsSaved, setSubjectsSaved] = useState(false);
  const [variationsSaved, setVariationsSaved] = useState(false);

  
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCategory(categoryName);
        if (cancelled) return;
        setCategory(data);
        setBasePrompt(data.base_prompt);
        setSubjects(data.subjects.map((s) => s.name));
        setVariations(data.variations.sort((a, b) => a.order - b.order).map((v) => v.text));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "Failed to load category");
        }
      }   finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [categoryName]);

  function updateListItem(list: string[], setList: (v: string[]) => void, index: number, value: string) {
    const next = [...list];
    next[index] = value;
    setList(next);
  }

  function removeListItem(list: string[], setList: (v: string[]) => void, index: number) {
    setList(list.filter((_, i) => i !== index));
  }

  function addListItem(list: string[], setList: (v: string[]) => void) {
    setList([...list, ""]);
  }

  async function handleSavePrompt() {
    setError(null);
    setPromptSaved(false);
    const trimmed = basePrompt.trim();
    if (!trimmed) {
      setError("Base prompt cannot be empty.");
      return;
    }
    setSavingPrompt(true);
    try {
      const updated = await updateCategory(categoryName, { base_prompt: trimmed });
      setCategory(updated);
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save prompt");
    } finally {
      setSavingPrompt(false);
    }
  }

  async function handleSaveSubjects() {
    setError(null);
    setSubjectsSaved(false);
    const clean = subjects.map((s) => s.trim()).filter(Boolean);
    setSavingSubjects(true);
    try {
      const updated = await updateCategory(categoryName, { subjects: clean });
      setCategory(updated);
      setSubjects(updated.subjects.map((s) => s.name));
      setSubjectsSaved(true);
      setTimeout(() => setSubjectsSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save subjects");
    } finally {
      setSavingSubjects(false);
    }
  }

  async function handleSaveVariations() {
    setError(null);
    setVariationsSaved(false);
    const clean = variations.map((v) => v.trim()).filter(Boolean);
    if (clean.length === 0) {
      setError("At least one variation is required.");
      return;
    }
    setSavingVariations(true);
    try {
      const updated = await updateCategory(categoryName, { variations: clean });
      setCategory(updated);
      setVariations(updated.variations.sort((a, b) => a.order - b.order).map((v) => v.text));
      setVariationsSaved(true);
      setTimeout(() => setVariationsSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save variations");
    } finally {
      setSavingVariations(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete category \"" + categoryName + "\"? This removes its subjects, variations, and translations. Generated files on disk are not affected."
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteCategory(categoryName);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete category");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <p style={{ color: "var(--pencil)" }}>Loading...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <p className="text-lg font-display" style={{ color: "var(--ink)" }}>
          Category not found
        </p>
        <p className="mt-2" style={{ color: "var(--pencil)" }}>
          There is no category named &quot;{categoryName}&quot;.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--teal)" }}
        >
          Back to categories
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/")}
            className="text-sm mb-3 inline-block"
            style={{ color: "var(--pencil)" }}
          >
            {"\u2190"} All categories
          </button>
          <h1 className="text-3xl font-display font-semibold capitalize" style={{ color: "var(--ink)" }}>
            {categoryName}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--pencil)" }}>
            {category?.subjects.length ?? 0} subjects, {category?.variations.length ?? 0} pose variations
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
          style={{ color: "var(--coral-dark)", border: "1.5px solid var(--coral)" }}
        >
          {deleting ? "Deleting..." : "Delete category"}
        </button>
      </header>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-md text-sm"
          style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <div className="space-y-10">
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
              Base prompt
            </label>
            <div className="flex items-center gap-3">
              {promptSaved && (
                <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                  Saved
                </span>
              )}
              <button
                onClick={handleSavePrompt}
                disabled={savingPrompt}
                className="text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--teal)" }}
              >
                {savingPrompt ? "Saving..." : "Save prompt"}
              </button>
            </div>
          </div>
          <textarea
            value={basePrompt}
            onChange={(e) => setBasePrompt(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
              Subjects
            </label>
            <div className="flex items-center gap-3">
              {subjectsSaved && (
                <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                  Saved
                </span>
              )}
              <button
                type="button"
                onClick={() => addListItem(subjects, setSubjects)}
                className="text-sm font-medium"
                style={{ color: "var(--teal)" }}
              >
                + Add subject
              </button>
              <button
                onClick={handleSaveSubjects}
                disabled={savingSubjects}
                className="text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--teal)" }}
              >
                {savingSubjects ? "Saving..." : "Save subjects"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {subjects.map((subject, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => updateListItem(subjects, setSubjects, i, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                  style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                />
                <button
                  type="button"
                  onClick={() => removeListItem(subjects, setSubjects, i)}
                  className="px-3 rounded-md text-sm"
                  style={{ color: "var(--pencil)" }}
                >
                  Remove
                </button>
              </div>
            ))}
            {subjects.length === 0 && (
              <p className="text-sm" style={{ color: "var(--pencil)" }}>
                No subjects yet.
              </p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
              Pose variations
            </label>
            <div className="flex items-center gap-3">
              {variationsSaved && (
                <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                  Saved
                </span>
              )}
              <button
                type="button"
                onClick={() => addListItem(variations, setVariations)}
                className="text-sm font-medium"
                style={{ color: "var(--teal)" }}
              >
                + Add variation
              </button>
              <button
                onClick={handleSaveVariations}
                disabled={savingVariations}
                className="text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--teal)" }}
              >
                {savingVariations ? "Saving..." : "Save variations"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {variations.map((variation, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={variation}
                  onChange={(e) => updateListItem(variations, setVariations, i, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                  style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                />
                <button
                  type="button"
                  onClick={() => removeListItem(variations, setVariations, i)}
                  className="px-3 rounded-md text-sm"
                  style={{ color: "var(--pencil)" }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
        {category && <GeneratePanel categoryName={categoryName} subjects={category.subjects} />}
        {category && (
          <TranslationsPanel
            categoryName={categoryName}
            subjects={category.subjects}
            variations={category.variations}
          />
        
      )}
      {category && <PublishPanel categoryName={categoryName} />}
      </div>
    </main>
  );
}
