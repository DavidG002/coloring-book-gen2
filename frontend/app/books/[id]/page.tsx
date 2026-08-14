"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getBook, deleteBook, getCategories, ApiError, type Book, type CategorySummary } from "@/lib/api";
import NewCategoryModal from "@/components/NewCategoryModal";
import DeleteBookModal from "@/components/DeleteBookModal";

export default function BookDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bookId = parseInt(params.id, 10);

  const [book, setBook] = useState<Book | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [data, allCategories] = await Promise.all([getBook(bookId), getCategories()]);
        if (cancelled) return;
        setBook(data);
        setCategories(allCategories.filter((c) => c.book_id === bookId));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "Failed to load book");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  async function handleDelete() {
    if (!book) return;
    const confirmed = window.confirm(
      `Delete book "${book.name}"? This is only possible if it has no categories.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteBook(bookId);
      router.push("/books");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete book");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-5xl mx-auto">
        <p style={{ color: "var(--pencil)" }}>Loading...</p>
      </main>
    );
  }

  if (notFound || !book) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <p className="text-lg font-display" style={{ color: "var(--ink)" }}>
          Book not found
        </p>
        <button
          onClick={() => router.push("/books")}
          className="mt-6 px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--teal)" }}
        >
          Back to books
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-8 py-12 max-w-5xl mx-auto">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/books")}
            className="text-sm mb-3 inline-block"
            style={{ color: "var(--pencil)" }}
          >
            {"\u2190"} All books
          </button>
          <h1 className="text-3xl font-display font-semibold" style={{ color: "var(--ink)" }}>
            {book.name}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--pencil)" }}>
            {book.category_count} {book.category_count === 1 ? "category" : "categories"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/books/${bookId}/settings`}
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ color: "var(--pencil)", border: "1.5px solid var(--pencil-light)" }}
          >
            Book Settings
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ color: "var(--coral-dark)", border: "1.5px solid var(--coral)" }}
          >
            Delete book
          </button>
        </div>
      </header>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-md text-sm"
          style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Categories
        </h2>
        <button
          onClick={() => setShowNewCategoryModal(true)}
          className="text-sm font-medium"
          style={{ color: "var(--teal)" }}
        >
          + New category
        </button>
      </div>

      {categories.length === 0 ? (
        <div
          className="rounded-lg border-2 border-dashed p-12 text-center"
          style={{ borderColor: "var(--pencil-light)", color: "var(--pencil)" }}
        >
          <p className="mb-4">No categories yet in this book.</p>
          <button
            onClick={() => setShowNewCategoryModal(true)}
            className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
            style={{ background: "var(--teal)" }}
          >
            + New category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${encodeURIComponent(cat.name)}`}
              className="group relative block rounded-lg border-[1.5px] p-5 transition-shadow hover:shadow-md"
              style={{ background: "var(--canvas)", borderColor: "var(--pencil-light)" }}
            >
              <span
                className="absolute -top-2.5 left-5 px-2 text-xs font-medium rounded"
                style={{ background: "var(--teal)", color: "white" }}
              >
                {cat.subject_count} {cat.subject_count === 1 ? "subject" : "subjects"}
              </span>
              <h2 className="font-display text-xl font-semibold mt-2 capitalize" style={{ color: "var(--ink)" }}>
                {cat.name}
              </h2>
              <p className="mt-2 text-sm" style={{ color: "var(--pencil)" }}>
                {cat.variation_count} pose {cat.variation_count === 1 ? "variation" : "variations"}
              </p>
            </Link>
          ))}
        </div>
      )}

      {showNewCategoryModal && book && (
        <NewCategoryModal
          bookId={book.id}
          bookName={book.name}
          onClose={() => setShowNewCategoryModal(false)}
        />
      )}
      {showDeleteModal && (
        <DeleteBookModal bookId={bookId} onClose={() => setShowDeleteModal(false)} />
      )}
    </main>
  );
}
