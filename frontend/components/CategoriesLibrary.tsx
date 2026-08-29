"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Grid2X2, Image as ImageIcon, MoreHorizontal, Plus, Search, ChevronDown, ArrowUpRight } from "lucide-react";
import { getCategories, getBooks, type CategorySummary, type BookSummary } from "@/lib/api";
import AppShell from "./AppShell";
import NewCategoryFromLibraryModal from "./NewCategoryFromLibraryModal";

const TONES = [
  { bg: "var(--tone-sage-bg)", fg: "var(--tone-sage)" },
  { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue)" },
  { bg: "var(--tone-peach-bg)", fg: "var(--tone-peach)" },
  { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow)" },
  { bg: "var(--tone-lavender-bg)", fg: "var(--tone-lavender)" },
];

export default function CategoriesLibrary() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [bookFilter, setBookFilter] = useState<number | "all">("all");
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([getCategories(), getBooks()])
      .then(([c, b]) => {
        setCategories(c);
        setBooks(b);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, []);

  const bookNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const b of books) map[b.id] = b.name;
    return map;
  }, [books]);

  const filtered = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) &&
          (bookFilter === "all" || c.book_id === bookFilter)
      ),
    [categories, query, bookFilter]
  );

  const uniqueBookCount = new Set(categories.map((c) => c.book_id)).size;
  const totalSubjects = categories.reduce((sum, c) => sum + c.subject_count, 0);

  return (
    <AppShell active="Categories" breadcrumb="Categories">
      <div className="flex items-end justify-between gap-5 mb-9">
        <div>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
            Creative library
          </p>
          <h1
            className="font-display font-normal m-0 mt-2"
            style={{ fontSize: "clamp(34px, 4vw, 47px)", letterSpacing: "-0.045em", color: "var(--ink)" }}
          >
            Categories<span style={{ color: "var(--teal)" }}>.</span>
          </h1>
          <p className="text-[13px] m-0 mt-2.5" style={{ color: "var(--pencil)" }}>
            Organize the worlds, creatures, and little ideas inside your books.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="lift-hover inline-flex items-center gap-2 rounded-lg text-white text-xs font-bold shrink-0"
          style={{ padding: "11px 15px", background: "var(--teal)", boxShadow: "0 5px 14px rgba(91,124,147,0.14)" }}
        >
          <Plus size={16} /> New category
        </button>
      </div>

      <div className="flex items-center gap-3.5 rounded-xl mb-7" style={{ padding: "16px 20px", border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}>
          <Grid2X2 size={17} />
        </div>
        <div>
          <p className="font-display font-normal m-0" style={{ fontSize: 17, color: "var(--ink)" }}>{categories.length} collections</p>
          <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>Across {uniqueBookCount} book{uniqueBookCount === 1 ? "" : "s"}</p>
        </div>
        <div style={{ width: 1, height: 30, background: "var(--pencil-light)" }} />
        <div>
          <p className="font-display font-normal m-0" style={{ fontSize: 17, color: "var(--ink)" }}>{totalSubjects} subjects</p>
          <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>Ready to illustrate</p>
        </div>
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
            placeholder="Search categories..."
            className="text-xs outline-none flex-1 bg-transparent"
            style={{ color: "var(--ink)" }}
          />
        </div>
        <div className="relative">
          <select
            value={bookFilter}
            onChange={(e) => setBookFilter(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))}
            className="appearance-none pr-8 rounded-lg text-[11px]"
            style={{ padding: "9px 11px", border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            <option value="all">All books</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
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
        <div className="grid grid-cols-2 gap-3.5">
          {filtered.map((cat, i) => {
            const tone = TONES[i % TONES.length];
            return (
              <article key={cat.id} className="lift-hover rounded-xl overflow-hidden" style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
                <div className="flex items-center justify-between" style={{ minHeight: 138, padding: 20, background: tone.bg, color: tone.fg }}>
                  <ImageIcon size={27} style={{ opacity: 0.55 }} />
                  <span className="font-display" style={{ fontSize: 38, opacity: 0.4 }}>{cat.subject_count}</span>
                </div>
                <div style={{ padding: "16px 17px 14px" }}>
                  <div className="flex justify-between gap-3">
                    <div>
                      <h2 className="font-display font-normal m-0 capitalize" style={{ fontSize: 21, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                        {cat.name}
                      </h2>
                      <p className="text-[11px] m-0 mt-1.5" style={{ color: "var(--pencil)" }}>
                        {bookNameById[cat.book_id] ?? "Unknown book"}
                      </p>
                    </div>
                    <MoreHorizontal size={18} style={{ color: "var(--pencil)" }} />
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-5 pt-3" style={{ borderTop: "1px solid var(--pencil-light)" }}>
                    <span className="text-[10px]" style={{ color: "var(--pencil)" }}>
                      {cat.variation_count} pose {cat.variation_count === 1 ? "variation" : "variations"}
                    </span>
                    <Link
                      href={`/categories/${encodeURIComponent(cat.name)}`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold"
                      style={{ color: "var(--teal)" }}
                    >
                      Open <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && (
            <div
              className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-xl"
              style={{ minHeight: 190, border: "1px dashed var(--pencil-light)", color: "var(--pencil)" }}
            >
              <Grid2X2 size={22} />
              <strong className="font-display font-normal" style={{ fontSize: 20, color: "var(--ink)" }}>
                No categories found
              </strong>
              <span className="text-xs">Try a different search or book filter.</span>
            </div>
          )}
        </div>
      )}

      {showCreate && <NewCategoryFromLibraryModal books={books} onClose={() => { setShowCreate(false); load(); }} />}
    </AppShell>
  );
}
