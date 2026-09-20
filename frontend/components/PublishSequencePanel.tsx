"use client";

import { useState, useEffect } from "react";
import { Send, RotateCw, ArrowUp, ArrowDown, X, Minimize2, Maximize2 } from "lucide-react";
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
async function markSeoReviewed(categoryId: number, lang: string): Promise<void> {
  await fetch(`${API_BASE_URL}/categories/${categoryId}/seo/${lang}/mark-reviewed`, { method: "POST" }).catch(() => {});
}
interface SelectedImageInfo {
  id: number;
  subject: string;
  variation_text: string | null;
  filename: string;
}
async function getImagesByIds(ids: number[]): Promise<SelectedImageInfo[]> {
  if (ids.length === 0) return [];
  const res = await fetch(`${API_BASE_URL}/review/images-by-ids?ids=${ids.join(",")}`);
  if (!res.ok) return [];
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject_name: subjectName, variation_text: variationText }),
  });
  return res.json();
}
async function acknowledgeTagSync(categoryId: number, lang: string, subjectName: string, variationText: string): Promise<void> {
  await fetch(`${API_BASE_URL}/categories/${categoryId}/seo/${lang}/content/acknowledge-tag-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject_name: subjectName, variation_text: variationText }),
  });
}

async function regenerateField(categoryId: number, lang: string, subjectName: string, variationText: string, field: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/categories/${categoryId}/seo/${lang}/content/regenerate-field`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject_name: subjectName, variation_text: variationText, field }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data.value as string;
}

