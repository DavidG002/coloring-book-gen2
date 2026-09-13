"use client";

import { useState, useEffect } from "react";
import { Link2, Check, Plus } from "lucide-react";
import { getBooks } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BookSummary {
  id: number;
  name: string;
}

interface WpCategory {
  id: number;
  name: string;
}

async function getWordpressCategories(): Promise<WpCategory[]> {
  const res = await fetch(`${API_BASE_URL}/wordpress/categories`);
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to fetch WordPress categories");
  return res.json();
}

async function getBookMapping(bookId: number, lang: string): Promise<number | null> {
  const res = await fetch(`${API_BASE_URL}/wordpress/books/${bookId}/mapping?lang=${lang}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.wp_term_id;
}

async function createBookMapping(bookId: number, lang: string, body: { wp_term_id?: number; term_name?: string }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/wordpress/books/${bookId}/mapping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang, ...body }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to save mapping");
}

export default function BookWordPressMapping({ lang = "en" }: { lang?: string }) {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [wpCategories, setWpCategories] = useState<WpCategory[]>([]);
  const [mappings, setMappings] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [pickMode, setPickMode] = useState<"existing" | "new">("existing");
  const [selectedWpTermId, setSelectedWpTermId] = useState<number | "">("");
  const [newTermName, setNewTermName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [realBooks, categories] = await Promise.all([getBooks(), getWordpressCategories()]);
        setBooks(realBooks);
        setWpCategories(categories);
        const mappingEntries = await Promise.all(
          realBooks.map(async (b) => [b.id, await getBookMapping(b.id, lang)] as const)
        );
        setMappings(Object.fromEntries(mappingEntries));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load WordPress mapping data");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [lang]);

  function startEditing(bookId: number) {
    setEditingBookId(bookId);
    setPickMode("existing");
    setSelectedWpTermId("");
    setNewTermName("");
    setError(null);
  }

  async function handleSave(bookId: number) {
    setError(null);
    if (pickMode === "existing" && !selectedWpTermId) {
      setError("Choose an existing WordPress category first.");
      return;
    }
    if (pickMode === "new" && !newTermName.trim()) {
      setError("Enter a name for the new WordPress category.");
      return;
    }
    setSaving(true);
    try {
      await createBookMapping(
        bookId,
        lang,
        pickMode === "existing" ? { wp_term_id: selectedWpTermId as number } : { term_name: newTermName.trim() }
      );
      const updated = await getBookMapping(bookId, lang);
      setMappings((prev) => ({ ...prev, [bookId]: updated }));
      setEditingBookId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mapping");
    } finally {
      setSaving(false);
    }
  }

  function wpCategoryName(id: number | null) {
    if (id === null) return null;
    return wpCategories.find((c) => c.id === id)?.name ?? `#${id}`;
  }

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "var(--pencil)" }}>
        Loading books and WordPress categories...
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--pencil)" }}>
        Optionally give a book its own top-level WordPress category — every category inside it will then nest under
        that term. A book with no mapping publishes its categories as top-level WordPress categories, exactly as
        before.
      </p>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <div className="grid gap-2">
        {books.map((book) => {
          const mappedId = mappings[book.id] ?? null;
          const isEditing = editingBookId === book.id;
          return (
            <div key={book.id} className="rounded-lg" style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
              <div className="flex items-center justify-between gap-3 p-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Link2 size={14} style={{ color: mappedId ? "var(--teal)" : "var(--pencil)", flexShrink: 0 }} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold m-0 truncate" style={{ color: "var(--ink)" }}>
                      {book.name}
                    </p>
                    <p className="text-[11px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>
                      {mappedId ? (
                        <>
                          Mapped to <strong style={{ color: "var(--teal-dark)" }}>{wpCategoryName(mappedId)}</strong>
                        </>
                      ) : (
                        "Not mapped — categories publish as top-level"
                      )}
                    </p>
                  </div>
                </div>
                {!isEditing && !mappedId && (
                  <button
                    onClick={() => startEditing(book.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-bold shrink-0"
                    style={{ border: "1px solid var(--teal)", color: "var(--teal)" }}
                  >
                    <Plus size={12} /> Map this book
                  </button>
                )}
              </div>

              {isEditing && (
                <div className="px-3.5 pb-3.5" style={{ borderTop: "1px solid var(--pencil-light)" }}>
                  <div className="flex items-center gap-2 mt-3 mb-3">
                    <button
                      onClick={() => setPickMode("existing")}
                      className="px-2.5 py-1.5 rounded-md text-[10px] font-bold"
                      style={
                        pickMode === "existing"
                          ? { background: "var(--teal)", color: "white" }
                          : { border: "1px solid var(--pencil-light)", color: "var(--pencil)" }
                      }
                    >
                      Use existing
                    </button>
                    <button
                      onClick={() => setPickMode("new")}
                      className="px-2.5 py-1.5 rounded-md text-[10px] font-bold"
                      style={
                        pickMode === "new"
                          ? { background: "var(--teal)", color: "white" }
                          : { border: "1px solid var(--pencil-light)", color: "var(--pencil)" }
                      }
                    >
                      Create new
                    </button>
                  </div>

                  {pickMode === "existing" ? (
                    <select
                      value={selectedWpTermId}
                      onChange={(e) => setSelectedWpTermId(e.target.value ? parseInt(e.target.value, 10) : "")}
                      className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm mb-3"
                      style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                    >
                      <option value="">Select a WordPress category...</option>
                      {wpCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      spellCheck={true}
                      value={newTermName}
                      onChange={(e) => setNewTermName(e.target.value)}
                      placeholder="e.g. Holidays"
                      className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm mb-3"
                      style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                    />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSave(book.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold text-white disabled:opacity-50"
                      style={{ background: "var(--teal)" }}
                    >
                      <Check size={13} /> {saving ? "Saving..." : "Save mapping"}
                    </button>
                    <button
                      onClick={() => setEditingBookId(null)}
                      disabled={saving}
                      className="px-3.5 py-2 rounded-md text-xs font-medium"
                      style={{ color: "var(--pencil)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
