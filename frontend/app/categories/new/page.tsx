"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPromptDefaults, createCategory, ApiError } from "@/lib/api";

function formatPromptForEditing(text: string): string {
  // Break into separate lines after each sentence, purely for readability
  // while editing. Stored/sent as one string either way.
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}

export default function NewCategoryPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [subjects, setSubjects] = useState<string[]>([""]);
  const [variations, setVariations] = useState<string[]>([""]);

  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPromptDefaults()
      .then((defaults) => {
        setBasePrompt(formatPromptForEditing(defaults.base_prompt));
        setVariations(defaults.variations.length ? defaults.variations : [""]);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load defaults"))
      .finally(() => setLoadingDefaults(false));
  }, []);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanSubjects = subjects.map((s) => s.trim()).filter(Boolean);
    const cleanVariations = variations.map((v) => v.trim()).filter(Boolean);
    const cleanPrompt = basePrompt.trim();

    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    if (cleanVariations.length === 0) {
      setError("At least one variation is required.");
      return;
    }
    if (!cleanPrompt) {
      setError("Base prompt cannot be empty.");
      return;
    }

    setSubmitting(true);
    try {
      const category = await createCategory({
        name: name.trim().toLowerCase(),
        base_prompt: cleanPrompt,
        subjects: cleanSubjects,
        variations: cleanVariations,
      });
      router.push(`/categories/${encodeURIComponent(category.name)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create category");
      setSubmitting(false);
    }
  }

  if (loadingDefaults) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <p style={{ color: "var(--pencil)" }}>Loading defaults...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-semibold" style={{ color: "var(--ink)" }}>
          New category
        </h1>
        <p className="mt-1" style={{ color: "var(--pencil)" }}>
          The prompt and variations below are pre-filled from your default template. Edit freely for this category.
        </p>
      </header>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-md text-sm"
          style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Category name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. dinosaurs"
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Base prompt
          </label>
          <textarea
            value={basePrompt}
            onChange={(e) => setBasePrompt(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
          <p className="mt-1.5 text-xs" style={{ color: "var(--pencil)" }}>
            One idea per line keeps it easy to scan, but this is just a plain text field. Paste in a prompt from anywhere and it will work fine.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
              Subjects
            </label>
            <button
              type="button"
              onClick={() => addListItem(subjects, setSubjects)}
              className="text-sm font-medium"
              style={{ color: "var(--teal)" }}
            >
              + Add subject
            </button>
          </div>
          <div className="space-y-2">
            {subjects.map((subject, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => updateListItem(subjects, setSubjects, i, e.target.value)}
                  placeholder="e.g. T-Rex"
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
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
              Pose variations
            </label>
            <button
              type="button"
              onClick={() => addListItem(variations, setVariations)}
              className="text-sm font-medium"
              style={{ color: "var(--teal)" }}
            >
              + Add variation
            </button>
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
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--teal)" }}
          >
            {submitting ? "Creating..." : "Create category"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-6 py-2.5 rounded-md text-sm font-medium"
            style={{ color: "var(--pencil)" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
