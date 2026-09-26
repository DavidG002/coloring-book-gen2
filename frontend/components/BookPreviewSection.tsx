"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, WandSparkles, Check, ArrowRight } from "lucide-react";
import { getBook, getAuthHeaders, ApiError, type Book, type CategorySummary } from "@/lib/api";
import { useAccessToken } from "@/lib/hooks/useAccessToken";
import { Panel, PanelSection } from "./SettingsUI";
import PrepareCategoryPanel from "./PrepareCategoryPanel";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BookPreviewHistoryItem {
  id: number;
  category: string;
  subject: string;
  variation_text: string;
  canvas_width: number;
  canvas_height: number;
  subject_size_ratio: number;
  white_clean_threshold: number;
  black_clean_threshold: number;
  palette_colors: number;
  prompt_used?: string | null;
  created_at: string;
  promoted_image_id?: number | null;
}

async function checkPreviewAvailability(bookId: number) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/preview-availability`, {
    headers: await getAuthHeaders(),
  });
  return res.json() as Promise<{
    available: boolean;
    all_categories: string[];
    eligible_categories: string[];
    sample_subject?: string;
    sample_variation?: string;
    sample_category?: string;
  }>;
}

async function getCategoryPreviewOptions(bookId: number, categoryName: string, subjectName?: string) {
  const query = subjectName ? `?subject_name=${encodeURIComponent(subjectName)}` : "";
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/preview-options/${encodeURIComponent(categoryName)}${query}`, {
    headers: await getAuthHeaders(),
  });
  return res.json() as Promise<{ subjects: string[]; variations: string[] }>;
}

async function fetchPreviewImage(
  bookId: number,
  settings: {
    canvas_width: number;
    canvas_height: number;
    subject_size_ratio: number;
    white_clean_threshold: number;
    black_clean_threshold: number;
    palette_colors: number;
    category_name: string;
    subject_name?: string;
    variation_text?: string;
  }
): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to generate preview");
  }
  return res.blob();
}

async function getPreviewHistory(bookId: number): Promise<BookPreviewHistoryItem[]> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/previews`, {
    headers: await getAuthHeaders(),
  });
  return res.json();
}

async function promotePreviewToImage(
  bookId: number,
  previewId: number
): Promise<{
  image_id: number;
  category_id: number;
  subject: string;
  variation_text: string;
  settings_updated: boolean;
  already_promoted: boolean;
}> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/previews/${previewId}/promote`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to use this preview as the final image");
  }
  return res.json();
}

