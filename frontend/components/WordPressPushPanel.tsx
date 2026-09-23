"use client";

import { useState, useEffect, useMemo } from "react";
import { Send, ChevronDown, Check } from "lucide-react";
import { getTranslations, getAuthHeaders, ApiError, type Translation } from "@/lib/api";
import { useAccessToken } from "@/lib/hooks/useAccessToken";
import type { components } from "@/lib/api/generated-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type WordPressPreviewFile = components["schemas"]["WordPressPreviewFile"];
type WordPressPreviewResponse = components["schemas"]["WordPressPreviewResponse"];

type LangFile = WordPressPreviewFile & { lang: string };

async function previewPush(categoryId: number, lang: string): Promise<WordPressPreviewResponse> {
  const res = await fetch(`${API_BASE_URL}/wordpress/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ category_id: categoryId, lang }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to preview push");
  }
  return res.json();
}

async function runPush(categoryId: number, lang: string, status: string, sourcePaths: string[]) {
  const res = await fetch(`${API_BASE_URL}/wordpress/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ category_id: categoryId, lang, status, source_paths: sourcePaths }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to push");
  }
  return res.json() as Promise<{
    pushed_count: number;
    failed_count: number;
    pushed_items: { title: string; wp_post_url: string }[];
    failed_items: { source_path: string; error: string }[];
  }>;
}

async function setExclude(sourcePath: string, excluded: boolean): Promise<void> {
  await fetch(`${API_BASE_URL}/wordpress/exclude`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ source_path: sourcePath, excluded }),
  });
}

