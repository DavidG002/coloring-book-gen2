"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen, LayoutDashboard, Library, Grid2X2, Settings, Sparkles, ArrowUpRight, ChevronDown,
} from "lucide-react";
import { getBooks } from "@/lib/api";

export default function AppShell({
  active,
  breadcrumb,
  children,
}: {
  active: "Overview" | "Books" | "Categories";
  breadcrumb: string;
  children: React.ReactNode;
}) {
  const [bookCount, setBookCount] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      getBooks()
        .then((books) => setBookCount(books.length))
        .catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex" style={{ background: "var(--paper)" }}>
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
          <Link
            href="/"
            className="nav-hover flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px]"
            style={
              active === "Overview"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
          >
            <LayoutDashboard size={16} />
            Overview
          </Link>
          <Link
            href="/books"
            className="nav-hover flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px]"
            style={
              active === "Books"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
          >
            <Library size={16} />
            Books
            {bookCount !== null && (
              <span className="ml-auto text-[11px]" style={{ color: "var(--teal)" }}>
                {bookCount}
              </span>
            )}
          </Link>
          <Link
            href="/categories"
            className="nav-hover flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px]"
            style={
              active === "Categories"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
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

      <main className="flex-1 min-w-0">
        <header
          className="flex items-center justify-between px-11"
          style={{ height: 70, borderBottom: "1px solid var(--pencil-light)" }}
        >
          <div className="flex gap-2.5 text-xs" style={{ color: "var(--pencil)" }}>
            <span>Studio</span>
            <span>/</span>
            <strong style={{ color: "var(--ink)" }}>{breadcrumb}</strong>
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
          {children}
        </div>
      </main>
    </div>
  );
}
