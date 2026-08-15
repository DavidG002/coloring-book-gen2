"use client";

import { useState, useEffect, useCallback } from "react";
import { getTranslations, ApiError, type Translation } from "@/lib/api";

interface PublishedFileInfo {
  source_path: string;
  target_filename: string;
  alt_text: string;
  title_text: string;
  subject_en: string;
  subject_translated: string;
  variation_text_en: string;
  variation_translated: string | null;
  variation_number: number;
  is_new: boolean;
}

interface PublishPlanResponse {
  files: PublishedFileInfo[];
  total_files: number;
  new_count: number;
  already_published_count: number;
  skipped_subjects: string[];
}

interface PublishRunResponse {
  published_count: number;
  new_count: number;
  already_published_count: number;
  manifest_path: string;
  skipped_subjects: string[];
  run_id: number;
}

interface PublishHistoryFile {
  target_filename: string;
  alt_text: string;
  title_text: string;
  was_new: boolean;
}

interface PublishHistoryRun {
  id: number;
  category: string;
  lang: string;
  published_count: number;
  new_count: number;
  already_published_count: number;
  manifest_path: string;
  created_at: string;
  files: PublishHistoryFile[];
}

interface OutputPathResponse {
  output_path: string;
  publish_root: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function planPublish(category: string, lang: string, onlyNew: boolean): Promise<PublishPlanResponse> {
  const res = await fetch(`${API_BASE_URL}/publish/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, lang, only_new: onlyNew }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data;
}

async function runPublish(category: string, lang: string, onlyNew: boolean): Promise<PublishRunResponse> {
  const res = await fetch(`${API_BASE_URL}/publish/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, lang, only_new: onlyNew }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data;
}

async function getPublishHistory(category: string, lang?: string): Promise<PublishHistoryRun[]> {
  const url = lang
    ? `${API_BASE_URL}/publish/history/${encodeURIComponent(category)}?lang=${encodeURIComponent(lang)}`
    : `${API_BASE_URL}/publish/history/${encodeURIComponent(category)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data;
}

async function getOutputPath(category: string): Promise<OutputPathResponse> {
  const res = await fetch(`${API_BASE_URL}/publish/output-path/${encodeURIComponent(category)}`);
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data;
}

function downloadManifestUrl(runId: number): string {
  return `${API_BASE_URL}/publish/runs/${runId}/manifest`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type PanelState = "idle" | "planning" | "planned" | "publishing" | "done";

export default function PublishPanel({ categoryName }: { categoryName: string }) {
  const [languages, setLanguages] = useState<string[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);
  const [selectedLang, setSelectedLang] = useState<string>("");

  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [plan, setPlan] = useState<PublishPlanResponse | null>(null);
  const [result, setResult] = useState<PublishRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<PublishHistoryRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [onlyNew, setOnlyNew] = useState(true);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [pathCopied, setPathCopied] = useState(false);

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

  useEffect(() => {
    getOutputPath(categoryName)
      .then((data) => setOutputPath(data.output_path))
      .catch(() => {});
  }, [categoryName]);

  function handleCopyPath() {
    if (!outputPath) return;
    navigator.clipboard.writeText(outputPath).then(() => {
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    });
  }

  const loadHistory = useCallback((lang: string) => {
    if (!lang) return;
    setLoadingHistory(true);
    getPublishHistory(categoryName, lang)
      .then(setHistory)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load history"))
      .finally(() => setLoadingHistory(false));
  }, [categoryName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedLang) loadHistory(selectedLang);
  }, [selectedLang, loadHistory]);

  async function handlePreview() {
    if (!selectedLang) return;
    setError(null);
    setPanelState("planning");
    try {
      const data = await planPublish(categoryName, selectedLang, onlyNew);
      setPlan(data);
      setPanelState("planned");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to plan publish");
      setPanelState("idle");
    }
  }

  async function handlePublish() {
    if (!selectedLang) return;
    setError(null);
    setPanelState("publishing");
    try {
      const data = await runPublish(categoryName, selectedLang, onlyNew);
      setResult(data);
      setPanelState("done");
      loadHistory(selectedLang);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to publish");
      setPanelState("planned");
    }
  }

  function handleReset() {
    setPanelState("idle");
    setPlan(null);
    setResult(null);
    setError(null);
  }

  return (
    <section
      className="rounded-lg border-[1.5px] p-6"
      style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
    >
      <h2 className="font-display text-xl font-semibold mb-4" style={{ color: "var(--ink)" }}>
        Publish
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
          Add a translation for this category first — publish needs at least one language with subject translations.
        </p>
      ) : (
        <>
          <div className="mb-5 flex gap-6">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                Language
              </label>
              <select
                value={selectedLang}
                onChange={(e) => {
                  setSelectedLang(e.target.value);
                  handleReset();
                }}
                className="w-40 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm uppercase"
                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                Scope
              </label>
              <div className="flex items-center gap-2 h-[38px]">
                <button
                  type="button"
                  onClick={() => {
                    setOnlyNew(true);
                    handleReset();
                  }}
                  className="px-3 py-1.5 rounded-md text-sm border-[1.5px]"
                  style={
                    onlyNew
                      ? { background: "var(--teal)", borderColor: "var(--teal)", color: "white" }
                      : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
                  }
                >
                  Only new
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOnlyNew(false);
                    handleReset();
                  }}
                  className="px-3 py-1.5 rounded-md text-sm border-[1.5px]"
                  style={
                    !onlyNew
                      ? { background: "var(--teal)", borderColor: "var(--teal)", color: "white" }
                      : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
                  }
                >
                  Everything
                </button>
              </div>
            </div>
          </div>

          {(panelState === "idle" || panelState === "planning") && (
            <button
              onClick={handlePreview}
              disabled={panelState === "planning"}
              className="px-5 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--teal)" }}
            >
              {panelState === "planning" ? "Planning..." : "Preview publish"}
            </button>
          )}

          {panelState === "planned" && plan && (
            <div className="space-y-4">
              <div
                className="rounded-md border-[1.5px] p-4"
                style={{ borderColor: "var(--pencil-light)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
                    style={{ background: "var(--teal)" }}
                  >
                    {plan.new_count} new
                  </span>
                  {plan.already_published_count > 0 && (
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: "var(--paper)", color: "var(--pencil)", border: "1px solid var(--pencil-light)" }}
                    >
                      {plan.already_published_count} already published
                    </span>
                  )}
                </div>
                {plan.skipped_subjects.length > 0 && (
                  <p className="text-xs mb-3" style={{ color: "var(--coral-dark)" }}>
                    Skipped (no translation yet): {plan.skipped_subjects.join(", ")}
                  </p>
                )}
                <div className="max-h-56 overflow-y-auto space-y-2">
                  {plan.files.map((f, i) => (
                    <div key={i} className="text-xs border-b pb-2 flex items-start gap-2" style={{ borderColor: "var(--pencil-light)" }}>
                      <span
                        className="mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={
                          f.is_new
                            ? { background: "var(--teal)", color: "white" }
                            : { background: "var(--paper)", color: "var(--pencil)", border: "1px solid var(--pencil-light)" }
                        }
                      >
                        {f.is_new ? "NEW" : "REPEAT"}
                      </span>
                      <div>
                        <div className="font-medium" style={{ color: "var(--ink)" }}>
                          {f.target_filename}
                        </div>
                        <div style={{ color: "var(--pencil)" }}>{f.alt_text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePublish}
                  disabled={plan.total_files === 0}
                  className="px-5 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: "var(--teal)" }}
                >
                  Publish {plan.total_files} file{plan.total_files === 1 ? "" : "s"}
                </button>
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-md text-sm font-medium"
                  style={{ color: "var(--pencil)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {panelState === "publishing" && (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Publishing...
            </p>
          )}

          {panelState === "done" && result && (
            <div className="space-y-3 mb-2">
              <p className="text-sm font-medium" style={{ color: "var(--teal)" }}>
                Published {result.published_count} file{result.published_count === 1 ? "" : "s"}
                {" "}({result.new_count} new, {result.already_published_count} repeat).
              </p>
              {result.skipped_subjects.length > 0 && (
                <p className="text-xs" style={{ color: "var(--coral-dark)" }}>
                  Skipped: {result.skipped_subjects.join(", ")}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
                  style={{ background: "var(--teal)" }}
                >
                  Done
                </button>
                <button
                  onClick={() => window.open(downloadManifestUrl(result.run_id), "_blank")}
                  className="px-5 py-2.5 rounded-md text-sm font-medium"
                  style={{ color: "var(--pencil)", border: "1.5px solid var(--pencil-light)" }}
                >
                  Download manifest
                </button>
              </div>
            </div>
          )}

          {outputPath && (
            <div
              className="mt-6 flex items-center justify-between rounded-md border-[1.5px] px-4 py-2.5"
              style={{ borderColor: "var(--pencil-light)" }}
            >
              <span className="text-xs font-mono truncate" style={{ color: "var(--pencil)" }}>
                {outputPath}
              </span>
              <button
                onClick={handleCopyPath}
                className="ml-3 shrink-0 text-xs font-medium"
                style={{ color: "var(--teal)" }}
              >
                {pathCopied ? "Copied!" : "Copy path"}
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
              Publish history — {selectedLang.toUpperCase()}
            </h3>
            {loadingHistory ? (
              <p className="text-sm" style={{ color: "var(--pencil)" }}>
                Loading...
              </p>
            ) : history.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--pencil)" }}>
                No publish runs recorded yet for this language.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((run) => (
                  <div key={run.id} className="rounded-md border-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
                    <div className="w-full flex items-center justify-between px-4 py-3">
                      <button
                        onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                        className="text-left flex-1"
                      >
                        <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                          {formatDate(run.created_at)}
                        </span>
                        <span className="ml-3 text-xs" style={{ color: "var(--pencil)" }}>
                          {run.published_count} files ({run.new_count} new, {run.already_published_count} repeat)
                        </span>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(downloadManifestUrl(run.id), "_blank");
                          }}
                          className="text-xs font-medium"
                          style={{ color: "var(--teal)" }}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                    {expandedRunId === run.id && (
                      <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
                        {run.files.map((f, i) => (
                          <div key={i} className="text-xs flex items-start gap-2">
                            <span
                              className="mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={
                                f.was_new
                                  ? { background: "var(--teal)", color: "white" }
                                  : { background: "var(--paper)", color: "var(--pencil)", border: "1px solid var(--pencil-light)" }
                              }
                            >
                              {f.was_new ? "NEW" : "REPEAT"}
                            </span>
                            <div>
                              <div style={{ color: "var(--ink)" }}>{f.target_filename}</div>
                              <div style={{ color: "var(--pencil)" }}>{f.alt_text}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
