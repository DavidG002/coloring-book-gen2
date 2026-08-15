"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBook, ApiError } from "@/lib/api";

const PRODUCT_NOUN_PRESETS = ["coloring page", "stencil", "icon", "sticker", "logo", "print"];

export default function NewBookPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [productNoun, setProductNoun] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Book name is required.");
      return;
    }
    if (!productNoun.trim()) {
      setError("Product type is required — choose a preset or type your own.");
      return;
    }
    if (!basePrompt.trim()) {
      setError("Base prompt is required.");
      return;
    }

    setSubmitting(true);
    try {
      const book = await createBook({
        name: name.trim(),
        base_prompt: basePrompt.trim(),
        product_noun: productNoun.trim(),
      });
      router.push(`/books/${book.id}/settings`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create book");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-semibold" style={{ color: "var(--ink)" }}>
          New book
        </h1>
        <p className="mt-1" style={{ color: "var(--pencil)" }}>
          Set the name, product type, and style for this book. Categories inside it will inherit these — image
          size and cleanup settings can be fine-tuned right after creating it.
        </p>
      </header>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Book name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Coloring Books — Ages 3-10"
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Product type
          </label>
          <p className="text-xs mb-2" style={{ color: "var(--pencil)" }}>
            The word used consistently in generated titles, descriptions, and SEO content — e.g. &quot;coloring
            page,&quot; &quot;stencil,&quot; &quot;icon.&quot;
          </p>
          <div className="flex gap-2 mb-2 flex-wrap">
            {PRODUCT_NOUN_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setProductNoun(preset)}
                className="px-3 py-1.5 rounded-full text-sm border-[1.5px]"
                style={
                  productNoun === preset
                    ? { background: "var(--teal)", borderColor: "var(--teal)", color: "white" }
                    : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
                }
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={productNoun}
            onChange={(e) => setProductNoun(e.target.value)}
            placeholder="Or type a custom term..."
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
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
            placeholder="Describe the shared style for every category in this book — e.g. line thickness, complexity level, color vs. black and white, overall tone."
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--teal)" }}
          >
            {submitting ? "Creating..." : "Create book"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/books")}
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
