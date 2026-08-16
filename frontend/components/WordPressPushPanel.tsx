"use client";

import { useState, useEffect, useMemo } from "react";
import { getTranslations, ApiError, type Translation } from "@/lib/api";
import LanguagePills from "@/components/LanguagePills";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface WordPressPreviewFile {
  source_path: string;
  title: string;
  alt_text: string;
  already_pushed: boolean;
  wp_excluded: boolean;
  publish_run_id: number | null;
  published_at: string | null;
  seo_error?: string | null;
  needs_update?: boolean;
}

interface WordPressPreviewResponse {
  new_count: number;
  already_pushed_count: number;
  term_already_exists: boolean;
  category_translated: string;
  files: WordPressPreviewFile[];
  skipped_subjects: string[];
}

interface WordPressPushedItem {
  source_path: string;
  wp_post_id: number;
  wp_post_url: string;
  title: string;
}

interface WordPressPushFailedItem {
  source_path: string;
  error: string;
}

interface WordPressPushResponse {
  pushed_count: number;
  skipped_count: number;
  failed_count: number;
  pushed_items: WordPressPushedItem[];
  failed_items: WordPressPushFailedItem[];
  skipped_subjects: string[];
}

async function previewPush(category: string, lang: string): Promise<WordPressPreviewResponse> {
  const res = await fetch(`${API_BASE_URL}/wordpress/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, lang }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to preview push");
  }
  return res.json();
}

async function runPush(
  category: string,
  lang: string,
  status: string,
  sourcePaths: string[]
): Promise<WordPressPushResponse> {
  const res = await fetch(`${API_BASE_URL}/wordpress/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, lang, status, source_paths: sourcePaths }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to push");
  }
  return res.json();
}

async function setExclude(sourcePath: string, excluded: boolean): Promise<void> {
  await fetch(`${API_BASE_URL}/wordpress/exclude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_path: sourcePath, excluded }),
  });
}

function formatBatchDate(iso: string | null): string {
  if (!iso) return "Unknown batch";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type PanelState = "idle" | "loading" | "ready" | "pushing" | "done";

export default function WordPressPushPanel({ categoryName }: { categoryName: string }) {
  const [languages, setLanguages] = useState<string[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);
  const [selectedLang, setSelectedLang] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "publish">("draft");

  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [preview, setPreview] = useState<WordPressPreviewResponse | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [expandedBatches, setExpandedBatches] = useState<Set<string | number>>(new Set());
  const [result, setResult] = useState<WordPressPushResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [syncingPath, setSyncingPath] = useState<string | null>(null);
  const [syncedPaths, setSyncedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getTranslations(categoryName)
      .then((data: Translation[]) => {
        if (cancelled) return;
        const langs = data.map((t) => t.lang);
        setLanguages(langs);
        if (langs.length > 0) setSelectedLang(langs[0]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load languages");
      })
      .finally(() => {
        if (!cancelled) setLoadingLangs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryName]);

  function handleReset() {
    setPanelState("idle");
    setPreview(null);
    setSelectedPaths(new Set());
    setExpandedBatches(new Set());
    setResult(null);
    setError(null);
  }

  async function handleLoadPreview() {
    if (!selectedLang) return;
    setError(null);
    setPanelState("loading");
    try {
      const data = await previewPush(categoryName, selectedLang);
      setPreview(data);
      setSelectedPaths(
        new Set(data.files.filter((f) => !f.already_pushed && !f.wp_excluded && !f.seo_error).map((f) => f.source_path))
      );
      setExpandedBatches(new Set());
      setPanelState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview");
      setPanelState("idle");
    }
  }

const batches = useMemo(() => {
  if (!preview) return [];
  const groups = new Map<number | string, WordPressPreviewFile[]>();
  for (const f of preview.files) {
    const key = f.publish_run_id ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return Array.from(groups.entries())
    .map(([runId, files]) => ({ jobId: runId, files, createdAt: files[0]?.published_at ?? null }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}, [preview]);

  function toggleFile(path: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleBatchExpanded(jobId: number | string) {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  function toggleBatchSelection(files: WordPressPreviewFile[]) {
    const pushable = files.filter((f) => !f.already_pushed && !f.wp_excluded && !f.seo_error).map((f) => f.source_path);
    const allSelected = pushable.length > 0 && pushable.every((p) => selectedPaths.has(p));
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      for (const p of pushable) {
        if (allSelected) next.delete(p);
        else next.add(p);
      }
      return next;
    });
  }

  function selectAllNew() {
    if (!preview) return;
    setSelectedPaths(
      new Set(preview.files.filter((f) => !f.already_pushed && !f.wp_excluded && !f.seo_error).map((f) => f.source_path))
    );
  }


  function selectNone() {
    setSelectedPaths(new Set());
  }

  async function handleToggleExclude(file: WordPressPreviewFile) {
    const newExcluded = !file.wp_excluded;
    await setExclude(file.source_path, newExcluded);
    setPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        files: prev.files.map((f) => (f.source_path === file.source_path ? { ...f, wp_excluded: newExcluded } : f)),
      };
    });
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (newExcluded) next.delete(file.source_path);
      return next;
    });
  }

  async function handlePush() {
    if (!selectedLang || selectedPaths.size === 0) return;
    setError(null);
    setPanelState("pushing");
    try {
      const data = await runPush(categoryName, selectedLang, status, Array.from(selectedPaths));
      setResult(data);
      setPanelState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to push");
      setPanelState("ready");
    }
  }

  async function syncToWordPress(sourcePath: string, lang: string): Promise<{ wp_post_id: number; wp_post_url: string; title: string }> {
    const res = await fetch(`${API_BASE_URL}/wordpress/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_path: sourcePath, lang }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Failed to sync");
    }
    return res.json();
  }

