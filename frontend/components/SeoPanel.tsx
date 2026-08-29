"use client";

import { useState, useEffect } from "react";
import { getTranslations, ApiError, type Translation } from "@/lib/api";
import LanguagePills from "@/components/LanguagePills";
import type { components } from "@/lib/api/generated-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ContentVariantRow = components["schemas"]["SeoContentVariantRow"];
type SeoData = components["schemas"]["SeoDataResponse"];

async function getSeoData(categoryName: string, lang: string): Promise<SeoData> {
  const res = await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/seo/${lang}`);
  if (!res.ok) {
    const data = await res.json();
    throw new ApiError(res.status, data.detail);
  }
  return res.json();
}

async function saveDescription(categoryName: string, lang: string, description: string): Promise<void> {
  await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/seo/${lang}/description`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
}

async function regenerateDescription(categoryName: string, lang: string): Promise<string> {
  const res = await fetch(
    `${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/seo/${lang}/description/regenerate`,
    { method: "POST" }
  );
  const data = await res.json();
  return data.description;
}

async function saveContentVariant(categoryName: string, lang: string, row: ContentVariantRow): Promise<void> {
  await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/seo/${lang}/content`, {
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

async function generateMissing(categoryName: string, lang: string): Promise<number> {
  const res = await fetch(
    `${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/seo/${lang}/content/generate-missing`,
    { method: "POST" }
  );
  const data = await res.json();
  return data.generated_count;
}

async function regenerateOne(
  categoryName: string,
  lang: string,
  subjectName: string,
  variationText: string
): Promise<Partial<ContentVariantRow>> {
  const res = await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/seo/${lang}/content/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject_name: subjectName, variation_text: variationText }),
  });
  return res.json();
}

export default function SeoPanel({ categoryName }: { categoryName: string }) {
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
    if (!selectedLang) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeoData(null);
      return;
    }
    let cancelled = false;
    setLoadingSeo(true);
    setError(null);
    getSeoData(categoryName, selectedLang)
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
    return () => {
      cancelled = true;
    };
  }, [categoryName, selectedLang]);

  async function handleSaveDescription() {
    setSavingDescription(true);
    try {
      await saveDescription(categoryName, selectedLang, description);
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
      const newDescription = await regenerateDescription(categoryName, selectedLang);
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
      await saveContentVariant(categoryName, selectedLang, row);
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
      const result = await regenerateOne(categoryName, selectedLang, row.subject_name, row.variation_text);
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
            r.subject_name === row.subject_name && r.variation_text === row.variation_text
              ? { ...r, ...result, generated: true }
              : r
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
      const count = await generateMissing(categoryName, selectedLang);
      setMissingResult(count > 0 ? `Generated ${count} new` : "Nothing missing");
      const refreshed = await getSeoData(categoryName, selectedLang);
      setSeoData(refreshed);
      setTimeout(() => setMissingResult(null), 4000);
    } catch {
      setError("Failed to generate missing content");
    } finally {
      setGeneratingMissing(false);
    }
  }

  if (loadingLangs) {
    return (
      <section className="rounded-lg border-[1.5px] p-6" style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}>
        <p className="text-sm" style={{ color: "var(--pencil)" }}>Loading...</p>
      </section>
    );
  }

  if (languages.length === 0) {
    return (
      <section className="rounded-lg border-[1.5px] p-6" style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}>
        <h2 className="font-display text-xl font-semibold mb-2" style={{ color: "var(--ink)" }}>SEO</h2>
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Add a translation for this category first — SEO content is generated per language.
        </p>
      </section>
    );
  }

  const descriptionDirty = description !== savedDescriptionSnapshot;
  const filteredVariants = seoData?.content_variants.filter(
    (r) =>
      !filter ||
      r.subject_name.toLowerCase().includes(filter.toLowerCase()) ||
      r.variation_text.toLowerCase().includes(filter.toLowerCase())
  ) ?? [];

  return (
    <section className="rounded-lg border-[1.5px] p-6" style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}>
      <h2 className="font-display text-xl font-semibold mb-4" style={{ color: "var(--ink)" }}>SEO</h2>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md text-sm" style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}>
          {error}
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>Language</label>
          <LanguagePills languages={languages} selected={selectedLang} onSelect={setSelectedLang} />
      </div>

      {loadingSeo ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>Loading...</p>
      ) : seoData ? (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>Category description</label>
              <button
                onClick={handleRegenerateDescription}
                disabled={regeneratingDescription}
                className="px-3 py-1 rounded-full text-xs font-medium border-[1.5px] disabled:opacity-60"
                style={{ borderColor: "var(--teal)", color: "var(--teal)" }}
              >
                {regeneratingDescription ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
            <p className="mt-1.5 text-xs mb-2" style={{ color: "var(--pencil)" }}>
              Used as the WordPress taxonomy term&apos;s description.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDescription}
                disabled={savingDescription}
                className="px-5 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--teal)" }}
              >
                {savingDescription ? "Saving..." : "Save description"}
              </button>
              {descriptionDirty && (
                <span className="text-xs font-medium" style={{ color: "var(--coral-dark)" }}>
                  Unsaved changes
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
              Per-image content ({seoData.content_variants.filter((r) => r.generated).length} of {seoData.content_variants.length} generated)
            </label>
            <div className="flex items-center gap-3">
              {missingResult && <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>{missingResult}</span>}
              <button
                onClick={handleGenerateMissing}
                disabled={generatingMissing}
                className="px-3 py-1 rounded-full text-xs font-medium border-[1.5px] disabled:opacity-60"
                style={{ borderColor: "var(--teal)", color: "var(--teal)" }}
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
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm mb-2"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
          )}

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredVariants.map((row) => {
              const key = `${row.subject_name}::${row.variation_text}`;
              const isExpanded = expandedRow === key;
              const isDirty = dirtyRows.has(key);
              return (
                <div key={key} className="rounded-md border-[1.5px] overflow-hidden" style={{ borderColor: row.generated ? "var(--pencil-light)" : "var(--coral)" }}>
                  <button
                    onClick={() => setExpandedRow(isExpanded ? null : key)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <img
                        src={imageFileUrl(row.sample_image_id)}
                        alt={`${row.subject_name} — ${row.variation_text}`}
                        className="w-9 h-9 rounded object-cover shrink-0"
                        style={{ background: "var(--tone-sage-bg)" }}
                      />
                      <span className="font-medium truncate capitalize" style={{ color: "var(--ink)" }}>
                        {row.subject_name} — {row.variation_text}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {isDirty && (
                        <span className="font-medium" style={{ color: "var(--coral-dark)" }}>Unsaved</span>
                      )}
                      <span style={{ color: row.generated ? "var(--teal)" : "var(--coral-dark)" }}>
                        {row.generated ? "Generated" : "Not generated"}
                      </span>
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
                      <div className="pt-2">
                        <label className="block text-xs font-medium mb-1" style={{ color: "var(--pencil)" }}>Title</label>
                        <input
                          type="text"
                          value={row.seo_title}
                          onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_title", e.target.value)}
                          className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-xs"
                          style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "var(--pencil)" }}>Alt text</label>
                        <input
                          type="text"
                          value={row.seo_alt_text}
                          onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_alt_text", e.target.value)}
                          className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-xs"
                          style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "var(--pencil)" }}>Excerpt</label>
                        <input
                          type="text"
                          value={row.seo_excerpt}
                          onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_excerpt", e.target.value)}
                          className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-xs"
                          style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "var(--pencil)" }}>Content</label>
                        <textarea
                          value={row.seo_content}
                          onChange={(e) => updateRow(row.subject_name, row.variation_text, "seo_content", e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1.5 rounded border-[1.5px] outline-none text-xs"
                          style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                        />
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => handleSaveRow(row)}
                          disabled={savingRow === key}
                          className="px-3 py-1.5 rounded text-xs font-medium text-white disabled:opacity-60"
                          style={{ background: "var(--teal)" }}
                        >
                          {savingRow === key ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => handleRegenerateRow(row)}
                          disabled={regeneratingRow === key}
                          className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-60"
                          style={{ color: "var(--pencil)", border: "1.5px solid var(--pencil-light)" }}
                        >
                          {regeneratingRow === key ? "Regenerating..." : "Regenerate"}
                        </button>
                        {isDirty && (
                          <span className="text-xs font-medium" style={{ color: "var(--coral-dark)" }}>
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
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Select a language above to view its SEO content.
        </p>
      )}
    </section>
  );
}
