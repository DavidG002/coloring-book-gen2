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
  reject_reason: string | null;
  wp_excluded: boolean;
  created_at: string;
  locally_published: boolean;
  wordpress_status: string | null;
  prompt_used: string | null;
}
type StatusKey = "live" | "draft" | "local" | "not_published" | "rejected";
const REJECT_REASONS = [
  { key: "gray_busy", label: "Gray / busy" },
  { key: "wrong_subject", label: "Wrong subject" },
  { key: "broken_line", label: "Broken line" },
  { key: "other", label: "Other" },
];
async function getCategoryImages(categoryId: number): Promise<CategoryImage[]> {
  const res = await fetch(`${API_BASE_URL}/review/images/${categoryId}`);
  return res.json();
}
async function rejectImage(imageId: number, reason: string) {
  await fetch(`${API_BASE_URL}/review/image/${imageId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}
async function restoreImage(imageId: number) {
  await fetch(`${API_BASE_URL}/review/image/${imageId}/restore`, { method: "POST" });
}
async function regenerateSameSlots(imageId: number) {
  const res = await fetch(`${API_BASE_URL}/generate/regenerate-same-slots/${imageId}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to regenerate");
  return res.json() as Promise<{ job_id: number }>;
}

async function runPairs(categoryId: number, pairs: { subject: string; variation_text: string }[]) {
  const res = await fetch(`${API_BASE_URL}/generate/run-pairs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_id: categoryId, pairs }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to start generation");
  return res.json() as Promise<{ job_id: number }>;
}

async function getJobStatus(jobId: number): Promise<{ status: string; completed_images: number; total_images: number }> {
  const res = await fetch(`${API_BASE_URL}/generate/status/${jobId}`);
  return res.json();
}



function imageFileUrl(imageId: number, createdAt?: string): string {
  const cacheBuster = createdAt ? `?v=${encodeURIComponent(createdAt)}` : "";
  return `${API_BASE_URL}/review/image/${imageId}/file${cacheBuster}`;
}

function statusKeyFor(img: CategoryImage): StatusKey {
  if (img.status === "rejected") return "rejected";
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
  rejected: { label: "Rejected", bg: "var(--pencil-light)", fg: "var(--pencil)" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CategoryImageStrip({
  categoryId,
  categoryName,
  refreshKey,
  onSelectionChanged,
  publishSetImageIds,
  clearSelectionTrigger,
}: {
  categoryId: number;
  categoryName: string;
  refreshKey: number;
  onSelectionChanged?: (imageIds: number[]) => void;
  publishSetImageIds?: number[];
  clearSelectionTrigger?: number;
}) {

  const [images, setImages] = useState<CategoryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const selectedLoadedRef = useRef(false);

  useEffect(() => {
    selectedLoadedRef.current = false;
    const timer = setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(`image-selection-${categoryId}`);
        if (saved) setSelected(new Set(JSON.parse(saved)));
      } catch {
        // corrupted/old data — ignore, start fresh
      } finally {
        selectedLoadedRef.current = true;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [categoryId]);

  useEffect(() => {
    if (!selectedLoadedRef.current) return;
    window.localStorage.setItem(`image-selection-${categoryId}`, JSON.stringify(Array.from(selected)));
  }, [selected, categoryId]);

  useEffect(() => {
    onSelectionChanged?.(Array.from(selected));
  }, [selected, onSelectionChanged]);

  const clearTriggerBaselineRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (clearSelectionTrigger === undefined) return;
    if (clearTriggerBaselineRef.current === undefined) {
      // Record the very first value we ever see as the baseline —
      // React Strict Mode double-invokes this effect in dev, so a
      // simple "have I mounted" boolean isn't enough (the second
      // invocation would wrongly treat the still-unchanged value as a
      // real, new trigger). Comparing against the real baseline value
      // is safe regardless of how many times the effect re-fires with
      // that same starting value.
      clearTriggerBaselineRef.current = clearSelectionTrigger;
      return;
    }
    if (clearSelectionTrigger === clearTriggerBaselineRef.current) return;
    const timer = setTimeout(() => setSelected(new Set()), 0);
    return () => clearTimeout(timer);
  }, [clearSelectionTrigger]);
  
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"oldest" | "newest" | "subject">("oldest");
  const [filterStatus, setFilterStatus] = useState<"all" | StatusKey>("all");
  const [filterBatch, setFilterBatch] = useState<"all" | number>("all");
  const [filterDate, setFilterDate] = useState<"all" | string>("all");
  const [showOnlyPublishSet, setShowOnlyPublishSet] = useState(false);
  const [confirming, setConfirming] = useState<{ id: number; action: "reject" | "regenerate" } | null>(null);

  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null);
  const prevCountRef = useRef(0);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [bulkRejectPicker, setBulkRejectPicker] = useState(false);

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
    getCategoryImages(categoryId)
      .then((data) => {
        setImages(data);
        const approved = data.filter((img) => img.status === "approved");
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
  }, [categoryId, refreshKey]);

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

  function requestConfirm(id: number, action: "regenerate") {
    if (confirming?.id === id && confirming.action === action) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirming(null);
      doRegenerate(id);
      return;
    }
    setConfirming({ id, action });
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirming(null), 4000);
  }

   async function doReject(id: number, reason: string) {
    setBusyId(id);
    try {
      await rejectImage(id, reason);
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, status: "rejected", reject_reason: reason } : img))
      );
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
  async function handleBulkReject(reason: string) {
    if (selected.size === 0) return;
    setBulkRejecting(true);
    try {
      const ids = Array.from(selected);
      await Promise.all(ids.map((id) => rejectImage(id, reason)));
      setImages((prev) =>
        prev.map((img) => (ids.includes(img.id) ? { ...img, status: "rejected", reject_reason: reason } : img))
      );
      setSelected(new Set());
    } catch {
      setError("Failed to reject selected images");
    } finally {
      setBulkRejecting(false);
    }
  }
  async function doRestore(id: number) {
    setBusyId(id);
    try {
      await restoreImage(id);
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, status: "approved", reject_reason: null } : img))
      );
    } catch {
      setError("Failed to restore image");
    } finally {
      setBusyId(null);
    }
  }
  async function doRegenerateSameSlots(id: number) {
    setBusyId(id);
    try {
      const result = await regenerateSameSlots(id);
      const poll = async () => {
        try {
          const status = await getJobStatus(result.job_id);
          if (status.status === "done" || status.status === "failed" || status.status === "cancelled") {
            load(true);
            setBusyId(null);
            return;
          }
        } catch {
          // transient poll failure — keep trying
        }
        setTimeout(poll, 1500);
      };
      setTimeout(poll, 1500);
    } catch {
      setError("Failed to start regeneration");
      setBusyId(null);
    }
  }

async function doRegenerate(id: number) {
  const img = images.find((i) => i.id === id);
  if (!img?.variation_text) return;
  setBusyId(id);
  try {
    const result = await runPairs(categoryId, [{ subject: img.subject, variation_text: img.variation_text }]);

    const poll = async () => {
      try {
        const status = await getJobStatus(result.job_id);
        if (status.status === "done" || status.status === "failed" || status.status === "cancelled") {
          load(true);
          setBusyId(null);
          return;
        }
      } catch {
        // transient poll failure — keep trying, don't give up on one hiccup
      }
      setTimeout(poll, 1500);
    };
    setTimeout(poll, 1500);
  } catch {
    setError("Failed to start regeneration");
    setBusyId(null);
  }
}

  
  const subjectsInImages = Array.from(new Set(images.map((img) => img.subject))).sort();
  const [filterSubject, setFilterSubject] = useState<"all" | string>("all");

  const batchesByDate = (() => {
    const dateToBatchIds = new Map<string, Set<number>>();
    for (const img of images) {
      const dateKey = new Date(img.created_at).toDateString();
      if (!dateToBatchIds.has(dateKey)) dateToBatchIds.set(dateKey, new Set());
      dateToBatchIds.get(dateKey)!.add(img.job_id);
    }
    return Array.from(dateToBatchIds.entries())
      .map(([dateKey, ids]) => ({
        dateKey,
        dateLabel: new Date(dateKey).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        batchIds: Array.from(ids).sort((a, b) => b - a),
      }))
      .sort((a, b) => new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime());
  })();
  

  const filteredImages = images.filter((img) => {
    if (showOnlyPublishSet) {

      return publishSetImageIds?.includes(img.id) ?? false;
    }
    if (filterStatus !== "all" && statusKeyFor(img) !== filterStatus) return false;
    if (filterSubject !== "all" && img.subject !== filterSubject) return false;
    if (filterDate !== "all" && new Date(img.created_at).toDateString() !== filterDate) return false;
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
    <div className="mx-4 my-5 rounded-xl overflow-hidden" style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3.5" style={{ borderBottom: minimized ? "none" : "1px solid var(--pencil-light)" }}>
        <div>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
            Generated pages
          </p>
          <p className="font-display font-normal m-0 mt-1" style={{ fontSize: 18, color: "var(--ink)" }}>
            {sortedImages.length} of {images.length} {images.length === 1 ? "page" : "pages"}
          </p>
        </div>
         <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
          <select
            value={showOnlyPublishSet ? "in_publish_set" : filterStatus}
            onChange={(e) => {
              if (e.target.value === "in_publish_set") {
                setShowOnlyPublishSet(true);
              } else {
                setShowOnlyPublishSet(false);
                setFilterStatus(e.target.value as typeof filterStatus);
              }
            }}
            className="px-2 py-2 rounded-md text-[10px] font-bold outline-none"
            style={{ width: 118, border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            <option value="all">All statuses</option>
            <option value="not_published">Not published</option>
            <option value="local">Published locally</option>
            <option value="draft">Draft on site</option>
            <option value="live">Live on site</option>
            <option value="rejected">Rejected</option>
            {publishSetImageIds && publishSetImageIds.length > 0 && (
             <option value="in_publish_set">Publish list</option>
            )}
          </select>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-2 py-2 rounded-md text-[10px] font-bold outline-none capitalize"
            style={{ width: 118, border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            <option value="all">All subjects</option>
            {subjectsInImages.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
            <select
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setFilterBatch("all");
            }}
            className="px-2 py-2 rounded-md text-[10px] font-bold outline-none"
            style={{ width: 130, border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
          >
            <option value="all">All dates</option>
            {batchesByDate.map((d) => (
              <option key={d.dateKey} value={d.dateKey}>
                {d.dateLabel} ({d.batchIds.length})
              </option>
            ))}
          </select>
          {filterDate !== "all" && (
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="px-2 py-2 rounded-md text-[10px] font-bold outline-none"
              style={{ width: 105, border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
            >
              <option value="all">Daily batches</option>
              {batchesByDate.find((d) => d.dateKey === filterDate)?.batchIds.map((id) => (
                <option key={id} value={id}>
                  Batch #{id}
                </option>
              ))}
            </select>
          )}
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
            onClick={() => setMinimized((v) => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-md ml-auto"
            style={{ border: "1px solid var(--tone-blue)", color: "var(--tone-blue)", background: "#eef2f5" }}
            aria-label={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>
      </div>
      {!minimized && (
            <div className="flex items-center justify-between gap-2 flex-nowrap overflow-x-auto px-4 py-2.5 relative" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
              <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelected(new Set(sortedImages.filter((img) => img.status !== "rejected").map((img) => img.id)))}
              className="text-[10px] font-bold"
              style={{ color: "var(--teal)" }}
            >
              Select all
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-[10px] font-bold"
              style={{ color: "var(--pencil)", visibility: selected.size > 0 ? "visible" : "hidden" }}
            >
              Clear selection
            </button>
            {publishSetImageIds && publishSetImageIds.length > 0 && (
              <button
                onClick={() => setShowOnlyPublishSet((v) => !v)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold ml-2"
                style={
                  showOnlyPublishSet
                    ? { background: "var(--tone-lavender)", color: "white" }
                    : { border: "1px solid var(--tone-lavender)", color: "var(--tone-lavender)" }
                }
              >
                Publish list
              </button>
            )}
          </div>
          <button
            onClick={() => {
              if (selected.size > 0) {
                const firstSelectedIndex = sortedImages.findIndex((img) => selected.has(img.id));
                setLightboxIndex(firstSelectedIndex >= 0 ? firstSelectedIndex : sortedImages.length - 1);
              } else {
                setLightboxIndex(sortedImages.length - 1);
              }
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold absolute left-1/2"
            style={{ transform: "translateX(-50%)", border: "1px solid var(--pencil-light)", color: "var(--teal-dark)" }}
          >
            <Expand size={11} /> Full preview
          </button>
          {selected.size > 0 && !bulkRejectPicker && (
            <button
              onClick={() => setBulkRejectPicker(true)}
              disabled={bulkRejecting}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold disabled:opacity-60"
              style={{ border: "1px solid var(--coral)", color: "var(--coral-dark)" }}
            >
              <Trash2 size={11} /> {bulkRejecting ? "Rejecting..." : `Reject ${selected.size} selected`}
            </button>
          )}
          {selected.size > 0 && bulkRejectPicker && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-bold mr-1" style={{ color: "var(--coral-dark)" }}>
                Why?
              </span>
              {REJECT_REASONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    handleBulkReject(r.key);
                    setBulkRejectPicker(false);
                  }}
                  className="px-2 py-1 rounded-full text-[9px] font-bold"
                  style={{ background: "var(--coral-light)", color: "var(--coral-dark)" }}
                >
                  {r.label}
                </button>
              ))}
              <button
                onClick={() => setBulkRejectPicker(false)}
                className="text-[9px] font-medium ml-1"
                style={{ color: "var(--pencil)" }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded text-xs" style={{ background: "var(--coral-light)", color: "var(--coral-dark)" }}>
          {error}
        </div>
      )}

      {!minimized && (
        <div className="relative group">
            <div ref={scrollRef} className="flex gap-3 p-3 overflow-x-auto scroll-smooth" style={{ scrollbarWidth: "thin" }}>
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
              const isRejected = img.status === "rejected";
              const confirmingRegen = confirming?.id === img.id && confirming.action === "regenerate";
              const isPickingReason = rejectingId === img.id;
              const inPublishSet = publishSetImageIds?.includes(img.id) ?? false;
              return (
                <div
                  key={img.id}
                  className="flex-shrink-0 rounded-lg overflow-hidden relative"
                  style={{
                    width: 260,
                    border: `1.5px solid ${isSelected ? "var(--teal)" : "var(--pencil-light)"}`,
                    boxShadow: isFlashing ? "0 0 0 3px var(--teal)" : "none",
                    opacity: isRejected ? 0.55 : 1,
                    filter: isRejected ? "grayscale(0.6)" : "none",
                    transition: "box-shadow 0.4s ease, opacity 0.3s ease",
                  }}
                >
                  <button
                    onClick={() => toggleSelected(img.id)}
                    className="absolute top-2 left-2 z-10 w-5 h-5 rounded flex items-center justify-center"
                    style={{
                      border: `1.5px solid ${isSelected ? "var(--teal)" : "var(--pencil)"}`,
                      background: isSelected ? "var(--teal)" : "rgba(255,255,255,0.9)",
                      boxShadow: isSelected ? "none" : "0 1px 3px rgba(28,27,26,0.2)",
                    }}
                  >
                    {isSelected && <Check size={12} color="white" />}
                  </button>

                  <button onClick={() => setLightboxIndex(sortedImages.indexOf(img))} className="block w-full">
                    <img
                      src={imageFileUrl(img.id, img.created_at)}
                      alt={`${img.subject} — ${img.variation_text ?? ""}`}
                      className="w-full object-contain"
                      style={{ height: 368, background: "var(--canvas)" }}
                    />
                  </button>

                  <div className="p-2.5">
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <p className="text-xs font-medium m-0 capitalize" style={{ color: "var(--ink)" }}>
                        {img.subject}
                      </p>
                      <div className="flex flex-col items-end gap-1 shrink-0" style={{ minHeight: 38 }}>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                          style={{ background: meta.bg, color: meta.fg }}
                        >
                          {meta.label}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                          style={{
                            background: "var(--tone-lavender-bg)",
                            color: "var(--tone-lavender)",
                            visibility: inPublishSet ? "visible" : "hidden",
                          }}
                        >
                          Publish list
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] m-0 mb-1.5 truncate" style={{ color: "var(--pencil)" }}>
                      {img.variation_text ?? "No variation recorded"}
                    </p>
                    <p className="text-[9px] m-0 mb-2" style={{ color: "var(--pencil)" }}>
                      Batch #{img.job_id} · {formatDate(img.created_at)}
                    </p>

                     {isRejected ? (
                      <div>
                        <p className="text-[10px] font-bold m-0 mb-1.5" style={{ color: "var(--coral-dark)" }}>
                          Rejected{img.reject_reason ? ` — ${REJECT_REASONS.find((r) => r.key === img.reject_reason)?.label ?? img.reject_reason}` : ""}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => doRegenerateSameSlots(img.id)}
                            disabled={isBusy}
                            title="Regenerate using the exact same instructions as the original"
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold disabled:opacity-30"
                            style={{ border: "1px solid var(--teal)", color: "var(--teal)" }}
                          >
                            <RotateCw size={11} className={isBusy ? "animate-spin" : ""} />
                            {isBusy ? "Working..." : "Regenerate original"}
                          </button>
                          <button
                            onClick={() => doRestore(img.id)}
                            disabled={isBusy}
                            title="Restore this image"
                            className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-30 shrink-0"
                            style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      </div>
                    ) : isPickingReason ? (
                      <div className="rounded-md" style={{ background: "var(--coral-light)", padding: 6 }}>
                        <p className="text-[10px] font-medium m-0 mb-1.5" style={{ color: "var(--coral-dark)" }}>
                          Why reject?
                        </p>
                        <div className="flex gap-1 flex-wrap mb-1">
                          {REJECT_REASONS.map((r) => (
                            <button
                              key={r.key}
                              onClick={() => {
                                doReject(img.id, r.key);
                                setRejectingId(null);
                              }}
                              className="px-2 py-1 rounded-full text-[9px] font-bold"
                              style={{ background: "var(--canvas)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="text-[9px] font-medium"
                          style={{ color: "var(--pencil)" }}
                        >
                          Cancel
                        </button>
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
                          onClick={() => setRejectingId(img.id)}
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
              src={imageFileUrl(sortedImages[lightboxIndex].id, sortedImages[lightboxIndex].created_at)}
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
