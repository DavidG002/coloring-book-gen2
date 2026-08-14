"use client";

import { useState, useEffect } from "react";
import TemplateField, { type TemplateToken } from "@/components/TemplateField";
import { getSupportedLanguages, addSupportedLanguage, type SupportedLanguage } from "@/lib/api";
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

const TEMPLATE_TOKENS: TemplateToken[] = [
  { key: "category", label: "Category" },
  { key: "item", label: "Item" },
  { key: "variant", label: "Variant" },
];

export default function TranslationsPanel({
  categoryName,
  bookId,
  subjects,
  variations,
}: {
  categoryName: string;
  bookId: number;
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

  const [autoTranslatingSubjects, setAutoTranslatingSubjects] = useState(false);
  const [autoTranslateResultSubjects, setAutoTranslateResultSubjects] = useState<string | null>(null);
  const [autoTranslatingVariations, setAutoTranslatingVariations] = useState(false);
  const [autoTranslateResultVariations, setAutoTranslateResultVariations] = useState<string | null>(null);
  const [translatingCategoryName, setTranslatingCategoryName] = useState(false);
  const [variationTranslationFilter, setVariationTranslationFilter] = useState("");

  const [hasLanguageDefault, setHasLanguageDefault] = useState(true);
  const [translatingTemplateStructure, setTranslatingTemplateStructure] = useState(false);

  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguage[]>([]);
  const [showAddNewLangForm, setShowAddNewLangForm] = useState(false);
  const [newLangName, setNewLangName] = useState("");
  const [addingLang, setAddingLang] = useState(false);

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

  useEffect(() => {
    getSupportedLanguages()
      .then(setSupportedLanguages)
      .catch(() => {});
  }, []);


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
    setShowAddNewLangForm(false);
    setNewLangName("");
    setForm({ ...BLANK_FORM });
  }

  function collapseLanguage() {
    setSelectedLang(null);
    setIsNewLang(false);
    setForm(BLANK_FORM);
    setError(null);
    setSaved(false);
  }

  async function handleAddNewSupportedLanguage() {
    const code = newLangCode.trim().toLowerCase();
    const name = newLangName.trim();
    if (!code || !name) {
      setError("Both a code and a name are required.");
      return;
    }
    if (languages.includes(code)) {
      setError(`A translation for '${code}' already exists — select it from the list instead.`);
      return;
    }
    setAddingLang(true);
    setError(null);
    try {
      const lang = await addSupportedLanguage(code, name);
      setSupportedLanguages((prev) => [...prev, lang].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ ...BLANK_FORM, lang: code });
      setSelectedLang(code);
      setShowAddNewLangForm(false);
      setNewLangCode("");
      setNewLangName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add language");
    } finally {
      setAddingLang(false);
    }
  }

  async function confirmNewLanguageCode() {
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

    try {
      const savedDefault = await getLanguageTemplateDefault(code);
      if (savedDefault) {
        setHasLanguageDefault(true);
        setForm({
          ...BLANK_FORM,
          lang: code,
          filenameTemplate: savedDefault.filename_template,
          altTemplate: savedDefault.alt_template,
          titleTemplate: savedDefault.title_template,
        });
      } else {
        setHasLanguageDefault(false);
        setForm({ ...BLANK_FORM, lang: code });
      }
    } catch {
      setHasLanguageDefault(false);
      setForm({ ...BLANK_FORM, lang: code });
    }

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
    setAutoTranslateResultVariations(null);
    setAutoTranslatingVariations(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(form.lang)}/translate-variations`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.detail);

      if (data.translated_count > 0) {
        setAutoTranslateResultVariations(`Translated ${data.translated_count} new variation${data.translated_count === 1 ? "" : "s"}`);
        // Reload this translation's data so the newly-translated rows show up immediately
        const refreshed = await getTranslation(categoryName, form.lang);
        setForm(formFromTranslation(refreshed));
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

  async function handleAutoTranslateCategoryName() {
      if (!form.lang) return;
      setError(null);
      setTranslatingCategoryName(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(form.lang)}/translate-category-name`,
          { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new ApiError(res.status, data.detail);
        if (data.translated_text) {
          setForm((f) => ({ ...f, categoryTranslated: data.translated_text }));
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to auto-translate category name");
      } finally {
        setTranslatingCategoryName(false);
      }
  }

  async function handleAutoTranslateSubjects() {
    if (!form.lang || isNewLang) return;
    setError(null);
    setAutoTranslateResultSubjects(null);
    setAutoTranslatingSubjects(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(form.lang)}/translate-subjects`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.detail);

      if (data.translated_count > 0) {
        setAutoTranslateResultSubjects(`Translated ${data.translated_count} new subject${data.translated_count === 1 ? "" : "s"}`);
        const refreshed = await getTranslation(categoryName, form.lang);
        setForm(formFromTranslation(refreshed));
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

  async function getLanguageTemplateDefault(lang: string) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/books/${bookId}/language-templates/${encodeURIComponent(lang)}`
    );
    if (res.status === 404) return null;
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data.detail);
    return data as { filename_template: string; alt_template: string; title_template: string };
  }
  async function autoTranslateLanguageTemplate(lang: string) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/books/${bookId}/language-templates/${encodeURIComponent(lang)}/auto-translate`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data.detail);
    return data as { filename_template: string; alt_template: string; title_template: string };
  }

  async function handleAutoTranslateTemplateStructure() {
    if (!form.lang) return;
    
    setError(null);
    setTranslatingTemplateStructure(true);
    try {
      const result = await autoTranslateLanguageTemplate(form.lang);
      setForm((f) => ({
        ...f,
        filenameTemplate: result.filename_template,
        altTemplate: result.alt_template,
        titleTemplate: result.title_template,
      }));
      setHasLanguageDefault(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to auto-translate template structure");
    } finally {
      setTranslatingTemplateStructure(false);
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
              onClick={() => (selectedLang === lang ? collapseLanguage() : selectLanguage(lang))}
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

     {isNewLang && selectedLang === null && !showAddNewLangForm && (
  <div className="flex gap-2 mb-6 items-end">
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
        Language
      </label>
      <select
        value={newLangCode}
        onChange={(e) => setNewLangCode(e.target.value)}
        className="w-56 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
        style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
      >
        <option value="" disabled>
          Choose a language...
        </option>
        {supportedLanguages
          .filter((l) => !languages.includes(l.code))
          .map((l) => (
            <option key={l.code} value={l.code}>
              {l.name} ({l.code})
            </option>
          ))}
      </select>
    </div>
    <button
      onClick={confirmNewLanguageCode}
      disabled={!newLangCode}
      className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
      style={{ background: "var(--teal)" }}
    >
      Continue
    </button>
    <button
      onClick={() => setShowAddNewLangForm(true)}
      className="px-4 py-2 rounded-md text-sm font-medium"
      style={{ color: "var(--pencil)", border: "1.5px solid var(--pencil-light)" }}
    >
      + New language
    </button>
  </div>
)}

    {isNewLang && selectedLang === null && showAddNewLangForm && (
      <div className="flex gap-2 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Code
          </label>
          <input
            type="text"
            value={newLangCode}
            onChange={(e) => setNewLangCode(e.target.value)}
            placeholder="e.g. nl"
            className="w-28 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Name
          </label>
          <input
            type="text"
            value={newLangName}
            onChange={(e) => setNewLangName(e.target.value)}
            placeholder="e.g. Dutch"
            className="w-40 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
        </div>
        <button
          onClick={handleAddNewSupportedLanguage}
          disabled={addingLang}
          className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--teal)" }}
        >
          {addingLang ? "Adding..." : "Add & continue"}
        </button>
        <button
          onClick={() => setShowAddNewLangForm(false)}
          className="px-4 py-2 rounded-md text-sm font-medium"
          style={{ color: "var(--pencil)" }}
        >
          Cancel
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
                  Translated category name
                </label>
                <button
                  type="button"
                  onClick={handleAutoTranslateCategoryName}
                  disabled={translatingCategoryName || !form.lang}
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
              {isNewLang && !hasLanguageDefault && (
                <div
                  className="rounded-md border-[1.5px] border-dashed p-4"
                  style={{ borderColor: "var(--pencil-light)" }}
                >
                  <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>
                    First time using <span className="uppercase font-medium">{form.lang}</span>? Auto-translate the template
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
              Click a token button to insert it into the field above, or type your own text around it. Filenames never use Variant — it only changes once a URL is already published, so it&apos;s left out to keep links stable.
            </p>

            {isNewLang && (
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
            )}

            {isNewLang ? (
              <div
                className="rounded-md border-[1.5px] border-dashed p-5 text-center"
                style={{ borderColor: "var(--pencil-light)" }}
              >
                <p className="text-sm" style={{ color: "var(--pencil)" }}>
                  Save the language setup above to start translating subjects and variations.
                </p>
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
                  disabled={autoTranslatingSubjects || isNewLang}
                  className="text-xs font-medium disabled:opacity-60"
                  style={{ color: "var(--teal)" }}
                  title={isNewLang ? "Save this language first" : undefined}
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
                {autoTranslateResultVariations && (
                  <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                    {autoTranslateResultVariations}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleAutoTranslateVariations}
                  disabled={autoTranslatingVariations || isNewLang}
                  className="text-xs font-medium disabled:opacity-60"
                  style={{ color: "var(--teal)" }}
                  title={isNewLang ? "Save this language first" : undefined}
                >
                  {autoTranslatingVariations ? "Translating..." : "Auto-translate missing"}
                </button>
              </div>
            </div>
            <p className="text-xs mb-2" style={{ color: "var(--pencil)" }}>
              Optional — enables unique per-image alt text and titles
            </p>
            {variations.length > 8 && (
              <input
                type="text"
                value={variationTranslationFilter}
                onChange={(e) => setVariationTranslationFilter(e.target.value)}
                placeholder={`Filter ${variations.length} variations...`}
                className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm mb-2"
                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
              />
            )}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {variations.map((v) => {
                if (
                  variationTranslationFilter &&
                  !v.text.toLowerCase().includes(variationTranslationFilter.toLowerCase())
                ) {
                  return null;
                }
                return (
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
                );
              })}
              {variations.length === 0 && (
                <p className="text-sm" style={{ color: "var(--pencil)" }}>
                  Add variations to this category first.
                </p>
              )}
              {variations.length > 0 &&
                variationTranslationFilter &&
                variations.every((v) => !v.text.toLowerCase().includes(variationTranslationFilter.toLowerCase())) && (
                  <p className="text-sm" style={{ color: "var(--pencil)" }}>
                    No variations match &quot;{variationTranslationFilter}&quot;.
                  </p>
                )}
            </div>
          </div>
          </>
        )}
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