async function handleSync(sourcePath: string) {
  setSyncingPath(sourcePath);
  setError(null);
  try {
    await syncToWordPress(sourcePath, selectedLang);
    setPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        files: prev.files.map((f) =>
          f.source_path === sourcePath ? { ...f, needs_update: false } : f
        ),
      };
    });
    setSyncedPaths((prev) => new Set(prev).add(sourcePath));
    setTimeout(() => {
      setSyncedPaths((prev) => {
        const next = new Set(prev);
        next.delete(sourcePath);
        return next;
      });
    }, 3000);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to sync to WordPress");
  } finally {
    setSyncingPath(null);
  }
}

  return (
    <section
      className="rounded-lg border-[1.5px] p-6"
      style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
    >
      <h2 className="font-display text-xl font-semibold mb-4" style={{ color: "var(--ink)" }}>
        Push to WordPress
      </h2>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      {loadingLangs ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Loading...
        </p>
      ) : languages.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Add a translation for this category first — pushing to WordPress needs at least one language.
        </p>
      ) : (
        <>
          <div className="mb-5 flex gap-6 flex-wrap items-end">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                Language
              </label>
              <LanguagePills
                languages={languages}
                selected={selectedLang}
                onSelect={(lang) => {
                  setSelectedLang(lang);
                  handleReset();
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                Publish as
              </label>
              <div className="flex items-center gap-2 h-[38px]">
                <button
                  type="button"
                  onClick={() => setStatus("draft")}
                  className="px-3 py-1.5 rounded-md text-sm border-[1.5px]"
                  style={
                    status === "draft"
                      ? { background: "var(--teal)", borderColor: "var(--teal)", color: "white" }
                      : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
                  }
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("publish")}
                  className="px-3 py-1.5 rounded-md text-sm border-[1.5px]"
                  style={
                    status === "publish"
                      ? { background: "var(--coral)", borderColor: "var(--coral)", color: "white" }
                      : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
                  }
                >
                  Live
                </button>
              </div>
            </div>

            {panelState === "idle" && (
              <button
                onClick={handleLoadPreview}
                className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
                style={{ background: "var(--teal)" }}
              >
                Show images
              </button>
            )}
          </div>

          {panelState === "loading" && (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Loading...
            </p>
          )}

          {(panelState === "ready" || panelState === "pushing") && preview && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
                  style={{ background: "var(--teal)" }}
                >
                  {preview.new_count} new
                </span>
                {preview.already_pushed_count > 0 && (
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "var(--paper)", color: "var(--pencil)", border: "1px solid var(--pencil-light)" }}
                  >
                    {preview.already_pushed_count} already pushed
                  </span>
                )}
                <span className="text-xs" style={{ color: "var(--pencil)" }}>
                  Category term: {preview.category_translated} (
                  {preview.term_already_exists ? "reusing existing" : "will create new"})
                </span>
              </div>

              {preview.skipped_subjects.length > 0 && (
                <p className="text-xs" style={{ color: "var(--coral-dark)" }}>
                  Skipped (no translation yet): {preview.skipped_subjects.join(", ")}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs">
                <button onClick={selectAllNew} className="font-medium" style={{ color: "var(--teal)" }}>
                  Select all new
                </button>
                <button onClick={selectNone} className="font-medium" style={{ color: "var(--pencil)" }}>
                  Select none
                </button>
                <span style={{ color: "var(--pencil)" }}>{selectedPaths.size} selected</span>
              </div>

              <div className="space-y-2">
                {batches.map((batch) => {
                  const pushableInBatch = batch.files.filter((f) => !f.already_pushed && !f.wp_excluded);
                  const allBatchSelected =
                    pushableInBatch.length > 0 && pushableInBatch.every((f) => selectedPaths.has(f.source_path));
                  const isExpanded = expandedBatches.has(batch.jobId);
                  const publishedCount = batch.files.filter((f) => f.already_pushed).length;
                  const excludedCount = batch.files.filter((f) => f.wp_excluded).length;

                  return (
                    <div key={batch.jobId} className="rounded-md border-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
                      <button
                        onClick={() => toggleBatchExpanded(batch.jobId)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: "var(--pencil)" }}>
                            {isExpanded ? "\u25BE" : "\u25B8"}
                          </span>
                          <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                            {formatBatchDate(batch.createdAt)}
                          </span>
                          <span className="text-xs" style={{ color: "var(--pencil)" }}>
                            {batch.files.length} images
                            {publishedCount > 0 && `, ${publishedCount} published`}
                            {excludedCount > 0 && `, ${excludedCount} excluded`}
                          </span>
                        </div>
                        {pushableInBatch.length > 0 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBatchSelection(batch.files);
                            }}
                            className="text-xs font-medium"
                            style={{ color: "var(--teal)" }}
                          >
                            {allBatchSelected ? "Deselect batch" : "Select batch"}
                          </span>
                        )}
                      </button>

                      {isExpanded && (
                        <div
                          className="p-2 space-y-1.5 border-t-[1.5px]"
                          style={{ borderColor: "var(--pencil-light)" }}
                        >
                          {batch.files.map((f) => (
                            <div
                              key={f.source_path}
                              className="flex items-start gap-2.5 px-1.5 py-1 rounded text-xs"
                              style={{ opacity: f.wp_excluded ? 0.7 : (f.already_pushed && !f.needs_update) ? 0.6 : 1 }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedPaths.has(f.source_path)}
                                disabled={f.already_pushed || f.wp_excluded || !!f.seo_error}
                                onChange={() => toggleFile(f.source_path)}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium" style={{ color: "var(--ink)" }}>
                                    {f.title}
                                  </span>
                                  {f.already_pushed && (
                                    <>
                                      <span
                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{ background: "var(--teal)", color: "white" }}
                                      >
                                        Published
                                      </span>
                                      {f.needs_update && !syncedPaths.has(f.source_path) && (
                                        <span
                                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                          style={{ background: "var(--coral)", color: "white" }}
                                        >
                                          Needs update
                                        </span>
                                      )}
                                      {(f.needs_update || syncedPaths.has(f.source_path)) && (
                                        <button
                                          onClick={() => handleSync(f.source_path)}
                                          disabled={syncingPath === f.source_path}
                                          className="text-[10px] font-semibold disabled:opacity-60 px-1.5 py-0.5 rounded"
                                          style={
                                            syncedPaths.has(f.source_path)
                                              ? { background: "var(--teal)", color: "white" }
                                              : { color: "var(--coral-dark)", border: "1.5px solid var(--coral)" }
                                          }
                                        >
                                          {syncingPath === f.source_path
                                            ? "Updating..."
                                            : syncedPaths.has(f.source_path)
                                            ? "\u2713 Updated"
                                            : "Update on WordPress"}
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {f.wp_excluded && (
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                      style={{ background: "var(--coral)", color: "white" }}
                                    >
                                      Don&apos;t publish
                                    </span>
                                  )}
                                  {f.seo_error && (
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                      style={{ background: "var(--coral)", color: "white" }}
                                      title={f.seo_error}
                                    >
                                      Not ready
                                    </span>
                                  )}
                                </div>
                                <div style={{ color: "var(--pencil)" }}>{f.alt_text}</div>
                              </div>
                              {!f.already_pushed && (
                                <button
                                  onClick={() => handleToggleExclude(f)}
                                  className="shrink-0 text-[10px] font-medium"
                                  style={{ color: f.wp_excluded ? "var(--teal)" : "var(--coral-dark)" }}
                                >
                                  {f.wp_excluded ? "Include" : "Don't publish"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {status === "publish" && selectedPaths.size > 0 && (
                <p className="text-xs font-medium" style={{ color: "var(--coral-dark)" }}>
                  Selected images will go live immediately on your WordPress site.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handlePush}
                  disabled={selectedPaths.size === 0 || panelState === "pushing"}
                  className="px-5 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: status === "publish" ? "var(--coral)" : "var(--teal)" }}
                >
                  {panelState === "pushing"
                    ? "Pushing..."
                    : `Push ${selectedPaths.size} file${selectedPaths.size === 1 ? "" : "s"} as ${status}`}
                </button>
                <button
                  onClick={handleReset}
                  disabled={panelState === "pushing"}
                  className="px-5 py-2.5 rounded-md text-sm font-medium"
                  style={{ color: "var(--pencil)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {panelState === "done" && result && (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: "var(--teal)" }}>
                Pushed {result.pushed_count} file{result.pushed_count === 1 ? "" : "s"} ({result.failed_count} failed).
              </p>

              {result.failed_items.length > 0 && (
                <div className="rounded-md border-[1.5px] p-3" style={{ borderColor: "var(--coral)", background: "var(--coral-light)" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--coral-dark)" }}>
                    Failed items:
                  </p>
                  {result.failed_items.map((f, i) => (
                    <p key={i} className="text-xs" style={{ color: "var(--coral-dark)" }}>
                      {f.source_path}: {f.error}
                    </p>
                  ))}
                </div>
              )}

              {result.pushed_items.length > 0 && (
                <div className="max-h-56 overflow-y-auto space-y-1.5">
                  {result.pushed_items.map((item, i) => (
                    <div key={i} className="text-xs flex items-center justify-between">
                      <span style={{ color: "var(--ink)" }}>{item.title}</span>
                      <button
                        onClick={() => window.open(item.wp_post_url, "_blank", "noopener,noreferrer")}
                        className="font-medium"
                        style={{ color: "var(--teal)" }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleReset}
                className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
                style={{ background: "var(--teal)" }}
              >
                Done
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