// Handed straight to <img src>, which can't set an Authorization header —
// so the access token rides along as a query param instead (accepted as a
// fallback by backend/services/auth.py's get_current_user). accessToken is
// undefined until the session has loaded (see useAccessToken); callers
// should hold off rendering the src until then rather than requesting the
// URL with no token and getting a 401.
function previewFileUrl(previewId: number, accessToken: string | undefined): string {
  return `${API_BASE_URL}/books/previews/${previewId}/file?token=${encodeURIComponent(accessToken ?? "")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function BookPreviewSection({
  bookId,
  onCategoryChanged,
  book,
  categories,
  lastCreatedCategoryId,
  liveImageSettings,
}: {
  bookId: number;
  onCategoryChanged?: (categoryName: string) => void;
  book?: Book | null;
  categories: CategorySummary[];
  lastCreatedCategoryId?: number;
  liveImageSettings?: { canvas_width: number; canvas_height: number; subject_size_ratio: number } | null;
}) {
  const router = useRouter();
  const accessToken = useAccessToken();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [promotingPreviewId, setPromotingPreviewId] = useState<number | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [eligibleCategories, setEligibleCategories] = useState<string[]>([]);
  // Bumped whenever PrepareCategoryPanel saves a subject/variation edit, so
  // the subjects/variations effects below re-fetch for the CURRENTLY
  // selected category immediately — without this, editing the category
  // you're already looking at (rather than switching away and back) left
  // the Preview Settings dropdowns showing stale data until a refresh,
  // since neither effect's own dependencies (category/subject name) had
  // actually changed.
  const [categoryOptionsRefreshTrigger, setCategoryOptionsRefreshTrigger] = useState(0);

  const [selectedPreviewCategory, setSelectedPreviewCategory] = useState<string>("");

  useEffect(() => {
    onCategoryChanged?.(selectedPreviewCategory);
  }, [selectedPreviewCategory, onCategoryChanged]);
  const [sampleSubject, setSampleSubject] = useState<string | null>(null);
  const [sampleVariation, setSampleVariation] = useState<string | null>(null);

  const [categorySubjects, setCategorySubjects] = useState<string[]>([]);
  const [categoryVariations, setCategoryVariations] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedVariation, setSelectedVariation] = useState<string>("");
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [previewState, setPreviewState] = useState<"idle" | "confirming" | "loading" | "done">("idle");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showFullSize, setShowFullSize] = useState(false);
  const [trueSizeView, setTrueSizeView] = useState(false);
  const [lastCanvasWidth, setLastCanvasWidth] = useState(595);
  const [lastCanvasHeight, setLastCanvasHeight] = useState(842);

  const viewerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelDragStart = useRef({ x: 0, scrollLeft: 0 });
  const wheelDragMoved = useRef(false);
  const [isDraggingWheel, setIsDraggingWheel] = useState(false);

  // Mobile fix: canvasDisplayWidth/Height below were computed only against
  // fixed desktop-oriented caps (600x660), with no awareness of how much
  // room the page actually had. The wheel's own outer div already clamps to
  // maxWidth: 100%, but its children (the canvas box, each preview image)
  // stay at the full uncapped size and simply overflow off-screen on a
  // phone — which is what showed up as "elongated, doesn't fit, have to
  // scroll to see it" (that's the canvas overflowing, not the intentional
  // side-to-side scroll between preview items). Measuring the actual
  // available width via ResizeObserver and folding it into the cap below
  // scales the whole canvas down proportionally so it fits the screen
  // outright, on any viewport, without guessing at breakpoint numbers.
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewContainerWidth, setPreviewContainerWidth] = useState<number | null>(null);

  // `loading` is a dependency here on purpose, not an oversight: while
  // loading is true, this component returns the "Loading..." placeholder
  // below (see the early return further down) instead of the real canvas
  // markup — so previewContainerRef.current is still null on this effect's
  // very first run. With an empty dependency array the effect would only
  // ever run once, against that null ref, and never again — silently
  // leaving previewContainerWidth stuck at null (and the canvas stuck at
  // the old fixed-600px cap) for the rest of the component's life. Re-
  // running when `loading` flips to false lets it attach once the real,
  // ref-bearing markup has actually mounted.
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const update = () => setPreviewContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  function handleWheelMouseDown(e: React.MouseEvent) {
    if (!wheelRef.current) return;
    setIsDraggingWheel(true);
    wheelDragMoved.current = false;
    wheelDragStart.current = { x: e.pageX, scrollLeft: wheelRef.current.scrollLeft };
  }

  const WHEEL_DRAG_MULTIPLIER = 2.5;

  function handleWheelMouseMove(e: React.MouseEvent) {
    if (!isDraggingWheel || !wheelRef.current) return;
    e.preventDefault();
    const dx = e.pageX - wheelDragStart.current.x;
    if (Math.abs(dx) > 3) wheelDragMoved.current = true;
    wheelRef.current.scrollLeft = wheelDragStart.current.scrollLeft - dx * WHEEL_DRAG_MULTIPLIER;
  }

  function handleWheelMouseUp() {
    setIsDraggingWheel(false);
  }

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    // The wheel only ever shows the selected category's own previews now
    // (see reversedHistory below) — reset back to the guide square rather
    // than leaving activeIndex pointing at whatever position happened to
    // be scrolled to in the PREVIOUS category's shorter or longer list.
    setActiveIndex(0);
    if (wheelRef.current) wheelRef.current.scrollLeft = 0;
  }, [selectedPreviewCategory]);

  function handleWheelScroll() {
    if (!wheelRef.current || !canvasDisplayWidth) return;
    const idx = Math.round(wheelRef.current.scrollLeft / canvasDisplayWidth);
    setActiveIndex(idx);
  }

  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    function onNativeWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el!.scrollLeft += e.deltaY * 2.5;
      }
    }
    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => el.removeEventListener("wheel", onNativeWheel);
  }, [loading]);

  const [previewHistory, setPreviewHistory] = useState<BookPreviewHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedPreviewId, setExpandedPreviewId] = useState<number | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  function loadPreviewHistory() {
    setLoadingHistory(true);
    getPreviewHistory(bookId)
      .then(setPreviewHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }

  useEffect(() => {
    if (showFullSize && trueSizeView && viewerRef.current) {
      const el = viewerRef.current;
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, (lastCanvasWidth - el.clientWidth) / 2);
        el.scrollTop = Math.max(0, (lastCanvasHeight - el.clientHeight) / 2);
      });
    }
  }, [showFullSize, trueSizeView, lightboxImageUrl, lastCanvasWidth, lastCanvasHeight]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const availability = await checkPreviewAvailability(bookId);
        if (cancelled) return;
        setPreviewAvailable(availability.available);
        setEligibleCategories(availability.eligible_categories);
        setSampleSubject(availability.sample_subject ?? null);
        setSampleVariation(availability.sample_variation ?? null);
        // The backend only offers a sample_category when it has an eligible
        // subject + variation. A category that still exists but currently
        // has none (e.g. its last subject was just deleted) comes back with
        // no sample_category, which used to leave selectedPreviewCategory as
        // "" — matching no <option>, so the dropdown visually showed the
        // first category while selectedCategoryId silently resolved to
        // undefined (breaking "Add subject"/"Add variation" with no visible
        // error). Fall back to the first real category so the selection
        // always matches something the dropdown actually shows.
        const fallbackCategory =
          availability.sample_category && categories.some((c) => c.name === availability.sample_category)
            ? availability.sample_category
            : categories[0]?.name ?? "";
        setSelectedPreviewCategory(fallbackCategory);
        loadPreviewHistory();
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load preview data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  async function refreshCategoryEligibility() {
    try {
      const availability = await checkPreviewAvailability(bookId);
      setPreviewAvailable(availability.available);
      setEligibleCategories(availability.eligible_categories);
    } catch {
      // best-effort — a failed refresh just leaves the previous eligibility
      // state in place rather than surfacing an error for a background sync.
    }
    setCategoryOptionsRefreshTrigger((n) => n + 1);
  }

  useEffect(() => {
    if (!lastCreatedCategoryId) return;
    const match = categories.find((c) => c.id === lastCreatedCategoryId);
    if (!match) return;
    const timer = setTimeout(() => setSelectedPreviewCategory(match.name), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCreatedCategoryId]);

  useEffect(() => {
    // Just the subjects list + picking which one starts selected. Variations
    // are fetched separately below, scoped to whichever subject ends up
    // selected — a category's variations aren't one flat pool, each
    // subject has its own (see PrepareCategoryPanel's own subject_id
    // filter), so this can't be resolved until a subject is known.
    //
    // Deliberately NOT gated on eligibleCategories here — that flag is
    // category-WIDE ("does this category have a variation anywhere at
    // all"), so a freshly added subject with no variation of its own yet
    // was getting wiped from this list the instant it was added (and
    // staying wiped even across a refresh), even though the backend
    // already returns it. Eligibility still correctly gates the actual
    // "Generate preview" action and its warning banner further down —
    // just not what shows up in this dropdown.
    if (!selectedPreviewCategory) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategorySubjects([]);
      setSelectedSubject("");
      return;
    }
    let cancelled = false;
    getCategoryPreviewOptions(bookId, selectedPreviewCategory)
      .then((opts) => {
        if (cancelled) return;
        setCategorySubjects(opts.subjects);
        setSelectedSubject(opts.subjects.includes(sampleSubject ?? "") ? (sampleSubject as string) : opts.subjects[0] ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, selectedPreviewCategory, categoryOptionsRefreshTrigger]);

  useEffect(() => {
    // Variations for the currently selected subject only — the backend
    // filters by subject_name now, instead of returning every variation
    // in the category mixed together (the old, since-removed behavior).
    // Same reasoning as the subjects effect above: no eligibleCategories
    // gate here either — a subject with genuinely zero variations yet
    // just gets an empty list back from the backend on its own, which
    // already disables this dropdown via categoryVariations.length === 0.
    if (!selectedPreviewCategory || !selectedSubject) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryVariations([]);
      return;
    }
    let cancelled = false;
    setLoadingOptions(true);
    getCategoryPreviewOptions(bookId, selectedPreviewCategory, selectedSubject)
      .then((opts) => {
        if (cancelled) return;
        setCategoryVariations(opts.variations);
        setSelectedVariation(
          selectedSubject === sampleSubject && opts.variations.includes(sampleVariation ?? "")
            ? (sampleVariation as string)
            : opts.variations[0] ?? ""
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, selectedPreviewCategory, selectedSubject, categoryOptionsRefreshTrigger]);

  function handleMouseDown(e: React.MouseEvent) {
    if (!viewerRef.current) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.pageX,
      y: e.pageY,
      scrollLeft: viewerRef.current.scrollLeft,
      scrollTop: viewerRef.current.scrollTop,
    };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || !viewerRef.current) return;
    e.preventDefault();
    const dx = e.pageX - dragStart.current.x;
    const dy = e.pageY - dragStart.current.y;
    viewerRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    viewerRef.current.scrollTop = dragStart.current.scrollTop - dy;
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  async function handleGeneratePreview() {
    setError(null);
    setPreviewState("loading");
    try {
      const book = await getBook(bookId);
      setLastCanvasWidth(book.canvas_width);
      setLastCanvasHeight(book.canvas_height);

      const blob = await fetchPreviewImage(bookId, {
        canvas_width: book.canvas_width,
        canvas_height: book.canvas_height,
        subject_size_ratio: book.subject_size_ratio,
        white_clean_threshold: book.white_clean_threshold,
        black_clean_threshold: book.black_clean_threshold,
        palette_colors: book.palette_colors,
        category_name: selectedPreviewCategory,
        subject_name: selectedSubject || undefined,
        variation_text: selectedVariation || undefined,
      });
      if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
      setPreviewImageUrl(URL.createObjectURL(blob));
      setPreviewState("done");
      loadPreviewHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
      setPreviewState("idle");
    }
  }

  function handleClosePreview() {
    if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
    setPreviewImageUrl(null);
    setPreviewState("idle");
  }

  function handlePreviewCategoryChange(value: string) {
    setSelectedPreviewCategory(value);
    handleClosePreview();
  }

  function goToCategoryGenerateStep(categoryId: number) {
    // These links are meant as a shortcut straight into Generate, but
    // CategorySequenceShell remembers whichever step was last open for a
    // category (in localStorage, keyed by category name) and restores it
    // on load — so if Language was the last step visited, landing here
    // silently reopened Language instead. Pre-setting that same key to
    // "generate" before navigating makes this link always land on
    // Generate, the same way a fresh category does.
    try {
      if (selectedPreviewCategory) {
        window.localStorage.setItem(`category-active-step-${selectedPreviewCategory}`, "generate");
      }
    } catch {
      // localStorage unavailable — CategorySequenceShell's own default
      // step is already "generate", so this just won't override a
      // different remembered step as reliably.
    }
    router.push(`/categories/${categoryId}`);
  }

  async function handleUseAsFinalImage(preview: BookPreviewHistoryItem) {
    setPromoteError(null);
    setPromotingPreviewId(preview.id);
    try {
      const result = await promotePreviewToImage(bookId, preview.id);
      // One-shot flag so the category's Generate step can point out which
      // image just landed there — same pattern as the "just finished
      // wizard" / "highlight newest category" flags elsewhere in this app.
      try {
        window.sessionStorage.setItem(
          `promoted-image-${result.category_id}`,
          JSON.stringify({ imageId: result.image_id, subject: result.subject })
        );
      } catch {
        // sessionStorage unavailable — the image still landed fine, it just
        // won't be highlighted when the Generate page opens.
      }
      goToCategoryGenerateStep(result.category_id);
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : "Failed to use this image");
      setPromotingPreviewId(null);
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--pencil)" }}>Loading...</p>;
  }

  const canvasW = liveImageSettings?.canvas_width || book?.canvas_width || lastCanvasWidth || 595;
  const canvasH = liveImageSettings?.canvas_height || book?.canvas_height || lastCanvasHeight || 842;
  const subjectRatio = liveImageSettings?.subject_size_ratio ?? book?.subject_size_ratio ?? 0.5;
  // Two independent caps rather than one square bound: the book detail
  // page's left column is now wide enough (see the page's widened
  // contentMaxWidth + PrepareCategoryPanel's own layout) to give a
  // portrait canvas noticeably more room without it also needing to
  // grow absurdly tall. Whichever cap binds first still preserves the
  // canvas's own aspect ratio exactly as before — this only raises the
  // ceiling, the scale math is unchanged.
  const CANVAS_PREVIEW_MAX_WIDTH = 600;
  const CANVAS_PREVIEW_MAX_HEIGHT = 660;
  // The panel around the wheel has 20px padding on each side (see the
  // "rounded-lg" teal-tint div below) — subtracting that from the measured
  // container width gives the actual space the canvas box can use.
  const effectiveMaxWidth = previewContainerWidth
    ? Math.min(CANVAS_PREVIEW_MAX_WIDTH, previewContainerWidth - 40)
    : CANVAS_PREVIEW_MAX_WIDTH;
  const canvasRatio = canvasW / canvasH;
  let canvasDisplayWidth = effectiveMaxWidth;
  let canvasDisplayHeight = effectiveMaxWidth / canvasRatio;
  if (canvasDisplayHeight > CANVAS_PREVIEW_MAX_HEIGHT) {
    canvasDisplayHeight = CANVAS_PREVIEW_MAX_HEIGHT;
    canvasDisplayWidth = CANVAS_PREVIEW_MAX_HEIGHT * canvasRatio;
  }
  // Match the new-book wizard's live preview: the subject square is sized
  // relative to the canvas's shorter side, so 100% fits exactly inside the
  // canvas regardless of orientation (the wizard bases it on canvas width,
  // which is the shorter side for every portrait paper preset).
  const subjectSquareBasisPx = Math.min(canvasDisplayWidth, canvasDisplayHeight);
  const subjectSquarePx = subjectSquareBasisPx * subjectRatio;
  // Scoped to whichever category is selected in "Preview settings" — this
  // used to show every preview across the whole book mixed together,
  // which made "scroll through this category's results and pick a
  // winner" meaningless once a book had more than one category.
  const categoryPreviewHistory = previewHistory.filter((p) => p.category === selectedPreviewCategory);
  const reversedHistory = [...categoryPreviewHistory].reverse();
  const selectedCategoryId = categories.find((c) => c.name === selectedPreviewCategory)?.id;

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      {/* Preview canvas */}
      <Panel
        kicker="PREVIEW CANVAS"
        title="Bring the story to life"
        right={
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold" style={{ color: "var(--teal)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--teal)" }} />
            {categoryPreviewHistory.length > 0 ? `${categoryPreviewHistory.length} preview${categoryPreviewHistory.length === 1 ? "" : "s"}` : "Ready to create"}
          </span>
        }
      >
          <div
            ref={previewContainerRef}
            className="rounded-lg"
            style={{ background: "var(--teal-tint)", padding: "16px 20px 20px" }}
          >
            <span
              className="inline-flex items-center gap-1.5 text-[11px] mb-3"
              style={{ color: "var(--teal-dark)" }}
            >
              <FileText size={13} />
              {activeIndex > 0 && reversedHistory[activeIndex - 1]
                ? `${reversedHistory[activeIndex - 1].subject} — ${reversedHistory[activeIndex - 1].variation_text}`
                : "Canvas"}
            </span>
            <div
              ref={wheelRef}
              onMouseDown={handleWheelMouseDown}
              onMouseMove={handleWheelMouseMove}
              onMouseUp={handleWheelMouseUp}
              onMouseLeave={handleWheelMouseUp}
              onScroll={handleWheelScroll}
              className="preview-wheel flex items-center"
              style={{
                width: canvasDisplayWidth,
                maxWidth: "100%",
                margin: "0 auto",
                minHeight: canvasDisplayHeight,
                overflowX: "auto",
                overflowY: "hidden",
                cursor: isDraggingWheel ? "grabbing" : "grab",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                scrollSnapType: "x mandatory",
              }}
            >
            <div
              style={{
                width: canvasDisplayWidth,
                height: canvasDisplayHeight,
                background: "white",
                border: "1px solid var(--pencil-light)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                borderRadius: 4,
                position: "relative",
                flexShrink: 0,
                scrollSnapAlign: "center",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: subjectSquarePx,
                  height: subjectSquarePx,
                  transform: "translate(-50%, -50%)",
                  border: "1.5px dashed var(--teal)",
                  borderRadius: 4,
                }}
              />
            </div>

            {reversedHistory.map((p) => (
              <div
                key={p.id}
                style={{
                  position: "relative",
                  width: canvasDisplayWidth,
                  height: canvasDisplayHeight,
                  flexShrink: 0,
                  scrollSnapAlign: "center",
                  overflow: "hidden",
                }}
              >
                <img
                  src={previewFileUrl(p.id, accessToken)}
                  alt={`${p.subject} preview`}
                  draggable={false}
                  onClick={() => {
                    if (wheelDragMoved.current) return;
                    setLightboxImageUrl(previewFileUrl(p.id, accessToken));
                    setShowFullSize(true);
                  }}
                  style={{
                    width: canvasDisplayWidth,
                    height: canvasDisplayHeight,
                    objectFit: "contain",
                    background: "white",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: Math.min(canvasDisplayWidth, canvasDisplayHeight) * p.subject_size_ratio,
                    height: Math.min(canvasDisplayWidth, canvasDisplayHeight) * p.subject_size_ratio,
                    transform: "translate(-50%, -50%)",
                    border: "1.5px dashed var(--teal)",
                    borderRadius: 4,
                    pointerEvents: "none",
                  }}
                />
              </div>
            ))}

            {previewState === "loading" && (
              <div
                className="flex items-center justify-center"
                style={{
                  width: canvasDisplayWidth,
                  height: canvasDisplayHeight,
                  background: "white",
                  border: "1px dashed var(--teal)",
                  borderRadius: 4,
                  flexShrink: 0,
                  scrollSnapAlign: "center",
                }}
              >
                <p className="text-xs" style={{ color: "var(--teal-dark)" }}>
                  Generating...
                </p>
              </div>
            )}
          </div>
        </div>

          <p className="text-[10px] m-0 mt-2 text-center" style={{ color: "var(--pencil)" }}>
            {activeIndex === 0 || !reversedHistory[activeIndex - 1] ? (
              <>Canvas · {canvasW}×{canvasH}px · subject fills {Math.round(subjectRatio * 100)}% of the page</>
            ) : (
              (() => {
                const active = reversedHistory[activeIndex - 1];
                return (
                  <>
                    {active.canvas_width}×{active.canvas_height}px · subject fills{" "}
                    {Math.round(active.subject_size_ratio * 100)}% · shading {active.palette_colors} · line{" "}
                    {active.black_clean_threshold} · cleanup {active.white_clean_threshold}
                  </>
                );
              })()
            )}
          </p>

          {activeIndex > 0 && reversedHistory[activeIndex - 1] && (
            <div className="flex flex-col items-center gap-1.5 mt-2.5">
              {reversedHistory[activeIndex - 1].promoted_image_id ? (
                <button
                  onClick={() => selectedCategoryId && goToCategoryGenerateStep(selectedCategoryId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold"
                  style={{ color: "var(--teal-dark)", border: "1.5px solid var(--teal)", background: "var(--teal-tint)" }}
                >
                  <Check size={13} /> Already sent to Generate — open it
                </button>
              ) : (
                <button
                  onClick={() => handleUseAsFinalImage(reversedHistory[activeIndex - 1])}
                  disabled={promotingPreviewId !== null}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--teal-dark)" }}
                >
                  {promotingPreviewId === reversedHistory[activeIndex - 1].id ? (
                    "Sending to Generate..."
                  ) : (
                    <>
                      Approve &amp; send to Generate <ArrowRight size={13} />
                    </>
                  )}
                </button>
              )}
              {reversedHistory[activeIndex - 1].promoted_image_id ? (
                <p className="text-[10px] m-0 mt-2" style={{ color: "var(--pencil)" }}>
                  Already waiting for you under {reversedHistory[activeIndex - 1].subject} in the Generate step.
                </p>
              ) : (
                <button
                  onClick={() => selectedCategoryId && goToCategoryGenerateStep(selectedCategoryId)}
                  className="text-[10px] m-0 mt-2 underline"
                  style={{ color: "var(--pencil)" }}
                >
                  Pair and generate more images like this in your sequence.
                </button>
              )}
            </div>
          )}

          {promoteError && (
            <div
              className="mt-2.5 px-3 py-2 rounded-md text-xs text-center"
              style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
            >
              {promoteError}
            </div>
          )}

          <style jsx>{`
            .preview-wheel::-webkit-scrollbar {
              display: none;
            }
          `}</style>

        <div className="flex items-center justify-between gap-3.5 mt-4">
          <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--pencil)" }}>
            <FileText size={15} />
            {selectedSubject && selectedVariation ? `${selectedSubject} — ${selectedVariation}` : "No selection"}
            <ArrowRight size={12} style={{ color: "var(--pencil)", opacity: 0.5 }} />
          </span>

          {previewState === "confirming" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGeneratePreview}
                className="px-4 py-2 rounded-md text-xs font-bold text-white"
                style={{ background: "var(--teal)" }}
              >
                Yes, generate (~$0.007)
              </button>
              <button
                onClick={() => setPreviewState("idle")}
                className="px-3 py-2 rounded-md text-xs font-medium"
                style={{ color: "var(--pencil)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPreviewState("confirming")}
              disabled={previewState === "loading" || !eligibleCategories.includes(selectedPreviewCategory) || !selectedSubject || !selectedVariation}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold text-white disabled:opacity-40"
              style={{ background: "var(--teal)" }}
            >
              {previewImageUrl ? "Regenerate preview" : "Generate preview"} <WandSparkles size={14} />
            </button>
          )}
        </div>
      </Panel>

      {/* Selection + history, one panel */}
      <Panel kicker="WHAT TO PREVIEW" title="Preview settings">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Category
            </label>
            <select
              value={selectedPreviewCategory}
              onChange={(e) => handlePreviewCategoryChange(e.target.value)}
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm capitalize"
              style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name} className="capitalize">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                handleClosePreview();
              }}
              disabled={loadingOptions || categorySubjects.length === 0}
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm disabled:opacity-50"
              style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
            >
              {categorySubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Variation
            </label>
            <select
              value={selectedVariation}
              onChange={(e) => {
                setSelectedVariation(e.target.value);
                handleClosePreview();
              }}
              disabled={loadingOptions || categoryVariations.length === 0}
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm disabled:opacity-50"
              style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
            >
              {categoryVariations.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!eligibleCategories.includes(selectedPreviewCategory) && (
          <p className="mt-3 text-xs" style={{ color: "var(--coral-dark)" }}>
            This category has no subject and variation yet — add at least one of each before previewing.
          </p>
        )}

        <PanelSection label="Prepare a category" defaultOpen>
          <PrepareCategoryPanel
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onCategoryUpdated={refreshCategoryEligibility}
            autoOpenSubjectsForCategoryId={lastCreatedCategoryId}
          />
        </PanelSection>

        <PanelSection label={`Preview history (${categoryPreviewHistory.length})`}>
          {loadingHistory ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Loading...
            </p>
          ) : categoryPreviewHistory.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              No previews generated yet for this category.
            </p>
          ) : (
            <div className="space-y-2">
              {categoryPreviewHistory.map((p) => (
                <div key={p.id} className="rounded-md border-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
                  <button
                    onClick={() => setExpandedPreviewId(expandedPreviewId === p.id ? null : p.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div>
                      <span className="text-sm font-medium capitalize" style={{ color: "var(--ink)" }}>
                        {p.category} — {p.subject}
                      </span>
                      <span className="ml-3 text-xs" style={{ color: "var(--pencil)" }}>
                        {formatDate(p.created_at)}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "var(--teal)" }}>
                      {expandedPreviewId === p.id ? "Hide" : "View"}
                    </span>
                  </button>
                  {expandedPreviewId === p.id && (
                    <div className="px-4 pb-4">
                      <img
                        src={previewFileUrl(p.id, accessToken)}
                        alt={`${p.subject} preview`}
                        onClick={() => {
                          setLightboxImageUrl(previewFileUrl(p.id, accessToken));
                          setShowFullSize(true);
                        }}
                        className="max-w-xs rounded-md border-[1.5px] mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ borderColor: "var(--pencil-light)" }}
                      />
                      <p className="text-xs mb-2" style={{ color: "var(--pencil)" }}>
                        {p.canvas_width}×{p.canvas_height}px, ratio {p.subject_size_ratio}, palette {p.palette_colors} —{" "}
                        {p.variation_text}
                      </p>
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: "var(--ink)" }}>
                          Prompt used
                        </p>
                        <p
                          className="text-xs px-2 py-1.5 rounded"
                          style={{ background: "var(--paper)", color: p.prompt_used ? "var(--pencil)" : "var(--coral-dark)" }}
                        >
                          {p.prompt_used ?? "Not recorded — generated before prompt tracking was added."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </PanelSection>
      </Panel>

      {showFullSize && lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: "rgba(28, 27, 26, 0.85)" }}
          onClick={() => setShowFullSize(false)}
        >
          <div className="flex flex-col items-center max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div
              ref={viewerRef}
              onMouseDown={trueSizeView ? handleMouseDown : undefined}
              onMouseMove={trueSizeView ? handleMouseMove : undefined}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="rounded-md shadow-2xl flex items-center justify-center"
              style={{
                width: "90vw",
                height: "75vh",
                overflow: trueSizeView ? "auto" : "hidden",
                cursor: trueSizeView ? (isDragging ? "grabbing" : "grab") : "default",
                background: "var(--pencil-light)",
              }}
            >
              <img
                src={lightboxImageUrl}
                alt="Settings preview at true size"
                draggable={false}
                style={
                  trueSizeView
                    ? {
                        width: `${lastCanvasWidth}px`,
                        height: `${lastCanvasHeight}px`,
                        background: "white",
                        display: "block",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
                      }
                    : {
                        maxWidth: "100%",
                        maxHeight: "100%",
                        width: "auto",
                        height: "auto",
                        background: "white",
                        display: "block",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
                      }
                }
              />
            </div>
            <div className="flex items-center gap-4 mt-4">
              <span className="text-sm" style={{ color: "white" }}>
                {lastCanvasWidth} × {lastCanvasHeight}px
              </span>
              <button
                onClick={() => setTrueSizeView((v) => !v)}
                className="px-4 py-2 rounded-md text-sm font-medium"
                style={{ background: "var(--teal)", color: "white" }}
              >
                {trueSizeView ? "See full page" : "Zoom to actual size"}
              </button>
              <button
                onClick={() => setShowFullSize(false)}
                className="px-4 py-2 rounded-md text-sm font-medium"
                style={{ background: "var(--canvas)", color: "var(--ink)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
