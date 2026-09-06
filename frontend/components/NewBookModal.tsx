"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles, ArrowUpRight, Check } from "lucide-react";
import { createBook, ApiError, type Book } from "@/lib/api";

export default function NewBookModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (book: Book) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Book | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Book name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const book = await createBook({ name: name.trim() });
      onCreated(book);
      setCreated(book);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create book");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(28,27,26,0.5)" }} onClick={onClose}>
        <div
          className="relative rounded-xl p-7"
          style={{ width: "min(440px, 100%)", background: "var(--canvas)", border: "1px solid var(--pencil-light)", boxShadow: "0 20px 60px rgba(28,27,26,0.2)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: "var(--tone-sage-bg)", color: "var(--tone-sage)" }}>
            <Check size={17} />
          </div>
          <h2 className="font-display font-normal m-0 mb-2" style={{ fontSize: 24, letterSpacing: "-0.03em", color: "var(--ink)" }}>
            &quot;{created.name}&quot; is ready
          </h2>
          <p className="text-xs m-0 mb-5" style={{ color: "var(--pencil)" }}>
            Set its style and first category now with a quick setup, or find it later in your books list — clicking it will always pick up right where you left off.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => router.push(`/books/${created.id}`)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold text-white"
              style={{ background: "var(--teal)" }}
            >
              Start setup <ArrowUpRight size={14} />
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-md text-sm font-medium"
              style={{ color: "var(--pencil)" }}
            >
              I&apos;ll do this later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(28,27,26,0.5)" }} onClick={onClose}>
      <div
        className="relative rounded-xl p-7"
        style={{ width: "min(440px, 100%)", background: "var(--canvas)", border: "1px solid var(--pencil-light)", boxShadow: "0 20px 60px rgba(28,27,26,0.2)" }}
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
          Give it a name — you can set its style, categories, and everything else right after.
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
              autoFocus
              className="w-full px-3 py-2.5 rounded-md border-[1.5px] outline-none text-sm"
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
