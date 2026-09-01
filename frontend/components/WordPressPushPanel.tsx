"use client";

import { useState, useEffect, useMemo } from "react";
import { Send, ChevronDown, Check } from "lucide-react";
import { getTranslations, ApiError, type Translation } from "@/lib/api";
import type { components } from "@/lib/api/generated-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type WordPressPreviewFile = components["schemas"]["WordPressPreviewFile"];
type WordPressPreviewResponse = components["schemas"]["WordPressPreviewResponse"];

type LangFile = WordPressPreviewFile & { lang: string };

async function previewPush(categoryId: number, lang: string): Promise<WordPressPreviewResponse> {
  const res = await fetch(`${API_BASE_URL}/wordpress/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_path: sourcePath, excluded }),
  });
}

async function syncToWordPress(sourcePath: string, lang: string) {
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

function formatBatchDate(iso: string | null): string {
  if (!iso) return "Unknown batch";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function WordPressPushPanel({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
  const [languages, setLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "publish">("draft");

  const [previews, setPreviews] = useState<Record<string, WordPressPreviewResponse>>({});
  const [langFilter, setLangFilter] = useState<string>("all");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [listCollapsed, setListCollapsed] = useState(false);

  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ pushed: number; failed: number; failedItems: { source_path: string; error: string }[] } | null>(null);
  const [syncingPath, setSyncingPath] = useState<string | null>(null);
  const [syncedPaths, setSyncedPaths] = useState<Set<string>>(new Set());

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    setError(null);
    getTranslations(categoryId)
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

  const readyCount = allFiles.filter((f) => selectedPaths.has(`${f.lang}::${f.source_path}`)).length;
  const publishedCount = allFiles.filter((f) => f.already_pushed).length;
  const languageSetCount = Object.keys(previews).length;

  // Batch numbers must be stable regardless of which language filter is
  // active — computed once from the full, unfiltered history (oldest
  // first), so "Batch 3" always means the same real batch whether you're
  // looking at "All languages" or a single language.
  const allBatchesChronological = useMemo(() => {
    const groups = new Map<string, LangFile[]>();
    for (const f of allFiles) {
      const key = `${f.lang}::${f.publish_run_id ?? "unknown"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    }
    return Array.from(groups.entries())
      .map(([key, files]) => ({ key, lang: files[0].lang, files, createdAt: files[0]?.published_at ?? null }))
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  }, [allFiles]);

  const batchNumberByKey = useMemo(() => {
    const map = new Map<string, number>();
    allBatchesChronological.forEach((b, i) => map.set(b.key, i + 1));
    return map;
  }, [allBatchesChronological]);

  const batches = useMemo(() => {
    const visible = langFilter === "all" ? allBatchesChronological : allBatchesChronological.filter((b) => b.lang === langFilter);
    return [...visible].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [allBatchesChronological, langFilter]);

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId, lang }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Failed to verify");
    }
    return res.json() as Promise<{ checked_count: number; removed_count: number }>;
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyResult(null);
    setError(null);
    try {
      let totalRemoved = 0;
      for (const lang of languages) {
        const result = await verifyPushes(categoryId, lang);
        totalRemoved += result.removed_count;
      }
      setVerifyResult(
        totalRemoved > 0
          ? `Found ${totalRemoved} post${totalRemoved === 1 ? "" : "s"} removed from WordPress — they're pushable again.`
          : "Everything checks out — no changes on the WordPress side."
      );
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
              style={status === "draft" ? { background: "var(--teal)", color: "white" } : { border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
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
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
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
              style={langFilter === lang ? { background: "var(--teal)", color: "white" } : { border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
            >
              {lang}
            </button>
          ))}
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
        <div className="flex items-center justify-between px-5 pt-2 pb-1">
          <button onClick={() => setListCollapsed((v) => !v)} className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--ink)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--teal)" }} />
            {visibleFiles.length} files
            <ChevronDown size={14} style={{ color: "var(--pencil)", transform: listCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
          </button>
        </div>

        {!listCollapsed && (
          <div className="px-5 pb-4">
            {visibleFiles.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-xs" style={{ color: "var(--tone-sage)" }}>
                <Check size={16} /> All selected files have been removed from this handoff.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {visibleFiles.map((f) => {
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
                })}
              </div>
            )}
          </div>
        )}

        {/* Archive / batch history */}
        {batches.length > 0 && (
          <div className="px-5 py-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
            <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
              Archive
            </p>
            <p className="text-[10px] m-0 mb-2" style={{ color: "var(--pencil)" }}>
              {batches.length} past batch{batches.length === 1 ? "" : "es"} — click one to see exactly which files went out.
            </p>
            <div className="space-y-1.5">
              {batches.map((batch, i) => {
                const isExpanded = expandedBatches.has(batch.key);
                const publishedInBatch = batch.files.filter((f) => f.already_pushed).length;
                const isFullyPublished = publishedInBatch === batch.files.length;
                const isPartial = publishedInBatch > 0 && !isFullyPublished;
                return (
                  <div key={batch.key} className="rounded-md" style={{ border: "1px solid var(--pencil-light)" }}>
                    <div className="flex items-center justify-between px-3 py-2">
                      <button onClick={() => toggleBatchExpanded(batch.key)} className="flex items-center gap-2.5 text-left">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background: ["var(--tone-sage)", "var(--tone-blue)", "var(--tone-peach)", "var(--tone-yellow)", "var(--tone-lavender)"][
                              [...new Set(allFiles.map((f) => f.lang))].indexOf(batch.lang) % 5
                            ],
                          }}
                        />
                        <span className="inline-flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--ink)" }}>
                          Batch {batchNumberByKey.get(batch.key)} · {batch.lang.toUpperCase()}
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
                          {batch.files.length} files
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
                      <div className="px-3 pb-2.5 space-y-1">
                        {batch.files.map((f) => (
                          <div key={f.source_path} className="flex items-center justify-between gap-2">
                            <p className="text-[10px] m-0" style={{ color: "var(--pencil)" }}>
                              {batch.lang.toUpperCase()} · {f.title}
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-5 py-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
          <span className="text-[10px]" style={{ color: "var(--pencil)" }}>
            {readyCount > 0 ? `${readyCount} selected across ${languageSetCount} language${languageSetCount === 1 ? "" : "s"}` : "Nothing selected"}
          </span>
          <button
            onClick={handlePublish}
            disabled={readyCount === 0 || pushing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
            style={{ background: status === "publish" ? "var(--coral)" : "var(--teal)" }}
          >
            {pushing ? "Publishing..." : "Publish to WordPress"} <Send size={13} />
          </button>
        </div>
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
