"use client";

import { useState } from "react";
import { X, Sparkles, ArrowUpRight } from "lucide-react";
import { createBook, ApiError, type Book } from "@/lib/api";

const PRODUCT_NOUN_PRESETS = ["coloring page", "stencil", "icon", "sticker", "logo", "print"];

export default function NewBookModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (book: Book) => void;
}) {
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
      onCreated(book);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create book");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(28,27,26,0.5)" }} onClick={onClose}>
      <div
        className="relative rounded-xl p-7 overflow-y-auto"
        style={{ width: "min(560px, 100%)", maxHeight: "88vh", background: "var(--canvas)", border: "1px solid var(--pencil-light)", boxShadow: "0 20px 60px rgba(28,27,26,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-5 right-5" style={{ color: "var(--pencil)" }}>
          <X size={18} />
        </button>

        <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4" style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}>
          <Sparkles size={16} />
        </div>
        <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
          A fresh beginning
        </p>
        <h2 className="font-display font-normal m-0 mt-1 mb-2" style={{ fontSize: 28, letterSpacing: "-0.03em", color: "var(--ink)" }}>
          Create a new book
        </h2>
        <p className="text-xs m-0 mb-5" style={{ color: "var(--pencil)" }}>
          Categories inside it will inherit these — image size and cleanup settings can be fine-tuned right after creating it.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-md text-sm" style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
              Book name
            </label>
            <input
              type="text"
                spellCheck={true}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coloring Books — Ages 3-10"
              className="w-full px-3 py-2.5 rounded-md border-[1.5px] outline-none text-sm"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
              Product type
            </label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {PRODUCT_NOUN_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setProductNoun(preset)}
                  className="px-2.5 py-1 rounded-full text-xs border-[1.5px]"
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
                spellCheck={true}
              value={productNoun}
              onChange={(e) => setProductNoun(e.target.value)}
              placeholder="Or type a custom term..."
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
              Base prompt
            </label>
            <textarea
                spellCheck={true}
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
              rows={5}
              placeholder="Describe the shared style for every category in this book."
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-md text-sm font-medium" style={{ color: "var(--pencil)" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "var(--teal)" }}
            >
              {submitting ? "Creating..." : "Create book"} <ArrowUpRight size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
