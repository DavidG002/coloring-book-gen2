"use client";

import { useState, useEffect } from "react";
import { WandSparkles, RotateCw, Check, X, Plus, ChevronRight } from "lucide-react";
import SequencePanel from "./SequencePanel";
import TranslationEditorModal from "./TranslationEditorModal";
import {
  getSupportedLanguages,
  addSupportedLanguage,
  getTranslations,
  getTranslation,
  createTranslation,
  updateTranslation,
  ApiError,
  type SupportedLanguage,
  type Subject,
  type Variation,
  type Translation,
} from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
async function translateCategoryName(categoryName: string, lang: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(lang)}/translate-category-name`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data.translated_text as string;
}
async function translateSubjects(categoryName: string, lang: string) {
  const res = await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(lang)}/translate-subjects`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data.translated_count as number;
}
async function translateVariations(categoryName: string, lang: string) {
  const res = await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}/translations/${encodeURIComponent(lang)}/translate-variations`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data.translated_count as number;
}

type Completeness = "none" | "partial" | "ready";

function computeCompleteness(t: Translation | undefined, subjects: Subject[]): Completeness {
  if (!t) return "none";
  if (!t.category_translated?.trim()) return "partial";
  const translatedSubjects = new Set(t.items.filter((i) => i.translated_text.trim()).map((i) => i.subject_name));
  const allSubjectsDone = subjects.length > 0 && subjects.every((s) => translatedSubjects.has(s.name));
  return allSubjectsDone ? "ready" : "partial";
}

export default function LanguageSequencePanel({
  categoryName,
  bookId,
  subjects,
  variations,
  onContinue,
}: {
  categoryName: string;
  bookId: number;
  subjects: Subject[];
  variations: Variation[];
  onContinue: () => void;
}) {
  const [supported, setSupported] = useState<SupportedLanguage[]>([]);
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyLang, setBusyLang] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [modalLang, setModalLang] = useState<string | null>(null);
  const [hiddenLangs, setHiddenLangs] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [addingLang, setAddingLang] = useState(false);

  const hiddenKey = `hidden-langs-${categoryName}`;

  function load() {
    setLoading(true);
    Promise.all([getSupportedLanguages(), getTranslations(categoryName)])
      .then(([langs, list]) => {
        setSupported(langs);
        const byLang: Record<string, Translation> = {};
        for (const t of list) byLang[t.lang] = t;
        setTranslations(byLang);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load languages"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
      if (typeof window !== "undefined") {
        const saved = window.localStorage.getItem(hiddenKey);
        if (saved) {
          try {
            setHiddenLangs(new Set(JSON.parse(saved)));
          } catch {
            // ignore malformed storage
          }
        }
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryName]);

  function persistHidden(next: Set<string>) {
    setHiddenLangs(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(hiddenKey, JSON.stringify(Array.from(next)));
    }
  }

  function hideLang(code: string) {
    persistHidden(new Set(hiddenLangs).add(code));
  }
  function unhideLang(code: string) {
    const next = new Set(hiddenLangs);
    next.delete(code);
    persistHidden(next);
  }

  async function generateLanguage(lang: string) {
    setBusyLang(lang);
    setError(null);
    try {
      const exists = !!translations[lang];
      if (!exists) {
        let templates = await getLanguageTemplateDefault(bookId, lang);
        if (!templates) templates = await autoTranslateLanguageTemplate(bookId, lang);
        const categoryTranslated = await translateCategoryName(categoryName, lang);
        await createTranslation(categoryName, {
          lang,
          category_translated: categoryTranslated,
          filename_template: templates.filename_template,
          alt_template: templates.alt_template,
          title_template: templates.title_template,
          items: [],
          variation_items: [],
        });
      } else {
        const categoryTranslated = await translateCategoryName(categoryName, lang);
        const current = await getTranslation(categoryName, lang);
        await updateTranslation(categoryName, lang, {
          category_translated: categoryTranslated,
          filename_template: current.filename_template,
          alt_template: current.alt_template,
          title_template: current.title_template,
          items: current.items.map((i) => ({ subject_name: i.subject_name, translated_text: i.translated_text })),
          variation_items: current.variation_items.map((i) => ({ variation_text: i.variation_text, translated_text: i.translated_text })),
        });
      }
      await translateSubjects(categoryName, lang);
      await translateVariations(categoryName, lang);
      const refreshed = await getTranslation(categoryName, lang);
      setTranslations((prev) => ({ ...prev, [lang]: refreshed }));
    } catch (err) {
      setError(err instanceof ApiError ? `${lang.toUpperCase()}: ${err.message}` : `Failed to generate ${lang.toUpperCase()}`);
    } finally {
      setBusyLang(null);
    }
  }

  async function generateAll() {
    setGeneratingAll(true);
    const visible = supported.filter((l) => !hiddenLangs.has(l.code));
    for (const lang of visible) {
      await generateLanguage(lang.code);
    }
    setGeneratingAll(false);
  }

  async function handleAddLanguage() {
    const code = newCode.trim().toLowerCase();
    const name = newName.trim();
    if (!code || !name) {
      setError("Both a code and a name are required.");
      return;
    }
    setAddingLang(true);
    setError(null);
    try {
      const lang = await addSupportedLanguage(code, name);
      setSupported((prev) => [...prev, lang].sort((a, b) => a.name.localeCompare(b.name)));
      unhideLang(code);
      setShowAddForm(false);
      setNewCode("");
      setNewName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add language");
    } finally {
      setAddingLang(false);
    }
  }

  if (loading) {
    return (
      <SequencePanel eyebrow="02 / LANGUAGE" title="Prepare your languages">
        <p className="text-sm px-7 py-6" style={{ color: "var(--pencil)" }}>
          Loading...
        </p>
      </SequencePanel>
    );
  }

  const visibleLangs = supported.filter((l) => !hiddenLangs.has(l.code));
  const hiddenList = supported.filter((l) => hiddenLangs.has(l.code));
  const readyCount = visibleLangs.filter((l) => computeCompleteness(translations[l.code], subjects) === "ready").length;

  return (
    <SequencePanel
      eyebrow="02 / LANGUAGE"
      title="Prepare your language templates"
      description="Prepare your publishing metadata in multiple languages. You can generate translations automatically, then review and edit them as needed."
      icon={<WandSparkles size={25} />}
      footer={
        <>
          <span className="text-[10px]" style={{ color: "var(--pencil)" }}>
            {readyCount} of {visibleLangs.length} languages ready
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={generateAll}
              disabled={generatingAll || visibleLangs.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold disabled:opacity-40"
              style={{ border: "1px solid var(--teal)", color: "var(--teal)" }}
            >
              {generatingAll ? "Generating all..." : "Generate all"} <WandSparkles size={14} />
            </button>
            <button
              onClick={onContinue}
              disabled={visibleLangs.length === 0 || readyCount < visibleLangs.length}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: "var(--teal)" }}
            >
              Continue to SEO <ChevronRight size={14} />
            </button>
          </div>
        </>
      }
    >
        <div className="px-6 pt-1 pb-4">
          <p className="text-xs leading-relaxed m-0 mt-3" style={{ maxWidth: 450, color: "var(--pencil)" }}>
            Click a card to review or edit its content.
          </p>
        </div>
      {error && (
        <div className="mx-7 mt-5 px-4 py-3 rounded-md text-sm" style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}>
          {error}
        </div>
      )}

      {(hiddenList.length > 0 || true) && (
        <div className="flex items-center gap-2 flex-wrap px-6 pt-5">
          {hiddenList.map((l) => (
            <button
              key={l.code}
              onClick={() => unhideLang(l.code)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold"
              style={{ border: "1px dashed var(--pencil-light)", color: "var(--pencil)" }}
              title={`Show ${l.name} again`}
            >
              <Plus size={11} /> {l.code.toUpperCase()}
            </button>
          ))}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold"
              style={{ border: "1px dashed var(--teal)", color: "var(--teal)" }}
            >
              <Plus size={11} /> Add language
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="code"
                className="w-16 px-2 py-1.5 rounded-md text-[10px] outline-none"
                style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="name"
                className="w-24 px-2 py-1.5 rounded-md text-[10px] outline-none"
                style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
              />
              <button
                onClick={handleAddLanguage}
                disabled={addingLang}
                className="px-2.5 py-1.5 rounded-md text-[10px] font-bold text-white disabled:opacity-60"
                style={{ background: "var(--teal)" }}
              >
                {addingLang ? "..." : "Add"}
              </button>
              <button onClick={() => setShowAddForm(false)} className="text-[10px]" style={{ color: "var(--pencil)" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {visibleLangs.length === 0 ? (
        <p className="text-sm px-7 py-6" style={{ color: "var(--pencil)" }}>
          No languages shown — bring one back above, or add a new one.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-6">
          {visibleLangs.map((lang) => {
            const completeness = computeCompleteness(translations[lang.code], subjects);
            const busy = busyLang === lang.code;
            const translatedSubjectCount = translations[lang.code]
              ? new Set(translations[lang.code].items.filter((i) => i.translated_text.trim()).map((i) => i.subject_name)).size
              : 0;

            return (
              <div
                key={lang.code}
                className="rounded-lg overflow-hidden relative"
                style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}
              >
                <button
                  onClick={() => hideLang(lang.code)}
                  className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ color: "var(--pencil)" }}
                  title="Remove from this category (doesn't delete the language)"
                >
                  <X size={12} />
                </button>

                <button onClick={() => setModalLang(lang.code)} className="w-full text-left px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between gap-2 pr-6">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="inline-flex items-center justify-center rounded-md text-[10px] font-black uppercase shrink-0"
                        style={{ width: 32, height: 26, background: "var(--teal-tint)", color: "var(--teal-dark)" }}
                      >
                        {lang.code}
                      </span>
                      <span className="font-display font-normal truncate" style={{ fontSize: 16, color: "var(--ink)" }}>
                        {lang.name}
                      </span>
                    </div>
                    <div className="shrink-0">
                      {completeness === "ready" && (
                        <span
                          className="px-2 py-1 rounded-full text-[9px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                          style={{ background: "var(--tone-sage-bg)", color: "var(--tone-sage)" }}
                        >
                          <Check size={10} /> Ready
                        </span>
                      )}
                      {completeness === "partial" && (
                        <span
                          className="px-2 py-1 rounded-full text-[9px] font-bold whitespace-nowrap"
                          style={{ background: "var(--tone-yellow-bg)", color: "var(--tone-yellow)" }}
                        >
                          {translatedSubjectCount}/{subjects.length}
                        </span>
                      )}
                      {completeness === "none" && (
                        <span
                          className="px-2 py-1 rounded-full text-[9px] font-bold whitespace-nowrap"
                          style={{ background: "var(--coral-light)", color: "var(--coral-dark)" }}
                        >
                          Not generated
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 px-4 pb-4">
                  {completeness === "none" ? (
                    <button
                      onClick={() => generateLanguage(lang.code)}
                      disabled={busy}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-bold text-white disabled:opacity-50"
                      style={{ background: "var(--teal)" }}
                    >
                      <WandSparkles size={12} className={busy ? "animate-spin" : ""} /> {busy ? "Generating..." : "Generate"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setModalLang(lang.code)}
                        className="flex-1 py-2 rounded-md text-[11px] font-bold"
                        style={{ border: "1px solid var(--pencil-light)", color: "var(--teal-dark)" }}
                      >
                        Review
                      </button>
                      <button
                        onClick={() => generateLanguage(lang.code)}
                        disabled={busy}
                        title="Fill in any missing content for this language"
                        className="w-9 h-9 flex items-center justify-center rounded-md disabled:opacity-50 shrink-0"
                        style={{ border: "1px solid var(--teal)", color: "var(--teal)" }}
                      >
                        <RotateCw size={13} className={busy ? "animate-spin" : ""} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mx-6 mb-6 rounded-lg flex items-center justify-between gap-4" style={{ padding: "16px 18px", border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
        <div>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
            Next - SEO
          </p>
          <p className="font-display font-normal m-0 mt-1" style={{ fontSize: 17, color: "var(--ink)" }}>
            Tag your images
          </p>
          <p className="text-[11px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
            Translations are ready to review. Continue to create titles and alt text for each selected page.
          </p>
        </div>
        <button
          onClick={onContinue}
          className="inline-flex items-center gap-1 text-[11px] font-medium shrink-0"
          style={{ color: "var(--pencil)" }}
        >
          Continue to SEO <ChevronRight size={12} />
        </button>
      </div>

      {modalLang && (
        <TranslationEditorModal
          categoryName={categoryName}
          bookId={bookId}
          lang={modalLang}
          subjects={subjects}
          variations={variations}
          onClose={async () => {
            const refreshed = await getTranslation(categoryName, modalLang).catch(() => null);
            if (refreshed) setTranslations((prev) => ({ ...prev, [modalLang]: refreshed }));
            setModalLang(null);
          }}
          onSaved={() => {}}
          onDeleted={() => setTranslations((prev) => { const next = { ...prev }; delete next[modalLang]; return next; })}
        />
      )}
    </SequencePanel>
  );
}
