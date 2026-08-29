"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import TemplateField, { type TemplateToken } from "@/components/TemplateField";
import {
  getTranslation,
  createTranslation,
  updateTranslation,
  deleteTranslation,
  ApiError,
  type Subject,
  type Variation,
} from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface FormState {
  categoryTranslated: string;
  filenameTemplate: string;
  altTemplate: string;
  titleTemplate: string;
  itemsBySubject: Record<string, string>;
  itemsByVariation: Record<string, string>;
}

const TEMPLATE_TOKENS: TemplateToken[] = [
  { key: "category", label: "Category" },
  { key: "item", label: "Item" },
  { key: "variant", label: "Variant" },
];

async function getLanguageTemplateDefault(bookId: number, lang: string) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/language-templates/${encodeURIComponent(lang)}`);
  if (res.status === 404) return null;
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data as { filename_template: string; alt_template: string; title_template: string };
}

async function autoTranslateLanguageTemplate(bookId: number, lang: string) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/language-templates/${encodeURIComponent(lang)}/auto-translate`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data as { filename_template: string; alt_template: string; title_template: string };
}

export default function TranslationEditorModal({
  categoryName,
  bookId,
  lang,
  subjects,
  variations,
  onClose,
  onSaved,
  onDeleted,
}: {
  categoryName: string;
  bookId: number;
  lang: string;
  subjects: Subject[];
  variations: Variation[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [isNew, setIsNew] = useState(false);
  const [hasLanguageDefault, setHasLanguageDefault] = useState(true);
  const [form, setForm] = useState<FormState>({
    categoryTranslated: "",
    filenameTemplate: "",
    altTemplate: "",
    titleTemplate: "",
    itemsBySubject: {},
    itemsByVariation: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [translatingCategoryName, setTranslatingCategoryName] = useState(false);
  const [translatingTemplateStructure, setTranslatingTemplateStructure] = useState(false);
  const [autoTranslatingSubjects, setAutoTranslatingSubjects] = useState(false);
  const [autoTranslateResultSubjects, setAutoTranslateResultSubjects] = useState<string | null>(null);
  const [autoTranslatingVariations, setAutoTranslatingVariations] = useState(false);
  const [autoTranslateResultVariations, setAutoTranslateResultVariations] = useState<string | null>(null);
  const [variationFilter, setVariationFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const translation = await getTranslation(categoryName, lang);
        if (cancelled) return;
        const itemsBySubject: Record<string, string> = {};
        for (const item of translation.items) itemsBySubject[item.subject_name] = item.translated_text;
        const itemsByVariation: Record<string, string> = {};
        for (const item of translation.variation_items) itemsByVariation[item.variation_text] = item.translated_text;
        setForm({
          categoryTranslated: translation.category_translated,
          filenameTemplate: translation.filename_template,
          altTemplate: translation.alt_template,
          titleTemplate: translation.title_template,
          itemsBySubject,
          itemsByVariation,
        });
        setIsNew(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setIsNew(true);
          try {
            const def = await getLanguageTemplateDefault(bookId, lang);
            if (def) {
              setHasLanguageDefault(true);
              setForm((f) => ({ ...f, filenameTemplate: def.filename_template, altTemplate: def.alt_template, titleTemplate: def.title_template }));
            } else {
              setHasLanguageDefault(false);
            }
          } catch {
            setHasLanguageDefault(false);
          }
        } else {
          setError(err instanceof ApiError ? err.message : "Failed to load translation");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [categoryName, lang, bookId]);

  function updateSubjectItem(subjectName: string, value: string) {
    setForm((f) => ({ ...f, itemsBySubject: { ...f.itemsBySubject, [subjectName]: value } }));
  }
  function updateVariationItem(variationText: string, value: string) {
    setForm((f) => ({ ...f, itemsByVariation: { ...f.itemsByVariation, [variationText]: value } }));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (!form.categoryTranslated.trim() || !form.filenameTemplate.trim() || !form.altTemplate.trim() || !form.titleTemplate.trim()) {
      setError("All four template fields are required.");
      return;
    }
    const items = subjects
      .map((s) => ({ subject_name: s.name, translated_text: (form.itemsBySubject[s.name] ?? "").trim() }))
      .filter((i) => i.translated_text.length > 0);
    const variationItems = variations
      .map((v) => ({ variation_text: v.text, translated_text: (form.itemsByVariation[v.text] ?? "").trim() }))
      .filter((i) => i.translated_text.length > 0);
    setSaving(true);
    try {
      const payload = {
        category_translated: form.categoryTranslated.trim(),
        filename_template: form.filenameTemplate.trim(),
        alt_template: form.altTemplate.trim(),
        title_template: form.titleTemplate.trim(),
        items,
        variation_items: variationItems,
      };
      if (isNew) {
        await createTranslation(categoryName, { lang, ...payload });
        setIsNew(false);
      } else {
        await updateTranslation(categoryName, lang, payload);
      }
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save translation");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Delete the '${lang}' translation for this category?`);
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTranslation(categoryName, lang);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete translation");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAutoTranslateCategoryName() {
    setError(null);
    setTranslatingCategoryName(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(lang)}/translate-category-name`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.detail);
      if (data.translated_text) setForm((f) => ({ ...f, categoryTranslated: data.translated_text }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to auto-translate category name");
    } finally {
      setTranslatingCategoryName(false);
    }
  }

  async function handleAutoTranslateTemplateStructure() {
    setError(null);
    setTranslatingTemplateStructure(true);
    try {
      const result = await autoTranslateLanguageTemplate(bookId, lang);
      setForm((f) => ({ ...f, filenameTemplate: result.filename_template, altTemplate: result.alt_template, titleTemplate: result.title_template }));
      setHasLanguageDefault(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to auto-translate template structure");
    } finally {
      setTranslatingTemplateStructure(false);
    }
  }

  async function handleAutoTranslateSubjects() {
    setError(null);
    setAutoTranslateResultSubjects(null);
    setAutoTranslatingSubjects(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(lang)}/translate-subjects`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.detail);
      if (data.translated_count > 0) {
        setAutoTranslateResultSubjects(`Translated ${data.translated_count} new subject${data.translated_count === 1 ? "" : "s"}`);
        const refreshed = await getTranslation(categoryName, lang);
        const itemsBySubject: Record<string, string> = {};
        for (const item of refreshed.items) itemsBySubject[item.subject_name] = item.translated_text;
        setForm((f) => ({ ...f, itemsBySubject }));
      } else {
        setAutoTranslateResultSubjects("All subjects already translated");
      }
      setTimeout(() => setAutoTranslateResultSubjects(null), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to auto-translate subjects");
    } finally {
      setAutoTranslatingSubjects(false);
    }
  }

  async function handleAutoTranslateVariations() {
    setError(null);
    setAutoTranslateResultVariations(null);
    setAutoTranslatingVariations(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(lang)}/translate-variations`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.detail);
      if (data.translated_count > 0) {
        setAutoTranslateResultVariations(`Translated ${data.translated_count} new variation${data.translated_count === 1 ? "" : "s"}`);
        const refreshed = await getTranslation(categoryName, lang);
        const itemsByVariation: Record<string, string> = {};
        for (const item of refreshed.variation_items) itemsByVariation[item.variation_text] = item.translated_text;
        setForm((f) => ({ ...f, itemsByVariation }));
      } else {
        setAutoTranslateResultVariations("All variations already translated");
      }
      setTimeout(() => setAutoTranslateResultVariations(null), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to auto-translate variations");
    } finally {
      setAutoTranslatingVariations(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(28,27,26,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl overflow-y-auto"
        style={{ width: "min(720px, 100%)", maxHeight: "88vh", background: "var(--canvas)", border: "1px solid var(--pencil-light)", boxShadow: "0 20px 60px rgba(28,27,26,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
          <div>
            <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
              Language
            </p>
            <p className="font-display font-normal m-0 mt-1 uppercase" style={{ fontSize: 20, color: "var(--ink)" }}>
              {lang}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: "1px solid var(--pencil-light)", color: "var(--pencil)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-md text-sm" style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}>
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Loading...
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
                    Translated category name
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoTranslateCategoryName}
                    disabled={translatingCategoryName}
                    className="text-xs font-medium disabled:opacity-60"
                    style={{ color: "var(--teal)" }}
                  >
                    {translatingCategoryName ? "Translating..." : "Auto-translate"}
                  </button>
                </div>
                <input
                  type="text"
                  value={form.categoryTranslated}
                  onChange={(e) => setForm((f) => ({ ...f, categoryTranslated: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                  style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                />
              </div>

              {isNew && !hasLanguageDefault && (
                <div className="rounded-md border-[1.5px] border-dashed p-4" style={{ borderColor: "var(--pencil-light)" }}>
                  <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>
                    First time using <span className="uppercase font-medium">{lang}</span>? Auto-translate the template
                    structure once — it&apos;ll be remembered for every future category in this language.
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoTranslateTemplateStructure}
                    disabled={translatingTemplateStructure}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: "var(--teal)" }}
                  >
                    {translatingTemplateStructure ? "Translating..." : "Auto-translate template structure"}
                  </button>
                </div>
              )}

              <TemplateField
                label="Filename template"
                value={form.filenameTemplate}
                onChange={(v) => setForm((f) => ({ ...f, filenameTemplate: v }))}
                tokens={TEMPLATE_TOKENS.filter((t) => t.key !== "variant")}
                previewValues={{ category: form.categoryTranslated || "Category", item: "Item" }}
                placeholder="e.g. coloring-page-{category}-{item}"
              />
              <TemplateField
                label="Alt text template"
                value={form.altTemplate}
                onChange={(v) => setForm((f) => ({ ...f, altTemplate: v }))}
                tokens={TEMPLATE_TOKENS}
                previewValues={{ category: form.categoryTranslated || "Category", item: "Item", variant: "Variant" }}
                placeholder="e.g. {category} {item} coloring page, free to print"
              />
              <TemplateField
                label="Title template"
                value={form.titleTemplate}
                onChange={(v) => setForm((f) => ({ ...f, titleTemplate: v }))}
                tokens={TEMPLATE_TOKENS}
                previewValues={{ category: form.categoryTranslated || "Category", item: "Item", variant: "Variant" }}
                placeholder="e.g. {category} {item} coloring page"
              />
              <p className="text-xs" style={{ color: "var(--pencil)" }}>
                Click a token button to insert it into the field above, or type your own text around it. Filenames never
                use Variant — it only changes once a URL is already published, so it&apos;s left out to keep links stable.
              </p>

              {isNew ? (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: "var(--teal)" }}
                  >
                    {saving ? "Saving..." : "Save & continue"}
                  </button>
                  {saved && (
                    <span className="text-sm font-medium" style={{ color: "var(--teal)" }}>
                      Saved
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
                        Subject translations
                      </label>
                      <div className="flex items-center gap-3">
                        {autoTranslateResultSubjects && (
                          <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                            {autoTranslateResultSubjects}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleAutoTranslateSubjects}
                          disabled={autoTranslatingSubjects}
                          className="text-xs font-medium disabled:opacity-60"
                          style={{ color: "var(--teal)" }}
                        >
                          {autoTranslatingSubjects ? "Translating..." : "Auto-translate missing"}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {subjects.map((s) => (
                        <div key={s.id} className="flex gap-3 items-center">
                          <span className="w-32 text-sm shrink-0" style={{ color: "var(--pencil)" }}>
                            {s.name}
                          </span>
                          <input
                            type="text"
                            value={form.itemsBySubject[s.name] ?? ""}
                            onChange={(e) => updateSubjectItem(s.name, e.target.value)}
                            placeholder="Not translated yet"
                            className="flex-1 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
                        Variation translations
                      </label>
                      <div className="flex items-center gap-3">
                        {autoTranslateResultVariations && (
                          <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                            {autoTranslateResultVariations}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleAutoTranslateVariations}
                          disabled={autoTranslatingVariations}
                          className="text-xs font-medium disabled:opacity-60"
                          style={{ color: "var(--teal)" }}
                        >
                          {autoTranslatingVariations ? "Translating..." : "Auto-translate missing"}
                        </button>
                      </div>
                    </div>
                    {variations.length > 8 && (
                      <input
                        type="text"
                        value={variationFilter}
                        onChange={(e) => setVariationFilter(e.target.value)}
                        placeholder={`Filter ${variations.length} variations...`}
                        className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm mb-2"
                        style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                      />
                    )}
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {variations
                        .filter((v) => !variationFilter || v.text.toLowerCase().includes(variationFilter.toLowerCase()))
                        .map((v) => (
                          <div key={v.id} className="flex gap-3 items-center">
                            <span className="w-56 text-xs shrink-0" style={{ color: "var(--pencil)" }}>
                              {v.text}
                            </span>
                            <input
                              type="text"
                              value={form.itemsByVariation[v.text] ?? ""}
                              onChange={(e) => updateVariationItem(v.text, e.target.value)}
                              placeholder="Not translated yet"
                              className="flex-1 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: "var(--teal)" }}
                >
                  {saving ? "Saving..." : "Save translation"}
                </button>
                {!isNew && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2.5 rounded-md text-sm font-medium disabled:opacity-60"
                    style={{ color: "var(--coral-dark)", border: "1.5px solid var(--coral)" }}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                )}
                {saved && (
                  <span className="text-sm font-medium" style={{ color: "var(--teal)" }}>
                    Saved
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
