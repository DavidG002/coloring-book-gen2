"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { getCategory, updateCategory, ApiError, type Category } from "@/lib/api";
import GeneratePanel from "@/components/GeneratePanel";
import TranslationsPanel from "@/components/TranslationsPanel";
import SeoPanel from "@/components/SeoPanel";
import PublishPanel from "@/components/PublishPanel";
import CollapsibleSection from "@/components/CollapsibleSection";
import CategorySidebar from "@/components/CategorySidebar";
import BulkPasteInput from "@/components/BulkPasteInput";
import ReviewPanel from "@/components/ReviewPanel";
import WordPressPushPanel from "@/components/WordPressPushPanel";
import DeleteCategoryModal from "@/components/DeleteCategoryModal";

const SECTION_ORDER = ["subjects", "variations", "generate", "review", "translations","seo", "publish", "wordpress"] as const;
type SectionId = (typeof SECTION_ORDER)[number];

const SECTION_LABELS: Record<SectionId, string> = {
  subjects: "Subjects",
  variations: "Variations",
  generate: "Generate",
  review: "Review",
  translations: "Translations",
  seo: "SEO",
  publish: "Publish",
  wordpress: "WordPress", 
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


  const [openSection, setOpenSection] = useState<SectionId | null>("subjects");
  const [savingMessage, setSavingMessage] = useState<{ section: SectionId; text: string } | null>(null);

  const [subjectFilter, setSubjectFilter] = useState("");
  const [variationFilter, setVariationFilter] = useState("");

  const subjectsRef = useRef<HTMLDivElement>(null);
  const variationsRef = useRef<HTMLDivElement>(null);
  const generateRef = useRef<HTMLDivElement>(null);
  const translationsRef = useRef<HTMLDivElement>(null);
  const publishRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const wordpressRef = useRef<HTMLDivElement>(null);
  const seoRef = useRef<HTMLDivElement>(null);

  function getSectionRef(id: SectionId): React.RefObject<HTMLDivElement | null> {
    switch (id) {
      case "subjects":
        return subjectsRef;
      case "variations":
        return variationsRef;
      case "generate":
        return generateRef;
      case "translations":
        return translationsRef;
      case "seo":
        return seoRef;  
      case "publish":
        return publishRef;
      case "review":
        return reviewRef;
      case "wordpress":
      return wordpressRef;
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
        setVariations(data.variations.sort((a, b) => a.order - b.order).map((v) => v.text));
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
    const currentIndex = SECTION_ORDER.indexOf(currentSection);
    const nextSection = SECTION_ORDER[currentIndex + 1];
    setTimeout(() => {
      setSavingMessage(null);
      if (nextSection) goToSection(nextSection);
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
      advanceAfterSave("subjects", "Saved — moving to Variations");
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
      advanceAfterSave("variations", "Saved — moving to Generate");
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

  const sidebarItems = SECTION_ORDER.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    complete:
      id === "subjects"
        ? subjects.filter(Boolean).length > 0
        : id === "variations"
        ? variations.filter(Boolean).length > 0
        : id === "generate"
        ? (category?.subjects.length ?? 0) > 0
        : false,
  }));

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
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 rounded-md text-sm font-medium"
          style={{ color: "var(--coral-dark)", border: "1.5px solid var(--coral)" }}
        >
          Delete category
        </button>
      </header>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-md text-sm"
          style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      {category && (
        <Link
          href={`/books/${category.book_id}`}
          className="inline-block mb-3 text-sm font-medium"
          style={{ color: "var(--teal)" }}
        >
          Part of book: {category.book_name} {"\u2192"}
        </Link>
      )}

      <div className="flex gap-6 items-start">
        <CategorySidebar
          items={sidebarItems}
          activeId={openSection}
          onSelect={(id) => goToSection(id as SectionId)}
        />

        <div className="flex-1 min-w-0 space-y-4">
          <CollapsibleSection
            id="subjects"
            title="Subjects"
            isOpen={openSection === "subjects"}
            onToggle={() => setOpenSection(openSection === "subjects" ? null : "subjects")}
            complete={subjects.filter(Boolean).length > 0}
            savingMessage={savingMessage?.section === "subjects" ? savingMessage.text : null}
            ref={subjectsRef}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => addListItem(subjects, setSubjects)}
                  className="text-sm font-medium"
                  style={{ color: "var(--teal)" }}
                >
                  + Add subject
                </button>
                <BulkPasteInput
                  placeholder={"Car\nTruck\nAirplane\nBoat"}
                  onAdd={(lines) => setSubjects((prev) => [...prev.filter(Boolean), ...lines])}
                />
              </div>
              <button
                onClick={handleSaveSubjects}
                disabled={savingSubjects}
                className="text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--teal)" }}
              >
                {savingSubjects ? "Saving..." : "Save & continue"}
              </button>
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
              {subjects.length > 0 && subjectFilter && subjects.every((s) => !s.toLowerCase().includes(subjectFilter.toLowerCase())) && (
                <p className="text-sm" style={{ color: "var(--pencil)" }}>
                  No subjects match &quot;{subjectFilter}&quot;.
                </p>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="variations"
            title="Variations"
            isOpen={openSection === "variations"}
            onToggle={() => setOpenSection(openSection === "variations" ? null : "variations")}
            complete={variations.filter(Boolean).length > 0}
            savingMessage={savingMessage?.section === "variations" ? savingMessage.text : null}
            ref={variationsRef}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => addListItem(variations, setVariations)}
                  className="text-sm font-medium"
                  style={{ color: "var(--teal)" }}
                >
                  + Add variation
                </button>
                <BulkPasteInput
                  placeholder={"side view on a road\nfront three-quarter view\naerial top-down view"}
                  onAdd={(lines) => setVariations((prev) => [...prev.filter(Boolean), ...lines])}
                />
              </div>
              <button
                onClick={handleSaveVariations}
                disabled={savingVariations}
                className="text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--teal)" }}
              >
                {savingVariations ? "Saving..." : "Save & continue"}
              </button>
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
              {variations.length > 0 && variationFilter && variations.every((v) => !v.toLowerCase().includes(variationFilter.toLowerCase())) && (
                <p className="text-sm" style={{ color: "var(--pencil)" }}>
                  No variations match &quot;{variationFilter}&quot;.
                </p>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="generate"
            title="Generate"
            isOpen={openSection === "generate"}
            onToggle={() => setOpenSection(openSection === "generate" ? null : "generate")}
            ref={generateRef}
          >
            {category && <GeneratePanel categoryName={categoryName} subjects={category.subjects} />}
          </CollapsibleSection>

          <CollapsibleSection
            id="review"
            title="Review"
            isOpen={openSection === "review"}
            onToggle={() => setOpenSection(openSection === "review" ? null : "review")}
            ref={reviewRef}
          >
            <ReviewPanel categoryName={categoryName} />
          </CollapsibleSection>

          <CollapsibleSection
            id="translations"
            title="Translations"
            isOpen={openSection === "translations"}
            onToggle={() => setOpenSection(openSection === "translations" ? null : "translations")}
            ref={translationsRef}
          >
            {category && (
              <TranslationsPanel
                categoryName={categoryName}
                bookId={category.book_id}
                subjects={category.subjects}
                variations={category.variations}
              />
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id="seo"
            title="SEO"
            isOpen={openSection === "seo"}
            onToggle={() => setOpenSection(openSection === "seo" ? null : "seo")}
            ref={seoRef}
          >
            <SeoPanel categoryName={categoryName} />
          </CollapsibleSection>

          <CollapsibleSection
            id="publish"
            title="Publish"
            isOpen={openSection === "publish"}
            onToggle={() => setOpenSection(openSection === "publish" ? null : "publish")}
            ref={publishRef}
          >
            {category && <PublishPanel categoryName={categoryName} />}
          </CollapsibleSection>

          <CollapsibleSection
            id="wordpress"
            title="WordPress"
            isOpen={openSection === "wordpress"}
            onToggle={() => setOpenSection(openSection === "wordpress" ? null : "wordpress")}
            ref={wordpressRef}
          >
            <WordPressPushPanel categoryName={categoryName} />
          </CollapsibleSection>
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
