"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Check, RotateCw, Trash2, Expand, X, ChevronLeft, ChevronRight, Minimize2, Maximize2 } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CategoryImage {
  id: number;
  job_id: number;
  subject: string;
  variation_text: string | null;
  status: string;
  wp_excluded: boolean;
  created_at: string;
  locally_published: boolean;
  wordpress_status: string | null;
  prompt_used: string | null;
}

type StatusKey = "live" | "draft" | "local" | "not_published";

async function getCategoryImages(categoryName: string): Promise<CategoryImage[]> {
  const res = await fetch(`${API_BASE_URL}/review/images/${encodeURIComponent(categoryName)}`);
  return res.json();
}

async function rejectImage(imageId: number) {
  await fetch(`${API_BASE_URL}/review/image/${imageId}/reject`, { method: "POST" });
}

async function runPairs(category: string, pairs: { subject: string; variation_text: string }[]) {
  const res = await fetch(`${API_BASE_URL}/generate/run-pairs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, pairs }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to start generation");
  return res.json() as Promise<{ job_id: number }>;
}

function imageFileUrl(imageId: number): string {
  return `${API_BASE_URL}/review/image/${imageId}/file`;
}

function statusKeyFor(img: CategoryImage): StatusKey {
  if (img.wordpress_status === "publish") return "live";
  if (img.wordpress_status === "draft") return "draft";
  if (img.locally_published) return "local";
  return "not_published";
}

const STATUS_META: Record<StatusKey, { label: string; bg: string; fg: string }> = {
  live: { label: "Live on site", bg: "var(--tone-sage-bg)", fg: "var(--tone-sage)" },
  draft: { label: "Draft on site", bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow)" },
  local: { label: "Published locally", bg: "var(--tone-blue-bg)", fg: "var(--tone-blue)" },
  not_published: { label: "Not published", bg: "var(--coral-light)", fg: "var(--coral-dark)" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CategoryImageStrip({
  categoryName,
  refreshKey,
}: {
  categoryName: string;
  refreshKey: number;
}) {
  const [images, setImages] = useState<CategoryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"oldest" | "newest" | "subject">("oldest");
  const [filterStatus, setFilterStatus] = useState<"all" | StatusKey>("all");
  const [filterBatch, setFilterBatch] = useState<"all" | number>("all");
  const [confirming, setConfirming] = useState<{ id: number; action: "reject" | "regenerate" } | null>(null);

  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null);
  const prevCountRef = useRef(0);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callback ref: attaches a native, non-passive wheel listener directly to
  // whatever DOM node currently exists, with no dependency-array timing to
  // get wrong — more robust than a useEffect keyed on unrelated state.
  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    if (scrollElRef.current && wheelHandlerRef.current) {
      scrollElRef.current.removeEventListener("wheel", wheelHandlerRef.current);
    }
    scrollElRef.current = node;
    if (node) {
      const handler = (e: WheelEvent) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          node.scrollLeft += e.deltaY;
        }
      };
      wheelHandlerRef.current = handler;
      node.addEventListener("wheel", handler, { passive: false });
    }
  }, []);

  function load(scrollToEndAfter = false) {
    setLoading(true);
    getCategoryImages(categoryName)
      .then((data) => {
        const approved = data.filter((img) => img.status === "approved");
        setImages(approved);
        if (scrollToEndAfter && approved.length > prevCountRef.current) {
          const newest = approved[approved.length - 1];
          setFlashId(newest.id);
          setTimeout(() => setFlashId(null), 2200);
          setMinimized(false);
          requestAnimationFrame(() => {
            if (!scrollElRef.current) return;
            // New images append at the end. That's the RIGHT edge when
            // sorted oldest→newest, but the LEFT edge when newest→oldest.
            if (sortBy === "newest") {
              scrollElRef.current.scrollTo({ left: 0, behavior: "smooth" });
            } else if (sortBy === "oldest") {
              scrollElRef.current.scrollTo({ left: scrollElRef.current.scrollWidth, behavior: "smooth" });
            }
          });
        }
        prevCountRef.current = approved.length;
      })
      .catch(() => setError("Failed to load generated images"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(() => load(refreshKey > 0), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryName, refreshKey]);

  function scrollByAmount(dir: 1 | -1) {
    scrollElRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function requestConfirm(id: number, action: "reject" | "regenerate") {
    if (confirming?.id === id && confirming.action === action) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirming(null);
      if (action === "reject") doReject(id);
      else doRegenerate(id);
      return;
    }
    setConfirming({ id, action });
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirming(null), 4000);
  }

  async function doReject(id: number) {
    setBusyId(id);
    try {
      await rejectImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      setError("Failed to reject image");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulkReject() {
    if (selected.size === 0) return;
    setBulkRejecting(true);
    try {
      await Promise.all(Array.from(selected).map((id) => rejectImage(id)));
      setImages((prev) => prev.filter((img) => !selected.has(img.id)));
      setSelected(new Set());
    } catch {
      setError("Failed to reject selected images");
    } finally {
      setBulkRejecting(false);
    }
  }

  async function doRegenerate(id: number) {
    const img = images.find((i) => i.id === id);
    if (!img?.variation_text) return;
    setBusyId(id);
    try {
      await runPairs(categoryName, [{ subject: img.subject, variation_text: img.variation_text }]);
      setTimeout(() => load(true), 7000);
    } catch {
      setError("Failed to start regeneration");
      setBusyId(null);
    }
  }

  const batchIds = Array.from(new Set(images.map((img) => img.job_id))).sort((a, b) => b - a);

  const filteredImages = images.filter((img) => {
    if (filterStatus !== "all" && statusKeyFor(img) !== filterStatus) return false;
    if (filterBatch !== "all" && img.job_id !== filterBatch) return false;
    return true;
  });

  const sortedImages = [...filteredImages].sort((a, b) => {
    if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return a.subject.localeCompare(b.subject);
  });

  if (loading && images.length === 0) {
    return (
      <p className="text-sm px-7 py-4" style={{ color: "var(--pencil)" }}>
        Loading generated images...
      </p>
    );
  }

  if (images.length === 0) {
    return (
      <p className="text-sm px-7 py-4" style={{ color: "var(--pencil)" }}>
        No generated images yet for this category.
      </p>
    );
  }

  return (
    <div className="mx-7 my-5 rounded-xl overflow-hidden" style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3.5" style={{ borderBottom: minimized ? "none" : "1px solid var(--pencil-light)" }}>
        <div>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
            Generated pages
          </p>
          <p className="font-display font-normal m-0 mt-1" style={{ fontSize: 18, color: "var(--ink)" }}>
            {sortedImages.length} of {images.length} {images.length === 1 ? "page" : "pages"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <button
              onClick={handleBulkReject}
              disabled={bulkRejecting}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[10px] font-bold disabled:opacity-60"
              style={{ border: "1px solid var(--coral)", color: "var(--coral-dark)" }}
            >
              <Trash2 size={13} /> {bulkRejecting ? "Rejecting..." : `Reject ${selected.size} selected`}
            </button>
          )}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-2 py-2 rounded-md text-[10px] font-bold outline-none"
            style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            <option value="all">All statuses</option>
            <option value="not_published">Not published</option>
            <option value="local">Published locally</option>
            <option value="draft">Draft on site</option>
            <option value="live">Live on site</option>
          </select>
          <select
            value={filterBatch}
            onChange={(e) => setFilterBatch(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="px-2 py-2 rounded-md text-[10px] font-bold outline-none"
            style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            <option value="all">All batches</option>
            {batchIds.map((id) => (
              <option key={id} value={id}>
                Batch #{id}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-2 rounded-md text-[10px] font-bold outline-none"
            style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            <option value="oldest">Oldest → Newest</option>
            <option value="newest">Newest → Oldest</option>
            <option value="subject">By subject</option>
          </select>
          <button
            onClick={() => setLightboxIndex(sortedImages.length - 1)}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[10px] font-bold"
            style={{ border: "1px solid var(--pencil-light)", color: "var(--teal-dark)" }}
          >
            <Expand size={13} /> Full preview
          </button>
          <button
            onClick={() => setMinimized((v) => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-md"
            style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
            aria-label={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded text-xs" style={{ background: "var(--coral-light)", color: "var(--coral-dark)" }}>
          {error}
        </div>
      )}

      {!minimized && (
        <div className="relative group">
          <div ref={scrollRef} className="flex gap-3 p-4 overflow-x-auto scroll-smooth" style={{ scrollbarWidth: "thin" }}>
            {sortedImages.length === 0 && (
              <p className="text-sm py-6" style={{ color: "var(--pencil)" }}>
                No images match the current filters.
              </p>
            )}
            {sortedImages.map((img) => {
              const meta = STATUS_META[statusKeyFor(img)];
              const isSelected = selected.has(img.id);
              const isBusy = busyId === img.id;
              const isFlashing = flashId === img.id;
              const confirmingReject = confirming?.id === img.id && confirming.action === "reject";
              const confirmingRegen = confirming?.id === img.id && confirming.action === "regenerate";

              return (
                <div
                  key={img.id}
                  className="flex-shrink-0 rounded-lg overflow-hidden relative"
                  style={{
                    width: 200,
                    border: `1.5px solid ${isSelected ? "var(--teal)" : "var(--pencil-light)"}`,
                    boxShadow: isFlashing ? "0 0 0 3px var(--teal)" : "none",
                    transition: "box-shadow 0.4s ease",
                  }}
                >
                  <button
                    onClick={() => toggleSelected(img.id)}
                    className="absolute top-2 left-2 z-10 w-5 h-5 rounded flex items-center justify-center"
                    style={{
                      border: `1px solid ${isSelected ? "var(--teal)" : "rgba(255,255,255,0.8)"}`,
                      background: isSelected ? "var(--teal)" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {isSelected && <Check size={12} color="white" />}
                  </button>

                  <button onClick={() => setLightboxIndex(sortedImages.indexOf(img))} className="block w-full">
                    <img
                      src={imageFileUrl(img.id)}
                      alt={`${img.subject} — ${img.variation_text ?? ""}`}
                      className="w-full object-cover"
                      style={{ height: 140, background: "var(--tone-sage-bg)" }}
                    />
                  </button>

                  <div className="p-2.5">
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <p className="text-xs font-medium m-0 capitalize" style={{ color: "var(--ink)" }}>
                        {img.subject}
                      </p>
                      <span
                        className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                        style={{ background: meta.bg, color: meta.fg }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[10px] m-0 mb-1.5 truncate" style={{ color: "var(--pencil)" }}>
                      {img.variation_text ?? "No variation recorded"}
                    </p>
                    <p className="text-[9px] m-0 mb-2" style={{ color: "var(--pencil)" }}>
                      Batch #{img.job_id} · {formatDate(img.created_at)}
                    </p>

                    {confirmingReject ? (
                      <div className="rounded-md" style={{ background: "var(--coral-light)", padding: 6 }}>
                        <p className="text-[10px] font-medium m-0 mb-1.5" style={{ color: "var(--coral-dark)" }}>
                          Reject this page?
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => requestConfirm(img.id, "reject")}
                            className="flex-1 py-1.5 rounded text-[10px] font-bold text-white"
                            style={{ background: "var(--coral)" }}
                          >
                            Yes, reject
                          </button>
                          <button
                            onClick={() => setConfirming(null)}
                            className="px-2 py-1.5 rounded text-[10px] font-bold"
                            style={{ color: "var(--pencil)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : confirmingRegen ? (
                      <div className="rounded-md" style={{ background: "var(--teal-tint)", padding: 6 }}>
                        <p className="text-[10px] font-medium m-0 mb-1.5" style={{ color: "var(--teal-dark)" }}>
                          Generate another version?
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => requestConfirm(img.id, "regenerate")}
                            className="flex-1 py-1.5 rounded text-[10px] font-bold text-white"
                            style={{ background: "var(--teal)" }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirming(null)}
                            className="px-2 py-1.5 rounded text-[10px] font-bold"
                            style={{ color: "var(--pencil)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => requestConfirm(img.id, "regenerate")}
                          disabled={!img.variation_text || isBusy}
                          title={img.variation_text ? "Generate another version" : "No variation recorded"}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold disabled:opacity-30"
                          style={{ border: "1px solid var(--teal)", color: "var(--teal)" }}
                        >
                          <RotateCw size={11} className={isBusy ? "animate-spin" : ""} />
                          {isBusy ? "Working..." : "Regenerate"}
                        </button>
                        <button
                          onClick={() => requestConfirm(img.id, "reject")}
                          disabled={isBusy}
                          title="Reject this image"
                          className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-30 shrink-0"
                          style={{ border: "1px solid var(--pencil-light)", color: "var(--coral-dark)" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => scrollByAmount(-1)}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            style={{ background: "rgba(250,249,246,0.9)", border: "1px solid var(--pencil-light)", color: "var(--teal-dark)" }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scrollByAmount(1)}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            style={{ background: "rgba(250,249,246,0.9)", border: "1px solid var(--pencil-light)", color: "var(--teal-dark)" }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {lightboxIndex !== null && sortedImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto"
          style={{ padding: "42px 24px 34px", background: "rgba(248,247,243,0.97)", backdropFilter: "blur(14px)" }}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="fixed rounded-full flex items-center justify-center"
            style={{ top: 22, right: 26, width: 36, height: 36, border: "1px solid var(--pencil-light)", background: "var(--canvas)", color: "var(--pencil)" }}
          >
            <X size={20} />
          </button>
          <p className="text-[10px] uppercase font-bold mt-4 mb-4" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
            Preview {lightboxIndex + 1} of {sortedImages.length}
          </p>
          <div
            className="flex flex-col items-center rounded"
            style={{ width: "min(680px, 100%)", padding: 40, border: "1px solid var(--pencil-light)", background: "var(--canvas)", boxShadow: "0 18px 55px rgba(28,27,26,0.1)" }}
          >
            <img
              src={imageFileUrl(sortedImages[lightboxIndex].id)}
              alt={sortedImages[lightboxIndex].subject}
              style={{ maxWidth: "100%", maxHeight: "50vh", borderRadius: 6 }}
            />
            <h2 className="font-display font-normal mt-5 mb-1 capitalize text-center" style={{ fontSize: 32, letterSpacing: "-0.04em", color: "var(--ink)" }}>
              {sortedImages[lightboxIndex].subject}
            </h2>
            <p className="text-sm text-center" style={{ color: "var(--pencil)" }}>
              {sortedImages[lightboxIndex].variation_text ?? "No variation recorded"}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--pencil)" }}>
              Batch #{sortedImages[lightboxIndex].job_id} · {formatDate(sortedImages[lightboxIndex].created_at)}
            </p>
            {sortedImages[lightboxIndex].prompt_used && (
              <div className="w-full mt-4 pt-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
                <p className="text-[10px] uppercase font-bold mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                  Prompt used
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--pencil)" }}>
                  {sortedImages[lightboxIndex].prompt_used}
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2.5 mt-5">
            <button
              onClick={() => setLightboxIndex((i) => (i! - 1 + sortedImages.length) % sortedImages.length)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md text-[11px] font-bold"
              style={{ border: "1px solid var(--pencil-light)", color: "var(--teal-dark)" }}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              onClick={() => setLightboxIndex((i) => (i! + 1) % sortedImages.length)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md text-[11px] font-bold"
              style={{ border: "1px solid var(--pencil-light)", color: "var(--teal-dark)" }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
