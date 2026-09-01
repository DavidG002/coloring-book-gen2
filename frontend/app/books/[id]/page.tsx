"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Trash2, Plus, Image as ImageIcon, MoreHorizontal, ArrowUpRight, BookOpen } from "lucide-react";
import { getBook, getCategories, ApiError, type Book, type CategorySummary } from "@/lib/api";
import NewCategoryModal from "@/components/NewCategoryModal";
import DeleteBookModal from "@/components/DeleteBookModal";
import BookSettingsFields from "@/components/BookSettingsFields";
import BookPreviewSection from "@/components/BookPreviewSection";
import PrepareCategoryPanel from "@/components/PrepareCategoryPanel";
import { Panel, PanelSection } from "@/components/SettingsUI";
import AppShell from "@/components/AppShell";

const TONES = [
  { bg: "var(--tone-sage-bg)", fg: "var(--tone-sage)" },
  { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue)" },
  { bg: "var(--tone-peach-bg)", fg: "var(--tone-peach)" },
  { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow)" },
  { bg: "var(--tone-lavender-bg)", fg: "var(--tone-lavender)" },
];

export default function BookDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bookId = parseInt(params.id, 10);

  const [book, setBook] = useState<Book | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [lastCreatedCategoryId, setLastCreatedCategoryId] = useState<number | undefined>(undefined);

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

  async function handleCloseNewCategoryModal() {
    setShowNewCategoryModal(false);
    try {
      const allCategories = await getCategories();
      const mine = allCategories.filter((c) => c.book_id === bookId);
      setCategories(mine);
      if (mine.length > 0) {
        const newest = mine.reduce((a, b) => (b.id > a.id ? b : a));
        setLastCreatedCategoryId(newest.id);
      }
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <AppShell active="Books" breadcrumb="Books">
        <p style={{ color: "var(--pencil)" }}>Loading...</p>
      </AppShell>
    );
  }

  if (notFound || !book) {
    return (
      <AppShell active="Books" breadcrumb="Books">
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
      </AppShell>
    );
  }

  const totalSubjects = categories.reduce((sum, c) => sum + c.subject_count, 0);

  return (
    <AppShell active="Books" breadcrumb={book.name}>
      <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
        <button
          onClick={() => router.push("/books")}
          className="inline-flex items-center gap-2 text-xs"
          style={{ color: "var(--pencil)" }}
        >
          <ArrowLeft size={15} /> Back to books
        </button>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold"
          style={{ color: "var(--coral-dark)" }}
        >
          <Trash2 size={14} /> Delete book
        </button>
      </div>

      <div className="flex items-end justify-between gap-5 mb-9">
        <div>
          <p className="text-[10px] uppercase font-bold m-0 mb-2" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
            Book studio / {book.name}
          </p>
          <h1
            className="font-display font-normal m-0"
            style={{ fontSize: "clamp(36px, 5vw, 52px)", letterSpacing: "-0.05em", color: "var(--ink)" }}
          >
            {book.name}
            <span style={{ color: "var(--teal)" }}>.</span>
          </h1>
          {book.base_prompt && (
            <p className="text-[13px] m-0 mt-2.5 max-w-lg" style={{ color: "var(--pencil)" }}>
              {book.base_prompt}
            </p>
          )}
        </div>
        <div
          className="inline-flex items-center gap-2 shrink-0 rounded-lg"
          style={{ padding: "12px 14px", border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
        >
          <BookOpen size={16} style={{ color: "var(--teal)" }} />
          <span className="font-display" style={{ fontSize: 19, color: "var(--ink)" }}>
            {totalSubjects}
          </span>
          <span className="text-[11px]" style={{ color: "var(--pencil)" }}>
            subjects
          </span>
        </div>
      </div>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <BookPreviewSection bookId={bookId} />

          <Panel
            kicker="YOUR COLLECTIONS"
            title={
              <>
                Categories{" "}
                <span style={{ fontSize: 14, color: "var(--teal)", fontFamily: "inherit" }}>{categories.length}</span>
              </>
            }
            right={
              <button
                onClick={() => setShowNewCategoryModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold"
                style={{ color: "var(--teal)" }}
              >
                <Plus size={15} /> Add category
              </button>
            }
          >
            {categories.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--pencil)" }}>
                No categories yet in this book.
              </p>
            ) : (
              <div className="grid gap-2">
                {categories.map((cat, i) => {
                  const tone = TONES[i % TONES.length];
                  return (
                    <Link
                      key={cat.id}
                      href={`/categories/${cat.id}`}
                      className="lift-hover flex items-center gap-3"
                      style={{ padding: "11px 10px", border: "1px solid var(--pencil-light)", borderRadius: 9 }}
                    >
                      <div
                        className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        <ImageIcon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold m-0 capitalize" style={{ color: "var(--ink)" }}>
                          {cat.name}
                        </p>
                        <p className="text-[10px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
                          {cat.subject_count} subjects, {cat.variation_count} variations
                        </p>
                      </div>
                      <MoreHorizontal size={16} style={{ color: "var(--pencil)" }} />
                    </Link>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowNewCategoryModal(true)}
              className="w-full flex items-center justify-between mt-2 text-xs font-bold"
              style={{ color: "var(--teal)", padding: "10px 2px" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus size={14} /> Add another category
              </span>
              <ArrowUpRight size={14} />
            </button>

            <PanelSection label="Prepare a category">
              <PrepareCategoryPanel categories={categories} defaultCategoryId={lastCreatedCategoryId} />
            </PanelSection>
          </Panel>
        </div>

        <div className="space-y-6">
          <BookSettingsFields bookId={bookId} onBookLoaded={setBook} />
        </div>
      </div>

      {showNewCategoryModal && book && (
        <NewCategoryModal
          bookId={book.id}
          bookName={book.name}
          onClose={handleCloseNewCategoryModal}
        />
      )}
      {showDeleteModal && (
        <DeleteBookModal bookId={bookId} onClose={() => setShowDeleteModal(false)} />
      )}
    </AppShell>
  );
}
