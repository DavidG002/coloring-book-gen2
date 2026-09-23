"use client";

import { useState, useEffect } from "react";
import { WandSparkles, RotateCw, Check, X, Plus, ChevronRight, Info, Pencil } from "lucide-react";
import SequencePanel from "./SequencePanel";
import TranslationEditorModal from "./TranslationEditorModal";
import {
  getSupportedLanguages,
  addSupportedLanguage,
  getTranslations,
  getTranslation,
  createTranslation,
  updateTranslation,
  getAuthHeaders,
  ApiError,
  type SupportedLanguage,
  type Subject,
  type Variation,
  type Translation,
} from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getLanguageTemplateDefault(bookId: number, lang: string) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/language-templates/${encodeURIComponent(lang)}`, {
    headers: await getAuthHeaders(),
  });
  if (res.status === 404) return null;
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data as { filename_template: string; alt_template: string; title_template: string };
}
async function autoTranslateLanguageTemplate(bookId: number, lang: string) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/language-templates/${encodeURIComponent(lang)}/auto-translate`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data as { filename_template: string; alt_template: string; title_template: string };
}
async function translateCategoryName(categoryId: number, lang: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/categories/${categoryId}/translations/${encodeURIComponent(lang)}/translate-category-name`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data.translated_text as string;
}
async function translateSubjects(categoryId: number, lang: string) {
  const res = await fetch(`${API_BASE_URL}/categories/${categoryId}/translations/${encodeURIComponent(lang)}/translate-subjects`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data.translated_count as number;
}
async function translateVariations(categoryId: number, lang: string) {
  const res = await fetch(`${API_BASE_URL}/categories/${categoryId}/translations/${encodeURIComponent(lang)}/translate-variations`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data.translated_count as number;
}

interface SubjectTagStatus {
  subject_id: number;
  subject_name: string;
  translated_text: string;
  live: boolean;
  wp_term_id: number | null;
  live_name: string | null;
  live_slug: string | null;
  live_count: number;
  out_of_sync: boolean;
}
interface SubjectTagsResponse {
  configured: boolean;
  site_url: string | null;
  subjects: SubjectTagStatus[];
}
async function getSubjectTags(categoryId: number, lang: string): Promise<SubjectTagsResponse> {
  const res = await fetch(`${API_BASE_URL}/wordpress/subject-tags?category_id=${categoryId}&lang=${encodeURIComponent(lang)}`, {
    headers: await getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data;
}
function langHasTagIssue(entries: SubjectTagStatus[] | undefined): boolean {
  if (!entries) return false;
  return entries.some((e) => e.out_of_sync || !e.live);
}
function sortLangCodesByTagStatus(byLang: Record<string, SubjectTagStatus[]>, codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const aIssue = langHasTagIssue(byLang[a]);
    const bIssue = langHasTagIssue(byLang[b]);
    if (aIssue !== bIssue) return aIssue ? -1 : 1;
    return a.localeCompare(b);
  });
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
  categoryId,
  categoryName,
  bookId,
  subjects,
  variations,
  onContinue,
  onTranslationsChanged,
  onTagSynced,
  languagesNeedingSeoReview,
  onReviewLanguage,
}: {
  categoryId: number;
  categoryName: string;
  bookId: number;
  subjects: Subject[];
  variations: Variation[];
  onContinue: () => void;
  onTranslationsChanged?: () => void;
  onTagSynced?: () => void;
  languagesNeedingSeoReview?: string[];
  onReviewLanguage?: (lang: string) => void;
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

  const [subjectTags, setSubjectTags] = useState<Record<string, SubjectTagStatus[]>>({});
  const [subjectTagsConfigured, setSubjectTagsConfigured] = useState(false);
  const [subjectTagsSiteUrl, setSubjectTagsSiteUrl] = useState<string | null>(null);
  const [subjectTagsLoading, setSubjectTagsLoading] = useState(false);
  const [tagsLangView, setTagsLangView] = useState<string | null>(null);
  const [syncingSubjectId, setSyncingSubjectId] = useState<number | null>(null);
  const [tagSyncResult, setTagSyncResult] = useState<Record<number, string>>({});
  const [updateSlugFor, setUpdateSlugFor] = useState<Record<number, boolean>>({});
  const [recentlyChangedSubjectIds, setRecentlyChangedSubjectIds] = useState<Set<number>>(new Set());
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editingSubjectText, setEditingSubjectText] = useState("");
  const [inlineSavingSubjectId, setInlineSavingSubjectId] = useState<number | null>(null);

  const hiddenKey = `hidden-langs-${categoryName}`;

  function load() {
    setLoading(true);
    Promise.all([getSupportedLanguages(), getTranslations(categoryId)])
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
  }, [categoryId]);

   useEffect(() => {
      const activeCodes = supported.filter((l) => !hiddenLangs.has(l.code)).map((l) => l.code);
      if (activeCodes.length === 0) {
        setSubjectTagsConfigured(false);
        setSubjectTags({});
        return;
      }
      let cancelled = false;
      setSubjectTagsLoading(true);
      Promise.all(
        activeCodes.map((code) =>
          getSubjectTags(categoryId, code)
            .then((data) => [code, data] as const)
            .catch(() => [code, null] as const)
        )
      )
        .then((entries) => {
          if (cancelled) return;
          const byLang: Record<string, SubjectTagStatus[]> = {};
          let configured = false;
          let siteUrl: string | null = null;
          for (const [code, data] of entries) {
            if (!data) continue;
            if (data.configured) {
              configured = true;
              siteUrl = data.site_url;
            }
            byLang[code] = data.subjects;
          }
          setSubjectTags(byLang);
          setSubjectTagsConfigured(configured);
          setSubjectTagsSiteUrl(siteUrl);
          setTagsLangView((prev) => (prev && activeCodes.includes(prev) ? prev : sortLangCodesByTagStatus(byLang, activeCodes)[0] ?? null));
        })
        .finally(() => {
          if (!cancelled) setSubjectTagsLoading(false);
        });
      return () => {
        cancelled = true;
      };

    }, [categoryId, supported, hiddenLangs]);

    async function refreshSubjectTagsForLang(lang: string, opts?: { switchTo?: boolean }) {
      try {
        const data = await getSubjectTags(categoryId, lang);
        setSubjectTags((prev) => {
          const prevEntries = prev[lang] ?? [];
          const changedIds = new Set<number>();
          for (const entry of data.subjects) {
            const prevEntry = prevEntries.find((e) => e.subject_id === entry.subject_id);
            if (!prevEntry || prevEntry.translated_text !== entry.translated_text) {
              changedIds.add(entry.subject_id);
            }
          }
          if (changedIds.size > 0) {
            setRecentlyChangedSubjectIds(changedIds);
            setTimeout(() => setRecentlyChangedSubjectIds(new Set()), 6000);
          }
          return { ...prev, [lang]: data.subjects };
        });
        if (data.configured) {
          setSubjectTagsConfigured(true);
          setSubjectTagsSiteUrl(data.site_url);
        }
        if (opts?.switchTo) {
          setTagsLangView(lang);
        }
      } catch {
        // best-effort — Tags section just won't refresh this time
      }
    }

    async function handleInlineSaveSubjectTranslation(subjectId: number, subjectName: string, lang: string, newText: string) {
      setInlineSavingSubjectId(subjectId);
      try {
        const current = await getTranslation(categoryId, lang);
        const hasItem = current.items.some((i) => i.subject_name === subjectName);
        const nextItems = hasItem
          ? current.items.map((i) => ({
              subject_name: i.subject_name,
              translated_text: i.subject_name === subjectName ? newText : i.translated_text,
            }))
          : [...current.items.map((i) => ({ subject_name: i.subject_name, translated_text: i.translated_text })), { subject_name: subjectName, translated_text: newText }];
        await updateTranslation(categoryId, lang, {
          category_translated: current.category_translated,
          filename_template: current.filename_template,
          alt_template: current.alt_template,
          title_template: current.title_template,
          items: nextItems,
          variation_items: current.variation_items.map((i) => ({ variation_text: i.variation_text, translated_text: i.translated_text })),
        });
        const refreshedTranslation = await getTranslation(categoryId, lang).catch(() => null);
        if (refreshedTranslation) setTranslations((prev) => ({ ...prev, [lang]: refreshedTranslation }));
        await refreshSubjectTagsForLang(lang);
        setEditingSubjectId(null);
        onTranslationsChanged?.();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to save translation");
      } finally {
        setInlineSavingSubjectId(null);
      }
    }

    

    async function handleSyncSubjectTag(subjectId: number, newName: string) {
      if (!tagsLangView) return;
      setSyncingSubjectId(subjectId);
      setTagSyncResult((prev) => ({ ...prev, [subjectId]: "" }));
      try {
        const res = await fetch(`${API_BASE_URL}/wordpress/rename-subject-tag`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
          body: JSON.stringify({
            subject_id: subjectId,
            lang: tagsLangView,
            new_name: newName,
            update_slug: !!updateSlugFor[subjectId],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to update WordPress tag");
        setTagSyncResult((prev) => ({ ...prev, [subjectId]: data.renamed ? "✓ Synced" : data.reason || "Nothing to update" }));
        if (data.renamed) {
          setSubjectTags((prev) => ({
            ...prev,
            [tagsLangView]: (prev[tagsLangView] ?? []).map((e) =>
              e.subject_id === subjectId ? { ...e, live_name:newName, out_of_sync: false } : e
            ),
          }));
          if (data.flagged_variants > 0) {
            onTagSynced?.();
          }
        }
      } catch (err) {
        setTagSyncResult((prev) => ({ ...prev, [subjectId]: err instanceof Error ? err.message : "Failed to sync" }));
      } finally {
        setSyncingSubjectId(null);
        setTimeout(() => setTagSyncResult((prev) => ({ ...prev, [subjectId]: "" })), 5000);
      }
    }

    function persistHidden(next: Set<string>) {
    setHiddenLangs(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(hiddenKey, JSON.stringify(Array.from(next)));
    }
  }

  async function hideLang(code: string) {
    persistHidden(new Set(hiddenLangs).add(code));
    try {
      await fetch(`${API_BASE_URL}/categories/${categoryId}/translations/${code}/set-active?active=false`, {
        method: "POST",
        headers: await getAuthHeaders(),
      });
    } catch {
      // best-effort — local hide still works even if the sync fails
    }
  }
  async function unhideLang(code: string) {
    const next = new Set(hiddenLangs);
    next.delete(code);
    persistHidden(next);
    try {
      await fetch(`${API_BASE_URL}/categories/${categoryId}/translations/${code}/set-active?active=true`, {
        method: "POST",
        headers: await getAuthHeaders(),
      });
    } catch {
      // best-effort
    }
  }

  async function generateLanguage(lang: string) {
    setBusyLang(lang);
    setError(null);
    try {
      const exists = !!translations[lang];
      if (!exists) {
        let templates = await getLanguageTemplateDefault(bookId, lang);
        if (!templates) templates = await autoTranslateLanguageTemplate(bookId, lang);
        const categoryTranslated = await translateCategoryName(categoryId, lang);
        await createTranslation(categoryId, {
          lang,
          category_translated: categoryTranslated,
          filename_template: templates.filename_template,
          alt_template: templates.alt_template,
          title_template: templates.title_template,
          items: [],
          variation_items: [],
        });
      } else {
        const categoryTranslated = await translateCategoryName(categoryId, lang);
        const current = await getTranslation(categoryId, lang);
        await updateTranslation(categoryId, lang, {
          category_translated: categoryTranslated,
          filename_template: current.filename_template,
          alt_template: current.alt_template,
          title_template: current.title_template,
          items: current.items.map((i) => ({ subject_name: i.subject_name, translated_text: i.translated_text })),
          variation_items: current.variation_items.map((i) => ({ variation_text: i.variation_text, translated_text: i.translated_text })),
        });
      }
      await translateSubjects(categoryId, lang);
      await translateVariations(categoryId, lang);
      const refreshed = await getTranslation(categoryId, lang);
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
        <div className="mx-6 mb-6 rounded-lg" style={{ padding: "16px 18px", border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                Next - SEO
              </p>
              <p className="font-display font-normal m-0 mt-1" style={{ fontSize: 17, color: "var(--ink)" }}>
                Subject Tags
              </p>
              <p className="text-[11px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
                Review your live tags below, and update them anytime. 
              </p>
              {languagesNeedingSeoReview && languagesNeedingSeoReview.length > 0 && (
                <div
                  className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium flex-wrap"
                  style={{ background: "#fbf0da", color: "#9c6f1f", width: "fit-content" }}
                >
                  <span>SEO content needs review in {languagesNeedingSeoReview.map((l) => l.toUpperCase()).join(", ")}</span>
                  {languagesNeedingSeoReview.map((l) => (
                    <button
                      key={l}
                      onClick={() => onReviewLanguage?.(l)}
                      className="underline font-bold"
                      style={{ color: "#9c6f1f" }}
                    >
                      Review {l.toUpperCase()} →
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onContinue}
              className="inline-flex items-center gap-1 text-[11px] font-medium shrink-0"
              style={{ color: "var(--pencil)" }}
            >
              Continue to SEO <ChevronRight size={12} />
            </button>
          </div>

          {subjectTagsConfigured && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
              <p className="text-[10px] uppercase font-bold m-0 mb-2.5" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                {subjectTagsSiteUrl} / Tags
              </p>

              <div className="flex items-center gap-2 flex-wrap mb-3">
                {sortLangCodesByTagStatus(subjectTags, Object.keys(subjectTags)).map((code) => {
                  const entries = subjectTags[code] ?? [];
                  const hasOutOfSync = entries.some((e) => e.out_of_sync);
                  const hasNew = entries.some((e) => !e.live);
                  return (
                    <button
                      key={code}
                      onClick={() => setTagsLangView(code)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase"
                      style={{
                        background: "var(--canvas)",
                        color: "var(--pencil)",
                        outline: tagsLangView === code ? "2px solid var(--ink)" : "none",
                        outlineOffset: 1,
                      }}
                    >
                      {hasOutOfSync && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#9c6f1f" }} />}
                      {!hasOutOfSync && hasNew && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--teal)" }} />}
                      {code}
                    </button>
                  );
                })}
                {subjectTagsLoading && (
                  <span className="text-[10px]" style={{ color: "var(--pencil)" }}>Loading...</span>
                )}
              </div>

              {tagsLangView && (subjectTags[tagsLangView]?.length ?? 0) > 0 ? (
                <div className="space-y-1.5">
                  {subjectTags[tagsLangView].map((entry) => (
                    <div
                      key={entry.subject_id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md"
                      style={{
                        background: "var(--canvas)",
                        outline: recentlyChangedSubjectIds.has(entry.subject_id) ? "2px solid var(--teal)" : "none",
                        outlineOffset: 1,
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        {editingSubjectId === entry.subject_id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={editingSubjectText}
                              onChange={(e) => setEditingSubjectText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleInlineSaveSubjectTranslation(entry.subject_id, entry.subject_name, tagsLangView!, editingSubjectText.trim());
                                if (e.key === "Escape") setEditingSubjectId(null);
                              }}
                              className="px-2 py-1 rounded-md text-xs outline-none flex-1"
                              style={{ border: "1px solid var(--teal)", background: "var(--paper)" }}
                            />
                            <button
                              onClick={() => handleInlineSaveSubjectTranslation(entry.subject_id, entry.subject_name, tagsLangView!, editingSubjectText.trim())}
                              disabled={inlineSavingSubjectId === entry.subject_id}
                              className="text-[10px] font-bold shrink-0 disabled:opacity-50"
                              style={{ color: "var(--teal)" }}
                            >
                              {inlineSavingSubjectId === entry.subject_id ? "..." : "Save"}
                            </button>
                            <button onClick={() => setEditingSubjectId(null)} className="text-[10px] shrink-0" style={{ color: "var(--pencil)" }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium capitalize" style={{ color: "var(--ink)" }}>
                              {entry.translated_text || entry.subject_name}
                            </span>
                            <button
                              onClick={() => {
                                setEditingSubjectId(entry.subject_id);
                                setEditingSubjectText(entry.translated_text || entry.subject_name);
                              }}
                              className="shrink-0"
                              style={{ color: "var(--pencil)" }}
                              title="Edit this subject's translation"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                        {entry.out_of_sync && (
                          <span className="block text-[10px] mt-0.5" style={{ color: "#9c6f1f" }}>
                            Live tag reads &quot;{entry.live_name}&quot; — doesn&apos;t match current translation
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.live ? (
                          entry.out_of_sync ? (
                            <div className="flex flex-col items-end gap-1">
                              <label className="flex items-center gap-1.5 text-[9px]" style={{ color: "var(--pencil)" }}>
                                <input
                                  type="checkbox"
                                  checked={!!updateSlugFor[entry.subject_id]}
                                  onChange={(e) =>
                                    setUpdateSlugFor((prev) => ({ ...prev, [entry.subject_id]: e.target.checked }))
                                  }
                                  className="w-3 h-3"
                                />
                                Update tag archive page URL
                                <span
                                  className="inline-flex shrink-0"
                                  title={`Only changes the /tag/... listing page's own URL (its "slug"). Your ${entry.live_count} published coloring page${entry.live_count === 1 ? "" : "s"} and their individual URLs are never affected either way.`}
                                >
                                  <Info size={11} style={{ color: "var(--pencil)" }} />
                                </span>
                              </label>
                              <button
                                onClick={() => handleSyncSubjectTag(entry.subject_id, entry.translated_text)}
                                disabled={syncingSubjectId === entry.subject_id}
                                className="px-2 py-1 rounded-md text-[10px] font-bold disabled:opacity-50"
                                style={{ border: "1px solid #9c6f1f", color: "#9c6f1f" }}
                              >
                                {syncingSubjectId === entry.subject_id ? "Syncing..." : "Sync"}
                              </button>
                            </div>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-[9px] font-bold" style={{ background: "var(--tone-sage-bg)", color: "var(--tone-sage)" }}>
                              Live
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[9px] font-bold" style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}>
                            New
                          </span>
                        )}
                        {tagSyncResult[entry.subject_id] && (
                          <span className="text-[10px]" style={{ color: tagSyncResult[entry.subject_id].startsWith("✓") ? "var(--teal)" : "var(--coral-dark)" }}>
                            {tagSyncResult[entry.subject_id]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] m-0" style={{ color: "var(--pencil)" }}>
                  No subjects yet for this language.
                </p>
              )}
            </div>
          )}
        </div>

      {modalLang && (
        <TranslationEditorModal
          categoryId={categoryId}
          bookId={bookId}
          lang={modalLang}
          subjects={subjects}
          variations={variations}
            onClose={async () => {
              const refreshed = await getTranslation(categoryId, modalLang).catch(() => null);
              if (refreshed) setTranslations((prev) => ({ ...prev, [modalLang]: refreshed }));
              await refreshSubjectTagsForLang(modalLang, { switchTo: true });
              setModalLang(null);
              onTranslationsChanged?.();
            }}
          onSaved={() => {}}
          onDeleted={() => setTranslations((prev) => { const next = { ...prev }; delete next[modalLang]; return next; })}
        />
      )}
    </SequencePanel>
  );
}
