"use client";

import { useState, useEffect } from "react";
import {
  getTranslations,
  getTranslation,
  createTranslation,
  updateTranslation,
  deleteTranslation,
  ApiError,
  type Subject,
  type Variation,
  type Translation,
} from "@/lib/api";

interface FormState {
  lang: string;
  categoryTranslated: string;
  filenameTemplate: string;
  altTemplate: string;
  titleTemplate: string;
  itemsBySubject: Record<string, string>;
  itemsByVariation: Record<string, string>;
}

const BLANK_FORM: FormState = {
  lang: "",
  categoryTranslated: "",
  filenameTemplate: "",
  altTemplate: "",
  titleTemplate: "",
  itemsBySubject: {},
  itemsByVariation: {},
};

export default function TranslationsPanel({
  categoryName,
  subjects,
  variations,
}: {
  categoryName: string;
  subjects: Subject[];
  variations: Variation[];
}) {
  const [languages, setLanguages] = useState<string[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [isNewLang, setIsNewLang] = useState(false);
  const [newLangCode, setNewLangCode] = useState("");

  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [autoTranslating, setAutoTranslating] = useState(false);
  const [autoTranslateResult, setAutoTranslateResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    console.log("TranslationsPanel effect running for", categoryName);
    getTranslations(categoryName)
      .then((data: Translation[]) => {
        if (!cancelled) setLanguages(data.map((t) => t.lang));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load translations");
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryName]);

  function formFromTranslation(t: Translation): FormState {
    const itemsBySubject: Record<string, string> = {};
    for (const item of t.items) {
      itemsBySubject[item.subject_name] = item.translated_text;
    }
    const itemsByVariation: Record<string, string> = {};
    for (const item of t.variation_items) {
      itemsByVariation[item.variation_text] = item.translated_text;
    }
    return {
      lang: t.lang,
      categoryTranslated: t.category_translated,
      filenameTemplate: t.filename_template,
      altTemplate: t.alt_template,
      titleTemplate: t.title_template,
      itemsBySubject,
      itemsByVariation,
    };
  }

  async function selectLanguage(lang: string) {
    setError(null);
    setSaved(false);
    setIsNewLang(false);
    setSelectedLang(lang);
    setLoadingForm(true);
    try {
      const translation = await getTranslation(categoryName, lang);
      setForm(formFromTranslation(translation));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load translation");
    } finally {
      setLoadingForm(false);
    }
  }

  function startNewLanguage() {
    setError(null);
    setSaved(false);
    setIsNewLang(true);
    setSelectedLang(null);
    setNewLangCode("");
    setForm({ ...BLANK_FORM });
  }

  function confirmNewLanguageCode() {
    const code = newLangCode.trim().toLowerCase();
    if (!code) {
      setError("Language code is required, e.g. 'he' or 'es'.");
      return;
    }
    if (languages.includes(code)) {
      setError(`A translation for '${code}' already exists — select it from the list instead.`);
      return;
    }
    setError(null);
    setForm({ ...BLANK_FORM, lang: code });
    setSelectedLang(code);
  }

  function updateSubjectItem(subjectName: string, value: string) {
    setForm((f) => ({ ...f, itemsBySubject: { ...f.itemsBySubject, [subjectName]: value } }));
  }

  function updateVariationItem(variationText: string, value: string) {
    setForm((f) => ({ ...f, itemsByVariation: { ...f.itemsByVariation, [variationText]: value } }));
  }

  async function handleSave() {
    if (!form.lang) return;
    setError(null);
    setSaved(false);

    if (!form.categoryTranslated.trim() || !form.filenameTemplate.trim() || !form.altTemplate.trim() || !form.titleTemplate.trim()) {
      setError("All four template fields are required.");
      return;
    }

    const items = subjects
      .map((s) => ({ subject_name: s.name, translated_text: (form.itemsBySubject[s.name] ?? "").trim() }))
      .filter((item) => item.translated_text.length > 0);

    const variationItems = variations
      .map((v) => ({ variation_text: v.text, translated_text: (form.itemsByVariation[v.text] ?? "").trim() }))
      .filter((item) => item.translated_text.length > 0);

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

      if (isNewLang) {
        await createTranslation(categoryName, { lang: form.lang, ...payload });
        setLanguages((prev) => (prev.includes(form.lang) ? prev : [...prev, form.lang]));
        setIsNewLang(false);
      } else {
        await updateTranslation(categoryName, form.lang, payload);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save translation");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedLang) return;
    const confirmed = window.confirm(`Delete the '${selectedLang}' translation for this category?`);
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteTranslation(categoryName, selectedLang);
      setLanguages((prev) => prev.filter((l) => l !== selectedLang));
      setSelectedLang(null);
      setForm(BLANK_FORM);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete translation");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAutoTranslateVariations() {
    if (!form.lang || isNewLang) return;
    setError(null);
    setAutoTranslateResult(null);
    setAutoTranslating(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(form.lang)}/translate-variations`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.detail);

      if (data.translated_count > 0) {
        setAutoTranslateResult(`Translated ${data.translated_count} new variation${data.translated_count === 1 ? "" : "s"}`);
        // Reload this translation's data so the newly-translated rows show up immediately
        const refreshed = await getTranslation(categoryName, form.lang);
        setForm(formFromTranslation(refreshed));
      } else {
        setAutoTranslateResult("All variations already translated");
      }
      setTimeout(() => setAutoTranslateResult(null), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to auto-translate variations");
    } finally {
      setAutoTranslating(false);
    }
  }

  const showForm = selectedLang !== null || isNewLang;

  return (
    <section
      className="rounded-lg border-[1.5px] p-6"
      style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
    >
      <h2 className="font-display text-xl font-semibold mb-4" style={{ color: "var(--ink)" }}>
        Translations
      </h2>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      {loadingList ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Loading...
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => selectLanguage(lang)}
              className="px-3 py-1.5 rounded-full text-sm border-[1.5px] uppercase"
              style={
                selectedLang === lang
                  ? { background: "var(--teal)", borderColor: "var(--teal)", color: "white" }
                  : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
              }
            >
              {lang}
            </button>
          ))}
          <button
            onClick={startNewLanguage}
            className="px-3 py-1.5 rounded-full text-sm border-[1.5px] border-dashed"
            style={{ borderColor: "var(--pencil-light)", color: "var(--teal)" }}
          >
            + Add language
          </button>
        </div>
      )}

      {isNewLang && selectedLang === null && (
        <div className="flex gap-2 mb-6 items-end">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              New language code
            </label>
            <input
              type="text"
              value={newLangCode}
              onChange={(e) => setNewLangCode(e.target.value)}
              placeholder="e.g. he, es, fr"
              className="w-40 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>
          <button
            onClick={confirmNewLanguageCode}
            className="px-4 py-2 rounded-md text-sm font-medium text-white"
            style={{ background: "var(--teal)" }}
          >
            Continue
          </button>
        </div>
      )}

      {loadingForm && (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          Loading translation...
        </p>
      )}

      {showForm && !loadingForm && form.lang && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                Translated category name
              </label>
              <input
                type="text"
                value={form.categoryTranslated}
                onChange={(e) => setForm((f) => ({ ...f, categoryTranslated: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                Language code
              </label>
              <input
                type="text"
                value={form.lang}
                disabled
                className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm uppercase"
                style={{ borderColor: "var(--pencil-light)", background: "var(--paper)", color: "var(--pencil)" }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Filename template
            </label>
            <input
              type="text"
              value={form.filenameTemplate}
              onChange={(e) => setForm((f) => ({ ...f, filenameTemplate: e.target.value }))}
              placeholder="e.g. coloring-page-{category}-{item}"
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm font-mono"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Alt text template
            </label>
            <input
              type="text"
              value={form.altTemplate}
              onChange={(e) => setForm((f) => ({ ...f, altTemplate: e.target.value }))}
              placeholder="e.g. {category} {item} coloring page, free to print"
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm font-mono"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Title template
            </label>
            <input
              type="text"
              value={form.titleTemplate}
              onChange={(e) => setForm((f) => ({ ...f, titleTemplate: e.target.value }))}
              placeholder="e.g. {category} {item} coloring page"
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm font-mono"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>

          <p className="text-xs" style={{ color: "var(--pencil)" }}>
            Use {"{category}"} and {"{item}"} as placeholders in the templates above — filled in automatically when publishing.
          </p>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--ink)" }}>
              Subject translations
            </label>
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
              {subjects.length === 0 && (
                <p className="text-sm" style={{ color: "var(--pencil)" }}>
                  Add subjects to this category first.
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
                Variation translations
              </label>
              <div className="flex items-center gap-3">
                {autoTranslateResult && (
                  <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                    {autoTranslateResult}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleAutoTranslateVariations}
                  disabled={autoTranslating || isNewLang}
                  className="text-xs font-medium disabled:opacity-60"
                  style={{ color: "var(--teal)" }}
                  title={isNewLang ? "Save this language first" : undefined}
                >
                  {autoTranslating ? "Translating..." : "Auto-translate missing"}
                </button>
              </div>
            </div>
            <p className="text-xs mb-2" style={{ color: "var(--pencil)" }}>
              Optional — enables unique per-image alt text and titles
            </p>

            <div className="space-y-2">
              {variations.map((v) => (
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
              {variations.length === 0 && (
                <p className="text-sm" style={{ color: "var(--pencil)" }}>
                  Add variations to this category first.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--teal)" }}
            >
              {saving ? "Saving..." : "Save translation"}
            </button>
            {!isNewLang && (
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
    </section>
  );
}
