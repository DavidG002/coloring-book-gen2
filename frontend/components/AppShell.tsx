"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  BookOpen, LayoutDashboard, Library, Grid2X2, Printer, Settings, Sparkles,ArrowUpRight, ChevronDown, ChevronLeft, LogOut, Menu, X,
} from "lucide-react";
import { getBooks } from "@/lib/api";
import NewBookModal from "./NewBookModal";
import ThemeToggle from "./ThemeToggle";

export default function AppShell({
  active,
  breadcrumb,
  children,
  contentMaxWidth,
}: {
  active: "Overview" | "Books" | "Categories" | "Print";
  breadcrumb: string;
  children: React.ReactNode;
  // Lets one page opt into a wider content area (e.g. the book detail
  // page's preview canvas + categories, which had room to spare) without
  // changing every other page that uses AppShell. Defaults to the
  // original 1100 everywhere this isn't passed.
  contentMaxWidth?: number;
}) {
  const { data: session } = useSession();
  const [bookCount, setBookCount] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  // Stage 1 of the responsive pass (see the "responsive-ui-audit" project
  // doc): below lg (1024px) there isn't room for the full 244px sidebar
  // alongside real content, so it's forced into its collapsed/icon-only
  // rail regardless of the user's manual preference. The manual toggle
  // still works above that width exactly as before.
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsNarrowViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Stage 2 (phone support): below 640px even the icon-only rail eats too
  // much of the screen to leave real content room. On a phone the sidebar
  // is hidden entirely and re-appears as an off-canvas drawer, opened by the
  // header's menu button — full-width nav labels shown (not the icon rail),
  // since it's the primary way to navigate while it's open.
  const [isPhoneViewport, setIsPhoneViewport] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => {
      setIsPhoneViewport(mq.matches);
      if (!mq.matches) setMobileDrawerOpen(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Renamed from the Stage 1 "effectiveCollapsed" — this now specifically
  // means "showing the narrow icon-only rail", which only applies above
  // phone width. At phone width the sidebar is either fully hidden or fully
  // expanded inside the drawer, never the icon rail.
  const showCollapsedRail = !isPhoneViewport && (isNarrowViewport || collapsed);

  function handleNavClick() {
    if (isPhoneViewport) {
      setMobileDrawerOpen(false);
      return;
    }
    // Re-expand a manually-collapsed sidebar after navigating — but not
    // when the collapse is just the forced tablet/laptop rail (isNarrowViewport),
    // since there's no wider state to "return" to there.
    if (collapsed && !isNarrowViewport) toggleCollapsed();
  }

  // Shown in place of the old static "My studio" placeholder — the
  // sidebar card doubles as the sign-out control now that accounts exist.
  const displayName = session?.user?.name || session?.user?.email || "Signed in";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

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

  const sidebarWidth = showCollapsedRail ? 76 : 244;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--paper)" }}>
      {/* Backdrop behind the phone drawer — tapping it closes the menu,
          same as tapping a nav link inside it. Only exists while the drawer
          is actually open, so it never intercepts clicks otherwise. */}
      {isPhoneViewport && mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }}
        />
      )}
      <aside
        className="shrink-0 flex flex-col relative"
        style={{
          width: isPhoneViewport ? 244 : sidebarWidth,
          height: "100vh",
          position: isPhoneViewport ? "fixed" : "sticky",
          top: 0,
          left: isPhoneViewport ? (mobileDrawerOpen ? 0 : -260) : undefined,
          zIndex: isPhoneViewport ? 50 : undefined,
          padding: showCollapsedRail ? "24px 10px 18px" : "24px 16px 18px",
          borderRight: "1px solid var(--shell-border)",
          background: "var(--shell)",
          boxShadow: isPhoneViewport && mobileDrawerOpen ? "0 10px 40px rgba(0,0,0,0.25)" : undefined,
          transition: isPhoneViewport ? "left 0.22s ease" : ready ? "width 0.22s ease, padding 0.22s ease" : "none",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <div className={`flex items-center gap-2.5 mb-7 ${showCollapsedRail ? "justify-center px-0" : "px-2.5"}`}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--teal)", transform: "rotate(-5deg)" }}
          >
            <BookOpen size={15} color="white" />
          </div>
          {!showCollapsedRail && (
            <span className="font-display text-[19px] whitespace-nowrap flex-1" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
              YOoPrints
            </span>
          )}
          {isPhoneViewport && (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Close menu"
              className="shrink-0 flex items-center justify-center rounded-md"
              style={{ width: 26, height: 26, color: "var(--pencil)" }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {!showCollapsedRail ? (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="flex items-center gap-2.5 p-2.5 mb-7 rounded-xl text-left w-full nav-hover"
            style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
              style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
                Signed in
              </p>
              <p className="text-xs font-semibold m-0 mt-0.5 truncate" style={{ color: "var(--ink)" }}>
                {displayName}
              </p>
            </div>
            <LogOut size={14} className="ml-auto shrink-0" style={{ color: "var(--pencil)" }} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center justify-center mb-7 mx-auto rounded-full text-[11px] font-bold"
            style={{ width: 28, height: 28, background: "var(--teal-tint)", color: "var(--teal-dark)" }}
            title={`Sign out (${displayName})`}
          >
            {initial}
          </button>
        )}

        <nav className="grid gap-1">
          <Link
            href="/"
            onClick={handleNavClick}
            title={showCollapsedRail ? "Overview" : undefined}
            className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] ${showCollapsedRail ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            style={
              active === "Overview"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
          >
            <LayoutDashboard size={16} />
            {!showCollapsedRail && "Overview"}
          </Link>
          <Link
            href="/books"
            onClick={handleNavClick}
            title={showCollapsedRail ? "Books" : undefined}
            className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] ${showCollapsedRail ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            style={
              active === "Books"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
          >
            <Library size={16} />
            {!showCollapsedRail && (
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
            onClick={handleNavClick}
            title={showCollapsedRail ? "Categories" : undefined}
            className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] ${showCollapsedRail ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            style={
              active === "Categories"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
          >
           <Grid2X2 size={16} />
            {!showCollapsedRail && "Categories"}
          </Link>
          <Link
            href="/print"
            onClick={handleNavClick}
            title={showCollapsedRail ? "Print & Publish" : undefined}
            className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] ${showCollapsedRail ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            style={
              active === "Print"
                ? { background: "var(--teal-tint)", color: "var(--teal-dark)", fontWeight: 700 }
                : { color: "var(--pencil)" }
            }
          >
            <Printer size={16} />
            {!showCollapsedRail && "Print & Publish"}
          </Link>
          </nav>

          {/* The manual collapse toggle only makes sense on the tablet/laptop
              tier — at phone width the sidebar is a drawer (fully shown or
              fully hidden, never an icon rail), and at the forced tablet
              rail width there's no wider state for this button to return to. */}
          {!isNarrowViewport && !isPhoneViewport && (
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
          )}

        <div className="mt-auto">
        <Link
          href="/settings"
          onClick={handleNavClick}
          title={showCollapsedRail ? "Settings" : undefined}
            className={`nav-hover flex items-center gap-2.5 rounded-lg text-[13px] ${showCollapsedRail ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            style={{ color: "var(--pencil)" }}
          >
            <Settings size={16} />
            {!showCollapsedRail && "Settings"}
          </Link>

          {!showCollapsedRail && (
            <>
              <div
                className="mt-5 p-3.5 rounded-xl"
                style={{ border: "1px solid var(--tone-blue)", background: "var(--tone-blue-bg)" }}
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
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--teal)" }}>
                  Start a book <ArrowUpRight size={12} />
                </button>
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
          className="flex items-center justify-between px-5 md:px-8 lg:px-11"
          style={{ height: 70, borderBottom: "1px solid var(--pencil-light)" }}
        >
          <div className="flex items-center gap-3">
            {isPhoneViewport && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open menu"
                className="shrink-0 -ml-1.5 flex items-center justify-center rounded-lg"
                style={{ width: 32, height: 32, color: "var(--pencil)" }}
              >
                <Menu size={19} />
              </button>
            )}
            <div className="flex gap-2.5 text-xs" style={{ color: "var(--pencil)" }}>
              <span>Studio</span>
              <span>/</span>
              <strong style={{ color: "var(--ink)" }}>{breadcrumb}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle />
            <Link
              href="/account"
              className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[10px] font-medium shrink-0"
              style={{ background: "var(--teal)", color: "white" }}
            >
              AC
            </Link>
          </div>
        </header>

        <div
          className="mx-auto px-5 md:px-8 lg:px-11"
          style={{ maxWidth: contentMaxWidth ?? 1100, paddingTop: 52, paddingBottom: 80 }}
        >
          {children}
        </div>
      </main>
      {showCreate && (
        <NewBookModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            getBooks().then((books) => setBookCount(books.length)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
