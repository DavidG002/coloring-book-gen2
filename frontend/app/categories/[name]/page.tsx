"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { getCategory, updateCategory, ApiError, type Category } from "@/lib/api";
import GeneratePanel from "@/components/GeneratePanel";
import TranslationsPanel from "@/components/TranslationsPanel";
import SeoPanel from "@/components/SeoPanel";
import PublishPanel from "@/components/PublishPanel";
import TabbedSection from "@/components/TabbedSection";
import CategorySidebar from "@/components/CategorySidebar";
import BulkPasteInput from "@/components/BulkPasteInput";
import ReviewPanel from "@/components/ReviewPanel";
import WordPressPushPanel from "@/components/WordPressPushPanel";
import DeleteCategoryModal from "@/components/DeleteCategoryModal";

const SECTION_ORDER = ["setup", "language", "generate", "publish"] as const;
type SectionId = (typeof SECTION_ORDER)[number];

const SECTION_LABELS: Record<SectionId, string> = {
  setup: "Setup",
  language: "Language",
  generate: "Generate",
  publish: "Publish",
};

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const categoryName = decodeURIComponent(params.name);

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [variations, setVariations] = useState<string[]>([]);

  const [savingSubjects, setSavingSubjects] = useState(false);
  const [savingVariations, setSavingVariations] = useState(false);

  const [openSection, setOpenSection] = useState<SectionId | null>("setup");
  const [savingMessage, setSavingMessage] = useState<{ section: SectionId; text: string } | null>(null);

  const [subjectFilter, setSubjectFilter] = useState("");
  const [variationFilter, setVariationFilter] = useState("");

  const setupRef = useRef<HTMLDivElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const generateRef = useRef<HTMLDivElement>(null);
  const publishRef = useRef<HTMLDivElement>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);



  const [savedSubjectsSnapshot, setSavedSubjectsSnapshot] = useState<string[]>([]);
  const [savedVariationsSnapshot, setSavedVariationsSnapshot] = useState<string[]>([]);

  function getSectionRef(id: SectionId): React.RefObject<HTMLDivElement | null> {
    switch (id) {
      case "setup":
        return setupRef;
      case "language":
        return languageRef;
      case "generate":
        return generateRef;
      case "publish":
        return publishRef;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCategory(categoryName);
        if (cancelled) return;
        setCategory(data);
        setSubjects(data.subjects.map((s) => s.name));
        setSavedSubjectsSnapshot(data.subjects.map((s) => s.name));
        setVariations(data.variations.sort((a, b) => a.order - b.order).map((v) => v.text));
        setSavedVariationsSnapshot(data.variations.sort((a, b) => a.order - b.order).map((v) => v.text));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "Failed to load category");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [categoryName]);

  function goToSection(id: SectionId) {
    setOpenSection(id);
    setTimeout(() => {
      getSectionRef(id).current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function advanceAfterSave(currentSection: SectionId, message: string) {
    setSavingMessage({ section: currentSection, text: message });
    setTimeout(() => {
      setSavingMessage(null);
    }, 1100);
  }

  function updateListItem(list: string[], setList: (v: string[]) => void, index: number, value: string) {
    const next = [...list];
    next[index] = value;
    setList(next);
  }

  function removeListItem(list: string[], setList: (v: string[]) => void, index: number) {
    setList(list.filter((_, i) => i !== index));
  }

  function addListItem(list: string[], setList: (v: string[]) => void) {
    setList([...list, ""]);
  }

  async function handleSaveSubjects() {
    setError(null);
    const clean = subjects.map((s) => s.trim()).filter(Boolean);
    setSavingSubjects(true);
    try {
      const updated = await updateCategory(categoryName, { subjects: clean });
      setCategory(updated);
      setSubjects(updated.subjects.map((s) => s.name));
      setSavedSubjectsSnapshot(updated.subjects.map((s) => s.name));
      advanceAfterSave("setup", "Saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save subjects");
    } finally {
      setSavingSubjects(false);
    }
  }

  async function handleSaveVariations() {
    setError(null);
    const clean = variations.map((v) => v.trim()).filter(Boolean);
    if (clean.length === 0) {
      setError("At least one variation is required.");
      return;
    }
    setSavingVariations(true);
    try {
      const updated = await updateCategory(categoryName, { variations: clean });
      setCategory(updated);
      setVariations(updated.variations.sort((a, b) => a.order - b.order).map((v) => v.text));
      setSavedVariationsSnapshot(updated.variations.sort((a, b) => a.order - b.order).map((v) => v.text));
      advanceAfterSave("setup", "Saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save variations");
    } finally {
      setSavingVariations(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-6xl mx-auto">
        <p style={{ color: "var(--pencil)" }}>Loading...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <p className="text-lg font-display" style={{ color: "var(--ink)" }}>
          Category not found
        </p>
        <p className="mt-2" style={{ color: "var(--pencil)" }}>
          There is no category named &quot;{categoryName}&quot;.
        </p>
        <button
          onClick={() => router.push("/books")}
          className="mt-6 px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--teal)" }}
        >
          Back to categories
        </button>
      </main>
    );
  }

  const subjectsComplete = subjects.filter(Boolean).length > 0;
  const variationsComplete = variations.filter(Boolean).length > 0;

  const sidebarItems = SECTION_ORDER.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    complete:
      id === "setup"
        ? subjectsComplete && variationsComplete
        : id === "generate"
        ? (category?.subjects.length ?? 0) > 0
        : false,
  }));

  const subjectsDirty = JSON.stringify(subjects) !== JSON.stringify(savedSubjectsSnapshot);
  const variationsDirty = JSON.stringify(variations) !== JSON.stringify(savedVariationsSnapshot);

  const subjectsTabContent = (
    <div>
      <div className="flex items-center gap-4 mb-1.5">
        <button
          type="button"
          onClick={() => addListItem(subjects, setSubjects)}
          className="px-3 py-1.5 rounded-full text-sm font-medium border-[1.5px]"
          style={{ borderColor: "var(--teal)", color: "var(--teal)" }}
        >
          + Add subject
        </button>
        <BulkPasteInput
          placeholder={"Car\nTruck\nAirplane\nBoat"}
          onAdd={(lines) => setSubjects((prev) => [...prev.filter(Boolean), ...lines])}
        />
      </div>

      {subjects.length > 8 && (
        <input
          type="text"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          placeholder={`Filter ${subjects.length} subjects...`}
          className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm mb-2"
          style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
        />
      )}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {subjects.map((subject, i) => {
          if (subjectFilter && !subject.toLowerCase().includes(subjectFilter.toLowerCase())) return null;
          return (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={subject}
                onChange={(e) => updateListItem(subjects, setSubjects, i, e.target.value)}
                className="flex-1 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
              />
              <button
                type="button"
                onClick={() => removeListItem(subjects, setSubjects, i)}
                className="px-3 rounded-md text-sm"
                style={{ color: "var(--pencil)" }}
              >
                Remove
              </button>
            </div>
          );
        })}
        {subjects.length === 0 && (
          <p className="text-sm" style={{ color: "var(--pencil)" }}>
            No subjects yet.
          </p>
        )}
        {subjects.length > 0 &&
          subjectFilter &&
          subjects.every((s) => !s.toLowerCase().includes(subjectFilter.toLowerCase())) && (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              No subjects match &quot;{subjectFilter}&quot;.
            </p>
          )}
      </div>
      <div className="flex items-center gap-3 mt-4 pt-4 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
        <button
          onClick={handleSaveSubjects}
          disabled={savingSubjects}
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--teal)" }}
        >
          {savingSubjects ? "Saving..." : "Save subjects"}
        </button>
        {subjectsDirty && (
          <span className="text-xs font-medium" style={{ color: "var(--coral-dark)" }}>
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );

  const variationsTabContent = (
    <div>
      <div className="flex items-center gap-4 mb-1.5">
        <button
          type="button"
          onClick={() => addListItem(variations, setVariations)}
          className="px-3 py-1.5 rounded-full text-sm font-medium border-[1.5px]"
          style={{ borderColor: "var(--teal)", color: "var(--teal)" }}
        >
          + Add variation
        </button>
        <BulkPasteInput
          placeholder={"side view on a road\nfront three-quarter view\naerial top-down view"}
          onAdd={(lines) => setVariations((prev) => [...prev.filter(Boolean), ...lines])}
        />
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
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {variations.map((variation, i) => {
          if (variationFilter && !variation.toLowerCase().includes(variationFilter.toLowerCase())) return null;
          return (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={variation}
                onChange={(e) => updateListItem(variations, setVariations, i, e.target.value)}
                className="flex-1 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
              />
              <button
                type="button"
                onClick={() => removeListItem(variations, setVariations, i)}
                className="px-3 rounded-md text-sm"
                style={{ color: "var(--pencil)" }}
              >
                Remove
              </button>
            </div>
          );
        })}
        {variations.length > 0 &&
          variationFilter &&
          variations.every((v) => !v.toLowerCase().includes(variationFilter.toLowerCase())) && (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              No variations match &quot;{variationFilter}&quot;.
            </p>
          )}
      </div>
      <div className="flex items-center gap-3 mt-4 pt-4 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
        <button
          onClick={handleSaveVariations}
          disabled={savingVariations}
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--teal)" }}
        >
          {savingVariations ? "Saving..." : "Save variations"}
        </button>
        {variationsDirty && (
          <span className="text-xs font-medium" style={{ color: "var(--coral-dark)" }}>
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );

  
  return (
    <main className="min-h-screen px-8 py-12 max-w-6xl mx-auto">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/books")}
            className="text-sm mb-3 inline-block"
            style={{ color: "var(--pencil)" }}
          >
            {"\u2190"} Back to books
          </button>
          <h1 className="text-3xl font-display font-semibold capitalize" style={{ color: "var(--ink)" }}>
            {categoryName}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--pencil)" }}>
            {category?.subjects.length ?? 0} subjects, {category?.variations.length ?? 0} pose variations
          </p>
          {category && (
            <Link
              href={`/books/${category.book_id}`}
              className="inline-block mt-1.5 text-sm font-medium"
              style={{ color: "var(--teal)" }}
            >
              Part of book: {category.book_name} {"\u2192"}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          {category && (
            <Link
              href={`/books/${category.book_id}/settings`}
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{ color: "var(--pencil)", border: "1.5px solid var(--pencil-light)" }}
            >
              Book Settings
            </Link>
          )}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ color: "var(--coral-dark)", border: "1.5px solid var(--coral)" }}
          >
            Delete category
          </button>
        </div>
      </header>
      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-md text-sm"
          style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <div className="flex gap-6 items-start">
        <CategorySidebar
          items={sidebarItems}
          activeId={openSection}
          onSelect={(id) => goToSection(id as SectionId)}
        />

        <div className="flex-1 min-w-0 space-y-4">
          <TabbedSection
            id="setup"
            title="Setup"
            isOpen={openSection === "setup"}
            onToggle={() => setOpenSection(openSection === "setup" ? null : "setup")}
            savingMessage={savingMessage?.section === "setup" ? savingMessage.text : null}
            ref={setupRef}
            tabs={[
              { id: "subjects", label: "Subjects", complete: subjectsComplete, content: subjectsTabContent },
              { id: "variations", label: "Variations", complete: variationsComplete, content: variationsTabContent },
            ]}
          />

          <TabbedSection
            id="language"
            title="Language"
            isOpen={openSection === "language"}
            onToggle={() => setOpenSection(openSection === "language" ? null : "language")}
            ref={languageRef}
            tabs={[
              {
                id: "translations",
                label: "Translations",
                content: category ? (
                  <TranslationsPanel
                    categoryName={categoryName}
                    bookId={category.book_id}
                    subjects={category.subjects}
                    variations={category.variations}
                  />
                ) : null,
              },
              {
                id: "seo",
                label: "SEO",
                content: <SeoPanel categoryName={categoryName} />,
              },
            ]}
          />

          <TabbedSection
            id="generate"
            title="Generate"
            isOpen={openSection === "generate"}
            onToggle={() => setOpenSection(openSection === "generate" ? null : "generate")}
            ref={generateRef}
            tabs={[
              {
                id: "generate-tab",
                label: "Generate",
                content: category ? (
                  <GeneratePanel categoryName={categoryName} subjects={category.subjects} />
                ) : null,
              },
              {
                id: "review-tab",
                label: "Review",
                content: <ReviewPanel categoryName={categoryName} />,
              },
            ]}
          />

          <TabbedSection
            id="publish"
            title="Publish"
            isOpen={openSection === "publish"}
            onToggle={() => setOpenSection(openSection === "publish" ? null : "publish")}
            ref={publishRef}
            tabs={[
              {
                id: "local-publish",
                label: "Local",
                content: <PublishPanel categoryName={categoryName} />,
              },
              {
                id: "wordpress-publish",
                label: "WordPress",
                content: <WordPressPushPanel categoryName={categoryName} />,
              },
            ]}
          />
        </div>
      </div>

      {showDeleteModal && category && (
        <DeleteCategoryModal
          categoryName={categoryName}
          bookId={category.book_id}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </main>
  );
}
