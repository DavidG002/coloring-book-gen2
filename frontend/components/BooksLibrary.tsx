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

type SortKey = "recent" | "title";

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
    return [...results].sort((a, b) => (sortBy === "title" ? a.name.localeCompare(b.name) : b.id - a.id));
  }, [books, query, sortBy]);

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

      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="font-display font-normal m-0" style={{ fontSize: 23, letterSpacing: "-0.03em", color: "var(--ink)" }}>
            Your library
          </h2>
          <p className="text-[13px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
            A clear view of every collection in progress.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="lift-hover inline-flex items-center gap-2 rounded-lg text-white text-xs font-bold shrink-0"
          style={{ padding: "11px 15px", background: "var(--teal)", boxShadow: "0 5px 14px rgba(91,124,147,0.14)" }}
        >
          <Plus size={16} /> New book
        </button>
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
            className="appearance-none pr-8 rounded-lg text-[11px]"
            style={{ padding: "9px 11px", border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            <option value="recent">Recently created</option>
            <option value="title">Title</option>
          </select>
          <ChevronDown size={13} className="absolute pointer-events-none" style={{ right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--pencil)" }} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Loading...
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3.5">
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
