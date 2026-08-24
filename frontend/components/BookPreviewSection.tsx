"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, WandSparkles } from "lucide-react";
import { getBook, ApiError } from "@/lib/api";
import { Panel, PanelSection } from "./SettingsUI";

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
}

async function checkPreviewAvailability(bookId: number) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/preview-availability`);
  return res.json() as Promise<{
    available: boolean;
    all_categories: string[];
    eligible_categories: string[];
    sample_subject?: string;
    sample_variation?: string;
    sample_category?: string;
  }>;
}

async function getCategoryPreviewOptions(bookId: number, categoryName: string) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/preview-options/${encodeURIComponent(categoryName)}`);
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to generate preview");
  }
  return res.blob();
}

async function getPreviewHistory(bookId: number): Promise<BookPreviewHistoryItem[]> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/previews`);
  return res.json();
}

function previewFileUrl(previewId: number): string {
  return `${API_BASE_URL}/books/previews/${previewId}/file`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function BookPreviewSection({ bookId }: { bookId: number }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [eligibleCategories, setEligibleCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedPreviewCategory, setSelectedPreviewCategory] = useState<string>("");
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
        setAllCategories(availability.all_categories);
        setSampleSubject(availability.sample_subject ?? null);
        setSampleVariation(availability.sample_variation ?? null);
        setSelectedPreviewCategory(availability.sample_category ?? "");
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

  useEffect(() => {
    if (!selectedPreviewCategory || !eligibleCategories.includes(selectedPreviewCategory)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategorySubjects([]);
      setCategoryVariations([]);
      return;
    }
    let cancelled = false;
    setLoadingOptions(true);
    getCategoryPreviewOptions(bookId, selectedPreviewCategory)
      .then((opts) => {
        if (cancelled) return;
        setCategorySubjects(opts.subjects);
        setCategoryVariations(opts.variations);
        setSelectedSubject(opts.subjects.includes(sampleSubject ?? "") ? (sampleSubject as string) : opts.subjects[0] ?? "");
        setSelectedVariation(
          opts.variations.includes(sampleVariation ?? "") ? (sampleVariation as string) : opts.variations[0] ?? ""
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
  }, [bookId, selectedPreviewCategory, eligibleCategories]);

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

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--pencil)" }}>Loading...</p>;
  }

  if (!previewAvailable) {
    return (
      <Panel kicker="PREVIEW CANVAS" title="Bring the story to life">
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Add at least one subject and one pose variation to a category in this book to enable a real preview.
        </p>
      </Panel>
    );
  }

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
            {previewImageUrl ? "Preview ready" : "Ready to create"}
          </span>
        }
      >
          {/* flex-wrap + gap so a future multi-preview comparison view can drop
              additional images in here as siblings, laid out side by side, without
              restructuring this container */}
          <div
            className="rounded-lg flex flex-wrap items-center justify-center gap-4"
            style={{ minHeight: 480, background: "var(--teal-tint)", padding: 20 }}
          >
          {previewState === "loading" ? (
            <p className="text-sm" style={{ color: "var(--teal-dark)" }}>
              Generating...
            </p>
          ) : previewImageUrl ? (
            <img
              src={previewImageUrl}
              alt="Settings preview"
              onClick={() => {
                setLightboxImageUrl(previewImageUrl);
                setShowFullSize(true);
              }}
              className="cursor-pointer hover:opacity-90 transition-opacity rounded"
              style={{ maxHeight: 260, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{ width: "min(76%, 390px)", aspectRatio: "1.42", border: "1px solid var(--teal)", opacity: 0.75, borderRadius: 6 }}
            >
              <span className="font-display" style={{ fontSize: 62, lineHeight: 1, color: "var(--teal)" }}>
                {"\u2726"}
              </span>
              <p className="font-display m-0 mt-2.5" style={{ fontSize: 20, color: "var(--teal-dark)" }}>
                No preview yet
              </p>
              <p className="text-[10px] m-0 mt-1" style={{ color: "var(--teal-dark)", opacity: 0.75 }}>
                Choose a subject below and generate one
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3.5 mt-4">
          <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--pencil)" }}>
            <FileText size={15} />
            {selectedSubject && selectedVariation ? `${selectedSubject} — ${selectedVariation}` : "No selection"}
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
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            >
              {allCategories.map((cat) => (
                <option key={cat} value={cat} className="capitalize">
                  {cat}
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
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
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
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
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

        <PanelSection label={`Preview history (${previewHistory.length})`}>
          {loadingHistory ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Loading...
            </p>
          ) : previewHistory.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              No previews generated yet.
            </p>
          ) : (
            <div className="space-y-2">
              {previewHistory.map((p) => (
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
                        src={previewFileUrl(p.id)}
                        alt={`${p.subject} preview`}
                        onClick={() => {
                          setLightboxImageUrl(previewFileUrl(p.id));
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