async function planPublishForLang(category: string, lang: string, imageIds?: number[]) {
  const res = await fetch(`${API_BASE_URL}/publish/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, lang, only_new: true, image_ids: imageIds !== undefined ? imageIds : null }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data as { total_files: number; skipped_subjects: string[] };
}
async function runPublishForLang(category: string, lang: string, imageIds?: number[]) {
  const res = await fetch(`${API_BASE_URL}/publish/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, lang, only_new: true, image_ids: imageIds !== undefined ? imageIds : null }),
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
  onSeoChanged,
  publishSetImageIds,
  onRemoveFromPublishSet,
  warnedImageIds,
  initialLang,
  initialOnlyNeedsReview,
}: {
  categoryId: number;
  categoryName: string;
  onGoToWordPress: () => void;
  onGoToLanguage: () => void;
  onSeoChanged?: () => void;
  publishSetImageIds?: number[] | null;
  onRemoveFromPublishSet?: (imageId: number) => void;
  warnedImageIds?: number[];
  initialLang?: string;
  initialOnlyNeedsReview?: boolean;
}) {
  const [languages, setLanguages] = useState<string[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);
  const [selectedLang, setSelectedLang] = useState("");

  const [selectedImages, setSelectedImages] = useState<SelectedImageInfo[]>([]);
  const [imagesNewestFirst, setImagesNewestFirst] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!publishSetImageIds || publishSetImageIds.length === 0) {
        setSelectedImages([]);
        return;
      }
      getImagesByIds(publishSetImageIds).then(setSelectedImages).catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [publishSetImageIds]);

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
  const [regeneratingAllFlagged, setRegeneratingAllFlagged] = useState(false);
  const [markingAllReviewed, setMarkingAllReviewed] = useState(false);
  const [missingResult, setMissingResult] = useState<string | null>(null);

  const [langFileCounts, setLangFileCounts] = useState<Record<string, number>>({});
  const [langSkippedSubjects, setLangSkippedSubjects] = useState<Record<string, string[]>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [building, setBuilding] = useState(false);
  const [builtSummary, setBuiltSummary] = useState<string | null>(null);
  const [filesSectionCollapsed, setFilesSectionCollapsed] = useState(false);
  const [showWordPress, setShowWordPress] = useState(false);

  const [regeneratingField, setRegeneratingField] = useState<string | null>(null);
  const [autoSeoBanner, setAutoSeoBanner] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [selectedImagesExpanded, setSelectedImagesExpanded] = useState(false);
  const [confirmingRemoveAll, setConfirmingRemoveAll] = useState(false);
  const [seoFilterSubject, setSeoFilterSubject] = useState<"all" | string>("all");
  const [seoSortView, setSeoSortView] = useState<"all" | "latest" | "oldest">("all");
  const [seoOnlyNeedsReview, setSeoOnlyNeedsReview] = useState(!!initialOnlyNeedsReview);
  const [seoRowsExpanded, setSeoRowsExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getTranslations(categoryId, true)
        .then((data: Translation[]) => {
          if (cancelled) return;
          const langs = data.map((t) => t.lang);
          setLanguages(langs);
          if (langs.length > 0) {
            setSelectedLang(initialLang && langs.includes(initialLang) ? initialLang : langs[0]);
          }
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
          const plan = await planPublishForLang(categoryName, lang, publishSetImageIds ?? undefined);
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
  }, [categoryName, languages, publishSetImageIds]);

  async function handleBuildLanguageSets() {
  setBuilding(true);
  setError(null);
  let totalPublished = 0;
  try {
    for (const lang of languages) {
      if ((langFileCounts[lang] ?? 0) === 0) continue;
      const result = await runPublishForLang(categoryName, lang, publishSetImageIds ?? undefined);
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
          const pendingCount = data.content_variants?.filter((v) => v.pending_review).length ?? 0;
          if (pendingCount > 0) {
            setAutoSeoBanner(`${pendingCount} item${pendingCount === 1 ? "" : "s"} auto-generated with SEO content — review anytime`);
            setTimeout(() => setAutoSeoBanner(null), 4500);
            markSeoReviewed(categoryId, selectedLang).then(() => onSeoChanged?.());
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const [acknowledgingRow, setAcknowledgingRow] = useState<string | null>(null);

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
      onSeoChanged?.();
    } catch {
      setError("Failed to save");
    } finally {
      setSavingRow(null);
    }
  }

  async function handleAcknowledgeTagSync(row: ContentVariantRow) {
    const key = `${row.subject_name}::${row.variation_text}`;
    setAcknowledgingRow(key);
    try {
      await acknowledgeTagSync(categoryId, selectedLang, row.subject_name, row.variation_text);
      setSeoData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          content_variants: prev.content_variants.map((r) =>
            r.subject_name === row.subject_name && r.variation_text === row.variation_text ? { ...r, needs_tag_sync: false } : r
          ),
        };
      });
      onSeoChanged?.();
    } catch {
      setError("Failed to mark reviewed");
    } finally {
      setAcknowledgingRow(null);
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
      onSeoChanged?.();
    } catch {
      setError("Failed to regenerate");
    } finally {
      setRegeneratingRow(null);
    }
  }

  async function handleRegenerateField(row: ContentVariantRow, field: keyof ContentVariantRow) {
    const key = `${row.subject_name}::${row.variation_text}::${field}`;
    setRegeneratingField(key);
    try {
      const newValue = await regenerateField(categoryId, selectedLang, row.subject_name, row.variation_text, field);
      updateRow(row.subject_name, row.variation_text, field, newValue);
      // The field is now saved on the backend already — clear its dirty flag
      // so the row doesn't show "Unsaved" for a change that's actually persisted.
      const rowKey = `${row.subject_name}::${row.variation_text}`;
      setDirtyRows((prev) => {
        const next = new Set(prev);
        next.delete(rowKey);
        return next;
      });
    } catch {
      setError(`Failed to regenerate ${field}`);
    } finally {
      setRegeneratingField(null);
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
      if (count > 0) onSeoChanged?.();
    } catch {
      setError("Failed to generate missing content");
    } finally {
      setGeneratingMissing(false);
    }
  }

  async function handleRegenerateAllFlagged() {
    const targets = filteredVariants.filter((r) => r.needs_tag_sync || r.pending_review);
    if (targets.length === 0) return;
    setRegeneratingAllFlagged(true);
    try {
      for (const row of targets) {
        const result = await regenerateOne(categoryId, selectedLang, row.subject_name, row.variation_text);
        setSeoData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            content_variants: prev.content_variants.map((r) =>
              r.subject_name === row.subject_name && r.variation_text === row.variation_text
                ? { ...r, ...result, generated: true, needs_tag_sync: false }
                : r
            ),
          };
        });
      }
      onSeoChanged?.();
    } catch {
      setError("Failed to regenerate all flagged items");
    } finally {
      setRegeneratingAllFlagged(false);
    }
  }

  async function handleMarkAllReviewed() {
    const targets = filteredVariants.filter((r) => r.needs_tag_sync);
    if (targets.length === 0) return;
    setMarkingAllReviewed(true);
    try {
      for (const row of targets) {
        await acknowledgeTagSync(categoryId, selectedLang, row.subject_name, row.variation_text);
      }
      const targetKeys = new Set(targets.map((r) => `${r.subject_name}::${r.variation_text}`));
      setSeoData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          content_variants: prev.content_variants.map((r) =>
            targetKeys.has(`${r.subject_name}::${r.variation_text}`) ? { ...r, needs_tag_sync: false } : r
          ),
        };
      });
      onSeoChanged?.();
    } catch {
      setError("Failed to mark all reviewed");
    } finally {
      setMarkingAllReviewed(false);
    }
  }

  const descriptionDirty = description !== savedDescriptionSnapshot;
  const seoSubjects = Array.from(new Set((seoData?.content_variants ?? []).map((r) => r.subject_name))).sort();
  const filteredVariants = (() => {
    let rows = seoData?.content_variants ?? [];
    if (seoFilterSubject !== "all") {
      rows = rows.filter((r) => r.subject_name === seoFilterSubject);
    }
    if (seoOnlyNeedsReview) {
      const warnedPairings = new Set(
        selectedImages
          .filter((img) => warnedImageIds?.includes(img.id))
          .map((img) => `${img.subject}::${img.variation_text}`)
      );
      rows = rows.filter((r) => r.pending_review || r.needs_tag_sync || warnedPairings.has(`${r.subject_name}::${r.variation_text}`));
    }
    if (seoSortView === "latest") {
      rows = [...rows].sort((a, b) => b.sample_image_id - a.sample_image_id);
    } else if (seoSortView === "oldest") {
      rows = [...rows].sort((a, b) => a.sample_image_id - b.sample_image_id);
    }
    return rows;
  })();

  return (
    <SequencePanel
      eyebrow="03 / PUBLISH"
      title="Tag and publish your pages"
      icon={<Send size={25} />}
    >
      <div className="px-6 pt-1 pb-2" />

      {languages.length > 0 && (
        <div className="mx-6 mb-6">
          {!filesSectionCollapsed ? (
            <div className="rounded-lg" style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
              <div className="p-4">
                <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                  Prepare your files
                </p>
                <p className="font-display font-normal m-0 mt-1" style={{ fontSize: 17, color: "var(--ink)" }}>
                  Build language sets
                </p>
                <p className="text-xs m-0 mt-1" style={{ color: "var(--pencil)" }}>
                  Write SEO titles and alt text for each generated image, then build your local files and push to WordPress.
                </p>
              </div>

              {selectedImages.length > 0 && (
                <div className="mx-4 mb-4 rounded-lg" style={{ padding: "15px 17px 10px", border: "1px solid var(--tone-lavender)", background: "var(--tone-lavender-bg)" }}>
                  <div className="flex items-center justify-between mb-3.5">
                    <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--tone-lavender)", letterSpacing: "0.1em" }}>
                            Selected for publishing ({selectedImages.length})
                    </p>
                    <div className="flex items-center gap-2">
                      {confirmingRemoveAll ? (
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 9, color: "var(--coral-dark)" }}>Remove all?</span>
                          <button
                            onClick={() => {
                              const idsToRemove = selectedImages.map((img) => img.id);
                              setSelectedImages([]);
                              idsToRemove.forEach((id) => onRemoveFromPublishSet?.(id));
                              setConfirmingRemoveAll(false);
                            }}
                            className="font-bold"
                            style={{ fontSize: 9, color: "var(--coral)" }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmingRemoveAll(false)}
                            style={{ fontSize: 9, color: "var(--pencil)" }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingRemoveAll(true)}
                          className="text-[9px] font-bold"
                          style={{ color: "var(--coral-dark)" }}
                        >
                          Remove all
                        </button>
                      )}
                      <button
                        onClick={() => setImagesNewestFirst((v) => !v)}
                        className="w-5 h-5 flex items-center justify-center rounded"
                        style={{ color: "var(--tone-lavender)" }}
                        title={imagesNewestFirst ? "Newest on top" : "Oldest on top"}
                      >
                        {imagesNewestFirst ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 overflow-y-auto pr-1" style={{ height: selectedImagesExpanded ? 280 : 140, transition: "height 0.2s ease" }}>
                    {(imagesNewestFirst ? [...selectedImages].reverse() : selectedImages).map((img, i) => {
                      const isWarned = warnedImageIds?.includes(img.id) ?? false;
                      return (
                      <div key={img.id} className="rounded overflow-hidden shrink-0" style={{ border: isWarned ? "1px solid #c99a4a" : "none" }}>
                      <div
                        className="flex items-center gap-2.5 rounded"
                        style={{
                          padding: "6px 10px",
                          background: isWarned ? "#fdf3e2" : "var(--canvas)",
                          color: isWarned ? "#9c6f1f" : "var(--tone-lavender)",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 10,
                        }}
                      >
                        <b style={{ minWidth: 18, color: "var(--pencil)", fontSize: 9, fontWeight: 500 }}>
                          {String(i + 1).padStart(2, "0")}
                        </b>
                        <span className="truncate flex-1">
                          {(() => {
                            const variant = seoData?.content_variants?.find(
                              (r) => r.subject_name === img.subject && r.variation_text === img.variation_text
                            );
                            return variant?.seo_title || `${img.subject}${img.variation_text ? ` — ${img.variation_text}` : ""}`;
                          })()}
                        </span>
                        {removingId === img.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <span style={{ color: "var(--coral-dark)", fontFamily: "inherit", fontSize: 9 }}>Remove?</span>
                            <button
                              onClick={() => {
                                setSelectedImages((prev) => prev.filter((i2) => i2.id !== img.id));
                                onRemoveFromPublishSet?.(img.id);
                                setRemovingId(null);
                              }}
                              className="font-bold"
                              style={{ color: "var(--coral)", fontFamily: "inherit", fontSize: 9 }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setRemovingId(null)}
                              style={{ color: "var(--pencil)", fontFamily: "inherit", fontSize: 9 }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setRemovingId(img.id)} className="shrink-0" style={{ color: isWarned ? "#9c6f1f" : "var(--tone-lavender)" }}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      {isWarned && (
                        <div className="flex items-center justify-between gap-2" style={{ padding: "5px 10px 5px 28px", background: "#fdf3e2", borderTop: "1px solid #eddcb8" }}>
                          <span style={{ fontSize: 9, color: "#9c6f1f" }}>Update SEO for this image?</span>
                          <button
                            title="Regenerate just this field"
                            className="disabled:opacity-40"
                            style={{ color: "#9c6f1f" }}
                          >
                            <RotateCw size={11} />
                          </button>
                        </div>
                      )}
                      </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end mt-5">
                    <button
                      onClick={() => setSelectedImagesExpanded((v) => !v)}
                      className="w-5 h-5 flex items-center justify-center rounded"
                      style={{ color: "var(--tone-lavender)" }}
                      title={selectedImagesExpanded ? "Collapse" : "Expand"}
                    >
                      {selectedImagesExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    </button>
                  </div>
                </div>
              )}

              {languages.length > 0 && (
                <div className="mx-4 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {languages.map((lang) => {
                      const count = langFileCounts[lang] ?? 0;
                      const skipped = langSkippedSubjects[lang] ?? [];
                      const total = selectedImages.length;
                      const ready = skipped.length === 0;
                      return (
                        <button
                          key={lang}
                          onClick={() => setSelectedLang(lang)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold"
                          style={{
                            ...(ready
                              ? { background: "var(--tone-sage-bg)", color: "var(--tone-sage)" }
                              : { background: "#fdf3e2", color: "#9c6f1f" }),
                            outline: selectedLang === lang ? "2px solid var(--ink)" : "none",
                            outlineOffset: 1,
                          }}
                        >
                          <span className="uppercase">{lang}</span>
                          <span>{loadingCounts ? "..." : `${count} of ${total} ready`}</span>
                          {skipped.length > 0 && (
                            <span onClick={(e) => { e.stopPropagation(); onGoToLanguage(); }} className="underline font-bold ml-1">
                              Fix
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                className="flex items-center justify-between gap-4 px-4 py-3"
                style={{ borderTop: "1px solid var(--pencil-light)" }}
              >
                <span className="text-[10px]" style={{ color: "var(--pencil)" }}>
                  {Object.values(langFileCounts).every((c) => c === 0) ? (
                    "Everything is already built."
                  ) : (
                    <>
                      <strong style={{ color: "var(--ink)" }}>
                        {loadingCounts ? "..." : Object.values(langFileCounts).reduce((sum, c) => sum + c, 0)}
                      </strong>{" "}
                      file{Object.values(langFileCounts).reduce((sum, c) => sum + c, 0) === 1 ? "" : "s"} total ready to build across{" "}
                      {languages.length} language{languages.length === 1 ? "" : "s"}
                    </>
                  )}
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

      <div className="px-6 pt-1 pb-2">
      </div>

      {autoSeoBanner && (
        <div className="mx-6 mb-4 px-4 py-3 rounded-md text-xs" style={{ background: "var(--tone-blue-bg)", color: "var(--tone-blue)", border: "1px solid var(--tone-blue)" }}>
          {autoSeoBanner}
        </div>
      )}
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
            <label className="block text-xs font-medium mb-3" style={{ color: "var(--ink)" }}>
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
                spellCheck={true}
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
                  {filteredVariants.some((r) => r.needs_tag_sync || r.pending_review) && (
                    <button
                      onClick={handleRegenerateAllFlagged}
                      disabled={regeneratingAllFlagged}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold disabled:opacity-60"
                      style={{ border: "1px solid #9c6f1f", color: "#9c6f1f" }}
                    >
                      {regeneratingAllFlagged ? "Regenerating..." : "Regenerate all flagged"}
                    </button>
                  )}
                  {filteredVariants.some((r) => r.needs_tag_sync) && (
                    <button
                      onClick={handleMarkAllReviewed}
                      disabled={markingAllReviewed}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold disabled:opacity-60"
                      style={{ border: "1px solid #9c6f1f", color: "#9c6f1f" }}
                    >
                      {markingAllReviewed ? "Marking..." : "Mark all reviewed"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-2">
                <select
                  value={seoFilterSubject}
                  onChange={(e) => setSeoFilterSubject(e.target.value)}
                  className="px-2 py-2 rounded-md text-[10px] font-bold outline-none capitalize"
                  style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
                >
                  <option value="all">All subjects</option>
                  {seoSubjects.map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={seoSortView}
                  onChange={(e) => setSeoSortView(e.target.value as typeof seoSortView)}
                  className="px-2 py-2 rounded-md text-[10px] font-bold outline-none"
                  style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)", background: "var(--canvas)" }}
                >
                  <option value="all">All</option>
                  <option value="latest">Latest</option>
                  <option value="oldest">Oldest</option>
                </select>
                <button
                  onClick={() => setSeoOnlyNeedsReview((v) => !v)}
                  className="px-2.5 py-2 rounded-md text-[10px] font-bold"
                  style={
                    seoOnlyNeedsReview
                      ? { background: "var(--tone-blue)", color: "white" }
                      : { border: "1px solid var(--tone-blue)", color: "var(--tone-blue)" }
                  }
                >
                  Needs SEO review
                </button>
              </div>

              {seoData.content_variants.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--pencil)" }}>
                  No generated images for this category yet — go back to Generate first.
                </p>
              ) : (
                <div className="space-y-1.5 overflow-y-auto pr-1" style={{ height: seoRowsExpanded ? 680 : 340, transition: "height 0.2s ease" }}>
                  {filteredVariants.map((row) => {
                    const key = `${row.subject_name}::${row.variation_text}`;
                    const isExpanded = expandedRow === key;
                    const isDirty = dirtyRows.has(key);
                    return (
                      <div
                        key={key}
                        className="rounded-lg overflow-hidden"
                        style={{
                          border: `1.5px solid ${
                            !row.generated ? "var(--coral)" : row.needs_tag_sync ? "#9c6f1f" : row.pending_review ? "var(--tone-blue)" : "var(--pencil-light)"
                          }`,
                        }}
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
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] font-medium" style={{ color: "var(--pencil)" }}>
                                  Title
                                </label>
                                <button
                                  onClick={() => handleRegenerateField(row, "seo_title")}
                                  disabled={regeneratingField === `${row.subject_name}::${row.variation_text}::seo_title`}
                                  title="Regenerate just this field"
                                  className="disabled:opacity-40"
                                  style={{ color: "var(--teal)" }}
                                >
                                  <RotateCw size={11} className={regeneratingField === `${row.subject_name}::${row.variation_text}::seo_title` ? "animate-spin" : ""} />
                                </button>
                              </div>
                              <input
                                type="text"
                spellCheck={true}
                                value={row.seo_title}
                                onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_title", e.target.value)}
                                className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] font-medium" style={{ color: "var(--pencil)" }}>
                                  Alt text
                                </label>
                                <button
                                  onClick={() => handleRegenerateField(row, "seo_alt_text")}
                                  disabled={regeneratingField === `${row.subject_name}::${row.variation_text}::seo_alt_text`}
                                  title="Regenerate just this field"
                                  className="disabled:opacity-40"
                                  style={{ color: "var(--teal)" }}
                                >
                                  <RotateCw size={11} className={regeneratingField === `${row.subject_name}::${row.variation_text}::seo_alt_text` ? "animate-spin" : ""} />
                                </button>
                              </div>
                              <input
                                type="text"
                spellCheck={true}
                                value={row.seo_alt_text}
                                onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_alt_text", e.target.value)}
                                className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] font-medium" style={{ color: "var(--pencil)" }}>
                                  Excerpt
                                </label>
                                <button
                                  onClick={() => handleRegenerateField(row, "seo_excerpt")}
                                  disabled={regeneratingField === `${row.subject_name}::${row.variation_text}::seo_excerpt`}
                                  title="Regenerate just this field"
                                  className="disabled:opacity-40"
                                  style={{ color: "var(--teal)" }}
                                >
                                  <RotateCw size={11} className={regeneratingField === `${row.subject_name}::${row.variation_text}::seo_excerpt` ? "animate-spin" : ""} />
                                </button>
                              </div>
                              <input
                                type="text"
                spellCheck={true}
                                value={row.seo_excerpt}
                                onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_excerpt", e.target.value)}
                                className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] font-medium" style={{ color: "var(--pencil)" }}>
                                  Content
                                </label>
                                <button
                                  onClick={() => handleRegenerateField(row, "seo_content")}
                                  disabled={regeneratingField === `${row.subject_name}::${row.variation_text}::seo_content`}
                                  title="Regenerate just this field"
                                  className="disabled:opacity-40"
                                  style={{ color: "var(--teal)" }}
                                >
                                  <RotateCw size={11} className={regeneratingField === `${row.subject_name}::${row.variation_text}::seo_content` ? "animate-spin" : ""} />
                                </button>
                              </div>
                              <textarea
                spellCheck={true}
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
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[10px] font-medium" style={{ color: "var(--pencil)" }}>
                                      Focus keyphrase
                                    </label>
                                    <button
                                      onClick={() => handleRegenerateField(row, "focus_keyphrase")}
                                      disabled={regeneratingField === `${row.subject_name}::${row.variation_text}::focus_keyphrase`}
                                      title="Regenerate just this field"
                                      className="disabled:opacity-40"
                                      style={{ color: "var(--teal)" }}
                                    >
                                      <RotateCw size={11} className={regeneratingField === `${row.subject_name}::${row.variation_text}::focus_keyphrase` ? "animate-spin" : ""} />
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                spellCheck={true}
                                    value={row.focus_keyphrase}
                                    onChange={(e) => updateRow(row.subject_name, row.variation_text, "focus_keyphrase", e.target.value)}
                                    placeholder="e.g. truck coloring page"
                                    className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-[11px]"
                                    style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[10px] font-medium" style={{ color: "var(--pencil)" }}>
                                      SEO title <span className="font-normal">({row.yoast_title.length}/60)</span>
                                    </label>
                                    <button
                                      onClick={() => handleRegenerateField(row, "yoast_title")}
                                      disabled={regeneratingField === `${row.subject_name}::${row.variation_text}::yoast_title`}
                                      title="Regenerate just this field"
                                      className="disabled:opacity-40"
                                      style={{ color: "var(--teal)" }}
                                    >
                                      <RotateCw size={11} className={regeneratingField === `${row.subject_name}::${row.variation_text}::yoast_title` ? "animate-spin" : ""} />
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                spellCheck={true}
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
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[10px] font-medium" style={{ color: "var(--pencil)" }}>
                                      Meta description <span className="font-normal">({row.yoast_meta_description.length}/155)</span>
                                    </label>
                                    <button
                                      onClick={() => handleRegenerateField(row, "yoast_meta_description")}
                                      disabled={regeneratingField === `${row.subject_name}::${row.variation_text}::yoast_meta_description`}
                                      title="Regenerate just this field"
                                      className="disabled:opacity-40"
                                      style={{ color: "var(--teal)" }}
                                    >
                                      <RotateCw size={11} className={regeneratingField === `${row.subject_name}::${row.variation_text}::yoast_meta_description` ? "animate-spin" : ""} />
                                    </button>
                                  </div>
                                  <textarea
                spellCheck={true}
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
                              {row.needs_tag_sync && (
                                <button
                                  onClick={() => handleAcknowledgeTagSync(row)}
                                  disabled={acknowledgingRow === key}
                                  className="px-3 py-1.5 rounded-md text-[10px] font-bold disabled:opacity-60"
                                  style={{ color: "#9c6f1f", border: "1px solid #9c6f1f" }}
                                >
                                  {acknowledgingRow === key ? "Marking..." : "Mark reviewed"}
                                </button>
                              )}
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
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => setSeoRowsExpanded((v) => !v)}
                  className="w-5 h-5 flex items-center justify-center rounded"
                  style={{ color: "var(--pencil)" }}
                  title={seoRowsExpanded ? "Collapse" : "Expand"}
                >
                  {seoRowsExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Select a language above to view its SEO content.
            </p>
          )}
        </div>
      )}


    </SequencePanel>
  );
}
