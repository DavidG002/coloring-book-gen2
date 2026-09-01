"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCategory, ApiError } from "@/lib/api";

export default function NewCategoryModal({
  bookId,
  bookName,
  onClose,
}: {
  bookId: number;
  bookName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const category = await createCategory({
        name: name.trim().toLowerCase(),
        book_id: bookId,
        subjects: [],
        variations: [],
      });
      router.push(`/categories/${category.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create category");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(28, 27, 26, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg p-6"
        style={{ background: "var(--canvas)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>
          New category
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--pencil)" }}>
          In {bookName}. Subjects and pose variations are added on the category&apos;s own page.
        </p>

        {error && (
          <div
            className="mb-4 px-3 py-2 rounded-md text-sm"
            style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. dinosaurs"
            autoFocus
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm mb-4"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--teal)" }}
            >
              {submitting ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-md text-sm font-medium"
              style={{ color: "var(--pencil)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
