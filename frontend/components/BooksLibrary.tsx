"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, ChevronDown, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { getBooks, type BookSummary } from "@/lib/api";
import AppShell from "./AppShell";
import NewBookModal from "./NewBookModal";

const TONES = [
  { bg: "var(--tone-sage-bg)", fg: "var(--tone-sage)" },
  { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue)" },
  { bg: "var(--tone-peach-bg)", fg: "var(--tone-peach)" },
  { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow)" },
  { bg: "var(--tone-lavender-bg)", fg: "var(--tone-lavender)" },
];

type SortKey = "recent" | "oldest" | "name-asc" | "name-desc" | "categories-desc" | "categories-asc";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recently created",
  oldest: "Oldest first",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  "categories-desc": "Most categories",
  "categories-asc": "Fewest categories",
};

export default function BooksLibrary() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    getBooks()
      .then(setBooks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, []);

  const filteredBooks = useMemo(() => {
    const results = books.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()));
    const sorted = [...results];
    switch (sortBy) {
      case "recent":
        sorted.sort((a, b) => b.id - a.id);
        break;
      case "oldest":
        sorted.sort((a, b) => a.id - b.id);
        break;
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "categories-desc":
        sorted.sort((a, b) => b.category_count - a.category_count);
        break;
      case "categories-asc":
        sorted.sort((a, b) => a.category_count - b.category_count);
        break;
    }
    return sorted;
  }, [books, query, sortBy]);

  // Reserve space for the full (unfiltered) list so typing in search never shrinks the page.
  const totalGridItems = books.length + 1; // +1 for the "create a new book" tile
  const gridRows = Math.max(1, Math.ceil(totalGridItems / 3));
  const gridMinHeight = gridRows * 216 + (gridRows - 1) * 14;

  return (
    <AppShell active="Books" breadcrumb="Books">
      <div className="flex items-end justify-between gap-5 mb-7">
        <div>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
            Your creative library
          </p>
          <h1
            className="font-display font-normal m-0 mt-2"
            style={{ fontSize: "clamp(34px, 4vw, 47px)", letterSpacing: "-0.045em", color: "var(--ink)" }}
          >
            Books<span style={{ color: "var(--teal)" }}>.</span>
          </h1>
          <p className="text-[13px] m-0 mt-2.5" style={{ color: "var(--pencil)" }}>
            Every coloring book you&apos;re creating, in one place.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="font-display font-normal m-0" style={{ fontSize: 23, letterSpacing: "-0.03em", color: "var(--ink)" }}>
          Your library
        </h2>
        <p className="text-[13px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
          A clear view of every collection in progress.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div
          className="flex items-center gap-2 rounded-lg"
          style={{ padding: "9px 11px", border: "1px solid var(--pencil-light)", background: "var(--canvas)", width: "min(290px, 100%)" }}
        >
          <Search size={15} style={{ color: "var(--pencil)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books..."
            className="text-xs outline-none flex-1 bg-transparent"
            style={{ color: "var(--ink)" }}
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="appearance-none rounded-lg text-[11px]"
            style={{ padding: "9px 30px 9px 11px", border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute pointer-events-none" style={{ right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--pencil)" }} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Loading...
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3.5" style={{ minHeight: gridMinHeight, alignContent: "start" }}>
          <button
            onClick={() => setShowCreate(true)}
            className="lift-hover rounded-xl flex items-center gap-3 text-left"
            style={{ minHeight: 216, padding: 18, border: "1.5px dashed var(--pencil-light)" }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--teal-tint)", color: "var(--teal)" }}>
              <Plus size={19} />
            </div>
            <div>
              <p className="font-display font-normal m-0" style={{ fontSize: 14, color: "var(--ink)" }}>
                Create a new book
              </p>
              <p className="text-[11px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
                Start with a style and a spark.
              </p>
            </div>
          </button>

          {filteredBooks.map((book, i) => {
            const tone = TONES[i % TONES.length];
            return (
              <Link
                key={book.id}
                href={`/books/${book.id}`}
                className="lift-hover rounded-xl overflow-hidden block"
                style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
              >
                <div className="flex items-center justify-center" style={{ height: 125, background: tone.bg }}>
                  <span className="font-display" style={{ fontSize: 40, color: tone.fg }}>
                    {["✦", "✧", "◆", "❖", "✳"][i % 5]}
                  </span>
                </div>
                <div style={{ padding: "14px 15px 13px" }}>
                  <div className="flex items-center justify-between gap-2.5">
                    <h3 className="font-display font-normal m-0" style={{ fontSize: 16, color: "var(--ink)" }}>
                      {book.name}
                    </h3>
                    <MoreHorizontal size={17} style={{ color: "var(--pencil)" }} />
                  </div>
                  <p className="text-[11px] m-0 mt-1.5 mb-4" style={{ color: "var(--pencil)" }}>
                    {book.category_count} {book.category_count === 1 ? "category" : "categories"}
                  </p>
                  <span className="inline-flex items-center gap-1 font-bold text-[11px]" style={{ color: "var(--teal)" }}>
                    Open <ArrowUpRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}

          {filteredBooks.length === 0 && (
            <p className="text-sm col-span-3" style={{ color: "var(--pencil)" }}>
              No books found. Try another search.
            </p>
          )}
        </div>
      )}

      {showCreate && (
        <NewBookModal
          onClose={() => setShowCreate(false)}
          onCreated={() => load()}
        />
      )}
    </AppShell>
  );
}
