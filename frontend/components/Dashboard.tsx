"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen, FolderOpen, Layers, Search, ChevronDown, ArrowUpRight,
  LayoutDashboard, Library, Grid2X2, Settings, Plus, MoreHorizontal, Sparkles,
} from "lucide-react";
import { getBooks, getCategories, type BookSummary, type CategorySummary } from "@/lib/api";

const TONES = [
  { bg: "var(--tone-sage-bg)", fg: "var(--tone-sage)" },
  { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue)" },
  { bg: "var(--tone-peach-bg)", fg: "var(--tone-peach)" },
  { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow)" },
  { bg: "var(--tone-lavender-bg)", fg: "var(--tone-lavender)" },
];

export default function Dashboard() {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [todayLabel, setTodayLabel] = useState("");

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

  const filteredBooks = useMemo(
    () =>
      books
        .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.id - a.id),
    [books, query]
  );

  const recentCategories = useMemo(
    () => [...categories].sort((a, b) => b.id - a.id).slice(0, 5),
    [categories]
  );

  const totalSubjects = categories.reduce((sum, c) => sum + c.subject_count, 0);

  return (
    <div className="min-h-screen flex" style={{ background: "var(--paper)" }}>
      {/* Sidebar */}
      <aside
        className="shrink-0 flex flex-col"
        style={{ width: 244, padding: "24px 16px 18px", borderRight: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
      >
        <div className="flex items-center gap-2.5 px-2.5 mb-7">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--teal)", transform: "rotate(-5deg)" }}
          >
            <BookOpen size={15} color="white" />
          </div>
          <span className="font-display text-[19px]" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
            coloring studio
          </span>
        </div>

        <div
          className="flex items-center gap-2.5 p-2.5 mb-7 rounded-xl"
          style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
            style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}
          >
            A
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
              Workspace
            </p>
            <p className="text-xs font-semibold m-0 mt-0.5 truncate" style={{ color: "var(--ink)" }}>
              My studio
            </p>
          </div>
          <ChevronDown size={14} className="ml-auto shrink-0" style={{ color: "var(--pencil)" }} />
        </div>

        <nav className="grid gap-1">
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-bold"
            style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}
          >
            <LayoutDashboard size={16} />
            Overview
          </div>
            <Link
              href="/books"
              className="nav-hover flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px]"
              style={{ color: "var(--pencil)" }}
            >
            <Library size={16} />
            Books
            <span className="ml-auto text-[11px]" style={{ color: "var(--teal)" }}>
              {books.length}
            </span>
          </Link>
            <Link
              href="/categories"
              className="nav-hover flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px]"
              style={{ color: "var(--pencil)" }}
            >
            <Grid2X2 size={16} />
            Categories
          </Link>
        </nav>

        <div className="mt-auto">
          <Link
            href="/settings"
            className="nav-hover flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px]"
            style={{ color: "var(--pencil)" }}
          >
            <Settings size={16} />
            Settings
          </Link>

          <div
            className="mt-5 p-3.5 rounded-xl"
            style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center mb-3"
              style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}
            >
              <Sparkles size={13} />
            </div>
            <p className="font-display text-sm m-0" style={{ color: "var(--ink)" }}>
              Make something new
            </p>
            <p className="text-[11px] leading-relaxed mt-1 mb-2.5" style={{ color: "var(--pencil)" }}>
              Your next book is just a prompt away.
            </p>
            <Link href="/books/new" className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--teal)" }}>
              Start a book <ArrowUpRight size={12} />
            </Link>
          </div>

          <p className="mt-4 px-2.5 text-[10px]" style={{ color: "var(--pencil)" }}>
            v1.0.0 <span className="px-1">•</span> local install
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header
          className="flex items-center justify-between px-11"
          style={{ height: 70, borderBottom: "1px solid var(--pencil-light)" }}
        >
          <div className="flex gap-2.5 text-xs" style={{ color: "var(--pencil)" }}>
            <span>Studio</span>
            <span>/</span>
            <strong style={{ color: "var(--ink)" }}>Overview</strong>
          </div>
          <Link
            href="/settings"
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[10px] font-medium"
            style={{ background: "var(--teal)", color: "white" }}
          >
            AC
          </Link>
        </header>

        <div className="mx-auto" style={{ maxWidth: 1100, padding: "52px 44px 80px" }}>
          <div className="flex items-end justify-between gap-5 mb-9">
            <div>
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
            <Link
              href="/books/new"
              className="lift-hover inline-flex items-center gap-2 rounded-lg text-white text-xs font-bold shrink-0"
              style={{ padding: "11px 15px", background: "var(--teal)", boxShadow: "0 5px 14px rgba(91,124,147,0.14)" }}
            >
              <Plus size={16} /> New book
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3.5 mb-12">
            <StatCard icon={<BookOpen size={16} />} label="Total books" value={books.length} tone={TONES[0]} />
            <StatCard icon={<FolderOpen size={16} />} label="Categories" value={categories.length} note="Across all books" tone={TONES[1]} />
            <StatCard icon={<Layers size={16} />} label="Subjects" value={totalSubjects} note="Across all categories" tone={TONES[2]} />
          </div>

          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="font-display font-normal m-0" style={{ fontSize: 23, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                Your books
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
            <button
              className="inline-flex items-center gap-2 rounded-lg text-[11px]"
              style={{ padding: "9px 11px", border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
            >
              Recently created <ChevronDown size={14} />
            </button>
          </div>

          {loading ? (
            <p className="text-sm mb-12" style={{ color: "var(--pencil)" }}>
              Loading...
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3.5 mb-12">
              {filteredBooks.map((book, i) => {
                const tone = TONES[i % TONES.length];
                return (
                  <Link
                    key={book.id}
                    href={`/books/${book.id}`}
                    className="lift-hover rounded-xl overflow-hidden block"
                    style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{ height: 125, background: tone.bg }}
                    >
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

              <Link
                href="/books/new"
                className="lift-hover rounded-xl flex items-center gap-3"
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
              </Link>

              {filteredBooks.length === 0 && (
                <p className="text-sm col-span-full" style={{ color: "var(--pencil)" }}>
                  No books found. Try a different search.
                </p>
              )}
            </div>
          )}

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
            <div style={{ borderTop: "1px solid var(--pencil-light)" }}>
              {recentCategories.map((cat, i) => (
                <Link
                  key={cat.id}
                  href={`/categories/${encodeURIComponent(cat.name)}`}
                  className="flex items-center gap-3.5"
                  style={{ padding: "15px 2px", borderBottom: "1px solid var(--pencil-light)" }}
                >
                  <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: TONES[i % TONES.length].fg }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-normal capitalize m-0" style={{ fontSize: 14, color: "var(--ink)" }}>
                      {cat.name}
                    </p>
                    <p className="text-[11px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>
                      {bookNameById[cat.book_id] ?? "Unknown book"}
                    </p>
                  </div>
                  <span className="text-[11px]" style={{ color: "var(--pencil)" }}>
                    {cat.subject_count} subjects
                  </span>
                  <ArrowUpRight size={15} style={{ color: "var(--pencil)" }} />
                </Link>
              ))}
              {recentCategories.length === 0 && (
                <p className="text-sm py-4" style={{ color: "var(--pencil)" }}>
                  No categories yet.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note?: string;
  tone: { bg: string; fg: string };
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl"
      style={{ minHeight: 91, padding: 16, border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
    >
      <div
        className="w-[33px] h-[33px] rounded-lg flex items-center justify-center shrink-0"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[11px] m-0 mb-1" style={{ color: "var(--pencil)" }}>
          {label}
        </p>
        <p className="font-display font-normal m-0" style={{ fontSize: 24, color: "var(--ink)" }}>
          {value}
        </p>
      </div>
      {note && (
        <span className="text-[10px] self-end" style={{ color: "var(--pencil)" }}>
          {note}
        </span>
      )}
    </div>
  );
}
