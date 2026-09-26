"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Trash2, Plus, Image as ImageIcon, MoreHorizontal, ArrowUpRight, BookOpen, CornerDownRight, ChevronDown } from "lucide-react";
import { getBook, getCategories, ApiError, type Book, type CategorySummary } from "@/lib/api";
import NewCategoryModal from "@/components/NewCategoryModal";
import DeleteBookModal from "@/components/DeleteBookModal";
import BookSettingsFields from "@/components/BookSettingsFields";
import BookPreviewSection from "@/components/BookPreviewSection";

import AppShell from "@/components/AppShell";
import DeleteCategoryModal from "@/components/DeleteCategoryModal";
import NewBookWizard from "@/components/NewBookWizard";

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
  const [deletingCategory, setDeletingCategory] = useState<CategorySummary | null>(null);
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<number | null>(null);
  
  const [justFinishedWizard, setJustFinishedWizard] = useState(false);
  const [selectedPreviewCategoryName, setSelectedPreviewCategoryName] = useState("");
  // Set when a category tile (now above the title, see below) is clicked —
  // drives BookPreviewSection's own selectedPreviewCategory via its new
  // selectedCategoryOverride prop. A fresh object (nonce: Date.now()) every
  // click so re-clicking the already-active category still re-applies,
  // rather than looking like a no-op change to BookPreviewSection's effect.
  const [categoryClickOverride, setCategoryClickOverride] = useState<{ name: string; nonce: number } | null>(null);
  // The categories section (tiles + its scroll row) can be collapsed down
  // to just its title bar — expanded by default per David's ask.
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [liveImageSettings, setLiveImageSettings] = useState<{
    canvas_width: number;
    canvas_height: number;
    subject_size_ratio: number;
  } | null>(null);
  // The categories row (see below) only scrolls sideways at lg:+ — below
  // that it's a normal stacked list using the page's own vertical scroll.
  // Native overflow-x containers don't respond to a plain vertical mouse
  // wheel (only shift+wheel/trackpad swipes do by default), so this
  // redirects vertical wheel delta into horizontal scroll, but only while
  // the row is actually in its horizontal-scrolling mode.
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  // `loading` is a dependency here on purpose, not an oversight — same fix
  // as BookPreviewSection's ResizeObserver effect. While loading is true,
  // this component returns the "Loading..." placeholder further down
  // instead of the real markup, so categoriesScrollRef.current is still
  // null on this effect's very first run. With an empty dependency array
  // the effect would only ever run once, against that null ref, and never
  // attach the listener at all once the real row (with the ref) actually
  // mounts — which is exactly why the wheel redirect wasn't doing anything
  // and a plain mouse wheel kept scrolling the page up/down instead of the
  // row left/right.
  useEffect(() => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      const isHorizontalMode = window.matchMedia("(min-width: 1024px)").matches;
      if (isHorizontalMode && el!.scrollWidth > el!.clientWidth) {
        el!.scrollLeft += e.deltaY;
        // React's onWheel is registered as a passive listener (it can't
        // call preventDefault — that's what let the page keep scrolling
        // underneath even though scrollLeft was moving too). Attaching the
        // listener directly to the DOM node with { passive: false } is what
        // actually lets preventDefault stop the page from also scrolling.
        e.preventDefault();
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [loading]);

  // Custom scrollbar for the categories row at lg+, replacing the native
  // one entirely. The native scrollbar kept fading in and out on hover no
  // matter how it was styled (::-webkit-scrollbar/scrollbar-width) — that
  // fade is the OS/browser's own overlay-scrollbar behavior, which some
  // browsers apply regardless of scrollbar CSS, so there was no reliable
  // way to make a *native* scrollbar simply stay put. This draws a plain
  // div as the track/thumb instead — a normal element, so "always visible"
  // is just its default state, no fighting a fade. It naturally spans the
  // full width of its container (same width as the preview canvas column,
  // since it lives in the same 1fr-wide wrapper as the tiles), tracks real
  // scroll position, and is click/drag-to-scroll like a real scrollbar.
  const categoriesTrackRef = useRef<HTMLDivElement>(null);
  const [categoriesScrollMetrics, setCategoriesScrollMetrics] = useState({ widthPct: 100, leftPct: 0 });

  useEffect(() => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    function update() {
      const node = el!;
      if (node.scrollWidth <= node.clientWidth) {
        setCategoriesScrollMetrics({ widthPct: 100, leftPct: 0 });
        return;
      }
      const widthPct = (node.clientWidth / node.scrollWidth) * 100;
      const maxScrollLeft = node.scrollWidth - node.clientWidth;
      const leftPct = maxScrollLeft > 0 ? (node.scrollLeft / maxScrollLeft) * (100 - widthPct) : 0;
      setCategoriesScrollMetrics({ widthPct, leftPct });
    }
    update();
    el.addEventListener("scroll", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [loading, categories.length]);

  function handleCategoriesTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = categoriesScrollRef.current;
    const track = categoriesTrackRef.current;
    if (!el || !track) return;
    const trackRect = track.getBoundingClientRect();
    const thumbWidthPx = (categoriesScrollMetrics.widthPct / 100) * trackRect.width;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    function moveTo(clientX: number) {
      const usableWidth = trackRect.width - thumbWidthPx;
      const ratio = usableWidth > 0 ? (clientX - trackRect.left - thumbWidthPx / 2) / usableWidth : 0;
      el!.scrollLeft = Math.max(0, Math.min(1, ratio)) * maxScrollLeft;
    }
    moveTo(e.clientX);
    track.setPointerCapture(e.pointerId);
    function onMove(ev: PointerEvent) {
      moveTo(ev.clientX);
    }
    function onUp() {
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
    }
    track.addEventListener("pointermove", onMove);
    track.addEventListener("pointerup", onUp);
  }


  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window === "undefined") return;
      const key = `just-finished-wizard-${bookId}`;
      if (window.sessionStorage.getItem(key) === "1") {
        setJustFinishedWizard(true);
        window.sessionStorage.removeItem(key);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [bookId]);

  
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

  function handleSelectCategory(cat: CategorySummary) {
    // Same "land on Generate, not wherever it was last left" fix the old
    // direct-navigation tile click used to apply on its own click handler —
    // preserved here so the "Open sequence" badge link (the new way to
    // actually reach the workflow) still lands on Generate.
    try {
      window.localStorage.setItem(`category-active-step-${cat.name}`, "generate");
    } catch {
      // localStorage unavailable — CategorySequenceShell's own default step
      // is already "generate".
    }
    setCategoryClickOverride({ name: cat.name, nonce: Date.now() });
  }

  async function handleCloseNewCategoryModal() {
    setShowNewCategoryModal(false);
    try {
      const allCategories = await getCategories();
      const mine = allCategories.filter((c) => c.book_id === bookId);
      setCategories(mine);
      if (mine.length > 0) {
        const newest = mine.reduce((a, b) => (b.id > a.id ? b : a));
        setLastCreatedCategoryId(newest.id);
        setHighlightedCategoryId(newest.id);
        setTimeout(() => setHighlightedCategoryId(null), 3000);
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
  const activePreviewCategory = categories.find((c) => c.name === selectedPreviewCategoryName);

  if (!book.wizard_completed) {
    return (
      <NewBookWizard
        book={book}
        onFinished={(updated) => {
          setBook(updated);
          setJustFinishedWizard(true);
          getCategories().then((all) => setCategories(all.filter((c) => c.book_id === bookId))).catch(() => {});
        }}
      />
    );
  }
  return (
    <AppShell active="Books" breadcrumb={book.name} contentMaxWidth={1560}>
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

      <p className="text-[10px] uppercase font-bold m-0 mb-4" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
        Book studio / {book.name}
      </p>

      {/* Was a plain flex row (items-end justify-between); switched to the
          SAME explicit column definition as the real content grid further
          down (1fr / 380px, same gap) so the left column here is a definite
          1fr computed against this row's own full width — identical to the
          preview canvas column below. A flex item with no flex-grow only
          takes its content's own width, so nesting a "matching" 1fr grid
          inside it (the previous approach) doesn't actually resolve to the
          same pixel width; making this row itself the matching grid does. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 mb-8 mt-9 items-end">
        {/* min-w-0: grid items default to min-width: auto, meaning this
            column would otherwise refuse to shrink below the intrinsic
            (unwrapped) width of its content — which is exactly what let the
            categories row below force this whole column wider than the 1fr
            track, spilling past where the preview canvas column ends.
            min-w-0 lets the track's own computed width win, so the
            horizontally-scrolling row actually clips at that width instead
            of stretching the grid to fit every tile. */}
        <div className="min-w-0">
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

          {/* Experimental placement: moved from a standalone Panel-wrapped
              section above the title to sit here instead, between the base
              prompt and the sequence badge link (which stays put) — no card
              chrome now, just the title sentence + tile grid straight on the
              page background. Clicking a tile still just makes that category
              the active preview (same as the Preview Settings dropdown
              further down); the badge link below is still the way to reach
              the workflow. Reaching the workflow page directly by its own
              URL still works. */}
          {/* The outer row (h1's grandparent, above) now provides the 1fr
              column width directly, so this section just fills it — no more
              nested width-matching grid needed here. */}
          <div className="mt-4 min-w-0">
            <button
              type="button"
              onClick={() => setCategoriesExpanded((v) => !v)}
              className="w-full flex items-center justify-between gap-4 mb-2.5 text-left"
              aria-expanded={categoriesExpanded}
            >
              <span className="font-bold inline-flex items-center gap-1.5" style={{ fontSize: 15, color: "var(--pencil)" }}>
                Browse or add new categories to your book collection
                <ChevronDown
                  size={15}
                  style={{
                    transform: categoriesExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </span>
              <span
                className="inline-flex items-center justify-center rounded-full text-[10px] font-bold shrink-0"
                style={{ minWidth: 20, height: 20, padding: "0 6px", background: "var(--teal-tint)", color: "var(--teal-dark)" }}
              >
                {categories.length}
              </span>
            </button>

            {categoriesExpanded && (
              <>
            {/* Two layouts in one, switching at lg (1024px):
                - Below lg (tablet/mobile): back to a stacked grid (1 col,
                  2 at sm), same as before the horizontal-scroll experiment,
                  but height-capped — 3 rows on a single column, 2 rows once
                  it's 2-across at sm — with its own overflow-y-auto, so a
                  book with a lot of categories scrolls up/down inside this
                  small box instead of pushing the whole page down.
                - At lg+: a single non-wrapping row (flex, no wrap) that
                  scrolls sideways instead, since there's now enough width
                  for that to be the more natural gesture. min-w-0 lets it
                  actually clip at the 1fr column's width (see the comment
                  on the grid item further up) rather than forcing the
                  column wider. The wheel-redirect listener (set up above)
                  is attached to this element via categoriesScrollRef. The
                  native scrollbar is hidden at lg+ (globals.css) in favor
                  of the custom track/thumb rendered just below it — no
                  more reserved padding needed for a native scrollbar to
                  sit in. */}
            {/* Touch scrolling here is otherwise native/free: a finger drag
                that moves enough is treated as a scroll gesture and never
                fires the tile buttons' onClick, while a stationary tap
                does — browsers already separate the two, no extra JS
                needed for "scroll to browse, tap to select". Only real gap
                was momentum on older iOS Safari, which is what
                WebkitOverflowScrolling adds; modern iOS/Android already
                have inertial scrolling on overflow-y-auto without it, but
                it's a harmless, standard belt-and-suspenders addition. */}
            <div
              ref={categoriesScrollRef}
              className="category-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-nowrap gap-2 max-h-[190px] sm:max-h-[124px] overflow-y-auto lg:max-h-none lg:overflow-y-visible lg:overflow-x-auto min-w-0"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {/* Add-category tile stays a fixed size on purpose — only the
                  category tiles themselves grow to fill the row, since a
                  wider "Add category" tile buys nothing but a category tile
                  benefits from more room for a long name. */}
              <button
                onClick={() => setShowNewCategoryModal(true)}
                className="lift-hover flex items-center gap-3 text-left w-full lg:w-[200px] shrink-0"
                style={{
                  padding: "11px 10px",
                  border: "1.5px dashed var(--teal)",
                  borderRadius: 9,
                  background: "var(--teal-tint)",
                }}
              >
                <div
                  className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--teal)", color: "white" }}
                >
                  <Plus size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold m-0 truncate" style={{ color: "var(--teal-dark)" }}>
                    Add category
                  </p>
                  <p className="text-[10px] m-0 mt-1 truncate" style={{ color: "var(--pencil)" }}>
                    Start a new collection
                  </p>
                </div>
              </button>

              {categories.map((cat, i) => {
                const tone = TONES[i % TONES.length];
                // Persistent "this is the active preview" state, distinct from
                // highlightedCategoryId's brief flash on a just-created category
                // — the tiles now double as a switcher, so which one is active
                // needs to stay visible, not just flash once.
                const isActive = selectedPreviewCategoryName === cat.name;
                const isJustCreated = highlightedCategoryId === cat.id;
                return (
                  // At lg+, width is (100% - the fixed 200px add-tile - the
                  // 3 gaps between 4 items) / 3 — sized so exactly 3
                  // category tiles plus the add-tile fit in view (was a flat
                  // 200px, same as the add-tile, which fit 4 + a sliver of a
                  // 5th; long category names need the room more than a 4th
                  // tile being fully visible does).
                  <div
                    key={cat.id}
                    className="flex items-center gap-1.5 w-full lg:w-[calc((100%-224px)/3)] shrink-0"
                    style={{
                      border: `1px solid ${isJustCreated || isActive ? "var(--teal)" : "var(--pencil-light)"}`,
                      background: isJustCreated || isActive ? "var(--teal-tint)" : "var(--paper)",
                      borderRadius: 9,
                      transition: "background 0.4s ease, border-color 0.4s ease",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className="lift-hover flex items-center gap-3 flex-1 min-w-0 text-left"
                      style={{ padding: "11px 10px" }}
                    >
                      <div
                        className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        <ImageIcon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold m-0 capitalize truncate" style={{ color: "var(--ink)" }}>
                          {cat.name}
                        </p>
                        <p className="text-[10px] m-0 mt-1 truncate" style={{ color: "var(--pencil)" }}>
                          {cat.subject_count} subj, {cat.variation_count} var
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => setDeletingCategory(cat)}
                      className="shrink-0 flex items-center justify-center"
                      style={{ width: 28, height: 28, marginRight: 6, color: "var(--pencil)" }}
                      title={`Delete ${cat.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}

              {categories.length === 0 && (
                <p className="text-sm mt-1 shrink-0" style={{ color: "var(--pencil)" }}>
                  No categories yet in this book.
                </p>
              )}
            </div>

            {/* Custom scrollbar for the row above (lg+ only — below lg it's
                the stacked/vertical layout with its own native scroll). A
                plain div, so "stays visible" is just its resting state
                rather than something we have to fight the browser/OS to
                keep — see the comment on categoriesTrackRef further up for
                why the native scrollbar wasn't reliable here. Full width of
                this wrapper, i.e. the same width as the preview canvas
                column. Click anywhere on it, or drag, to scroll.
                Thumb color is soft/muted at rest (blending toward the rail)
                and darkens to the fuller color on hover, alongside the
                height change — a fade-in feel rather than a flat bar that's
                just suddenly taller. */}
            <div
              ref={categoriesTrackRef}
              onPointerDown={handleCategoriesTrackPointerDown}
              className="hidden lg:block group relative mt-3 rounded-full cursor-pointer h-[6px] hover:h-[12px] transition-[height] duration-150"
              style={{ background: "var(--pencil-light)" }}
            >
              <div
                className="absolute inset-y-0 rounded-full bg-[var(--pencil-light)] group-hover:bg-[var(--pencil)] transition-colors duration-150"
                style={{
                  left: `${categoriesScrollMetrics.leftPct}%`,
                  width: `${categoriesScrollMetrics.widthPct}%`,
                  pointerEvents: "none",
                }}
              />
            </div>
              </>
            )}
          </div>

          {activePreviewCategory && (
            <a
              href={`/categories/${activePreviewCategory.id}`}
              onClick={() => {
                try {
                  window.localStorage.setItem(`category-active-step-${activePreviewCategory.name}`, "generate");
                } catch {
                  // localStorage unavailable — CategorySequenceShell's own
                  // default step is already "generate".
                }
              }}
              className="inline-flex items-center gap-1 mt-9 rounded-md text-[10px] font-bold capitalize hover:underline"
              style={{ padding: "5px 8px", color: "var(--teal-dark)", background: "var(--teal-tint)" }}
              title={`Open ${activePreviewCategory.name}'s sequence workflow`}
            >
              <CornerDownRight size={11} /> {activePreviewCategory.name} sequence
            </a>
          )}
        </div>
        {/* justify-self-end: as a grid item this would otherwise stretch to
            fill the full 380px column (grid's default item sizing), turning
            this pill into a full-width bar — justify-self-end keeps it
            content-sized and pinned to the column's right edge, matching
            its old flex-row "shrink-0, pushed right by justify-between"
            look. */}
        <div
          className="inline-flex items-center gap-2 shrink-0 rounded-lg justify-self-end"
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
          <BookPreviewSection
            bookId={bookId}
            onCategoryChanged={setSelectedPreviewCategoryName}
            book={book}
            categories={categories}
            lastCreatedCategoryId={lastCreatedCategoryId}
            liveImageSettings={liveImageSettings}
            selectedCategoryOverride={categoryClickOverride}
          />
        </div>

        <div className="space-y-6">
          <BookSettingsFields
            bookId={bookId}
            onBookLoaded={setBook}
            onLiveImageSettingsChange={setLiveImageSettings}
            defaultSection={justFinishedWizard ? "knobs" : undefined}
            selectedCategoryName={selectedPreviewCategoryName}
          />
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
      {deletingCategory && (
        <DeleteCategoryModal
          categoryId={deletingCategory.id}
          categoryName={deletingCategory.name}
          bookId={bookId}
          onClose={() => {
            setDeletingCategory(null);
            getCategories().then((all) => setCategories(all.filter((c) => c.book_id === bookId))).catch(() => {});
          }}
        />
      )}
    </AppShell>
  );
}
