"use client";

import { useState, useEffect } from "react";
import { Send } from "lucide-react";
import SequencePanel from "./SequencePanel";
import LanguagePills from "@/components/LanguagePills";
import { getTranslations, ApiError, type Translation } from "@/lib/api";
import type { components } from "@/lib/api/generated-types";
import { Check, ChevronDown } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ContentVariantRow = components["schemas"]["SeoContentVariantRow"];
type SeoData = components["schemas"]["SeoDataResponse"];

async function getSeoData(categoryId: number, lang: string): Promise<SeoData> {
  const res = await fetch(`${API_BASE_URL}/categories/${categoryId}/seo/${lang}`);
  if (!res.ok) {
    const data = await res.json();
    throw new ApiError(res.status, data.detail);
  }
  return res.json();
}
async function saveDescription(categoryId: number, lang: string, description: string): Promise<void> {
  await fetch(`${API_BASE_URL}/categories/${categoryId}/seo/${lang}/description`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
}
async function regenerateDescription(categoryId: number, lang: string): Promise<string> {
  const res = await fetch(
    `${API_BASE_URL}/categories/${categoryId}/seo/${lang}/description/regenerate`,
    { method: "POST" }
  );
  const data = await res.json();
  return data.description;
}
async function saveContentVariant(categoryId: number, lang: string, row: ContentVariantRow): Promise<void> {
  await fetch(`${API_BASE_URL}/categories/${categoryId}/seo/${lang}/content`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject_name: row.subject_name,
      variation_text: row.variation_text,
      seo_title: row.seo_title,
      seo_alt_text: row.seo_alt_text,
      seo_excerpt: row.seo_excerpt,
      seo_content: row.seo_content,
    }),
  });
}
function imageFileUrl(imageId: number): string {
  return `${API_BASE_URL}/review/image/${imageId}/file`;
}
async function generateMissing(categoryId: number, lang: string): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/categories/${categoryId}/seo/${lang}/content/generate-missing`, { method: "POST" });
  const data = await res.json();
  return data.generated_count;
}
async function regenerateOne(categoryId: number, lang: string, subjectName: string, variationText: string): Promise<Partial<ContentVariantRow>> {
  const res = await fetch(`${API_BASE_URL}/categories/${categoryId}/seo/${lang}/content/regenerate`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject_name: subjectName, variation_text: variationText }),
  });
  return res.json();
}

async function planPublishForLang(category: string, lang: string) {
  const res = await fetch(`${API_BASE_URL}/publish/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, lang, only_new: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data as { total_files: number; skipped_subjects: string[] };
}
async function runPublishForLang(category: string, lang: string) {
  const res = await fetch(`${API_BASE_URL}/publish/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, lang, only_new: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data as { published_count: number };
}

export default function PublishSequencePanel({
  categoryId,
  categoryName,
  onGoToWordPress,
  onGoToLanguage,
}: {
  categoryId: number;
  categoryName: string;
  onGoToWordPress: () => void;
  onGoToLanguage: () => void;
}) {
  const [languages, setLanguages] = useState<string[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);
  const [selectedLang, setSelectedLang] = useState("");

  const [seoData, setSeoData] = useState<SeoData | null>(null);
  const [loadingSeo, setLoadingSeo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [savedDescriptionSnapshot, setSavedDescriptionSnapshot] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [regeneratingDescription, setRegeneratingDescription] = useState(false);

  const [filter, setFilter] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [regeneratingRow, setRegeneratingRow] = useState<string | null>(null);
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [generatingMissing, setGeneratingMissing] = useState(false);
  const [missingResult, setMissingResult] = useState<string | null>(null);

  const [langFileCounts, setLangFileCounts] = useState<Record<string, number>>({});
  const [langSkippedSubjects, setLangSkippedSubjects] = useState<Record<string, string[]>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [building, setBuilding] = useState(false);
  const [builtSummary, setBuiltSummary] = useState<string | null>(null);
  const [filesSectionCollapsed, setFilesSectionCollapsed] = useState(false);
  const [showWordPress, setShowWordPress] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getTranslations(categoryId)
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
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
   }, [categoryId]);

  useEffect(() => {
    if (languages.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingCounts(true);
      const counts: Record<string, number> = {};
      const skipped: Record<string, string[]> = {};
      for (const lang of languages) {
        try {
          const plan = await planPublishForLang(categoryName, lang);
          counts[lang] = plan.total_files;
          skipped[lang] = plan.skipped_subjects ?? [];
        } catch {
          counts[lang] = 0;
          skipped[lang] = [];
        }
      }
      if (!cancelled) {
        setLangFileCounts(counts);
        setLangSkippedSubjects(skipped);
        setLoadingCounts(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryName, languages]);

  async function handleBuildLanguageSets() {
  setBuilding(true);
  setError(null);
  let totalPublished = 0;
  try {
    for (const lang of languages) {
      if ((langFileCounts[lang] ?? 0) === 0) continue;
      const result = await runPublishForLang(categoryName, lang);
      totalPublished += result.published_count;
    }
    setBuiltSummary(`${totalPublished} file${totalPublished === 1 ? "" : "s"} across ${languages.length} language${languages.length === 1 ? "" : "s"}`);
    setFilesSectionCollapsed(true);
    setShowWordPress(true);
  } catch (err) {
    setError(err instanceof ApiError ? err.message : "Failed to build language sets");
  } finally {
    setBuilding(false);
  }
}

  useEffect(() => {
    if (!selectedLang) {
      const timer = setTimeout(() => setSeoData(null), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoadingSeo(true);
      setError(null);
      getSeoData(categoryId, selectedLang)
        .then((data) => {
          if (cancelled) return;
          setSeoData(data);
          setDescription(data.category_description);
          setSavedDescriptionSnapshot(data.category_description);
          setDirtyRows(new Set());
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load SEO data");
        })
        .finally(() => {
          if (!cancelled) setLoadingSeo(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId, selectedLang]);

  async function handleSaveDescription() {
    setSavingDescription(true);
    try {
      await saveDescription(categoryId, selectedLang, description);
      setSavedDescriptionSnapshot(description);
    } catch {
      setError("Failed to save description");
    } finally {
      setSavingDescription(false);
    }
  }

  async function handleRegenerateDescription() {
    setRegeneratingDescription(true);
    try {
      const newDescription = await regenerateDescription(categoryId, selectedLang);
      setDescription(newDescription);
    } catch {
      setError("Failed to regenerate description");
    } finally {
      setRegeneratingDescription(false);
    }
  }

  function updateRow(subjectName: string, variationText: string, field: keyof ContentVariantRow, value: string) {
    const key = `${subjectName}::${variationText}`;
    setDirtyRows((prev) => new Set(prev).add(key));
    setSeoData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        content_variants: prev.content_variants.map((r) =>
          r.subject_name === subjectName && r.variation_text === variationText ? { ...r, [field]: value } : r
        ),
      };
    });
  }

  async function handleSaveRow(row: ContentVariantRow) {
    const key = `${row.subject_name}::${row.variation_text}`;
    setSavingRow(key);
    try {
      await saveContentVariant(categoryId, selectedLang, row);
      setDirtyRows((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setSeoData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          content_variants: prev.content_variants.map((r) =>
            r.subject_name === row.subject_name && r.variation_text === row.variation_text ? { ...r, generated: true } : r
          ),
        };
      });
    } catch {
      setError("Failed to save");
    } finally {
      setSavingRow(null);
    }
  }

  async function handleRegenerateRow(row: ContentVariantRow) {
    const key = `${row.subject_name}::${row.variation_text}`;
    setRegeneratingRow(key);
    try {
      const result = await regenerateOne(categoryId, selectedLang, row.subject_name, row.variation_text);
      setDirtyRows((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setSeoData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          content_variants: prev.content_variants.map((r) =>
            r.subject_name === row.subject_name && r.variation_text === row.variation_text ? { ...r, ...result, generated: true } : r
          ),
        };
      });
    } catch {
      setError("Failed to regenerate");
    } finally {
      setRegeneratingRow(null);
    }
  }

  async function handleGenerateMissing() {
    setGeneratingMissing(true);
    setMissingResult(null);
    try {
      const count = await generateMissing(categoryId, selectedLang);
      setMissingResult(count > 0 ? `Generated ${count} new` : "Nothing missing");
      const refreshed = await getSeoData(categoryId, selectedLang);
      setSeoData(refreshed);
      setTimeout(() => setMissingResult(null), 4000);
    } catch {
      setError("Failed to generate missing content");
    } finally {
      setGeneratingMissing(false);
    }
  }

  const descriptionDirty = description !== savedDescriptionSnapshot;
  const filteredVariants =
    seoData?.content_variants.filter(
      (r) =>
        !filter ||
        r.subject_name.toLowerCase().includes(filter.toLowerCase()) ||
        r.variation_text.toLowerCase().includes(filter.toLowerCase())
    ) ?? [];

  return (
    <SequencePanel
      eyebrow="03 / PUBLISH"
      title="Tag and publish your pages"
      icon={<Send size={25} />}
    >
      <div className="px-6 pt-1 pb-2">
        <p className="text-xs leading-relaxed m-0" style={{ maxWidth: 450, color: "var(--pencil)" }}>
          Write SEO titles and alt text for each generated image, then build your local files and push to WordPress.
        </p>
      </div>

      {error && (
        <div className="mx-6 mb-4 px-4 py-3 rounded-md text-sm" style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}>
          {error}
        </div>
      )}

      {loadingLangs ? (
        <p className="text-sm px-6 pb-6" style={{ color: "var(--pencil)" }}>
          Loading...
        </p>
      ) : languages.length === 0 ? (
        <p className="text-sm px-6 pb-6" style={{ color: "var(--pencil)" }}>
          Prepare at least one language first — SEO content is generated per language.
        </p>
      ) : (
        <div className="px-6 pb-6">
          <div className="mb-5">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Language
            </label>
            <LanguagePills languages={languages} selected={selectedLang} onSelect={setSelectedLang} />
          </div>

          {loadingSeo ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Loading...
            </p>
          ) : seoData ? (
            <>
              <div
                className="mb-5 rounded-lg"
                style={{ padding: 16, border: "1px solid var(--pencil-light)", background: "var(--paper)" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                    Category description
                  </label>
                  <button
                    onClick={handleRegenerateDescription}
                    disabled={regeneratingDescription}
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold disabled:opacity-60"
                    style={{ border: "1px solid var(--teal)", color: "var(--teal)" }}
                  >
                    {regeneratingDescription ? "Regenerating..." : "Regenerate"}
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-xs"
                  style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                />
                <p className="mt-1.5 text-[10px] mb-2" style={{ color: "var(--pencil)" }}>
                  Used as the WordPress taxonomy term&apos;s description.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveDescription}
                    disabled={savingDescription}
                    className="px-3.5 py-1.5 rounded-md text-[11px] font-bold text-white disabled:opacity-60"
                    style={{ background: "var(--teal)" }}
                  >
                    {savingDescription ? "Saving..." : "Save description"}
                  </button>
                  {descriptionDirty && (
                    <span className="text-[10px] font-bold" style={{ color: "var(--coral-dark)" }}>
                      Unsaved changes
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                  Per-image content ({seoData.content_variants.filter((r) => r.generated).length} of {seoData.content_variants.length})
                </label>
                <div className="flex items-center gap-3">
                  {missingResult && (
                    <span className="text-[10px] font-bold" style={{ color: "var(--teal)" }}>
                      {missingResult}
                    </span>
                  )}
                  <button
                    onClick={handleGenerateMissing}
                    disabled={generatingMissing}
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold disabled:opacity-60"
                    style={{ border: "1px solid var(--teal)", color: "var(--teal)" }}
                  >
                    {generatingMissing ? "Generating..." : "Generate missing"}
                  </button>
                </div>
              </div>

              {seoData.content_variants.length > 8 && (
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={`Filter ${seoData.content_variants.length} rows...`}
                  className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-xs mb-2"
                  style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                />
              )}

              {seoData.content_variants.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--pencil)" }}>
                  No generated images for this category yet — go back to Generate first.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
                  {filteredVariants.map((row) => {
                    const key = `${row.subject_name}::${row.variation_text}`;
                    const isExpanded = expandedRow === key;
                    const isDirty = dirtyRows.has(key);
                    return (
                      <div
                        key={key}
                        className="rounded-lg overflow-hidden"
                        style={{ border: `1px solid ${row.generated ? "var(--pencil-light)" : "var(--coral)"}` }}
                      >
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : key)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <img
                              src={imageFileUrl(row.sample_image_id)}
                              alt={`${row.subject_name} — ${row.variation_text}`}
                              className="w-10 h-10 rounded-md object-cover shrink-0"
                              style={{ background: "var(--tone-sage-bg)" }}
                            />
                            <span className="text-xs font-medium truncate capitalize" style={{ color: "var(--ink)" }}>
                              {row.subject_name} — {row.variation_text}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0 text-[10px] font-bold">
                            {isDirty && <span style={{ color: "var(--coral-dark)" }}>Unsaved</span>}
                            <span style={{ color: row.generated ? "var(--tone-sage)" : "var(--coral-dark)" }}>
                              {row.generated ? "Generated" : "Not generated"}
                            </span>
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-2" style={{ borderTop: "1px solid var(--pencil-light)" }}>
                            <div className="pt-2.5">
                              <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--pencil)" }}>
                                Title
                              </label>
                              <input
                                type="text"
                                value={row.seo_title}
                                onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_title", e.target.value)}
                                className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--pencil)" }}>
                                Alt text
                              </label>
                              <input
                                type="text"
                                value={row.seo_alt_text}
                                onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_alt_text", e.target.value)}
                                className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--pencil)" }}>
                                Excerpt
                              </label>
                              <input
                                type="text"
                                value={row.seo_excerpt}
                                onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_excerpt", e.target.value)}
                                className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--pencil)" }}>
                                Content
                              </label>
                              <textarea
                                value={row.seo_content}
                                onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_content", e.target.value)}
                                rows={2}
                                className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                              />
                            </div>

                            <div className="rounded-md p-2.5 mt-1" style={{ background: "var(--tone-yellow-bg)", border: "1px solid var(--tone-yellow)" }}>
                              <div className="flex items-center gap-1.5 mb-2">
                                <span
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                                  style={{ background: "var(--tone-yellow)", color: "white" }}
                                >
                                  Y
                                </span>
                                <p className="text-[10px] font-bold uppercase m-0" style={{ color: "var(--tone-yellow)", letterSpacing: "0.06em" }}>
                                  Yoast SEO
                                </p>
                                {!row.focus_keyphrase && !row.yoast_title && !row.yoast_meta_description && (
                                  <span className="text-[9px] ml-auto" style={{ color: "var(--tone-yellow)" }}>
                                    Not set yet
                                  </span>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div>
                                  <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--pencil)" }}>
                                    Focus keyphrase
                                  </label>
                                  <input
                                    type="text"
                                    value={row.focus_keyphrase}
                                    onChange={(e) => updateRow(row.subject_name, row.variation_text, "focus_keyphrase", e.target.value)}
                                    placeholder="e.g. truck coloring page"
                                    className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                    style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--pencil)" }}>
                                    SEO title <span className="font-normal">({row.yoast_title.length}/60)</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={row.yoast_title}
                                    onChange={(e) => updateRow(row.subject_name, row.variation_text, "yoast_title", e.target.value)}
                                    className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                    style={{
                                      borderColor: row.yoast_title.length > 60 ? "var(--coral)" : "var(--pencil-light)",
                                      background: "var(--paper)",
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--pencil)" }}>
                                    Meta description <span className="font-normal">({row.yoast_meta_description.length}/155)</span>
                                  </label>
                                  <textarea
                                    value={row.yoast_meta_description}
                                    onChange={(e) => updateRow(row.subject_name, row.variation_text, "yoast_meta_description", e.target.value)}
                                    rows={2}
                                    className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                    style={{
                                      borderColor: row.yoast_meta_description.length > 155 ? "var(--coral)" : "var(--pencil-light)",
                                      background: "var(--paper)",
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 pt-1">
                              <button
                                onClick={() => handleSaveRow(row)}
                                disabled={savingRow === key}
                                className="px-3 py-1.5 rounded-md text-[10px] font-bold text-white disabled:opacity-60"
                                style={{ background: "var(--teal)" }}
                              >
                                {savingRow === key ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={() => handleRegenerateRow(row)}
                                disabled={regeneratingRow === key}
                                className="px-3 py-1.5 rounded-md text-[10px] font-bold disabled:opacity-60"
                                style={{ color: "var(--pencil)", border: "1px solid var(--pencil-light)" }}
                              >
                                {regeneratingRow === key ? "Regenerating..." : "Regenerate"}
                              </button>
                              {isDirty && (
                                <span className="text-[10px] font-bold" style={{ color: "var(--coral-dark)" }}>
                                  Unsaved
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Select a language above to view its SEO content.
            </p>
          )}
        </div>
      )}

      {languages.length > 0 && (
        <div className="mx-6 mb-6">
          {!filesSectionCollapsed ? (
            <div className="rounded-lg" style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                    Prepare your files
                  </p>
                  <p className="font-display font-normal m-0 mt-1" style={{ fontSize: 17, color: "var(--ink)" }}>
                    Build language sets
                  </p>
                  <p className="text-xs m-0 mt-1" style={{ color: "var(--pencil)" }}>
                    Marry the approved images with their reviewed translations and SEO metadata.
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {languages.map((lang) => {
                    const count = langFileCounts[lang] ?? 0;
                    const skipped = langSkippedSubjects[lang] ?? [];
                    return (
                      <div key={lang}>
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex items-center justify-center rounded-md text-[10px] font-black uppercase"
                          style={{ width: 30, height: 22, background: "var(--teal-tint)", color: "var(--teal-dark)" }}
                        >
                          {lang}
                        </span>
                        <span className="text-[11px] w-16 text-right" style={{ color: "var(--pencil)" }}>
                          {loadingCounts ? "..." : `${count} file${count === 1 ? "" : "s"}`}
                        </span>
                        <span
                          className="px-2 py-1 rounded-full text-[9px] font-bold whitespace-nowrap"
                          style={
                            count > 0
                              ? { background: "var(--tone-sage-bg)", color: "var(--tone-sage)" }
                              : { background: "var(--pencil-light)", color: "var(--pencil)" }
                          }
                        >
                          {count > 0 ? "Ready" : "Up to date"}
                        </span>
                    </div>
                    {skipped.length > 0 && (
                      <p className="text-[10px] mt-1 mb-0" style={{ color: "var(--coral-dark)" }}>
                        {skipped.length} subject{skipped.length === 1 ? "" : "s"} can&apos;t publish yet — missing{" "}
                        {lang.toUpperCase()} translation: {skipped.join(", ")}.{" "}
                        <button onClick={onGoToLanguage} className="underline font-bold">
                          Fix in Language
                        </button>
                      </p>
                    )}
                    </div>
                    );
                  })}
          </div>
              </div>
              <div
                className="flex items-center justify-between gap-4 px-4 py-3"
                style={{ borderTop: "1px solid var(--pencil-light)" }}
              >
                <span className="text-[10px]" style={{ color: "var(--pencil)" }}>
                  {Object.values(langFileCounts).every((c) => c === 0)
                    ? "Everything is already built."
                    : "Review SEO before building the sets."}
                </span>
                <button
                  onClick={handleBuildLanguageSets}
                  disabled={building || Object.values(langFileCounts).every((c) => c === 0)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                  style={{ background: "var(--teal)" }}
                >
                  {building ? "Building..." : "Build publish sets"} <Send size={13} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setFilesSectionCollapsed(false)}
              className="w-full flex items-center justify-between gap-4 rounded-lg px-4 py-3"
              style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}
            >
              <span className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: "var(--ink)" }}>
                <Check size={14} style={{ color: "var(--tone-sage)" }} />
                Language sets built — {builtSummary}
              </span>
              <ChevronDown size={14} style={{ color: "var(--pencil)" }} />
            </button>
          )}

            {showWordPress && (
              <div
                className="mt-3 rounded-lg overflow-hidden"
                style={{ border: "1px solid var(--tone-sage)", background: "var(--tone-sage-bg)" }}
              >
                <div className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--tone-sage)", letterSpacing: "0.1em" }}>
                      Final handoff
                    </p>
                    <p className="font-display font-normal m-0 mt-1" style={{ fontSize: 17, color: "var(--ink)" }}>
                      Your language sets are ready
                    </p>
                    <p className="text-xs m-0 mt-1" style={{ color: "var(--pencil)" }}>
                      {builtSummary} prepared locally. Push them live to WordPress.
                    </p>
                  </div>
                  <button
                    onClick={onGoToWordPress}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white shrink-0"
                    style={{ background: "var(--tone-sage)" }}
                  >
                    Publish to WordPress <Send size={13} />
                  </button>
                </div>
              </div>
            )}
        </div>
      )}
    </SequencePanel>
  );
}