async function syncToWordPress(sourcePath: string, lang: string) {
  const res = await fetch(`${API_BASE_URL}/wordpress/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ source_path: sourcePath, lang }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to sync");
  }
  return res.json();
}

function formatBatchDate(iso: string | null): string {
  if (!iso) return "Unknown batch";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDateHeading(dayKey: string): string {
  if (dayKey === "unknown") return "Unknown date";
  const d = new Date(`${dayKey}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// Handed straight to <img src> — can't set an Authorization header, so the
// access token rides along as a query param (accepted as a fallback by
// backend/services/auth.py's get_current_user).
function imageFileUrl(imageId: number, accessToken: string | undefined): string {
  return `${API_BASE_URL}/review/image/${imageId}/file?token=${encodeURIComponent(accessToken ?? "")}`;
}

type ImageGroup = { sourcePath: string; imageId: number | null; files: LangFile[] };

function groupBySourcePath(files: LangFile[]): ImageGroup[] {
  const map = new Map<string, ImageGroup>();
  for (const f of files) {
    if (!map.has(f.source_path)) {
      map.set(f.source_path, { sourcePath: f.source_path, imageId: f.image_id ?? null, files: [] });
    }
    map.get(f.source_path)!.files.push(f);
  }
  return Array.from(map.values());
}

export default function WordPressPushPanel({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
  const accessToken = useAccessToken();
  const [languages, setLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "publish">("draft");

  const [previews, setPreviews] = useState<Record<string, WordPressPreviewResponse>>({});
  const [langFilter, setLangFilter] = useState<string>("all");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [listCollapsed, setListCollapsed] = useState(false);
  const [archiveCollapsed, setArchiveCollapsed] = useState(true);

  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ pushed: number; failed: number; failedItems: { source_path: string; error: string }[] } | null>(null);
  const [syncingPath, setSyncingPath] = useState<string | null>(null);
  const [syncedPaths, setSyncedPaths] = useState<Set<string>>(new Set());

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    setError(null);
    getTranslations(categoryId, true)
      .then(async (data: Translation[]) => {
        const langs = data.map((t) => t.lang);
        setLanguages(langs);
        const results = await Promise.all(
          langs.map((lang) => previewPush(categoryId, lang).then((p) => [lang, p] as const).catch(() => [lang, null] as const))
        );
        const byLang: Record<string, WordPressPreviewResponse> = {};
        for (const [lang, preview] of results) {
          if (preview) byLang[lang] = preview;
        }
        setPreviews(byLang);
        const defaultSelected = new Set<string>();
        for (const [lang, preview] of Object.entries(byLang)) {
          for (const f of preview.files) {
            if (!f.already_pushed && !f.wp_excluded && !f.seo_error) {
              defaultSelected.add(`${lang}::${f.source_path}`);
            }
          }
        }
        setSelectedPaths(defaultSelected);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load WordPress data"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(loadAll, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const allFiles: LangFile[] = useMemo(() => {
    const out: LangFile[] = [];
    for (const [lang, preview] of Object.entries(previews)) {
      for (const f of preview.files) out.push({ ...f, lang });
    }
    return out;
  }, [previews]);

  const langFilteredFiles = langFilter === "all" ? allFiles : allFiles.filter((f) => f.lang === langFilter);
  const visibleFiles = langFilteredFiles.filter((f) => !f.already_pushed || f.needs_update);
  const groupedItems = groupBySourcePath(visibleFiles);

  function toggleItemExpanded(sourcePath: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(sourcePath)) next.delete(sourcePath);
      else next.add(sourcePath);
      return next;
    });
  }

  function renderFileRow(f: LangFile, imageId?: number | null) {
    const key = `${f.lang}::${f.source_path}`;
    const isSelected = selectedPaths.has(key);
    const isDisabled = f.already_pushed || f.wp_excluded || !!f.seo_error;
    return (
      <div
        key={key}
        className="flex items-start gap-3 rounded-lg px-3 py-2.5"
        style={{ border: "1px solid var(--pencil-light)", opacity: f.wp_excluded ? 0.6 : f.already_pushed && !f.needs_update ? 0.7 : 1 }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isDisabled}
          onChange={() => toggleFile(f.lang, f.source_path)}
          className="mt-0.5"
        />
        {imageId != null && (
          <img
            src={imageFileUrl(imageId, accessToken)}
            alt=""
            className="w-10 h-10 rounded-md object-cover shrink-0"
            style={{ border: "1px solid var(--pencil-light)" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium capitalize" style={{ color: "var(--ink)" }}>{f.title}</span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
              style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}
            >
              {f.lang}
            </span>
            {f.already_pushed && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "var(--tone-sage-bg)", color: "var(--tone-sage)" }}>
                Published
              </span>
            )}
            {f.already_pushed && f.needs_update && !syncedPaths.has(key) && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "var(--coral)", color: "white" }}>
                Needs update
              </span>
            )}
            {f.already_pushed && (f.needs_update || syncedPaths.has(key)) && (
              <button
                onClick={() => handleSync(f)}
                disabled={syncingPath === key}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded disabled:opacity-60"
                style={syncedPaths.has(key) ? { background: "var(--tone-sage)", color: "white" } : { border: "1px solid var(--coral)", color: "var(--coral-dark)" }}
              >
                {syncingPath === key ? "Updating..." : syncedPaths.has(key) ? "\u2713 Updated" : "Update"}
              </button>
            )}
            {f.wp_excluded && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "var(--coral)", color: "white" }}>
                Don&apos;t publish
              </span>
            )}
            {f.seo_error && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "var(--coral)", color: "white" }} title={f.seo_error}>
                Not ready
              </span>
            )}
          </div>
          <p className="text-[10px] m-0 mt-0.5 truncate" style={{ color: "var(--pencil)" }}>{f.alt_text}</p>
        </div>
        {!f.already_pushed && (
          <button
            onClick={() => handleToggleExclude(f)}
            className="shrink-0 text-[9px] font-bold px-2 py-1 rounded-md"
            style={{ border: "1px solid var(--pencil-light)", color: f.wp_excluded ? "var(--teal)" : "var(--coral-dark)" }}
          >
            {f.wp_excluded ? "Include" : "Don't publish"}
          </button>
        )}
      </div>
    );
  }

  const readyCount = allFiles.filter((f) => selectedPaths.has(`${f.lang}::${f.source_path}`)).length;
  const publishedCount = allFiles.filter((f) => f.already_pushed).length;
  const languageSetCount = Object.keys(previews).length;

  // Batch numbers must be stable regardless of which language filter is
  // active — computed once from the full, unfiltered history (oldest
  // first), so "Batch 3" always means the same real batch whether you're
  // looking at "All languages" or a single language. A batch is a single
  // publish action (one publish_run_id), which may cover several languages.
  const allBatchesChronological = useMemo(() => {
    const groups = new Map<string, LangFile[]>();
    for (const f of allFiles) {
      // publish_batch_id ties together every language published together in
      // one "Build publish sets" click (see PublishRun.batch_id) — that's
      // the real "batch" from the user's point of view, even though each
      // language got its own PublishRun row under the hood. Runs from
      // before batch_id existed fall back to grouping by the minute they
      // were created, which is enough to reassemble a same-click batch
      // without merging genuinely unrelated runs.
      const key = f.publish_batch_id ?? (f.published_at ? `min:${f.published_at.slice(0, 16)}` : `run:${f.publish_run_id ?? "unknown"}`);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    }
    return Array.from(groups.entries())
      .map(([key, files]) => ({ key, files, createdAt: files[0]?.published_at ?? null }))
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  }, [allFiles]);

  const batchNumberByKey = useMemo(() => {
    const map = new Map<string, number>();
    allBatchesChronological.forEach((b, i) => map.set(b.key, i + 1));
    return map;
  }, [allBatchesChronological]);

  const batches = useMemo(() => {
    const filtered = allBatchesChronological
      .map((b) => ({ ...b, files: langFilter === "all" ? b.files : b.files.filter((f) => f.lang === langFilter) }))
      .filter((b) => b.files.length > 0);
    return [...filtered].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [allBatchesChronological, langFilter]);

  const batchesByDate = useMemo(() => {
    const map = new Map<string, typeof batches>();
    for (const b of batches) {
      const dayKey = b.createdAt ? b.createdAt.slice(0, 10) : "unknown";
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(b);
    }
    return Array.from(map.entries());
  }, [batches]);

  function toggleFile(lang: string, path: string) {
    const key = `${lang}::${path}`;
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleBatchExpanded(key: string) {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleDateExpanded(dateKey: string) {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  async function handleToggleExclude(file: LangFile) {
    const newExcluded = !file.wp_excluded;
    await setExclude(file.source_path, newExcluded);
    setPreviews((prev) => {
      const preview = prev[file.lang];
      if (!preview) return prev;
      return {
        ...prev,
        [file.lang]: {
          ...preview,
          files: preview.files.map((f) => (f.source_path === file.source_path ? { ...f, wp_excluded: newExcluded } : f)),
        },
      };
    });
    if (newExcluded) {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        next.delete(`${file.lang}::${file.source_path}`);
        return next;
      });
    }
  }

  async function handleSync(file: LangFile) {
    setSyncingPath(`${file.lang}::${file.source_path}`);
    setError(null);
    try {
      await syncToWordPress(file.source_path, file.lang);
      setPreviews((prev) => {
        const preview = prev[file.lang];
        if (!preview) return prev;
        return {
          ...prev,
          [file.lang]: {
            ...preview,
            files: preview.files.map((f) => (f.source_path === file.source_path ? { ...f, needs_update: false } : f)),
          },
        };
      });
      const key = `${file.lang}::${file.source_path}`;
      setSyncedPaths((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setSyncedPaths((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync to WordPress");
    } finally {
      setSyncingPath(null);
    }
  }

  async function handlePublish() {
    setPushing(true);
    setError(null);
    setPushResult(null);
    try {
      const pathsByLang: Record<string, string[]> = {};
      for (const key of selectedPaths) {
        const [lang, ...rest] = key.split("::");
        const path = rest.join("::");
        if (!pathsByLang[lang]) pathsByLang[lang] = [];
        pathsByLang[lang].push(path);
      }

      let totalPushed = 0;
      let totalFailed = 0;
      const allFailedItems: { source_path: string; error: string }[] = [];

      for (const [lang, paths] of Object.entries(pathsByLang)) {
        if (paths.length === 0) continue;
        const result = await runPush(categoryId, lang, status, paths);
        totalPushed += result.pushed_count;
        totalFailed += result.failed_count;
        allFailedItems.push(...result.failed_items);
      }

      setPushResult({ pushed: totalPushed, failed: totalFailed, failedItems: allFailedItems });
      setSelectedPaths(new Set());
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPushing(false);
    }
  }

  async function verifyPushes(categoryId: number, lang: string) {
    const res = await fetch(`${API_BASE_URL}/wordpress/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ category_id: categoryId, lang }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Failed to verify");
    }
    return res.json() as Promise<{ checked_count: number; removed_count: number; terms_checked_count?: number; terms_removed_count?: number }>;
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyResult(null);
    setError(null);
    try {
      let totalRemoved = 0;
      let totalTermsRemoved = 0;
      for (const lang of languages) {
        const result = await verifyPushes(categoryId, lang);
        totalRemoved += result.removed_count;
        totalTermsRemoved += result.terms_removed_count ?? 0;
      }
      const parts: string[] = [];
      if (totalTermsRemoved > 0) {
        parts.push(`${totalTermsRemoved} category/subject link${totalTermsRemoved === 1 ? "" : "s"} reset — new terms will be created next push`);
      }
      if (totalRemoved > 0) {
        parts.push(`${totalRemoved} post${totalRemoved === 1 ? "" : "s"} removed from WordPress, pushable again`);
      }
      setVerifyResult(parts.length > 0 ? `Found: ${parts.join("; ")}.` : "Everything checks out — no changes on the WordPress side.");
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify against WordPress");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return <p className="text-sm px-1 py-4" style={{ color: "var(--pencil)" }}>Loading WordPress status...</p>;
  }

  if (languages.length === 0) {
    return (
      <p className="text-sm px-1 py-4" style={{ color: "var(--pencil)" }}>
        Prepare at least one language first — pushing to WordPress needs real content to send.
      </p>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-3 rounded-md text-sm" style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}>
          {error}
        </div>
      )}

      {/* Summary stats */}
      <div className="rounded-lg mb-3" style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
        <div className="flex items-center gap-8 px-5 py-4" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
          <div>
            <p className="font-display font-normal m-0" style={{ fontSize: 22, color: "var(--ink)" }}>{readyCount}</p>
            <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>ready to publish</p>
          </div>
          <div>
            <p className="font-display font-normal m-0" style={{ fontSize: 22, color: "var(--ink)" }}>{languageSetCount}</p>
            <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>language sets</p>
          </div>
          <div>
            <p className="font-display font-normal m-0" style={{ fontSize: 22, color: "var(--ink)" }}>{publishedCount}</p>
            <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>published</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              title="Check WordPress for posts that were deleted or trashed outside this app"
              className="px-2.5 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-60"
              style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => setStatus("draft")}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-bold"
              style={status === "draft" ? { background: "#0EA5E9", color: "white" } : { border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
            >
              Draft
            </button>
            <button
              type="button"
              onClick={() => setStatus("publish")}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-bold"
              style={status === "publish" ? { background: "var(--coral)", color: "white" } : { border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
            >
              Live
            </button>
          </div>
        </div>
        {verifyResult && (
          <div className="px-5 py-2.5 text-xs" style={{ borderBottom: "1px solid var(--pencil-light)", color: "var(--tone-sage)" }}>
            {verifyResult}
          </div>
        )}
        {/* Language filter pills */}
        <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setLangFilter("all")}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
              style={langFilter === "all" ? { background: "var(--teal)", color: "white" } : { border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
            >
              All languages
            </button>
            {languages.map((lang) => (
              <button
                key={lang}
                onClick={() => setLangFilter(lang)}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
                style={langFilter === lang ? { background: "var(--teal)", color: "white" } : { border: "1px solid var(--pencil-light)",color: "var(--pencil)" }}
              >
                {lang}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px]" style={{ color: "var(--pencil)" }}>
              {readyCount > 0 ? `${readyCount} selected across ${languageSetCount} language${languageSetCount === 1 ? "" : "s"}` : "Nothing selected"}
            </span>
            <button
              onClick={handlePublish}
              disabled={readyCount === 0 || pushing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: status === "publish" ? "var(--coral)" : "#0EA5E9" }}
            >
              {pushing ? "Publishing..." : "Publish to WordPress"} <Send size={13} />
            </button>
          </div>
        </div>

        {/* Collapsible file list */}
        <div className="px-5 pt-3">
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
            Ready to send
          </p>
          <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>
            Not yet pushed to WordPress — select what to send below.
          </p>
        </div>
        <div className="flex items-center gap-8 px-5 pt-2 pb-1">
          <button onClick={() => setListCollapsed((v) => !v)} className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--ink)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--teal)" }} />
            {visibleFiles.length} files
            <ChevronDown size={14} style={{ color: "var(--pencil)", transform: listCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
          </button>
          <span className="flex items-center gap-2">
            <button
              onClick={() => {
                const selectable = visibleFiles.filter((f) => !f.already_pushed && !f.wp_excluded && !f.seo_error);
                setSelectedPaths((prev) => {
                  const next = new Set(prev);
                  selectable.forEach((f) => next.add(`${f.lang}::${f.source_path}`));
                  return next;
                });
              }}
              className="text-[10px] font-bold"
              style={{ color: "var(--teal)" }}
            >
              Select all
            </button>
            <span className="text-[10px]" style={{ color: "var(--pencil-light)" }}>·</span>
            <button
              onClick={() => {
                setSelectedPaths((prev) => {
                  const next = new Set(prev);
                  visibleFiles.forEach((f) => next.delete(`${f.lang}::${f.source_path}`));
                  return next;
                });
              }}
              className="text-[10px] font-bold"
              style={{ color: "var(--pencil)" }}
            >
              Clear
            </button>
          </span>
        </div>
        {!listCollapsed && (
          <div className="px-5 pb-4">
            {groupedItems.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-xs" style={{ color: "var(--tone-sage)" }}>
                <Check size={16} /> All selected files have been removed from this handoff.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {groupedItems.map((group) => {
                  const isMulti = group.files.length > 1;

                  if (!isMulti) {
                    const f = group.files[0];
                    return renderFileRow(f, group.imageId);
                  }

                  const label = group.files[0].subject && group.files[0].variation_text
                    ? `${group.files[0].subject} — ${group.files[0].variation_text}`
                    : "Untitled";
                  const selectableInGroup = group.files.filter((f) => !f.already_pushed && !f.wp_excluded && !f.seo_error);
                  const selectedInGroup = selectableInGroup.filter((f) => selectedPaths.has(`${f.lang}::${f.source_path}`));
                  const allSelected = selectableInGroup.length > 0 && selectedInGroup.length === selectableInGroup.length;
                  const noneSelected = selectedInGroup.length === 0;
                  const isExpanded = expandedItems.has(group.sourcePath);

                  return (
                    <div key={group.sourcePath} className="rounded-lg" style={{ border: "1px solid var(--pencil-light)" }}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = !allSelected && !noneSelected;
                          }}
                          disabled={selectableInGroup.length === 0}
                          onChange={() => {
                            selectableInGroup.forEach((f) => {
                              const k = `${f.lang}::${f.source_path}`;
                              const isSelected = selectedPaths.has(k);
                              if (allSelected ? isSelected : !isSelected) toggleFile(f.lang, f.source_path);
                            });
                          }}
                        />
                        {group.imageId != null && (
                          <img
                            src={imageFileUrl(group.imageId, accessToken)}
                            alt=""
                            className="w-10 h-10 rounded-md object-cover shrink-0"
                            style={{ border: "1px solid var(--pencil-light)" }}
                          />
                        )}
                        <button
                          onClick={() => toggleItemExpanded(group.sourcePath)}
                          className="flex-1 flex items-center justify-between gap-2 min-w-0 text-left"
                        >
                          <span className="text-xs font-medium capitalize truncate" style={{ color: "var(--ink)" }}>{label}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px]" style={{ color: "var(--pencil)" }}>{group.files.length} languages</span>
                            <ChevronDown size={14} style={{ color: "var(--pencil)", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                          </span>
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="space-y-1.5 px-3 pb-2.5 pt-1" style={{ borderTop: "1px solid var(--pencil-light)" }}>
                          {group.files.map((f) => renderFileRow(f))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* Archive / batch history */}
        {batches.length > 0 && (
          <div className="px-5 py-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
            <button onClick={() => setArchiveCollapsed((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
              <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                Archive
              </p>
              <ChevronDown size={14} style={{ color: "var(--pencil)", transform: archiveCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
            </button>
            <p className="text-[10px] m-0 mb-2" style={{ color: "var(--pencil)" }}>
              {batches.length} past batch{batches.length === 1 ? "" : "es"} across {batchesByDate.length} day{batchesByDate.length === 1 ? "" : "s"} — click a date, then a batch, to see exactly which files went out.
            </p>
            {!archiveCollapsed && (
            <div className="space-y-1.5">
              {batchesByDate.map(([dateKey, dateBatches]) => {
                const isDateExpanded = expandedDates.has(dateKey);
                const totalFiles = dateBatches.reduce((sum, b) => sum + b.files.length, 0);
                const publishedFiles = dateBatches.reduce((sum, b) => sum + b.files.filter((f) => f.already_pushed).length, 0);
                return (
                  <div key={dateKey} className="rounded-md" style={{ border: "1px solid var(--pencil-light)" }}>
                    <button
                      onClick={() => toggleDateExpanded(dateKey)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
                    >
                      <span className="text-[11px] font-bold" style={{ color: "var(--ink)" }}>
                        {formatDateHeading(dateKey)}
                      </span>
                      <span className="flex items-center gap-2 text-[10px] shrink-0" style={{ color: "var(--pencil)" }}>
                        {dateBatches.length} batch{dateBatches.length === 1 ? "" : "es"} · {publishedFiles}/{totalFiles} published
                        <ChevronDown size={14} style={{ color: "var(--pencil)", transform: isDateExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                      </span>
                    </button>
                    {isDateExpanded && (
                      <div className="px-3 pb-2.5 space-y-1.5" style={{ borderTop: "1px solid var(--pencil-light)" }}>
                        {dateBatches.map((batch) => {
                          const isExpanded = expandedBatches.has(batch.key);
                          const publishedInBatch = batch.files.filter((f) => f.already_pushed).length;
                          const isFullyPublished = publishedInBatch === batch.files.length;
                          const isPartial = publishedInBatch > 0 && !isFullyPublished;
                          const langsInBatch = [...new Set(batch.files.map((f) => f.lang))];
                          const posts = groupBySourcePath(batch.files);
                          return (
                            <div key={batch.key} className="rounded-md mt-1.5" style={{ border: "1px solid var(--pencil-light)" }}>
                              <div className="flex items-center justify-between px-3 py-2">
                                <button onClick={() => toggleBatchExpanded(batch.key)} className="flex items-center gap-2.5 text-left">
                                  <span className="inline-flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--ink)" }}>
                                    Batch {batchNumberByKey.get(batch.key)}
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                      style={
                                        isFullyPublished
                                          ? { background: "var(--tone-sage-bg)", color: "var(--tone-sage)" }
                                          : isPartial
                                          ? { background: "var(--tone-yellow-bg)", color: "var(--tone-yellow)" }
                                          : { background: "var(--pencil-light)", color: "var(--pencil)" }
                                      }
                                    >
                                      {isFullyPublished ? "Published" : isPartial ? "Partial" : "Not sent"}
                                    </span>
                                  </span>
                                  <span className="text-[10px]" style={{ color: "var(--pencil)" }}>
                                    {posts.length} file{posts.length === 1 ? "" : "s"} · {langsInBatch.length} language{langsInBatch.length === 1 ? "" : "s"}
                                    {batch.files.some((f) => f.wp_excluded) && `, ${batch.files.filter((f) => f.wp_excluded).length} excluded`}
                                    {" · "}
                                    {formatBatchDate(batch.createdAt)}
                                  </span>
                                </button>
                                {batch.files.some((f) => !f.already_pushed && !f.wp_excluded && !f.seo_error) && (
                                  <button
                                    onClick={() => {
                                      const pushable = batch.files.filter((f) => !f.already_pushed && !f.wp_excluded && !f.seo_error);
                                      const keys = pushable.map((f) => `${f.lang}::${f.source_path}`);
                                      const allSelected = keys.every((k) => selectedPaths.has(k));
                                      setSelectedPaths((prev) => {
                                        const next = new Set(prev);
                                        for (const k of keys) {
                                          if (allSelected) next.delete(k);
                                          else next.add(k);
                                        }
                                        return next;
                                      });
                                    }}
                                    className="text-[10px] font-bold shrink-0"
                                    style={{ color: "var(--teal)" }}
                                  >
                                    Select batch
                                  </button>
                                )}
                              </div>
                              {isExpanded && (
                                <div className="px-3 pb-2.5 space-y-2" style={{ borderTop: "1px solid var(--pencil-light)" }}>
                                  {posts.map((post) => {
                                    const label = post.files[0].subject && post.files[0].variation_text
                                      ? `${post.files[0].subject} — ${post.files[0].variation_text}`
                                      : post.files[0].title;
                                    return (
                                      <div key={post.sourcePath} className="pt-1.5">
                                        <p className="text-[10px] font-bold m-0 mb-1 truncate capitalize" style={{ color: "var(--ink)" }}>
                                          {label}
                                        </p>
                                        <div className="space-y-1 pl-2">
                                          {post.files.map((f) => (
                                            <div key={`${f.lang}::${f.source_path}`} className="flex items-center justify-between gap-2">
                                              <p className="text-[10px] m-0" style={{ color: "var(--pencil)" }}>
                                                {f.lang.toUpperCase()} · {f.title}
                                              </p>
                                              <span
                                                className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                                style={
                                                  f.already_pushed
                                                    ? { background: "var(--tone-sage-bg)", color: "var(--tone-sage)" }
                                                    : { background: "var(--pencil-light)", color: "var(--pencil)" }
                                                }
                                              >
                                                {f.already_pushed ? "Published" : allBatchesChronological.some((b) => b.files.some((bf) => bf.source_path === f.source_path)) ? "Re-send" : "Not sent"}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

</div>

      {pushResult && (
        <div className="rounded-lg px-4 py-3" style={{ border: "1px solid var(--tone-sage)", background: "var(--tone-sage-bg)" }}>
          <p className="text-xs font-bold m-0" style={{ color: "var(--tone-sage)" }}>
            Published {pushResult.pushed} file{pushResult.pushed === 1 ? "" : "s"}
            {pushResult.failed > 0 && ` (${pushResult.failed} failed)`}.
          </p>
          {pushResult.failedItems.map((f, i) => (
            <p key={i} className="text-[10px] m-0 mt-1" style={{ color: "var(--coral-dark)" }}>
              {f.source_path}: {f.error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
