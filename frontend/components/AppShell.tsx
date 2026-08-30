"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen, LayoutDashboard, Library, Grid2X2, Settings, Sparkles, ArrowUpRight, ChevronDown, ChevronLeft,
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
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      getBooks()
        .then((books) => setBookCount(books.length))
        .catch(() => {});
      const saved = window.localStorage.getItem("sidebar-collapsed");
      if (saved === "1") setCollapsed(true);
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const sidebarWidth = collapsed ? 76 : 244;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--paper)" }}>
      <aside
        className="shrink-0 flex flex-col relative"
        style={{
          width: sidebarWidth,
          height: "100vh",
          position: "sticky",
          top: 0,
          padding: collapsed ? "24px 10px 18px" : "24px 16px 18px",
          borderRight: "1px solid var(--pencil-light)",
          background: "var(--canvas)",
          transition: ready ? "width 0.22s ease, padding 0.22s ease" : "none",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <div className={`flex items-center gap-2.5 mb-7 ${collapsed ? "justify-center px-0" : "px-2.5"}`}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--teal)", transform: "rotate(-5deg)" }}
          >
            <BookOpen size={15} color="white" />
          </div>
          {!collapsed && (
            <span className="font-display text-[19px] whitespace-nowrap" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
              coloring studio
            </span>
          )}
        </div>

        {!collapsed ? (
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
        ) : (
          <div
            className="flex items-center justify-center mb-7 mx-auto rounded-full text-[11px] font-bold"
            style={{ width: 28, height: 28, background: "var(--teal-tint)", color: "var(--teal-dark)" }}
            title="My studio"
          >
            A
          </div>
        )}

        <nav className="grid gap-1">
          <Link
            href="/"
            onClick={() => collapsed && toggleCollapsed()}
            title={collapsed ? "Overview" : undefined}
            className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            style={
              active === "Overview"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
          >
            <LayoutDashboard size={16} />
            {!collapsed && "Overview"}
          </Link>
          <Link
            href="/books"
            onClick={() => collapsed && toggleCollapsed()}
            title={collapsed ? "Books" : undefined}
            className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            style={
              active === "Books"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
          >
            <Library size={16} />
            {!collapsed && (
              <>
                Books
                {bookCount !== null && (
                  <span className="ml-auto text-[11px]" style={{ color: "var(--teal)" }}>
                    {bookCount}
                  </span>
                )}
              </>
            )}
          </Link>
          <Link
            href="/categories"
            onClick={() => collapsed && toggleCollapsed()}
            title={collapsed ? "Categories" : undefined}
            className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            style={
              active === "Categories"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
          >
            <Grid2X2 size={16} />
            {!collapsed && "Categories"}
          </Link>
          </nav>

          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--pencil-light)" }}>
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : undefined}
              className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] w-full ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
              style={{ color: "var(--pencil)" }}
            >
              <ChevronLeft size={16} style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.22s ease" }} />
              {!collapsed && "Collapse"}
            </button>
          </div>

        <div className="mt-auto">
        <Link
          href="/settings"
          onClick={() => collapsed && toggleCollapsed()}
          title={collapsed ? "Settings" : undefined}
            className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            style={{ color: "var(--pencil)" }}
          >
            <Settings size={16} />
            {!collapsed && "Settings"}
          </Link>

          {!collapsed && (
            <>
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

              <p className="mt-4 px-2.5 text-[10px] whitespace-nowrap" style={{ color: "var(--pencil)" }}>
                v1.0.0 <span className="px-1">•</span> local install
              </p>
            </>
          )}
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
            href="/account"
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
