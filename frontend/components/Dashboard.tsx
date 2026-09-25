"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BookOpen, FolderOpen, Layers, Search, ChevronDown, ArrowUpRight, Plus, MoreHorizontal } from "lucide-react";
import { getBooks, getCategories, type BookSummary, type CategorySummary } from "@/lib/api";
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

const RECENT_BOOKS_LIMIT = 5;

export default function Dashboard() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [todayLabel, setTodayLabel] = useState("");
  // Tracks the actual rendered column count of the "recent books" grid below
  // (1 col under md, 2 under xl, 3 at xl+ — mirrors the Tailwind breakpoints
  // used on its className) so the min-height reservation that keeps the page
  // from jumping while the user types a search stays accurate at every
  // width, not just the old fixed 3-column desktop layout.
  const [recentBooksColumns, setRecentBooksColumns] = useState(3);

  useEffect(() => {
    function computeColumns() {
      const w = window.innerWidth;
      if (w >= 1280) return 3;
      if (w >= 768) return 2;
      return 1;
    }
    const update = () => setRecentBooksColumns(computeColumns());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getBooks(), getCategories()])
      .then(([b, c]) => {
        if (cancelled) return;
        setBooks(b);
        setCategories(c);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    );
  }, []);

  const bookNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const b of books) map[b.id] = b.name;
    return map;
  }, [books]);

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

  const visibleBooks = filteredBooks.slice(0, RECENT_BOOKS_LIMIT);

  const recentCategories = useMemo(
    () => [...categories].sort((a, b) => b.id - a.id).slice(0, 5),
    [categories]
  );

  const totalSubjects = categories.reduce((sum, c) => sum + c.subject_count, 0);

  return (
    <AppShell active="Overview" breadcrumb="Overview">
      <div className="mb-9">
        <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
          {todayLabel}
        </p>
        <h1
          className="font-display font-normal m-0 mt-2"
          style={{ fontSize: "clamp(34px, 4vw, 47px)", letterSpacing: "-0.045em", color: "var(--ink)" }}
        >
          Good day, David<span style={{ color: "var(--teal)" }}>.</span>
        </h1>
        <p className="text-[13px] m-0 mt-2.5" style={{ color: "var(--pencil)" }}>
          A quiet place to turn ideas into pages worth keeping.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-12">
        <StatCard icon={<BookOpen size={16} />} label="Total books" value={books.length} tone={TONES[0]} />
        <StatCard icon={<FolderOpen size={16} />} label="Categories" value={categories.length} note="Across all books" tone={TONES[1]} />
        <StatCard icon={<Layers size={16} />} label="Subjects" value={totalSubjects} note="Across all categories" tone={TONES[2]} />
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="font-display font-normal m-0" style={{ fontSize: 23, letterSpacing: "-0.03em", color: "var(--ink)" }}>
            Recent categories
          </h2>
          <p className="text-[13px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
            Most recently created across your books.
          </p>
        </div>
        <Link href="/categories" className="text-[11px] font-bold inline-flex items-center gap-1.5" style={{ color: "var(--teal)" }}>
          View all <ArrowUpRight size={13} />
        </Link>
      </div>

      {!loading && (
        <div
          className="flex items-stretch mb-12"
          style={{ borderTop: "1px solid var(--pencil-light)", borderBottom: "1px solid var(--pencil-light)" }}
        >
          {recentCategories.map((cat, i) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.id}`}
              className="flex-1 min-w-0 hover:bg-[var(--row-tone)]"
              style={{
                padding: "13px 16px",
                borderRight: i < recentCategories.length - 1 ? "1px solid var(--pencil-light)" : undefined,
                transition: "background-color 0.45s ease",
                "--row-tone": TONES[i % TONES.length].bg,
              } as React.CSSProperties}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: TONES[i % TONES.length].fg }} />
                <p className="font-display font-normal capitalize m-0 truncate" style={{ fontSize: 13, color: "var(--ink)" }}>
                  {cat.name}
                </p>
              </div>
              <p className="text-[10px] m-0 truncate" style={{ color: "var(--pencil)" }}>
                {bookNameById[cat.book_id] ?? "Unknown book"} · {cat.subject_count} subjects
              </p>
            </Link>
          ))}
          {recentCategories.length === 0 && (
            <p className="text-sm py-4" style={{ color: "var(--pencil)" }}>
              No categories yet.
            </p>
          )}
        </div>
      )}

      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="font-display font-normal m-0" style={{ fontSize: 23, letterSpacing: "-0.03em", color: "var(--ink)" }}>
            Recent books
          </h2>
          <p className="text-[13px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
            Pick up where you left off.
          </p>
        </div>
        <Link href="/books" className="text-[11px] font-bold inline-flex items-center gap-1.5" style={{ color: "var(--teal)" }}>
          View all <ArrowUpRight size={13} />
        </Link>
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
        <div className="relative inline-flex items-center shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="appearance-none rounded-lg text-[11px] outline-none"
            style={{ padding: "9px 28px 9px 11px", border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 pointer-events-none" style={{ color: "var(--pencil)" }} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm mb-12" style={{ color: "var(--pencil)" }}>
          Loading...
        </p>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 mb-12"
          style={{
            minHeight: Math.ceil((RECENT_BOOKS_LIMIT + 1) / recentBooksColumns) * 216 + (Math.ceil((RECENT_BOOKS_LIMIT + 1) / recentBooksColumns) - 1) * 14,
            alignContent: "start",
          }}
        >
          <button
            onClick={() => setShowCreate(true)}
            className="lift-hover rounded-xl flex items-center gap-3 text-left"
            style={{ minHeight: 216, padding: 18, border: "1.5px dashed var(--pencil-light)" }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--teal-tint)", color: "var(--teal)" }}
            >
              <Plus size={19} />
            </div>
            <div>
              <p className="font-display font-normal m-0" style={{ fontSize: 14, color: "var(--ink)" }}>
                Create a new book
              </p>
              <p className="text-[11px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
                Start with a style and a prompt.
              </p>
            </div>
          </button>

          {visibleBooks.map((book, i) => {
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
                  <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--pencil)" }}>
                    <span>&nbsp;</span>
                    <span className="inline-flex items-center gap-1 font-bold text-[11px]" style={{ color: "var(--teal)" }}>
                      Open <ArrowUpRight size={12} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}

          {filteredBooks.length === 0 && (
            <p className="text-sm col-span-full" style={{ color: "var(--pencil)" }}>
              No books found. Try a different search.
            </p>
          )}
        </div>
      )}

      {showCreate && (
        <NewBookModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            getBooks().then(setBooks).catch(() => {});
          }}
        />
      )}
    </AppShell>
  );
}

function StatCard({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: number; note?: string; tone: { bg: string; fg: string } }) {
  return (
    <div className="flex items-center gap-3 rounded-xl" style={{ minHeight: 91, padding: 16, border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
      <div className="w-[33px] h-[33px] rounded-lg flex items-center justify-center shrink-0" style={{ background: tone.bg, color: tone.fg }}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[11px] m-0 mb-1" style={{ color: "var(--pencil)" }}>{label}</p>
        <p className="font-display font-normal m-0" style={{ fontSize: 24, color: "var(--ink)" }}>{value}</p>
      </div>
      {note && <span className="text-[10px] self-end" style={{ color: "var(--pencil)" }}>{note}</span>}
    </div>
  );
}
